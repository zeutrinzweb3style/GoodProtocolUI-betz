import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useAppKitProvider } from '@reown/appkit/react'
import type { Provider } from '@reown/appkit/react'
import { ethers } from 'ethers'

import { useConnectionInfo } from 'hooks/useConnectionInfo'

import supportChatAbi from './supportChatAbi.json'
import type { RawLog, SupportChatMessage } from './supportChatUtils'
import {
    CELO_CHAIN_ID,
    CELO_CHAIN_ID_HEX,
    ERROR_MESSAGES,
    ESTIMATE_SAMPLE,
    MESSAGES_POLL_MS,
    POST_COOLDOWN_SECONDS,
    dedupeAndSortMessages,
    estimateCostWei,
    formatCeloFromWei,
    isBalanceTooLow,
    isContractAddress,
    mapEventToMessage,
    resolveScanWindow,
    sanitizeMessage,
    validateMessage,
} from './supportChatUtils'

const CONTRACT_ADDRESS = String(process.env.REACT_APP_SUPPORT_CHAT_CONTRACT || '').trim()
const DEPLOY_BLOCK = Number(process.env.REACT_APP_SUPPORT_CHAT_DEPLOY_BLOCK || 0) || 0
const TELEGRAM_URL = String(process.env.REACT_APP_SUPPORT_TG_URL || '').trim()

const CONFIGURED_RPCS = String(process.env.REACT_APP_CELO_RPC || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)

const READ_RPCS = CONFIGURED_RPCS.length ? CONFIGURED_RPCS : ['https://forno.celo.org']

const CELO_CHAIN_PARAMS = {
    chainId: CELO_CHAIN_ID_HEX,
    chainName: 'Celo',
    nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
    rpcUrls: READ_RPCS,
    blockExplorerUrls: ['https://celoscan.io'],
}

const MESSAGE_POSTED_TOPIC = ethers.utils.id('MessagePosted(uint256,address,string,uint256)')
const CHAT_INTERFACE = new ethers.utils.Interface(supportChatAbi)

export interface SupportChatCost {
    celo: string
    gasLimit: string
    gasPriceWei: string
    wei: string
    balanceWei: string
    balanceTooLow: boolean
}

export interface SendResult {
    ok: boolean
    error?: string
    txHash?: string
}

const hex = (value: number): string => `0x${Math.max(0, Math.floor(value)).toString(16)}`

const rpcRequest = async (method: string, params: unknown[]): Promise<any> => {
    let lastError: unknown

    for (const url of READ_RPCS) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
            })

            if (!response.ok) {
                lastError = new Error(`${method} failed (${response.status})`)
                continue
            }

            const payload = await response.json()

            if (payload.error) {
                throw new Error(payload.error.message || `${method} failed`)
            }

            return payload.result
        } catch (error) {
            lastError = error
        }
    }

    throw lastError instanceof Error ? lastError : new Error(`${method} failed`)
}

const describeSendError = (error: any): string => {
    const code = error?.code ?? error?.data?.originalError?.code ?? error?.cause?.code
    const message = String(error?.message || '').toLowerCase()

    if (code === 4001 || code === 'ACTION_REJECTED' || message.includes('user rejected')) {
        return ERROR_MESSAGES.rejected
    }

    if (message.includes('insufficient funds') || message.includes('insufficient balance')) {
        return ERROR_MESSAGES.lowBalance
    }

    return ERROR_MESSAGES.failed
}

export interface UseSupportChatOptions {
    open: boolean
}

export interface UseSupportChatResult {
    enabled: boolean
    contractAddress: string
    telegramUrl: string
    messages: SupportChatMessage[]
    loading: boolean
    error?: string
    cost?: SupportChatCost
    costLoading: boolean
    sending: boolean
    sendError?: string
    lastTxHash?: string
    cooldownUntil: number
    refresh: () => void
    send: (text: string) => Promise<SendResult>
}

