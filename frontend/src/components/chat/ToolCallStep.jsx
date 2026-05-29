import { useState, useRef, useEffect } from 'react'
import { CopyButton } from './mdComponents'

// ── Tool metadata ──────────────────────────────────────────────────────────────
const TOOL_META = {
  python_repl_tool: {
    label: 'Menjalankan Python',
    labelRunning: 'Menjalankan kode Python…',
    color: 'text-sky-400',
    icon: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
      </svg>
    ),
  },
  render_chart_tool: {
    label: 'Membuat Chart',
    labelRunning: 'Merender chart…',
    color: 'text-violet-400',
    icon: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
      </svg>
    ),
  },
  read_data_tool: {
    label: 'Membaca Dataset',
    labelRunning: 'Membaca dataset…',
    color: 'text-emerald-400',
    icon: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M3 6h18M3 18h18"/>
      </svg>
    ),
  },
  data_profile_tool: {
    label: 'Profiling Dataset',
    labelRunning: 'Membuat profiling report…',
    color: 'text-amber-400',
    icon: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
      </svg>
    ),
  },
}

const DEFAULT_META = TOOL_META.python_repl_tool

// ── icon helpers ──────────────────────────────────────────────────────────────
function SpinIcon({ colorClass }) {
  return (
    <svg className={`w-3 h-3 animate-spin ${colorClass}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
    </svg>
  )
}

// ── component ─────────────────────────────────────────────────────────────────
export default function ToolCallStep({ step, index, isRunning }) {
  const [open, setOpen] = useState(false)
  const liveRef = useRef(null)

  const progressLines = step.progressLines || []
  const hasOutput = !!step.output
  const hasLive = isRunning && progressLines.length > 0
  const lineCount = step.code ? step.code.split('\n').length : 0
  const isDone = hasOutput && !isRunning

  const toolKey = step.tool || 'python_repl_tool'
  const meta = TOOL_META[toolKey] || DEFAULT_META

  // For render_chart_tool, show filename if available
  const labelSuffix = toolKey === 'render_chart_tool' && step.filename
    ? ` — ${step.filename}`
    : ` (${lineCount} baris)`

  // auto-scroll live output
  useEffect(() => {
    if (liveRef.current) liveRef.current.scrollTop = liveRef.current.scrollHeight
  }, [progressLines.length])

  return (
    <div className="group">
      {/* ── row ── */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-start gap-2.5 w-full text-left py-[3px] px-1 rounded hover:bg-[var(--bg-hover)] transition-colors"
      >
        {/* state icon */}
        <div className={`mt-[2px] w-3 h-3 shrink-0 flex items-center justify-center ${meta.color}`}>
          {isRunning && !hasOutput
            ? <SpinIcon colorClass={meta.color} />
            : isDone
              ? <CheckIcon />
              : <span className={meta.color}>{meta.icon}</span>
          }
        </div>

        {/* label */}
        <div className="flex-1 min-w-0">
          <span className={`text-[12px] leading-[1.4] ${isDone ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'}`}>
            {isRunning && !hasOutput
              ? <><span className={meta.color}>{meta.labelRunning}</span></>
              : <>{meta.label} <span className="font-mono text-[var(--text-muted)] text-[11px]">{labelSuffix}</span></>
            }
          </span>
        </div>

        {/* expand arrow */}
        <svg
          className={`w-3 h-3 mt-[3px] shrink-0 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-all duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {/* ── live progress ── */}
      {hasLive && (
        <div className="ml-5 mt-1 mb-0.5 rounded-md border border-[var(--border-primary)] bg-[var(--bg-tertiary)]/40 overflow-hidden">
          <pre
            ref={liveRef}
            className="px-3 py-2 text-[10.5px] font-mono text-[var(--text-secondary)] max-h-32 overflow-y-auto whitespace-pre-wrap leading-snug"
          >
            {progressLines.join('\n')}
          </pre>
        </div>
      )}

      {/* ── expanded detail ── */}
      {open && (
        <div className="ml-5 mt-1 mb-0.5 rounded-md border border-[var(--border-primary)] bg-[var(--bg-tertiary)]/20 overflow-hidden text-[11px]">
          {step.code && (
            <div>
              <div className="flex items-center justify-between px-3 py-1 bg-[var(--bg-page)]/60 border-b border-[var(--border-primary)]">
                <span className="text-[9.5px] uppercase font-semibold tracking-wider text-[var(--text-muted)]">Input</span>
                <CopyButton text={step.code} />
              </div>
              <pre className={`px-3 py-2 font-mono overflow-x-auto whitespace-pre leading-snug max-h-64 overflow-y-auto ${meta.color}`}>
                {step.code}
              </pre>
            </div>
          )}
          {step.output && (
            <div className="border-t border-[var(--border-primary)]">
              <div className="flex items-center gap-2 px-3 py-1 bg-[var(--bg-page)]/60 border-b border-[var(--border-primary)]">
                <span className="text-[9.5px] uppercase font-semibold tracking-wider text-[var(--text-muted)]">Output</span>
                {step.output.toLowerCase().includes('error') && (
                  <span className="text-[9px] text-red-400 bg-red-500/10 px-1 py-0.5 rounded uppercase tracking-wide">error</span>
                )}
              </div>
              <pre className="px-3 py-2 font-mono text-[var(--text-secondary)] overflow-x-auto whitespace-pre-wrap leading-snug max-h-48 overflow-y-auto">
                {step.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
