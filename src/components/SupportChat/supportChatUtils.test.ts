import {
    DEFAULT_SCAN_WINDOW_BLOCKS,
    ERROR_MESSAGES,
    MAX_MESSAGE_BYTES,
    MAX_SCAN_CHUNKS,
    dedupeAndSortMessages,
    estimateCostWei,
    formatCeloFromWei,
    formatRelativeTime,
    isBalanceTooLow,
    isContractAddress,
    mapEventToMessage,
    resolveScanWindow,
    sanitizeMessage,
    shortenAddress,
    utf8ByteLength,
    validateMessage,
} from './supportChatUtils'

const word = (value: number): string => value.toString(16).padStart(64, '0')

const encodeMessageEvent = ({
    id,
    author,
    text,
    timestamp,
}: {
    id: number
    author: string
    text: string
    timestamp: number
}) => {
    const bytes = Array.from(new TextEncoder().encode(text))
    const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')
    const padded = hex.padEnd(Math.ceil(hex.length / 64) * 64, '0')

    return {
        topics: [
            '0x0000000000000000000000000000000000000000000000000000000000000000',
            `0x${word(id)}`,
            `0x${author.toLowerCase().replace(/^0x/, '').padStart(64, '0')}`,
        ],
        data: `0x${word(64)}${word(timestamp)}${word(bytes.length)}${padded}`,
    }
}

