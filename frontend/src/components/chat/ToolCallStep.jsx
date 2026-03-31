import { useState, useRef, useEffect } from 'react'
import { CopyButton } from './mdComponents'

export default function ToolCallStep({ step, index, isRunning }) {
  const [open, setOpen] = useState(false)
  const liveRef = useRef(null)
  const lineCount = step.code ? step.code.split('\n').length : 0
  const hasOutput = !!step.output
  const progressLines = step.progressLines || []
  const hasLive = isRunning && progressLines.length > 0

  useEffect(() => {
    if (liveRef.current) {
      liveRef.current.scrollTop = liveRef.current.scrollHeight
    }
  }, [progressLines.length])

  return (
    <div className="my-2 border border-[var(--border-primary)] rounded-[6px] overflow-hidden bg-transparent">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[var(--bg-hover)] transition-colors text-left text-[11px] text-[var(--text-secondary)]"
      >
        {isRunning && !hasOutput ? (
          <svg className="w-3.5 h-3.5 text-sky-500 animate-spin shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
        ) : (
          <svg className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
        )}
        <span className="font-medium">{isRunning && !hasOutput ? 'Mengeksekusi Python...' : 'Menjalankan Python'}</span>
        <span className="ml-auto flex items-center gap-2 text-[var(--text-muted)]">
          <span>{lineCount} baris</span>
          <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
        </span>
      </button>

      {hasLive && (
        <div className="bg-[var(--bg-tertiary)] border-t border-[var(--border-primary)]">
          <pre
            ref={liveRef}
            className="px-3 py-2 text-[11px] font-mono text-[var(--text-secondary)] max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed"
          >
            {progressLines.join('\n')}
          </pre>
        </div>
      )}

      {open && (
        <div className="bg-[var(--bg-tertiary)] border-t border-[var(--border-primary)]">
          {step.code && (
            <div className="border-b border-[var(--border-primary)]">
              <div className="flex items-center justify-between px-3 py-1 bg-[var(--bg-page)] border-b border-[var(--border-primary)]">
                <span className="text-[10px] uppercase font-semibold text-[var(--text-muted)] tracking-wider">Input</span>
                <CopyButton text={step.code} />
              </div>
              <pre className="px-3 py-2 text-[11px] font-mono text-[var(--analisai-cyan)] overflow-x-auto whitespace-pre-wrap leading-relaxed">{step.code}</pre>
            </div>
          )}
          {step.output && (
            <div>
              <div className="flex items-center gap-2 px-3 py-1 bg-[var(--bg-page)] border-b border-[var(--border-primary)]">
                <span className="text-[10px] uppercase font-semibold text-[var(--text-muted)] tracking-wider">Output</span>
                {step.output.toLowerCase().includes('error') && (
                  <span className="text-[9px] text-red-500 bg-red-500/10 px-1 rounded-sm uppercase">error</span>
                )}
              </div>
              <pre className="px-3 py-2 text-[11px] font-mono text-[var(--text-secondary)] overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">{step.output}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
