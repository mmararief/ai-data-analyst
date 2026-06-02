import React from 'react'

export default function TaskWidget({ tasks, completed, onClose }) {
  if (!tasks || tasks.length === 0) return null

  const progress = Math.round((completed.length / tasks.length) * 100)

  return (
    <div className="absolute top-14 right-6 z-50 w-80 bg-[var(--bg-secondary)] border border-[var(--border-strong)] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="px-4 py-3 bg-[var(--bg-header)] border-b border-[var(--border-primary)] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-heading)] flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          To-Do List
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded-full">
            {progress}%
          </span>
          <button 
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            title="Sembunyikan To-Do List"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Progress bar line */}
      <div className="h-1 w-full bg-[var(--bg-tertiary)]">
        <div 
          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 ease-out" 
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="p-3 max-h-64 overflow-y-auto space-y-2">
        {tasks.map((task, idx) => {
          const isDone = completed.includes(idx)
          return (
            <div key={idx} className="flex items-start gap-3 p-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors group">
              <div className="mt-0.5 shrink-0">
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all duration-300 ${isDone ? 'bg-emerald-500 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-[#1e1e1e] border-[rgba(255,255,255,0.2)] group-hover:border-sky-500/50'}`}>
                  {isDone && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className={`text-sm leading-tight transition-colors duration-300 ${isDone ? 'text-[var(--text-muted)] line-through decoration-[var(--text-muted)]' : 'text-[var(--text-secondary)]'}`}>
                {task}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
