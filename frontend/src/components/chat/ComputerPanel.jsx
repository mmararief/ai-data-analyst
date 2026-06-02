// ComputerPanel – Kimi-style side panel that shows AI's real-time
// analysis process: task progress, code execution, and step details.

import { useState, useRef, useEffect, useMemo } from 'react'
import { CopyButton } from './mdComponents'

// SVG Icons matching Kimi design
const DOC_ICON = (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
  </svg>
)

const TERMINAL_ICON = (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
  </svg>
)

const NOTEBOOK_EDIT_ICON = (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
  </svg>
)

const CODE_ICON = (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
  </svg>
)

const DOWNLOAD_ICON = (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
)

// Retro CRT Monitor SVG Icon
const RETRO_COMPUTER_ICON = (
  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-[var(--text-secondary)]">
    <rect x="3" y="3" width="18" height="13" rx="2" strokeWidth="2" />
    <path d="M7 21h10" strokeWidth="2" strokeLinecap="round" />
    <path d="M9 16l-2 5M15 16l2 5" strokeWidth="2" />
    <rect x="5" y="5" width="14" height="9" rx="1" strokeWidth="1.5" />
  </svg>
)

function formatStepLabel(step) {
  const tool = step.tool || 'python_repl_tool'
  const code = step.code || ''
  
  if (tool === 'read_data_tool') {
    const match = code.match(/read_data_tool\(['"]([^'"]+)['"]/);
    const fname = match ? match[1] : (step.filename || 'dataset')
    return `Read ${fname}`
  }
  if (tool === 'download_dataset_tool') {
    const matchFname = code.match(/filename=['"]([^'"]+)['"]/);
    const matchUrl = code.match(/url=['"]([^'"]+)['"]/);
    const fname = matchFname && matchFname[1] ? matchFname[1] : '';
    const url = matchUrl && matchUrl[1] ? matchUrl[1] : '';
    return fname ? `Download ${fname}` : (url ? `Download dari internet` : 'Download dataset');
  }
  if (tool === 'bash_tool') {
    if (code.includes('head')) {
      return 'Execute Terminal | Preview CSV file structure'
    }
    if (code.includes('todo') || code.includes('TODO')) {
      return 'Write Todo'
    }
    const cleanCmd = code.replace(/^\$\s*/, '').trim()
    return `Execute Terminal | ${cleanCmd.slice(0, 30)}`
  }
  if (tool === 'render_chart_tool') {
    return 'Membuat Chart'
  }
  if (tool === 'data_profile_tool') {
    return 'Profiling Dataset'
  }
  return 'Execute Python code'
}

function getStepIcon(step, label) {
  const tool = step.tool || 'python_repl_tool'
  if (label.startsWith('Read')) {
    return { icon: DOC_ICON, color: 'text-sky-500 dark:text-sky-400' }
  }
  if (label.startsWith('Download')) {
    return { icon: DOWNLOAD_ICON, color: 'text-emerald-500 dark:text-emerald-400' }
  }
  if (label === 'Write Todo') {
    return { icon: NOTEBOOK_EDIT_ICON, color: 'text-amber-600 dark:text-amber-400' }
  }
  if (tool === 'bash_tool') {
    return { icon: TERMINAL_ICON, color: 'text-pink-500 dark:text-pink-400' }
  }
  return { icon: CODE_ICON, color: 'text-blue-500 dark:text-blue-400' }
}

function CompactCopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = (e) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button
      onClick={copy}
      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all flex items-center gap-1 cursor-pointer bg-transparent border-0 p-1 rounded hover:bg-[var(--bg-hover)] shrink-0"
      title="Salin"
    >
      {copied ? (
        <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
        </svg>
      )}
    </button>
  )
}

