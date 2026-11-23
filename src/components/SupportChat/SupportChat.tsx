import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import styled from 'styled-components'

import { useSupportChat } from './useSupportChat'
import {
    MAX_MESSAGE_BYTES,
    formatRelativeTime,
    shortenAddress,
    utf8ByteLength,
    validateMessage,
} from './supportChatUtils'

const Launcher = styled.button`
    position: fixed;
    right: 16px;
    bottom: 88px;
    z-index: 1200;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border: 0;
    border-radius: 999px;
    background: ${({ theme }) => theme.color.text2};
    color: #ffffff;
    font-family: ${({ theme }) => theme.font.primary};
    font-size: 14px;
    font-weight: 700;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
    cursor: pointer;

    &:hover {
        filter: brightness(1.05);
    }

    @media ${({ theme }) => theme.media.sm} {
        right: 12px;
        bottom: 84px;
    }
`

const Panel = styled.section`
    position: fixed;
    right: 16px;
    bottom: 88px;
    z-index: 1201;
    display: flex;
    flex-direction: column;
    width: 350px;
    max-width: calc(100vw - 24px);
    max-height: min(70vh, 520px);
    border: 1px solid ${({ theme }) => theme.color.border2};
    border-radius: 16px;
    background: ${({ theme }) => theme.color.main};
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.22);
    overflow: hidden;

    @media ${({ theme }) => theme.media.sm} {
        right: 12px;
        bottom: 84px;
        width: calc(100vw - 24px);
        max-height: 72vh;
    }
`

const Header = styled.header`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 12px 14px;
    border-bottom: 1px solid ${({ theme }) => theme.color.border2};
`

const Title = styled.h3`
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: ${({ theme }) => theme.color.text1};
`

const IconButton = styled.button`
    border: 0;
    background: transparent;
    color: ${({ theme }) => theme.color.text3};
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
`

const Notice = styled.div`
    margin: 10px 14px 0;
    padding: 10px 12px;
    border-radius: 10px;
    background: ${({ theme }) => theme.color.secondaryBg};
    font-size: 12px;
    line-height: 1.5;
    color: ${({ theme }) => theme.color.text1};
`

const NoticeLink = styled.a`
    color: ${({ theme }) => theme.color.text2};
    font-weight: 700;
    text-decoration: none;

    &:hover {
        text-decoration: underline;
    }
`

const CostLine = styled.p<{ $warn?: boolean }>`
    margin: 8px 14px 0;
    font-size: 11.5px;
    line-height: 1.5;
    color: ${({ $warn, theme }) => ($warn ? theme.color.text1 : theme.color.text3)};
`

const List = styled.div`
    flex: 1;
    min-height: 120px;
    overflow-y: auto;
    padding: 10px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
`

const Bubble = styled.div`
    align-self: flex-start;
    max-width: 88%;
    padding: 8px 10px;
    border-radius: 12px;
    background: ${({ theme }) => theme.color.secondaryBg};
`

const BubbleMeta = styled.span`
    display: block;
    margin-bottom: 2px;
    font-size: 10.5px;
    opacity: 0.75;
`

const BubbleText = styled.p`
    margin: 0;
    font-size: 13px;
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
`

const Hint = styled.p`
    margin: 12px 0;
    font-size: 12px;
    text-align: center;
    color: ${({ theme }) => theme.color.text3};
`

const ErrorText = styled.p`
    margin: 8px 14px 0;
    font-size: 12px;
    color: ${({ theme }) => theme.red1};
`

const Composer = styled.form`
    display: flex;
    gap: 8px;
    padding: 10px 14px 12px;
    border-top: 1px solid ${({ theme }) => theme.color.border2};
`

const Input = styled.textarea`
    flex: 1;
    min-height: 42px;
    max-height: 96px;
    padding: 10px 12px;
    border: 1px solid ${({ theme }) => theme.color.border2};
    border-radius: 10px;
    background: ${({ theme }) => theme.color.secondaryBg};
    color: ${({ theme }) => theme.color.text1};
    font-family: inherit;
    font-size: 13px;
    resize: none;

    &:focus {
        outline: 2px solid ${({ theme }) => theme.color.text2};
        outline-offset: 1px;
    }
`

const SendButton = styled.button`
    align-self: flex-end;
    padding: 10px 14px;
    border: 0;
    border-radius: 10px;
    background: ${({ theme }) => theme.color.text2};
    color: #ffffff;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;

    &:disabled {
        opacity: 0.45;
        cursor: not-allowed;
    }
`

const Footer = styled.p`
    margin: 0;
    padding: 0 14px 12px;
    font-size: 10.5px;
    line-height: 1.5;
    color: ${({ theme }) => theme.color.text3};
`

