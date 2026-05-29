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
    <div className="my-4 bg-sky-500/10 border border-sky-500/20 rounded-lg p-4 shadow-sm animate-fade-in">
      <div className="flex items-start gap-3 mb-3">
        <div className="text-sky-400 mt-0.5 shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-sky-400/80 mb-0.5">
            Intent Agent
          </p>
          <p className="text-[13px] text-[var(--text-primary)]">
            Saya butuh sedikit klarifikasi sebelum melanjutkan{questions.length > 1 ? ` (${questions.length} pertanyaan)` : ''}:
          </p>
        </div>
      </div>

      <div className="space-y-4 ml-8">
        {questions.map((q, qi) => {
          const selected = answers[q.id]
          return (
            <div key={q.id || qi} className="space-y-2">
              <p className="text-[13px] font-medium text-[var(--text-primary)] flex items-start gap-2">
                <span className="text-sky-400 font-mono text-[11px] mt-0.5">{qi + 1}.</span>
                <span className="flex-1">
                  {q.question}
                  {q.allow_multiple && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-normal">
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
                      className={`px-3 py-1.5 rounded text-[12px] transition-colors border ${
                        isActive
                          ? 'bg-sky-500/30 border-sky-400 text-[var(--text-primary)] font-medium'
                          : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-sky-500/15 hover:border-sky-500/40'
                      } ${!isInteractive ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
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
        <div className="mt-4 ml-8 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!allAnswered}
            className={`px-4 py-2 rounded-md text-[12.5px] font-semibold transition-all shadow-sm flex items-center gap-2 ${
              allAnswered
                ? 'bg-sky-500 hover:bg-sky-400 text-white'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            Kirim Jawaban
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
        <div className="mt-3 ml-8 flex flex-wrap gap-2">
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
