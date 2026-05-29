// Chat input area: textarea, web-search toggle, stop/send buttons,
// suggestion chips (only shown when the chat is empty), and disclaimer text.

import { useRef, useState } from 'react'

const QUICK_PROMPTS = [
  {
    label: 'Analisis data',
    prompt: 'Analisis dataset dan berikan ringkasan insight utama',
    color: '#38bdf8',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
      </svg>
    ),
  },
  {
    label: 'Visualisasi',
    prompt: 'Buat visualisasi distribusi dan korelasi kolom-kolom penting',
    color: '#818cf8',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"/>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"/>
      </svg>
    ),
  },
  {
    label: 'Preprocessing data',
    prompt: 'Lakukan preprocessing data: handling missing values, encoding, dan transformasi',
    color: '#34d399',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
      </svg>
    ),
  },
  {
    label: 'Cek kualitas data',
    prompt: 'Cek kualitas data: missing values, duplikat, outlier, dan tipe data',
    color: '#f59e0b',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    ),
  },
]

export default function ChatComposer({
  loading,
  showSuggestions,
  onSend,
  onStop,
}) {
  const [input, setInput] = useState('')
  const [inputFocused, setInputFocused] = useState(false)
  const inputRef = useRef(null)

  const resetTextareaHeight = () => {
    if (inputRef.current) inputRef.current.style.height = '56px'
  }

  const submit = (text) => {
    const value = text ?? input
    if (!value.trim() || loading) return
    setInput('')
    resetTextareaHeight()
    onSend(value)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div style={{
      padding: '0.75rem 1.25rem 2rem',
      background: 'transparent',
      position: 'relative', zIndex: 10, flexShrink: 0,
    }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end',
          background: 'var(--bg-input)',
          border: `1px solid ${inputFocused ? 'rgba(255,255,255,0.1)' : 'transparent'}`,
          borderRadius: 28,
          transition: 'border-color 0.2s, box-shadow 0.2s',
          boxShadow: inputFocused ? '0 0 0 4px rgba(255,255,255,0.03)' : 'none',
          overflow: 'hidden',
          paddingBottom: 8,
        }}>
          <textarea
            ref={inputRef}
            rows={1}
            placeholder="Ask Analisai"
            value={input}
            onChange={e => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            disabled={loading}
            style={{
              flex: 1, background: 'transparent',
              border: 'none', outline: 'none', resize: 'none',
              padding: '1.1rem 1.5rem 0.5rem',
              color: 'var(--text-primary)', fontFamily: "'Syne', sans-serif",
              fontSize: '1rem', lineHeight: 1.6,
              minHeight: 56, maxHeight: 160,
              height: 56,
            }}
          />

          <div style={{ padding: '0 0.75rem 0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            {loading && (
              <button
                onClick={onStop}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(239,68,68,0.1)',
                  border: 'none',
                  color: '#f87171',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'background 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                title="Hentikan"
              >
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2"/>
                </svg>
              </button>
            )}

            <button
              onClick={() => submit()}
              disabled={loading || !input.trim()}
              className="send-btn"
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: loading ? 'transparent' : input.trim() ? 'var(--btn-send-bg)' : 'transparent',
                border: 'none',
                color: input.trim() && !loading ? 'var(--btn-send-icon)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {loading ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)"
                  style={{ animation: 'spin 0.8s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" strokeWidth="3" strokeOpacity="0.2"/>
                  <path d="M12 2a10 10 0 0110 10" strokeWidth="3" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19V5m0 0l-6 6m6-6l6 6"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {showSuggestions && (
          <div style={{
            display: 'flex', gap: '0.6rem', flexWrap: 'wrap',
            justifyContent: 'center', marginTop: '1.25rem',
          }}>
            {QUICK_PROMPTS.map(qp => (
              <button
                key={qp.label}
                onClick={() => submit(qp.prompt)}
                style={{
                  padding: '0.5rem 1rem', borderRadius: 9999,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-primary)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.8rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ color: qp.color, display: 'flex' }}>{qp.icon}</span>
                {qp.label}
              </button>
            ))}
          </div>
        )}

        <div style={{
          textAlign: 'center', marginTop: showSuggestions ? '1rem' : '0.75rem',
          fontFamily: "'Syne', sans-serif",
          fontSize: '0.65rem', color: 'var(--text-muted)',
        }}>
          Analisai can make mistakes. Check important info.
        </div>
      </div>
    </div>
  )
}
