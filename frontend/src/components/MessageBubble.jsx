import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import api from '../api'

async function generateAndDownloadNotebook(allMessages) {
  const token = localStorage.getItem('token')
  const payload = allMessages.map(m => ({
    role: m.role,
    content: m.content || '',
    parts: m.parts || [],
    codeSteps: (m.codeSteps || []).map(s => ({ code: s.code || '', output: s.output || '' })),
    images: m.images || [],
  }))
  const res = await fetch('/notebook/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ messages: payload }),
  })
  if (!res.ok) throw new Error('Gagal generate notebook')
  const notebook = await res.json()
  const blob = new Blob([JSON.stringify(notebook, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `analisis_${Date.now()}.ipynb`
  a.click()
  URL.revokeObjectURL(url)
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button onClick={copy} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-slate-300 text-[10px] flex items-center gap-1">
      {copied ? (
        <><svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg><span className="text-emerald-400">Copied</span></>
      ) : (
        <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>Copy</>
      )}
    </button>
  )
}

const mdComponents = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-[var(--text-heading)]">{children}</strong>,
  em: ({ children }) => <em className="italic text-[var(--text-secondary)]">{children}</em>,
  ul: ({ children }) => <ul className="list-disc list-outside pl-5 space-y-1 my-2">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-outside pl-5 space-y-1 my-2">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }) => <h1 className="text-lg font-bold text-[var(--text-heading)] mt-4 mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-bold text-[var(--text-heading)] mt-4 mb-2">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold text-[var(--text-primary)] mt-3 mb-1">{children}</h3>,
  code: ({ inline, children }) =>
    inline
      ? <code className="bg-sky-100 text-sky-700 dark:bg-slate-800 dark:text-sky-300 rounded px-1.5 py-0.5 text-[12px] font-mono">{children}</code>
      : (
        <div className="relative group my-3">
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-200 dark:bg-slate-800/80 rounded-t-lg border-b border-slate-300 dark:border-slate-700/60">
            <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest">python</span>
            <CopyButton text={String(children)} />
          </div>
          <pre className="bg-[#0d1117] rounded-b-lg px-4 py-3 text-[12px] text-sky-300 font-mono overflow-x-auto whitespace-pre-wrap">{children}</pre>
        </div>
      ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-3 rounded-lg border border-[var(--border-primary)]">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-[var(--bg-tertiary)]">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-[var(--border-light)]">{children}</tbody>,
  tr: ({ children }) => <tr className="hover:bg-[var(--bg-hover)] transition-colors">{children}</tr>,
  th: ({ children }) => <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider whitespace-nowrap">{children}</th>,
  td: ({ children }) => <td className="px-4 py-2.5 text-[var(--text-secondary)] text-[12px]">{children}</td>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-sky-500/50 pl-4 text-[var(--text-muted)] italic my-2">{children}</blockquote>,
  hr: () => <hr className="border-[var(--border-primary)] my-4" />,
}

/** Single inline collapsible tool-call row — professional minimalist style */
function ToolCallStep({ step, index, isRunning }) {
  const [open, setOpen] = useState(false)
  const liveRef = useRef(null)
  const lineCount = step.code ? step.code.split('\n').length : 0
  const hasOutput = !!step.output
  const progressLines = step.progressLines || []
  const hasLive = isRunning && progressLines.length > 0

  // Auto-scroll live terminal to the latest line
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
              <pre className="px-3 py-2 text-[11px] font-mono text-sky-700 dark:text-sky-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">{step.code}</pre>
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
              <pre className="px-3 py-2 text-[11px] font-mono text-slate-600 dark:text-slate-400 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">{step.output}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex gap-1.5">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      <span className="text-xs text-slate-500">Menganalisis data...</span>
    </div>
  )
}

