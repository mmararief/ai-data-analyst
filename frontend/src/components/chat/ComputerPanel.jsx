// ComputerPanel – Kimi-style side panel that shows AI's real-time
// analysis process: task progress, code execution, and step details.

import { useState, useRef, useEffect, useMemo } from 'react'
import { CopyButton } from './mdComponents'

// ── Tool metadata (mirrors ToolCallStep.jsx) ──────────────────────────────────
const TOOL_META = {
  python_repl_tool: {
    label: 'Execute Python code',
    labelRunning: 'Menjalankan kode Python…',
    color: '#38bdf8',
    bgColor: 'rgba(56,189,248,0.08)',
    borderColor: 'rgba(56,189,248,0.2)',
    icon: (
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
      </svg>
    ),
  },
  render_chart_tool: {
    label: 'Membuat Chart',
    labelRunning: 'Merender chart…',
    color: '#a78bfa',
    bgColor: 'rgba(167,139,250,0.08)',
    borderColor: 'rgba(167,139,250,0.2)',
    icon: (
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
      </svg>
    ),
  },
  read_data_tool: {
    label: 'Membaca Dataset',
    labelRunning: 'Membaca dataset…',
    color: '#34d399',
    bgColor: 'rgba(52,211,153,0.08)',
    borderColor: 'rgba(52,211,153,0.2)',
    icon: (
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M3 6h18M3 18h18"/>
      </svg>
    ),
  },
  data_profile_tool: {
    label: 'Profiling Dataset',
    labelRunning: 'Membuat profiling…',
    color: '#fbbf24',
    bgColor: 'rgba(251,191,36,0.08)',
    borderColor: 'rgba(251,191,36,0.2)',
    icon: (
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
      </svg>
    ),
  },
}
const DEFAULT_META = TOOL_META.python_repl_tool

// ── Thinking step metadata ─────────────────────────────────────────────────────
const THINK_META = {
  label: 'Think',
  color: '#94a3b8',
  bgColor: 'rgba(148,163,184,0.06)',
  borderColor: 'rgba(148,163,184,0.15)',
  icon: (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
    </svg>
  ),
}

// ── Extract panel steps from message data ──────────────────────────────────────
function extractPanelSteps(message) {
  if (!message || message.role !== 'assistant') return []
  const parts = message.parts || []
  const codeSteps = message.codeSteps || []
  const steps = []

  for (const part of parts) {
    if (part.type === 'agent_label') {
      steps.push({ kind: 'think', label: part.content, status: 'done' })
    } else if (part.type === 'task_start') {
      steps.push({
        kind: 'task',
        label: part.content,
        index: part.index,
        total: part.total,
        agent: part.agent,
        status: 'done',
      })
    } else if (part.type === 'text' && part.content && !part.content.trim()) {
      // skip empty text parts
    } else if (part.type === 'code_step') {
      const step = codeSteps[part.stepIndex]
      if (step) {
        const toolKey = step.tool || 'python_repl_tool'
        const meta = TOOL_META[toolKey] || DEFAULT_META
        steps.push({
          kind: 'code',
          label: meta.label,
          toolKey,
          code: step.code || '',
          output: step.output || '',
          progressLines: step.progressLines || [],
          filename: step.filename || '',
          status: step.output ? 'done' : 'running',
        })
      }
    } else if (part.type === 'plan') {
      steps.push({
        kind: 'think',
        label: `Merencanakan ${Array.isArray(part.content) ? part.content.length : 0} langkah`,
        status: 'done',
      })
    } else if (part.type === 'critic') {
      steps.push({
        kind: 'think',
        label: part.judgment === 'pass' ? 'Evaluasi: Lulus ✓' : 'Evaluasi: Perlu perbaikan',
        status: 'done',
      })
    }
  }

  return steps
}

