// Scrollable list of chat messages with the empty welcome state and the
// floating "scroll to bottom" pill.

import { useCallback, useEffect, useRef, useState } from 'react'
import MessageBubble from '../MessageBubble'

export default function ChatMessageList({
  messages,
  loading,
  statusText,
  username,
  projectId,
  onApprovePlan,
  onSelectOption,
  onSubmitClarification,
}) {
  const scrollAreaRef = useRef(null)
  const bottomRef = useRef(null)
  const userScrolledUpRef = useRef(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  const isNearBottom = useCallback(() => {
    const el = scrollAreaRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }, [])

  // Auto-scroll on new content unless user scrolled up.
  useEffect(() => {
    if (!userScrolledUpRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleScroll = useCallback(() => {
    const scrolledUp = !isNearBottom()
    userScrolledUpRef.current = scrolledUp
    setShowScrollBtn(scrolledUp)
  }, [isNearBottom])

  const handleScrollToBottom = useCallback(() => {
    userScrolledUpRef.current = false
    setShowScrollBtn(false)
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Reset the "user scrolled up" flag whenever a new message appears so the
  // very first event of a new turn always scrolls into view.
  const lastCount = useRef(messages.length)
  useEffect(() => {
    if (messages.length > lastCount.current) {
      userScrolledUpRef.current = false
      setShowScrollBtn(false)
    }
    lastCount.current = messages.length
  }, [messages.length])

  return (
    <>
      <div
        ref={scrollAreaRef}
        onScroll={handleScroll}
        className="chat-scroll"
        style={{
          flex: 1, overflowY: 'auto',
          padding: '2rem 1.5rem',
          display: 'flex', flexDirection: 'column',
          gap: '0.75rem',
          position: 'relative', zIndex: 1,
        }}
      >
        {messages.length === 0 && <EmptyState username={username} />}

        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.uid || i}
            message={msg}
            isLoading={loading && i === messages.length - 1}
            statusText={loading && i === messages.length - 1 ? statusText : ''}
            allMessages={messages}
            projectId={projectId}
            isLastMessage={i === messages.length - 1}
            onApprovePlan={onApprovePlan}
            onSelectOption={onSelectOption}
            onSubmitClarification={onSubmitClarification}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {showScrollBtn && messages.length > 0 && (
        <ScrollToBottomButton onClick={handleScrollToBottom} />
      )}
    </>
  )
}

function EmptyState({ username }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', animation: 'fadeInUp 0.6s ease both',
      padding: '2rem 1rem',
    }}>
      <div style={{
        fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', fontWeight: 600,
        background: 'linear-gradient(90deg, #a8c7fa, #c58cf2)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        fontFamily: "'Syne', sans-serif",
        letterSpacing: '-0.04em',
        marginBottom: '0.1rem',
      }}>
        Hello, {(username || 'Ammar').split('@')[0]}
      </div>
      <div style={{
        fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 500, color: 'var(--text-secondary)',
        fontFamily: "'Syne', sans-serif",
        letterSpacing: '-0.04em',
      }}>
        Where should we start?
      </div>
    </div>
  )
}

function ScrollToBottomButton({ onClick }) {
  return (
    <div style={{
      position: 'absolute', bottom: 130, left: '50%',
      transform: 'translateX(-50%)', zIndex: 20,
    }}>
      <button
        onClick={onClick}
        className="scroll-to-bottom"
        style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.4rem 0.9rem',
          background: 'var(--bg-header)',
          border: '1px solid var(--border-primary)',
          borderRadius: 100, cursor: 'pointer',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.62rem', letterSpacing: '0.08em',
          color: 'var(--text-muted)', transition: 'all 0.2s',
          backdropFilter: 'blur(8px)',
        }}
      >
        <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
        </svg>
        TERBARU
      </button>
    </div>
  )
}