describe('supportChatUtils', () => {
    describe('utf8ByteLength', () => {
        it('counts ascii, accents and astral emoji', () => {
            expect(utf8ByteLength('abc')).toBe(3)
            expect(utf8ByteLength('ñ')).toBe(2)
            expect(utf8ByteLength('₱')).toBe(3)
            expect(utf8ByteLength('💬')).toBe(4)
            expect(utf8ByteLength('')).toBe(0)
        })
    })

    describe('sanitizeMessage', () => {
        it('keeps newlines, drops control chars and collapses blank runs', () => {
            expect(sanitizeMessage('  hi\nthere  ')).toBe('hi\nthere')
            expect(sanitizeMessage('a\r\nb')).toBe('a\nb')
            expect(sanitizeMessage('a\n\n\n\nb')).toBe('a\n\nb')
            expect(sanitizeMessage('bad\u0007char')).toBe('badchar')
        })
    })

    describe('validateMessage', () => {
        it('rejects empty and over-long messages', () => {
            expect(validateMessage('   ').ok).toBe(false)
            expect(validateMessage('   ').error).toBe(ERROR_MESSAGES.empty)
            expect(validateMessage('a'.repeat(MAX_MESSAGE_BYTES)).ok).toBe(true)
            expect(validateMessage('a'.repeat(MAX_MESSAGE_BYTES + 1)).error).toBe(ERROR_MESSAGES.tooLong)
            expect(validateMessage('💬'.repeat(251)).ok).toBe(false)
        })
    })

    describe('isContractAddress', () => {
        it('accepts a real address only', () => {
            expect(isContractAddress('0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A')).toBe(true)
            expect(isContractAddress('0x0000000000000000000000000000000000000000')).toBe(false)
            expect(isContractAddress('0x1234')).toBe(false)
            expect(isContractAddress('')).toBe(false)
            expect(isContractAddress(undefined)).toBe(false)
        })
    })

    describe('cost maths', () => {
        it('formats wei as CELO without losing precision', () => {
            expect(formatCeloFromWei(BigInt(0))).toBe('0')
            expect(formatCeloFromWei(BigInt('1000000000000000000'))).toBe('1')
            expect(formatCeloFromWei(BigInt('10600000000000000'))).toBe('0.0106')
            expect(formatCeloFromWei(BigInt('123456789012345678'))).toBe('0.1234')
        })

        it('multiplies gas price by gas limit exactly', () => {
            expect(estimateCostWei(BigInt('202510000000'), BigInt(52303))).toBe(BigInt('10591880530000000'))
        })

        it('detects a shortfall only when the balance is lower', () => {
            expect(isBalanceTooLow(BigInt(10), BigInt(11))).toBe(true)
            expect(isBalanceTooLow(BigInt(11), BigInt(11))).toBe(false)
            expect(isBalanceTooLow(BigInt(12), BigInt(11))).toBe(false)
        })
    })

    describe('resolveScanWindow', () => {
        it('splits a bounded window into at most MAX_SCAN_CHUNKS ranges', () => {
            const window = resolveScanWindow({ headBlock: 100000 })

            expect(window.toBlock).toBe(100000)
            expect(window.fromBlock).toBe(100000 - DEFAULT_SCAN_WINDOW_BLOCKS + 1)
            expect(window.ranges.length).toBeLessThanOrEqual(MAX_SCAN_CHUNKS)
            expect(window.ranges[0][0]).toBe(window.fromBlock)
            expect(window.ranges[window.ranges.length - 1][1]).toBe(100000)
        })

        it('never scans below the deploy block', () => {
            const window = resolveScanWindow({ headBlock: 100000, deployBlock: 99500 })

            expect(window.fromBlock).toBe(99500)
            expect(window.ranges[0][0]).toBe(99500)
        })

        it('covers every block exactly once', () => {
            const window = resolveScanWindow({ headBlock: 5000, deployBlock: 4000 })
            const covered: number[] = []

            window.ranges.forEach(([from, to]) => {
                for (let block = from; block <= to; block += 1) {
                    covered.push(block)
                }
            })

            expect(covered[0]).toBe(4000)
            expect(covered[covered.length - 1]).toBe(5000)
            expect(covered.length).toBe(1001)
            expect(new Set(covered).size).toBe(1001)
        })
    })

    describe('mapEventToMessage', () => {
        it('decodes id, author, text and timestamp', () => {
            const log = encodeMessageEvent({
                id: 7,
                author: '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A',
                text: 'Hello\nworld 💬',
                timestamp: 1763000000,
            })

            const message = mapEventToMessage(log)

            expect(message).not.toBeNull()
            expect(message?.id).toBe(7)
            expect(message?.author).toBe('0x62b8b11039fcfE5ab0C56E502b1C372A3d2a9c7A'.toLowerCase())
            expect(message?.text).toBe('Hello\nworld 💬')
            expect(message?.timestamp).toBe(1763000000)
        })

        it('accepts hex values with or without the 0x prefix', () => {
            const log = encodeMessageEvent({
                id: 12,
                author: '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A',
                text: 'bare',
                timestamp: 1,
            })
            const bare = {
                topics: log.topics.map((topic) => topic.replace(/^0x/, '')),
                data: log.data.replace(/^0x/, ''),
            }

            expect(mapEventToMessage(bare)?.id).toBe(12)
            expect(mapEventToMessage(bare)?.text).toBe('bare')
        })

        it('rejects malformed logs instead of throwing', () => {
            expect(mapEventToMessage({ topics: [], data: '0x' })).toBeNull()
            expect(mapEventToMessage({ topics: ['0x1', '0x2', '0x3'], data: '0x' })).toBeNull()
        })
    })

    describe('dedupeAndSortMessages', () => {
        it('keeps the last copy of an id and sorts ascending', () => {
            const result = dedupeAndSortMessages([
                { id: 2, author: 'a', text: 'two', timestamp: 2 },
                { id: 1, author: 'a', text: 'one', timestamp: 1 },
                { id: 2, author: 'a', text: 'two again', timestamp: 2 },
            ])

            expect(result.map((message) => message.id)).toEqual([1, 2])
            expect(result[1].text).toBe('two again')
        })
    })

    describe('formatRelativeTime', () => {
        it('renders the useful buckets', () => {
            const now = 1763000000000

            expect(formatRelativeTime(1763000000, now)).toBe('just now')
            expect(formatRelativeTime(1762999940, now)).toBe('1m ago')
            expect(formatRelativeTime(1762996400, now)).toBe('1h ago')
            expect(formatRelativeTime(1762913600, now)).toBe('1d ago')
            expect(formatRelativeTime(0, now)).toBe('')
        })
    })

    describe('shortenAddress', () => {
        it('truncates long addresses and leaves short ones alone', () => {
            expect(shortenAddress('0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A')).toBe('0x62B8…9c7A')
            expect(shortenAddress('0x1234')).toBe('0x1234')
            expect(shortenAddress('')).toBe('')
        })
    })
})