export const useSupportChat = ({ open }: UseSupportChatOptions): UseSupportChatResult => {
    const { address, chainId, isConnected } = useConnectionInfo()
    const { walletProvider } = useAppKitProvider<Provider>('eip155')

    const enabled = Boolean(isConnected && address) && isContractAddress(CONTRACT_ADDRESS)

    const [messages, setMessages] = useState<SupportChatMessage[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | undefined>()
    const [cost, setCost] = useState<SupportChatCost | undefined>()
    const [costLoading, setCostLoading] = useState(false)
    const [sending, setSending] = useState(false)
    const [sendError, setSendError] = useState<string | undefined>()
    const [lastTxHash, setLastTxHash] = useState<string | undefined>()
    const [cooldownUntil, setCooldownUntil] = useState(0)

    const mounted = useRef(true)

    useEffect(() => {
        mounted.current = true

        return () => {
            mounted.current = false
        }
    }, [])

    const refresh = useCallback(async () => {
        if (!enabled) {
            return
        }

        setLoading(true)

        try {
            const headBlock = Number(BigInt(await rpcRequest('eth_blockNumber', [])))
            const window = resolveScanWindow({ headBlock, deployBlock: DEPLOY_BLOCK })
            const collected: SupportChatMessage[] = []

            for (const [fromBlock, toBlock] of window.ranges) {
                const logs: RawLog[] = await rpcRequest('eth_getLogs', [
                    {
                        address: CONTRACT_ADDRESS,
                        fromBlock: hex(fromBlock),
                        toBlock: hex(toBlock),
                        topics: [MESSAGE_POSTED_TOPIC],
                    },
                ])

                ;(logs || []).forEach((log) => {
                    const message = mapEventToMessage(log)

                    if (message) {
                        collected.push(message)
                    }
                })
            }

            if (mounted.current) {
                setMessages(dedupeAndSortMessages(collected))
                setError(undefined)
            }
        } catch (loadError) {
            if (mounted.current) {
                setError('Could not load the conversation.')
            }
        } finally {
            if (mounted.current) {
                setLoading(false)
            }
        }
    }, [enabled])

    const refreshCost = useCallback(async () => {
        if (!enabled || !address) {
            setCost(undefined)

            return
        }

        setCostLoading(true)

        try {
            const data = CHAT_INTERFACE.encodeFunctionData('post', [ESTIMATE_SAMPLE])
            const [gasEstimate, gasPriceHex, balanceHex] = await Promise.all([
                rpcRequest('eth_estimateGas', [{ from: address, to: CONTRACT_ADDRESS, data }]),
                rpcRequest('eth_gasPrice', []),
                rpcRequest('eth_getBalance', [address, 'latest']),
            ])

            const gasLimit = (BigInt(gasEstimate) * BigInt(140)) / BigInt(100)
            const gasPriceWei = BigInt(gasPriceHex)
            const wei = estimateCostWei(gasPriceWei, gasLimit)
            const balanceWei = BigInt(balanceHex)

            if (mounted.current) {
                setCost({
                    celo: formatCeloFromWei(wei),
                    gasLimit: gasLimit.toString(),
                    gasPriceWei: gasPriceWei.toString(),
                    wei: wei.toString(),
                    balanceWei: balanceWei.toString(),
                    balanceTooLow: isBalanceTooLow(balanceWei, wei),
                })
            }
        } catch (estimateError) {
            if (mounted.current) {
                setCost(undefined)
            }
        } finally {
            if (mounted.current) {
                setCostLoading(false)
            }
        }
    }, [address, enabled])

    const ensureCeloChain = useCallback(async () => {
        if (Number(chainId) === CELO_CHAIN_ID || !walletProvider) {
            return
        }

        try {
            await walletProvider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: CELO_CHAIN_ID_HEX }],
            })
        } catch (switchError: any) {
            if (switchError?.code === 4902) {
                await walletProvider.request({ method: 'wallet_addEthereumChain', params: [CELO_CHAIN_PARAMS] })

                return
            }

            throw switchError
        }
    }, [chainId, walletProvider])

    const send = useCallback(
        async (text: string): Promise<SendResult> => {
            const validation = validateMessage(text)

            if (!validation.ok) {
                return { ok: false, error: validation.error }
            }

            if (!enabled || !address) {
                return { ok: false, error: ERROR_MESSAGES.noWallet }
            }

            if (!walletProvider) {
                return { ok: false, error: ERROR_MESSAGES.noWallet }
            }

            if (Date.now() < cooldownUntil) {
                return { ok: false, error: ERROR_MESSAGES.cooldown }
            }

            setSending(true)
            setSendError(undefined)

            try {
                await ensureCeloChain()

                const provider = new ethers.providers.Web3Provider(walletProvider as any)
                const signer = provider.getSigner(address)
                const contract = new ethers.Contract(CONTRACT_ADDRESS, supportChatAbi, signer)

                const data = CHAT_INTERFACE.encodeFunctionData('post', [sanitizeMessage(text)])
                const gasEstimate = await rpcRequest('eth_estimateGas', [{ from: address, to: CONTRACT_ADDRESS, data }])
                const gasPriceHex = await rpcRequest('eth_gasPrice', [])
                const gasLimit = (BigInt(gasEstimate) * BigInt(140)) / BigInt(100)

                const tx = await contract.post(sanitizeMessage(text), {
                    gasLimit: ethers.BigNumber.from(gasLimit.toString()),
                    gasPrice: ethers.BigNumber.from(gasPriceHex),
                })

                setLastTxHash(tx.hash)
                setCooldownUntil(Date.now() + POST_COOLDOWN_SECONDS * 1000)

                await provider.waitForTransaction(tx.hash, 1, 120000).catch(() => null)

                if (mounted.current) {
                    setSending(false)
                }

                refresh()

                return { ok: true, txHash: tx.hash }
            } catch (sendFailure: any) {
                const message = describeSendError(sendFailure)

                if (mounted.current) {
                    setSendError(message)
                    setSending(false)
                }

                return { ok: false, error: message }
            }
        },
        [address, cooldownUntil, enabled, ensureCeloChain, refresh, walletProvider]
    )

    useEffect(() => {
        if (!open || !enabled) {
            return
        }

        refresh()
        refreshCost()

        const timer = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
                refresh()
            }
        }, MESSAGES_POLL_MS)

        const onVisible = () => {
            if (document.visibilityState === 'visible') {
                refresh()
                refreshCost()
            }
        }

        document.addEventListener('visibilitychange', onVisible)

        return () => {
            window.clearInterval(timer)
            document.removeEventListener('visibilitychange', onVisible)
        }
    }, [enabled, open, refresh, refreshCost])

    return useMemo(
        () => ({
            enabled,
            contractAddress: CONTRACT_ADDRESS,
            telegramUrl: TELEGRAM_URL,
            messages,
            loading,
            error,
            cost,
            costLoading,
            sending,
            sendError,
            lastTxHash,
            cooldownUntil,
            refresh,
            send,
        }),
        [
            cooldownUntil,
            cost,
            costLoading,
            enabled,
            error,
            lastTxHash,
            loading,
            messages,
            refresh,
            send,
            sendError,
            sending,
        ]
    )
}

export default useSupportChat