export default function ComputerPanel({ message, loading, statusText, onClose, selectedStepIndex }) {
  const scrollRef = useRef(null)
  const [userScrolledUp, setUserScrolledUp] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)

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

  const codeSteps = message?.codeSteps || []
  const totalSteps = codeSteps.length
  
  const stepData = selectedStepIndex >= 0 && selectedStepIndex < codeSteps.length 
    ? codeSteps[selectedStepIndex] 
    : null

  const isRunning = stepData ? (loading && selectedStepIndex === codeSteps.length - 1 && !stepData.output) : false

  const label = stepData ? formatStepLabel(stepData) : ''
  const { icon, color } = stepData ? getStepIcon(stepData, label) : { icon: null, color: '' }

  // Auto-scroll to bottom on new step output
  useEffect(() => {
    if (!userScrolledUp && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [stepData?.output, stepData?.progressLines?.length, userScrolledUp])

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollHeight, scrollTop, clientHeight } = scrollRef.current
    setUserScrolledUp(scrollHeight - scrollTop - clientHeight > 80)
  }

  if (!message) return null

  return (
    <div
      className="computer-panel-desktop computer-panel-enter text-[var(--text-primary)]"
      style={{
        width: isMaximized ? '50vw' : 440,
        minWidth: isMaximized ? '600px' : 360,
        maxWidth: isMaximized ? '900px' : 520,
        height: 'calc(100% - 24px)',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--border-primary)',
        borderRadius: '16px',
        background: 'var(--bg-primary)',
        position: 'relative',
        flexShrink: 0,
        margin: '12px 12px 12px 8px',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-lg)',
        transition: 'width 0.3s ease, max-width 0.3s ease, min-width 0.3s ease',
      }}
    >
      {/* ── Kimi Header Bar ── */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-primary)',
        flexShrink: 0,
      }} className="w-full flex items-center justify-between">
        
        {/* Left side: Icon, title, status stacked vertically */}
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 flex items-center justify-center text-[var(--text-primary)] shrink-0 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] shadow-sm">
            {RETRO_COMPUTER_ICON}
          </div>
          
          <div className="flex flex-col min-w-0">
            <span className="text-[13.5px] font-semibold tracking-tight text-[var(--text-primary)] leading-tight mt-0.5">
              Analisai's Computer
            </span>
            
            {/* Green dot status + task label */}
            {taskParts.total > 0 ? (
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] truncate mt-0.5 leading-none">
                <span className="w-2.5 h-2.5 flex items-center justify-center shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Task Progress {taskParts.current}/{taskParts.total}
                </span>
                <span className="text-[var(--border-primary)] select-none">|</span>
                <span className="truncate">{taskParts.label} &gt;</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] mt-0.5 leading-none">
                <span className="w-2.5 h-2.5 flex items-center justify-center shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                </span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Running</span>
              </div>
            )}
          </div>
        </div>

        {/* Right side: Actions / Maximize / Close */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsMaximized(prev => !prev)}
            className="w-7 h-7 rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-all flex items-center justify-center cursor-pointer"
            title={isMaximized ? "Perkecil Panel" : "Perbesar Panel"}
          >
            {isMaximized ? (
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M20 12H4"/>
              </svg>
            ) : (
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4"/>
              </svg>
            )}
          </button>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-all flex items-center justify-center cursor-pointer"
            title="Tutup Panel"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Main Details Scrollable Area ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="panel-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
        }}
      >
        {!stepData ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--text-muted)] text-[12px]">
            {loading ? (
              <>
                <svg className="animate-spin text-sky-400" width="18" height="18" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <span>Memulai analisis...</span>
              </>
            ) : (
              <>
                {RETRO_COMPUTER_ICON}
                <span>Belum ada proses berjalan</span>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            
            {/* Unified IPython/Terminal Card (Kimi UI style) */}
            <div className="rounded-xl overflow-hidden border border-[var(--border-primary)] bg-[var(--bg-code)] shadow-lg">
              
              {/* Terminal Card Header with Centered Tool Name */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
                <div className="flex-1" />
                <span className="text-[11.5px] font-semibold text-[var(--text-secondary)] font-mono uppercase tracking-wider text-center flex-1 select-none">
                  {stepData.tool === 'bash_tool' ? 'Terminal' : 'iPython'}
                </span>
                <div className="flex-1 flex justify-end">
                  <CompactCopyButton text={`${stepData.code}\n\n${stepData.output || ''}`} />
                </div>
              </div>

              {/* Terminal Code & Output Body */}
              <div className="p-4 text-[12.5px] font-mono leading-relaxed overflow-x-auto select-text flex flex-col gap-4">
                
                {/* Request Section */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between border-b border-[var(--border-light)] pb-1.5 mb-2.5 select-none">
                    <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider font-sans">
                      Request
                    </span>
                    <CompactCopyButton text={stepData.code} />
                  </div>
                  <pre className="text-[var(--text-primary)] whitespace-pre-wrap select-text leading-relaxed break-all">
                    {stepData.code}
                  </pre>
                </div>

                {/* Response / Progress Section */}
                {(stepData.output || isRunning) && (
                  <div className="flex flex-col border-t border-[var(--border-primary)] pt-4 mt-2">
                    <div className="flex items-center justify-between border-b border-[var(--border-light)] pb-1.5 mb-2.5 select-none">
                      <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider font-sans">
                        {isRunning ? 'Running Progress' : 'Response'}
                      </span>
                      {stepData.output && (
                        <CompactCopyButton text={stepData.output} />
                      )}
                    </div>

                    {/* Progress Lines */}
                    {isRunning && stepData.progressLines?.length > 0 && (
                      <pre className="text-[var(--text-secondary)] opacity-90 whitespace-pre-wrap select-text leading-relaxed mb-3">
                        {stepData.progressLines.join('\n')}
                      </pre>
                    )}

                    {/* Final Output */}
                    {stepData.output ? (
                      <pre className="text-[var(--text-secondary)] whitespace-pre-wrap select-text leading-relaxed break-all">
                        {stepData.output}
                      </pre>
                    ) : (
                      isRunning && !stepData.progressLines?.length && (
                        <div className="flex items-center gap-2 text-[var(--text-muted)] mt-2 animate-pulse font-sans text-[12px]">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
                          </span>
                          <span>Mengeksekusi...</span>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* ── Footer status (when done) ── */}
      {!loading && totalSteps > 0 && (
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border-primary)',
          flexShrink: 0,
        }}>
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] font-mono">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#4ade80">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
            </svg>
            <span>Selesai · {totalSteps} langkah berhasil dijalankan</span>
          </div>
        </div>
      )}
    </div>
  )
}
