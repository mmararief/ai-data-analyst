import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { mdComponents } from './mdComponents'

import CriticCard from './CriticCard'
import ClarificationCard from './ClarificationCard'

function stripThinking(text) {
  if (typeof text !== 'string') return text
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<think>[\s\S]*$/g, '').trim()
}

export default function PartRenderer({ part, index, openInsights, toggleInsight, isLoading, projectId, isLastMessage, onApprovePlan, onSelectOption, onSubmitClarification }) {
  if (part.type === 'error') {
    return (
      <div key={index} className="flex items-start gap-2.5 p-3 rounded-lg border border-[var(--error)]/30 bg-[var(--error)]/5 my-2">
        <svg className="w-4 h-4 text-[var(--error)] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        <div>
          <p className="text-xs font-semibold text-[var(--error)] mb-0.5">Error</p>
          <p className="text-xs text-[var(--error)]/80 leading-relaxed">{part.content}</p>
        </div>
      </div>
    )
  }

  if (part.type === 'text') {
    const cleanedContent = stripThinking(part.content)
    if (!cleanedContent) return null
    return (
      <div key={index} className="text-[13.5px] text-[var(--text-secondary)] leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
          {cleanedContent}
        </ReactMarkdown>
      </div>
    )
  } else if (part.type === 'plan') {
    if (!part.content || part.content.length === 0) return null

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
        {isLastMessage && !isLoading && (
          <div className="mt-4">
            <button 
              onClick={() => onApprovePlan(part.content)}
              className="px-4 py-2 bg-emerald-500/90 hover:bg-emerald-500 text-white rounded-md text-[12.5px] font-semibold transition-all shadow-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
              Setuju & Eksekusi
            </button>
          </div>
        )}
      </div>
    )
  } else if (part.type === 'agent_label') {
    return (
      <div key={index} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-[var(--border-light)] bg-[var(--bg-tertiary)] text-[10px] font-medium text-[var(--text-muted)] my-2 shadow-sm">
        <svg className="w-3 h-3 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>
        Agent: <span className="text-[var(--text-secondary)] font-semibold">{part.content}</span>
      </div>
    )
  } else if (part.type === 'clarification') {
    return (
      <ClarificationCard
        key={index}
        part={part}
        isLastMessage={isLastMessage}
        isLoading={isLoading}
        onSelectOption={onSelectOption}
        onSubmit={onSubmitClarification}
      />
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
  } else if (part.type === 'critic') {
    return <CriticCard key={index} part={part} />
  } else if (part.type === 'insight') {
    const cleanedInsight = stripThinking(part.content)
    if (!cleanedInsight) return null
    return (
      <div key={index} className="mt-6 pt-4 border-t-2 border-dotted border-[var(--border-light)]">
        <button
          onClick={() => toggleInsight(index)}
          className="flex items-center gap-2 mb-3 text-[13px] font-bold text-[var(--text-heading)] hover:opacity-80 transition-opacity cursor-pointer w-full"
        >
          <svg className="w-4 h-4 text-[var(--analisai-cyan)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          Insight &amp; Summary
          <svg className={`w-4 h-4 shrink-0 transition-transform ${openInsights[index] ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>
        </button>
        {openInsights[index] && (
          <div className="text-[13.5px] text-[var(--text-secondary)] leading-relaxed bg-[var(--bg-tertiary)]/30 p-4 rounded-lg border border-[var(--border-light)] animate-fade-in">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {cleanedInsight}
            </ReactMarkdown>
          </div>
        )}
      </div>
    )
  } else if (part.type === 'file_export') {
    const formatIcons = {
      ipynb: '📓', csv: '📊', xlsx: '📊', md: '📝', html: '🌐', txt: '📄',
    }
    const formatColors = {
      ipynb: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
      csv: 'text-green-400 bg-green-500/10 border-green-500/20',
      xlsx: 'text-green-400 bg-green-500/10 border-green-500/20',
      md: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      html: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
      txt: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
    }
    const icon = formatIcons[part.format] || '📄'
    const colorCls = formatColors[part.format] || 'text-[var(--text-muted)] bg-[var(--bg-hover)] border-[var(--border-light)]'
    const sizeStr = part.size_bytes ? `${(part.size_bytes / 1024).toFixed(1)} KB` : ''

    return (
      <div key={index} className="my-2 inline-flex items-center gap-3 px-4 py-2.5 border border-[var(--border-primary)] rounded-lg bg-[var(--bg-tertiary)]/20 shadow-sm">
        <div className={`flex items-center justify-center w-8 h-8 rounded-md border text-base ${colorCls}`}>
          {icon}
        </div>
        <div>
          <div className="text-[12.5px] font-bold text-[var(--text-heading)]">
            {part.filename}
          </div>
          <div className="text-[10px] text-[var(--text-muted)] flex items-center gap-2">
            <span className="uppercase tracking-wider">{part.format}</span>
            {sizeStr && <span>· {sizeStr}</span>}
            <span>· Tersedia di sidebar</span>
          </div>
        </div>
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
        </div>
      </div>
    )
  } else if (part.type === 'image') {
    const chartName = part.filename || `grafik_${index}.png`
    return (
      <div key={index} className="my-3 space-y-1.5">
        <div className="rounded-xl overflow-hidden border border-[var(--border-primary)] shadow-md bg-[var(--bg-secondary)]">
          <img
            src={`data:image/png;base64,${part.content}`}
            alt={chartName}
            className="w-full block"
            style={{ maxHeight: '520px', objectFit: 'contain' }}
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[var(--text-muted)] font-mono">{chartName}</span>
          <a
            href={`data:image/png;base64,${part.content}`}
            download={chartName}
            className="inline-flex items-center gap-1 text-[11px] text-sky-500 hover:text-sky-400 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
            Download
          </a>
        </div>
      </div>
    )
  } else if (part.content) {
    // Legacy fallback for old messages stored without explicit type="image"
    return (
      <div key={index} className="my-3 space-y-1.5">
        <div className="rounded-xl overflow-hidden border border-[var(--border-primary)] shadow-md">
          <img src={`data:image/png;base64,${part.content}`} alt="grafik" className="w-full block" style={{ maxHeight: '520px', objectFit: 'contain' }} />
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
