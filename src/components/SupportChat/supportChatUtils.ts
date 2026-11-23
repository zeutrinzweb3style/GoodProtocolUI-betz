/**
 * Pure helpers for the on-chain support chat. No React, no network, no ethers -
 * everything here is deterministic so it can be unit tested.
 */

export const MAX_MESSAGE_BYTES = 1000
export const POST_COOLDOWN_SECONDS = 15
export const MESSAGES_POLL_MS = 15000
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
export const DEFAULT_SCAN_WINDOW_BLOCKS = 6000
export const MAX_SCAN_CHUNKS = 4
export const ESTIMATE_SAMPLE = 'x'.repeat(200)
export const CELO_CHAIN_ID = 42220
export const CELO_CHAIN_ID_HEX = '0xa4ec'

export interface SupportChatMessage {
    id: number
    author: string
    text: string
    timestamp: number
}

export interface ValidationResult {
    ok: boolean
    error?: string
}

export interface ScanWindow {
    fromBlock: number
    toBlock: number
    ranges: Array<[number, number]>
}

export interface RawLog {
    topics: string[]
    data: string
    blockNumber?: string
    transactionHash?: string
}

export const ERROR_MESSAGES = {
    empty: 'Write a short message first.',
    tooLong: `Messages are limited to ${MAX_MESSAGE_BYTES} bytes.`,
    noWallet: 'Connect a wallet to post a message.',
    noContract: 'The support chat is not configured yet.',
    lowBalance: 'Not enough CELO for the network fee. Use Telegram instead - it is free.',
    cooldown: 'Please wait a few seconds before posting again.',
    rejected: 'Transaction cancelled. Nothing was charged.',
    failed: 'Could not send the message. Nothing was charged.',
}

export const utf8ByteLength = (value: string): number => {
    const text = String(value ?? '')
    let bytes = 0

    for (let index = 0; index < text.length; index += 1) {
        const code = text.charCodeAt(index)

        if (code < 0x80) {
            bytes += 1
        } else if (code < 0x800) {
            bytes += 2
        } else if (code >= 0xd800 && code <= 0xdbff) {
            bytes += 4
            index += 1
        } else {
            bytes += 3
        }
    }

    return bytes
}

export const sanitizeMessage = (value: string): string =>
    String(value ?? '')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
        .replace(/\r\n?/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()

export const validateMessage = (value: string): ValidationResult => {
    const text = sanitizeMessage(value)

    if (!text) {
        return { ok: false, error: ERROR_MESSAGES.empty }
    }

    if (utf8ByteLength(text) > MAX_MESSAGE_BYTES) {
        return { ok: false, error: ERROR_MESSAGES.tooLong }
    }

    return { ok: true }
}

export const isContractAddress = (value?: string | null): boolean => {
    if (!value) {
        return false
    }

    const address = String(value).trim().toLowerCase()

    return /^0x[0-9a-f]{40}$/.test(address) && address !== ZERO_ADDRESS
}

const WEI_PER_CELO = BigInt(10) ** BigInt(18)

export const formatCeloFromWei = (wei: bigint): string => {
    const negative = wei < BigInt(0)
    const absolute = negative ? -wei : wei
    const whole = absolute / WEI_PER_CELO
    const fraction = (absolute % WEI_PER_CELO).toString().padStart(18, '0').slice(0, 4).replace(/0+$/, '')
    const sign = negative ? '-' : ''

    return `${sign}${whole.toString()}${fraction ? `.${fraction}` : ''}`
}

export const estimateCostWei = (gasPriceWei: bigint, gasLimit: bigint): bigint => gasPriceWei * gasLimit

export const isBalanceTooLow = (balanceWei: bigint, costWei: bigint): boolean => balanceWei < costWei

export const resolveScanWindow = ({
    headBlock,
    deployBlock = 0,
    windowBlocks = DEFAULT_SCAN_WINDOW_BLOCKS,
    maxChunks = MAX_SCAN_CHUNKS,
}: {
    headBlock: number
    deployBlock?: number
    windowBlocks?: number
    maxChunks?: number
}): ScanWindow => {
    const safeHead = Number.isFinite(headBlock) ? Math.max(0, Math.floor(headBlock)) : 0
    const floor = Number.isFinite(deployBlock) && deployBlock > 0 ? Math.floor(deployBlock) : 0
    const safeWindow =
        Number.isFinite(windowBlocks) && windowBlocks > 0 ? Math.floor(windowBlocks) : DEFAULT_SCAN_WINDOW_BLOCKS
    const chunks = Number.isFinite(maxChunks) && maxChunks > 0 ? Math.floor(maxChunks) : MAX_SCAN_CHUNKS
    const fromBlock = Math.max(floor, safeHead - safeWindow + 1)
    const span = safeHead - fromBlock + 1
    const chunkSize = Math.max(1, Math.ceil(span / chunks))
    const ranges: Array<[number, number]> = []

    for (let start = fromBlock; start <= safeHead; start += chunkSize) {
        ranges.push([start, Math.min(safeHead, start + chunkSize - 1)])
    }

    return { fromBlock, toBlock: safeHead, ranges }
}

const hexToBytes = (hex: string): Uint8Array => {
    const clean = hex.length % 2 === 0 ? hex : `${hex}0`
    const bytes = new Uint8Array(clean.length / 2)

    for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = parseInt(clean.slice(index * 2, index * 2 + 2), 16)
    }

    return bytes
}