// ── Step Card ─────────────────────────────────────────────────────────────────
function StepCard({ step, isActive, isLast, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  const outputRef = useRef(null)

  useEffect(() => {
    if (isActive && step.kind === 'code') setOpen(true)
  }, [isActive, step.kind])

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
  }, [step.output, step.progressLines?.length])

  const isCode = step.kind === 'code'
  const meta = isCode ? (TOOL_META[step.toolKey] || DEFAULT_META) : THINK_META
  const isDone = step.status === 'done'
  const isRunning = step.status === 'running'

  return (
    <div className={`panel-step rounded-lg transition-all duration-200 ${isActive ? 'step-active' : ''}`}
      style={{
        border: `1px solid ${isActive ? meta.borderColor : 'var(--border-primary)'}`,
        background: isActive ? meta.bgColor : 'transparent',
        marginBottom: 6,
      }}
    >
      {/* Step header */}
      <button
        onClick={() => isCode && setOpen(v => !v)}
        className="flex items-center gap-2.5 w-full text-left px-3 py-2.5 rounded-lg"
        style={{ cursor: isCode ? 'pointer' : 'default' }}
      >
        {/* Status indicator */}
        <div className="shrink-0 flex items-center justify-center" style={{ width: 18, height: 18 }}>
          {isRunning ? (
            <svg className="animate-spin" width="14" height="14" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke={meta.color} strokeWidth="4"/>
              <path className="opacity-75" fill={meta.color} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          ) : isDone ? (
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#34d399">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
            </svg>
          ) : (
            <span style={{ color: meta.color }}>{meta.icon}</span>
          )}
        </div>

        {/* Label */}
        <span className="flex-1 min-w-0 text-[12px] leading-snug" style={{
          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontWeight: isActive ? 500 : 400,
        }}>
          {step.label}
          {step.filename && <span className="text-[var(--text-muted)] ml-1">— {step.filename}</span>}
        </span>

        {/* Expand chevron for code steps */}
        {isCode && (
          <svg
            className="shrink-0 transition-transform duration-200"
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', color: 'var(--text-muted)', width: 12, height: 12 }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        )}
      </button>

      {/* Expanded code detail */}
      {isCode && open && (
        <div className="mx-3 mb-3 rounded-md overflow-hidden border" style={{
          borderColor: 'var(--border-primary)',
          background: 'var(--bg-page)',
        }}>
          {/* Request section */}
          {step.code && (
            <div>
              <div className="flex items-center justify-between px-3 py-1.5" style={{
                background: 'var(--bg-tertiary)',
                borderBottom: '1px solid var(--border-primary)',
              }}>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] uppercase font-bold tracking-widest" style={{ color: 'var(--text-muted)' }}>Request</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded" style={{
                    background: 'rgba(56,189,248,0.1)',
                    color: '#38bdf8',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>IPython</span>
                </div>
                <CopyButton text={step.code} />
              </div>
              <pre className="px-3 py-2.5 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap leading-snug max-h-48 overflow-y-auto" style={{
                color: '#38bdf8',
                background: '#0d1117',
              }}>
                {step.code}
              </pre>
            </div>
          )}

          {/* Progress lines (live) */}
          {isRunning && step.progressLines?.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-primary)' }}>
              <div className="px-3 py-1.5" style={{ background: 'var(--bg-tertiary)' }}>
                <span className="text-[9px] uppercase font-bold tracking-widest" style={{ color: '#fbbf24' }}>Live Output</span>
              </div>
              <pre ref={outputRef} className="px-3 py-2 text-[10.5px] font-mono overflow-x-auto whitespace-pre-wrap leading-snug max-h-32 overflow-y-auto" style={{
                color: 'var(--text-secondary)',
              }}>
                {step.progressLines.join('\n')}
              </pre>
            </div>
          )}

          {/* Response section */}
          {step.output && (
            <div style={{ borderTop: '1px solid var(--border-primary)' }}>
              <div className="flex items-center gap-2 px-3 py-1.5" style={{
                background: 'var(--bg-tertiary)',
                borderBottom: '1px solid var(--border-primary)',
              }}>
                <span className="text-[9px] uppercase font-bold tracking-widest" style={{ color: 'var(--text-muted)' }}>Response</span>
                {step.output.toLowerCase().includes('error') && (
                  <span className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold" style={{
                    color: '#f87171', background: 'rgba(248,113,113,0.1)',
                  }}>error</span>
                )}
              </div>
              <pre className="px-3 py-2.5 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap leading-snug max-h-40 overflow-y-auto" style={{
                color: 'var(--text-secondary)',
              }}>
                {step.output}
              </pre>
            </div>
          )}

          {/* Running indicator when no output yet */}
          {isRunning && !step.output && step.progressLines?.length === 0 && (
            <div style={{ borderTop: '1px solid var(--border-primary)' }}>
              <div className="flex items-center gap-2 px-3 py-3">
                <div className="relative overflow-hidden rounded-full" style={{ width: '100%', height: 2, background: 'var(--border-primary)' }}>
                  <div className="absolute inset-0 rounded-full progress-slide" style={{ width: '25%', background: 'linear-gradient(90deg, transparent, #38bdf8, transparent)' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main ComputerPanel ────────────────────────────────────────────────────────
export default function ComputerPanel({ message, loading, statusText, onClose }) {
  const scrollRef = useRef(null)
  const [userScrolledUp, setUserScrolledUp] = useState(false)

  const steps = useMemo(() => extractPanelSteps(message), [message])

  // Compute progress
  const taskParts = useMemo(() => {
    if (!message?.parts) return { current: 0, total: 0, label: '' }
    const taskStarts = message.parts.filter(p => p.type === 'task_start')
    if (taskStarts.length === 0) return { current: 0, total: 0, label: '' }
    const last = taskStarts[taskStarts.length - 1]
    return {
      current: (last.index ?? 0) + 1,
      total: last.total || taskStarts.length,
      label: last.content || '',
    }
  }, [message?.parts])

  const doneSteps = steps.filter(s => s.status === 'done').length
  const totalSteps = steps.length

  // Auto-scroll to bottom on new steps
  useEffect(() => {
    if (!userScrolledUp && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [steps.length, userScrolledUp])

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollHeight, scrollTop, clientHeight } = scrollRef.current
    setUserScrolledUp(scrollHeight - scrollTop - clientHeight > 80)
  }

  if (!message) return null

  return (
    <div
      className="computer-panel-desktop computer-panel-enter"
      style={{
        width: 420,
        minWidth: 340,
        maxWidth: 480,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid var(--border-primary)',
        background: 'var(--bg-secondary)',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {/* ── Header ── */}
      <div style={{
        padding: '16px 16px 12px',
        borderBottom: '1px solid var(--border-primary)',
        flexShrink: 0,
      }}>
        {/* Title row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            {/* Computer icon */}
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'rgba(56,189,248,0.1)',
              border: '1px solid rgba(56,189,248,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#38bdf8">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
            </div>
            <div>
              <div className="text-[13px] font-semibold" style={{
                color: 'var(--text-primary)',
                fontFamily: "'Syne', sans-serif",
                letterSpacing: '-0.01em',
              }}>
                Analisai's Computer
              </div>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 6,
              background: 'transparent', border: 'none',
              color: 'var(--text-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
            title="Tutup Panel"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Status row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status dot + label */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{
            background: loading ? 'rgba(52,211,153,0.08)' : 'rgba(148,163,184,0.06)',
            border: `1px solid ${loading ? 'rgba(52,211,153,0.2)' : 'rgba(148,163,184,0.15)'}`,
          }}>
            <span className="relative flex" style={{ width: 7, height: 7 }}>
              {loading && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: '#34d399' }} />
              )}
              <span className="relative inline-flex rounded-full" style={{
                width: 7, height: 7,
                background: loading ? '#34d399' : '#64748b',
              }} />
            </span>
            <span className="text-[10.5px] font-medium" style={{
              color: loading ? '#34d399' : 'var(--text-muted)',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {loading ? 'Active' : 'Completed'}
            </span>
          </div>

          {/* Task progress */}
          {taskParts.total > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{
              background: 'rgba(168,199,250,0.06)',
              border: '1px solid rgba(168,199,250,0.15)',
            }}>
              <span className="text-[10.5px] font-medium" style={{
                color: 'var(--text-accent)',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                Task {taskParts.current}/{taskParts.total}
              </span>
            </div>
          )}

          {/* Step counter */}
          {totalSteps > 0 && (
            <span className="text-[10px]" style={{
              color: 'var(--text-muted)',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {doneSteps}/{totalSteps} steps
            </span>
          )}
        </div>

        {/* Current status text */}
        {loading && statusText && (
          <div className="mt-2 text-[11px] truncate" style={{
            color: 'var(--text-muted)',
            fontStyle: 'italic',
          }}>
            {statusText}
          </div>
        )}
      </div>

      {/* ── Steps list ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="panel-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 12px',
        }}
      >
        {steps.length === 0 && loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-8" style={{ color: 'var(--text-muted)' }}>
            <svg className="animate-spin" width="20" height="20" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span className="text-[11px]">Memulai analisis...</span>
          </div>
        )}

        {steps.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center gap-2 py-8" style={{ color: 'var(--text-muted)' }}>
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="opacity-40">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
            <span className="text-[11px]">Belum ada proses</span>
          </div>
        )}

        {steps.map((step, i) => (
          <StepCard
            key={i}
            step={step}
            isActive={i === steps.length - 1 && loading}
            isLast={i === steps.length - 1}
            defaultOpen={i === steps.length - 1 && step.kind === 'code'}
          />
        ))}
      </div>

      {/* ── Footer summary (when done) ── */}
      {!loading && totalSteps > 0 && (
        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid var(--border-primary)',
          flexShrink: 0,
        }}>
          <div className="flex items-center gap-2 text-[11px]" style={{
            color: 'var(--text-muted)',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#34d399">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
            </svg>
            <span>Selesai · {doneSteps} langkah berhasil dijalankan</span>
          </div>
        </div>
      )}
    </div>
  )
}
