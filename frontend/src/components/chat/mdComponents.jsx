import { useState } from 'react'

export function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button onClick={copy} className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-[10px] flex items-center gap-1">
      {copied ? (
        <><svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg><span className="text-emerald-400">Copied</span></>
      ) : (
        <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>Copy</>
      )}
    </button>
  )
}

export const mdComponents = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-[var(--text-heading)]">{children}</strong>,
  em: ({ children }) => <em className="italic text-[var(--text-secondary)]">{children}</em>,
  ul: ({ children }) => <ul className="list-disc list-outside pl-5 space-y-1 my-2">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-outside pl-5 space-y-1 my-2">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }) => <h1 className="text-lg font-bold text-[var(--text-heading)] mt-4 mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-bold text-[var(--text-heading)] mt-4 mb-2">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold text-[var(--text-primary)] mt-3 mb-1">{children}</h3>,
  code: ({ className, children }) => {
    const text = String(children).replace(/\n$/, '')
    const hasLang = /language-(\w+)/.test(className || '')
    const isBlock = hasLang || text.includes('\n') || text.length > 120
    if (!isBlock) {
      return <code className="bg-[var(--bg-tertiary)] text-[var(--analisai-cyan)] rounded px-1.5 py-0.5 text-[12px] font-mono">{text}</code>
    }
    return (
      <div className="relative group my-3">
        <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--bg-header)] rounded-t-lg border-b border-[var(--border-primary)]">
          <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest">python</span>
          <CopyButton text={text} />
        </div>
        <pre className="bg-[#0d1117] rounded-b-lg px-4 py-3 text-[12px] text-sky-300 font-mono overflow-x-auto whitespace-pre-wrap border-x border-b border-[var(--border-primary)]">{text}</pre>
      </div>
    )
  },
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