const decodeUtf8 = (hex: string): string => {
    if (!hex) {
        return ''
    }

    try {
        return new TextDecoder().decode(hexToBytes(hex))
    } catch (error) {
        return ''
    }
}

const wordAt = (data: string, index: number): string => data.slice(index * 64, index * 64 + 64)

// JSON-RPC sends 0x-prefixed hex; web3 helpers can return bare hex. Accept both.
const asHex = (value: string): string => (String(value || '').startsWith('0x') ? String(value) : `0x${value}`)

export const mapEventToMessage = (log: RawLog): SupportChatMessage | null => {
    if (!log || !Array.isArray(log.topics) || log.topics.length < 3) {
        return null
    }

    const data = String(log.data || '').replace(/^0x/, '')

    if (data.length < 128) {
        return null
    }

    try {
        const id = Number(BigInt(asHex(log.topics[1])))
        const author = `0x${asHex(log.topics[2]).slice(-40)}`
        const offsetWords = Number(BigInt(asHex(wordAt(data, 0))) / BigInt(32))
        const timestamp = Number(BigInt(asHex(wordAt(data, 1))))
        const length = Number(BigInt(asHex(wordAt(data, offsetWords))))
        const start = (offsetWords + 1) * 64
        const text = decodeUtf8(data.slice(start, start + length * 2))

        if (!Number.isFinite(id) || !Number.isFinite(timestamp)) {
            return null
        }

        return { id, author, text, timestamp }
    } catch (error) {
        return null
    }
}

export const dedupeAndSortMessages = (messages: SupportChatMessage[]): SupportChatMessage[] => {
    const byId = new Map<number, SupportChatMessage>()

    ;(messages || []).forEach((message) => {
        if (message && Number.isFinite(message.id)) {
            byId.set(message.id, message)
        }
    })

    return Array.from(byId.values()).sort((left, right) => left.id - right.id)
}

export const formatRelativeTime = (timestampSeconds: number, nowMs: number = Date.now()): string => {
    if (!Number.isFinite(timestampSeconds) || timestampSeconds <= 0) {
        return ''
    }

    const seconds = Math.max(0, Math.floor(nowMs / 1000) - timestampSeconds)

    if (seconds < 60) {
        return 'just now'
    }

    if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60)

        return `${minutes}m ago`
    }

    if (seconds < 86400) {
        const hours = Math.floor(seconds / 3600)

        return `${hours}h ago`
    }

    return `${Math.floor(seconds / 86400)}d ago`
}

export const shortenAddress = (address?: string | null): string => {
    if (!address) {
        return ''
    }

    const value = String(address)

    return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value
}