const SendStatus = styled.p<{ $ok?: boolean }>`
    margin: 0;
    padding: 8px 14px 0;
    font-size: 11.5px;
    color: ${({ $ok, theme }) => ($ok ? theme.color.text2 : theme.red1)};

    a {
        color: inherit;
        text-decoration: underline;
    }
`

const SupportChat = () => {
    const [open, setOpen] = useState(false)
    const [draft, setDraft] = useState('')
    const [now, setNow] = useState(() => Date.now())
    const listRef = useRef<HTMLDivElement>(null)

    const {
        enabled,
        messages,
        loading,
        error,
        cost,
        costLoading,
        sending,
        sendError,
        lastTxHash,
        cooldownUntil,
        telegramUrl,
        send,
    } = useSupportChat({ open })

    const bytes = useMemo(() => utf8ByteLength(draft), [draft])
    const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000))
    const validation = validateMessage(draft)
    const canSend = validation.ok && !sending && cooldownSeconds === 0

    useEffect(() => {
        if (cooldownSeconds <= 0) {
            return
        }

        const timer = window.setInterval(() => setNow(Date.now()), 1000)

        return () => window.clearInterval(timer)
    }, [cooldownSeconds])

    useEffect(() => {
        if (!open || !listRef.current) {
            return
        }

        listRef.current.scrollTop = listRef.current.scrollHeight
    }, [messages.length, open])

    const close = useCallback(() => setOpen(false), [])

    useEffect(() => {
        if (!open) {
            return
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                close()
            }
        }

        document.addEventListener('keydown', onKeyDown)

        return () => document.removeEventListener('keydown', onKeyDown)
    }, [close, open])

    const submit = useCallback(
        async (event: React.FormEvent) => {
            event.preventDefault()

            if (!canSend) {
                return
            }

            const result = await send(draft)

            if (result.ok) {
                setDraft('')
            }
        },
        [canSend, draft, send]
    )

    if (!enabled) {
        return null
    }

    if (!open) {
        return (
            <Launcher type="button" onClick={() => setOpen(true)} aria-label="Open support chat">
                💬 Support
            </Launcher>
        )
    }

    return (
        <Panel role="dialog" aria-label="Support chat">
            <Header>
                <Title>Support</Title>
                <IconButton type="button" onClick={close} aria-label="Close support chat">
                    ×
                </IconButton>
            </Header>

            <Notice>
                Need a human right now? Join{' '}
                {telegramUrl ? (
                    <NoticeLink href={telegramUrl} target="_blank" rel="noopener noreferrer">
                        our Telegram support group
                    </NoticeLink>
                ) : (
                    'our Telegram support group'
                )}{' '}
                - live support, no cost needed.
            </Notice>

            <CostLine $warn={cost?.balanceTooLow}>
                {costLoading && !cost
                    ? 'Checking the network fee…'
                    : cost
                    ? `Each message is an on-chain transaction: about ${cost.celo} CELO, paid by your wallet.`
                    : 'Each message is an on-chain transaction paid by your wallet.'}
                {cost?.balanceTooLow ? ' You do not have enough CELO - use Telegram, it is free.' : ''}
            </CostLine>

            <List ref={listRef}>
                {loading && messages.length === 0 && <Hint>Loading the conversation…</Hint>}
                {!loading && messages.length === 0 && !error && <Hint>No messages yet. Ask your question below.</Hint>}
                {error && <Hint>{error}</Hint>}
                {messages.map((message) => (
                    <Bubble key={message.id}>
                        <BubbleMeta>
                            {shortenAddress(message.author)} · {formatRelativeTime(message.timestamp, now)}
                        </BubbleMeta>
                        <BubbleText>{message.text}</BubbleText>
                    </Bubble>
                ))}
            </List>

            {sendError && <ErrorText>{sendError}</ErrorText>}
            {lastTxHash && !sendError && (
                <SendStatus $ok>
                    Sent.{' '}
                    <a href={`https://celoscan.io/tx/${lastTxHash}`} target="_blank" rel="noopener noreferrer">
                        View on Celoscan
                    </a>
                </SendStatus>
            )}

            <Composer onSubmit={submit}>
                <Input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Write your question…"
                    aria-label="Your message"
                />
                <SendButton type="submit" disabled={!canSend}>
                    {sending ? 'Sending…' : cooldownSeconds > 0 ? `Wait ${cooldownSeconds}s` : 'Send'}
                </SendButton>
            </Composer>

            <Footer>
                {bytes}/{MAX_MESSAGE_BYTES} bytes · Messages are public and permanent. Never post wallet addresses,
                transaction IDs or personal details here.
            </Footer>
        </Panel>
    )
}

export default SupportChat
