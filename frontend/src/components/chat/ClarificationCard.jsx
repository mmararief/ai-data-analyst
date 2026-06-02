import { useState } from 'react'

/**
 * ClarificationCard renders a bundle of up to 3 clarification questions
 * produced by the Intent Agent. Supports both single-select and multi-select
 * options per question. When the user submits, all answers are sent at once
 * via `onSubmit({ answers, summary })`.
 *
 * Backwards-compatible with the legacy single-question shape:
 *   { type: 'clarification', question: '...', options: [...] }
 *
 * New shape:
 *   { type: 'clarification', questions: [{id, question, options, allow_multiple}] }
 */
export default function ClarificationCard({ part, isLastMessage, isLoading, onSubmit, onSelectOption }) {
  const questions = Array.isArray(part.questions) && part.questions.length > 0
    ? part.questions
    : (part.question
        ? [{ id: 'q1', question: part.question, options: part.options || [], allow_multiple: false }]
        : [])

  const [answers, setAnswers] = useState({})

  if (questions.length === 0) return null

  const isInteractive = isLastMessage && !isLoading
  const allAnswered = questions.every(q => {
    const a = answers[q.id]
    return q.allow_multiple ? Array.isArray(a) && a.length > 0 : Boolean(a)
  })

  const toggleOption = (qid, opt, allowMultiple) => {
    setAnswers(prev => {
      if (!allowMultiple) {
        return { ...prev, [qid]: opt }
      }
      const current = Array.isArray(prev[qid]) ? prev[qid] : []
      const exists = current.includes(opt)
      const next = exists ? current.filter(o => o !== opt) : [...current, opt]
      return { ...prev, [qid]: next }
    })
  }

  const handleSubmit = () => {
    if (!allAnswered || !onSubmit) return
    const summaryLines = questions.map(q => {
      const a = answers[q.id]
      const text = Array.isArray(a) ? a.join(', ') : a
      return `- ${q.question} → ${text}`
    })
    const summary = summaryLines.join('\n')
    const structured = questions.map(q => ({
      id: q.id,
      question: q.question,
      answer: answers[q.id],
    }))
    onSubmit({ answers: structured, summary })
  }

  return (
    <div 
      className="my-4 rounded-2xl p-5 shadow-sm animate-fade-in"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-primary)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
      }}
    >
      <div className="flex items-start gap-3.5 mb-4">
        <div 
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: 'rgba(56,189,248,0.1)',
            border: '1px solid rgba(56,189,248,0.2)',
            color: 'var(--analisai-cyan)',
          }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p 
            className="text-[10px] font-bold uppercase tracking-wider mb-0.5"
            style={{
              color: 'var(--analisai-cyan)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            Butuh Klarifikasi
          </p>
          <p className="text-[13px] text-[var(--text-secondary)] font-medium leading-relaxed">
            Saya mendeteksi beberapa dataset di workspace Anda. Silakan tentukan data yang ingin dianalisis sebelum melanjutkan:
          </p>
        </div>
      </div>

      <div className="space-y-4 ml-0 md:ml-12">
        {questions.map((q, qi) => {
          const selected = answers[q.id]
          return (
            <div key={q.id || qi} className="space-y-2.5">
              <p className="text-[13px] font-semibold text-[var(--text-primary)] flex items-start gap-2">
                <span className="text-[var(--analisai-cyan)] font-mono text-[11px] mt-0.5">{qi + 1}.</span>
                <span className="flex-1">
                  {q.question}
                  {q.allow_multiple && (
                    <span className="ml-2 text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-normal">
                      (boleh pilih lebih dari satu)
                    </span>
                  )}
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {(q.options || []).map((opt, i) => {
                  const isActive = q.allow_multiple
                    ? Array.isArray(selected) && selected.includes(opt)
                    : selected === opt
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={!isInteractive}
                      onClick={() => isInteractive && toggleOption(q.id, opt, q.allow_multiple)}
                      style={{
                        padding: '0.45rem 0.85rem',
                        borderRadius: '10px',
                        fontSize: '11.5px',
                        fontWeight: isActive ? 600 : 500,
                        border: '1px solid',
                        borderColor: isActive ? 'var(--analisai-cyan)' : 'var(--border-primary)',
                        background: isActive ? 'rgba(56,189,248,0.15)' : 'var(--bg-card)',
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                        boxShadow: isActive ? '0 0 10px rgba(56,189,248,0.1)' : 'none',
                        cursor: isInteractive ? 'pointer' : 'not-allowed',
                        opacity: !isInteractive && !isActive ? 0.6 : 1,
                        transition: 'all 0.15s ease',
                      }}
                      className="hover:opacity-90"
                      onMouseEnter={e => {
                        if (isInteractive && !isActive) {
                          e.currentTarget.style.borderColor = 'var(--analisai-cyan)'
                          e.currentTarget.style.background = 'rgba(56,189,248,0.06)'
                        }
                      }}
                      onMouseLeave={e => {
                        if (isInteractive && !isActive) {
                          e.currentTarget.style.borderColor = 'var(--border-primary)'
                          e.currentTarget.style.background = 'var(--bg-card)'
                        }
                      }}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {isInteractive && (
        <div className="mt-5 ml-0 md:ml-12 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!allAnswered}
            style={{
              padding: '0.55rem 1.1rem',
              borderRadius: '12px',
              fontSize: '12.5px',
              fontWeight: 600,
              background: allAnswered ? 'var(--analisai-cyan)' : 'var(--bg-card)',
              border: '1px solid',
              borderColor: allAnswered ? 'var(--analisai-cyan)' : 'var(--border-primary)',
              color: allAnswered ? '#131314' : 'var(--text-muted)',
              cursor: allAnswered ? 'pointer' : 'not-allowed',
              boxShadow: allAnswered ? '0 2px 8px rgba(56,189,248,0.15)' : 'none',
              transition: 'all 0.2s ease',
            }}
            className="flex items-center gap-2"
          >
            <span>Kirim Jawaban</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
          {!allAnswered && (
            <span className="text-[11px] text-[var(--text-muted)]">
              Pilih jawaban untuk semua pertanyaan
            </span>
          )}
        </div>
      )}

      {/* Backwards-compat: if old single-option layout is in play and a legacy
          handler is provided, expose quick-pick buttons too. */}
      {isInteractive && !onSubmit && onSelectOption && questions.length === 1 && (
        <div className="mt-3 ml-0 md:ml-12 flex flex-wrap gap-2">
          {(questions[0].options || []).map((opt, i) => (
            <button
              key={i}
              onClick={() => onSelectOption(opt)}
              className="px-3 py-1.5 bg-[var(--bg-tertiary)] hover:bg-sky-500/20 border border-[var(--border-primary)] hover:border-sky-500/50 rounded text-[12px] text-[var(--text-secondary)] transition-colors"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