function PartRenderer({ part, index, openInsights, toggleInsight }) {
  if (part.type === 'text') {
    return (
      <div key={index} className="text-[13.5px] text-[var(--text-secondary)] leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
          {part.content}
        </ReactMarkdown>
      </div>
    )
  } else if (part.type === 'plan') {
    return (
      <div key={index} className="my-3 border-l-2 border-[var(--border-primary)] pl-4 py-1">
        <div className="flex items-center gap-2 mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
          Rencana Eksekusi {part.content?.length ? `(${part.content.length} langkah)` : ''}
        </div>
        <div className="space-y-2">
          {(part.content || []).map((item, ti) => {
            const taskText = typeof item === 'string' ? item : (item?.task || String(item))
            const agentType = typeof item === 'object' ? item?.agent : null
            return (
              <div key={ti} className="flex items-start gap-2 text-[12.5px] text-[var(--text-secondary)] leading-relaxed">
                <span className="text-[var(--text-muted)] font-mono shrink-0 select-none mt-0.5">{ti + 1}.</span>
                <span>{taskText}
                  {agentType && (
                    <span className="ml-2 inline-block px-1.5 py-0.5 rounded-sm border border-[var(--border-light)] bg-[var(--bg-tertiary)] text-[9px] uppercase tracking-wider text-[var(--text-muted)] select-none">
                      {agentType}
                    </span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  } else if (part.type === 'agent_label') {
    return (
      <div key={index} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-[var(--border-light)] bg-[var(--bg-tertiary)] text-[10px] font-medium text-[var(--text-muted)] my-2 shadow-sm">
        <svg className="w-3 h-3 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>
        Agent: <span className="text-[var(--text-secondary)] font-semibold">{part.content}</span>
      </div>
    )
  } else if (part.type === 'task_start') {
    return (
      <div key={index} className="flex items-center gap-2 mt-4 mb-2">
        <span className="text-[10px] bg-[var(--bg-tertiary)] border border-[var(--border-light)] px-1.5 py-0.5 rounded text-[var(--text-muted)] shrink-0 font-mono select-none">
          {(part.index ?? 0) + 1}/{part.total}
        </span>
        <span className="text-[12px] text-[var(--text-primary)] font-medium truncate">{part.content}</span>
        {part.agent && (
          <span className="ml-1 inline-block px-1.5 py-0.5 rounded-sm border border-[var(--border-light)] bg-[var(--bg-tertiary)] text-[9px] uppercase tracking-wider text-[var(--text-muted)] select-none">
            {part.agent}
          </span>
        )}
        <div className="flex-1 h-px bg-[var(--border-light)] ml-1" />
      </div>
    )
  } else if (part.type === 'insight') {
    return (
      <div key={index} className="mt-6 pt-4 border-t-2 border-dotted border-[var(--border-light)]">
        <button
          onClick={() => toggleInsight(index)}
          className="flex items-center gap-2 mb-3 text-[13px] font-bold text-[var(--text-heading)] hover:opacity-80 transition-opacity cursor-pointer w-full"
        >
          <svg className="w-4 h-4 text-sky-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          Insight &amp; Summary
          <svg className={`w-4 h-4 shrink-0 transition-transform ${openInsights[index] ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>
        </button>
        {openInsights[index] && (
          <div className="text-[13.5px] text-[var(--text-secondary)] leading-relaxed bg-[var(--bg-tertiary)]/30 p-4 rounded-lg border border-[var(--border-light)] animate-fade-in">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {part.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    )
  } else if (part.type === 'streamlit') {
    return <StreamlitPanel key={index} filename={part.content} />
  } else if (part.content) {
    // Image
    return (
      <div key={index} className="space-y-1">
        <div className="rounded-lg overflow-hidden border border-slate-800">
          <img src={`data:image/png;base64,${part.content}`} alt="grafik" className="w-full" />
        </div>
        <a href={`data:image/png;base64,${part.content}`} download={`grafik_${index}.png`}
          className="inline-flex items-center gap-1 text-[11px] text-sky-500 hover:text-sky-400 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
          Download
        </a>
      </div>
    )
  }
  return null
}

function StreamlitPanel({ filename }) {
  const [info, setInfo] = useState(null)
  const [launching, setLaunching] = useState(false)
  const [iframeReady, setIframeReady] = useState(false)
  const [error, setError] = useState('')

  const launch = async () => {
    setLaunching(true); setError(''); setIframeReady(false)
    try {
      const res = await api.post('/streamlit/run', { filename })
      setInfo(res.data)
      setTimeout(() => setIframeReady(true), 1000)
    } catch (e) {
      setError(e.response?.data?.detail || 'Gagal menjalankan Streamlit')
    } finally { setLaunching(false) }
  }

  const stop = async () => {
    try { await api.post('/streamlit/stop'); setInfo(null); setIframeReady(false) } catch {}
  }

  return (
    <div className="rounded-lg border border-sky-500/25 bg-sky-950/20 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          <span className="text-xs font-mono text-sky-300">{filename}</span>
        </div>
        <div className="flex items-center gap-2">
          {info ? (
            <>
              <a href={info.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-sky-400 hover:text-sky-300 border border-sky-600/30 px-2.5 py-1 rounded transition-colors">Buka ↗</a>
              <button onClick={stop} className="text-[11px] text-red-400 hover:text-red-300 border border-red-600/20 px-2.5 py-1 rounded transition-colors">Stop</button>
            </>
          ) : (
            <button onClick={launch} disabled={launching} className="text-[11px] text-sky-300 bg-sky-900/40 hover:bg-sky-900/60 disabled:opacity-50 px-3 py-1 rounded transition-colors flex items-center gap-1.5">
              {launching ? <><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Starting...</> : <>▶ Run Dashboard</>}
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-red-400 px-3 pb-2">{error}</p>}
      {info && !iframeReady && <div className="flex items-center justify-center gap-2 py-6 text-sky-400 text-xs border-t border-sky-500/20"><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Mempersiapkan dashboard...</div>}
      {info && iframeReady && <iframe src={info.url} className="w-full border-t border-sky-500/20" style={{ height: '600px' }} title="Streamlit Dashboard" />}
    </div>
  )
}

export default function MessageBubble({ message, isLoading, statusText, allMessages }) {
  const isUser = message.role === 'user'
  const isEmpty = !message.parts?.length && !message.codeSteps?.length
  const [nbLoading, setNbLoading] = useState(false)
  const [nbError, setNbError] = useState('')
  const [openInsights, setOpenInsights] = useState({})  // Track which insights are open

  const toggleInsight = (index) => {
    setOpenInsights(prev => ({
      ...prev,
      [index]: !prev[index]
    }))
  }

  const handleDownloadNotebook = async () => {
    setNbLoading(true); setNbError('')
    try { await generateAndDownloadNotebook(allMessages) }
    catch { setNbError('Gagal generate, coba lagi.') }
    finally { setNbLoading(false) }
  }

  // Build a merged, ordered list of text/image/streamlit parts + code steps
  // Properly interleave code steps with the analysis text/plans they belong to
  const buildOrderedParts = () => {
    const parts = message.parts || (message.content ? [{ type: 'text', content: message.content }] : [])
    const steps = message.codeSteps || []
    
    // Smart interleaving: group parts by task/agent, then interleave with corresponding steps
    // Count non-insight parts to distribute code steps
    const nonInsightParts = parts.filter(p => p.type !== 'insight')
    const insightPart = parts.find(p => p.type === 'insight')
    
    if (steps.length === 0) {
      // No steps, just return parts as ordered array
      const ordered = nonInsightParts.map(p => ({ type: 'part', value: p }))
      if (insightPart) {
        ordered.push({ type: 'part', value: insightPart })
      }
      return { ordered, parts, steps: [] }
    }
    
    // Distribute code steps among the non-insight parts
    // Simple heuristic: divide steps equally among agents/tasks
    const stepsPerBlock = Math.ceil(steps.length / Math.max(nonInsightParts.length, 1))
    
    const ordered = []
    let stepIndex = 0
    
    // Interleave parts and steps
    nonInsightParts.forEach(part => {
      ordered.push({ type: 'part', value: part })
      
      // Add corresponding code steps for this part
      const stepsToAdd = steps.slice(stepIndex, stepIndex + stepsPerBlock)
      stepsToAdd.forEach(step => {
        ordered.push({ type: 'step', value: step })
      })
      stepIndex += stepsToAdd.length
    })
    
    // Add remaining steps
    while (stepIndex < steps.length) {
      ordered.push({ type: 'step', value: steps[stepIndex] })
      stepIndex++
    }
    
    // Add insight at the end
    if (insightPart) {
      ordered.push({ type: 'part', value: insightPart })
    }
    
    return { ordered, parts, steps }
  }
  const { ordered, parts: allParts, steps } = buildOrderedParts()
  const lastStepRunning = isLoading && steps.length > 0 && !steps[steps.length - 1]?.output

  return (
    <div className="msg-appear max-w-4xl mx-auto w-full">
      {isUser ? (
        /* User bubble — right-aligned, compact */
        <div className="flex justify-end">
          <div className="bg-[var(--bg-bubble-user)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[78%]">
            <p className="text-sm leading-relaxed">{message.content}</p>
          </div>
        </div>
      ) : (
        /* Assistant — VS Code agent style: no heavy card, clean inline layout */
        <div className="space-y-0.5">
          {/* Subtle left accent line like VS Code chat */}
          <div className="flex gap-4">
            <div className="w-px bg-[var(--border-primary)] shrink-0 rounded-full mt-1 mb-1" />

            <div className="flex-1 min-w-0 space-y-2 pb-1">
              {/* Processing shimmer */}
              {isLoading && isEmpty && (
                <div className="h-px w-full shimmer-bar rounded-full" />
              )}

              {isEmpty ? (
                <TypingIndicator />
              ) : (
                <>
                  {/* Interleaved text/image/streamlit parts + code steps */}
                  {ordered.map((item, i) =>
                    item.type === 'part' ? (
                      <PartRenderer key={i} part={item.value} index={i} openInsights={openInsights} toggleInsight={toggleInsight} />
                    ) : (
                      <ToolCallStep
                        key={i}
                        step={item.value}
                        index={i}
                        isRunning={isLoading && i === ordered.length - 1 && !item.value.output}
                      />
                    )
                  )}

                  {/* Live status when still processing */}
                  {isLoading && (
                    <div className="flex items-center gap-2 pt-0.5">
                      <div className="flex gap-1">
                        <span className="typing-dot" style={{ width: 4, height: 4 }} />
                        <span className="typing-dot" style={{ width: 4, height: 4 }} />
                        <span className="typing-dot" style={{ width: 4, height: 4 }} />
                      </div>
                      <span className="text-[11px] text-slate-600 italic">{statusText || 'Memproses...'}</span>
                    </div>
                  )}

                  {/* Download notebook CTA */}
                  {!isLoading && steps.length > 0 && (
                    <div className="pt-2 flex items-center gap-3 border-t border-[var(--border-light)]">
                      <button
                        onClick={handleDownloadNotebook}
                        disabled={nbLoading}
                        className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-sky-400 disabled:opacity-50 transition-colors"
                      >
                        {nbLoading ? (
                          <><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Menyusun notebook...</>
                        ) : (
                          <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>Download .ipynb</>
                        )}
                      </button>
                      {nbError && <span className="text-[11px] text-red-400">{nbError}</span>}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

