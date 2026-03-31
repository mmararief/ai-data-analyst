import { useState } from 'react'
import ToolCallStep from './ToolCallStep'

export default function ToolCallGroup({ steps, projectId, isLoading }) {
  const [open, setOpen] = useState(false)
  
  if (steps.length === 0) return null
  
  // If only one step and we don't want to group yet, it could still use this or the old individual one.
  // But grouping even a single one for consistency is fine.
  
  const isLastRunning = isLoading && !steps[steps.length - 1].output

  return (
    <div className="my-3 border border-[var(--border-primary)] rounded-lg overflow-hidden bg-[var(--bg-tertiary)]/20 shadow-sm">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-hover)] transition-colors text-left"
      >
        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-[var(--analisai-cyan)]/10 text-[var(--analisai-cyan)] border border-[var(--analisai-cyan)]/20">
           {isLastRunning ? (
             <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
           ) : (
             <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
           )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-bold text-[var(--text-heading)] flex items-center gap-2">
            {isLastRunning ? 'Mengeksekusi Analisis...' : 'Analisis Python Selesai'}
            <span className="text-[10px] font-normal text-[var(--text-muted)] bg-[var(--bg-hover)] px-1.5 py-0.5 rounded border border-[var(--border-light)] uppercase tracking-wider">
              {steps.length} {steps.length > 1 ? 'langkah' : 'langkah'}
            </span>
          </div>
          <div className="text-[11px] text-[var(--text-muted)] truncate italic mt-0.5">
            {isLastRunning ? 'Memproses tugas data di sandbox terisolasi...' : 'Semua transformasi data dan perhitungan selesai.'}
          </div>
        </div>

        <svg className={`w-4 h-4 text-[var(--text-muted)] transition-transform duration-300 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 bg-[var(--bg-tertiary)]/10 border-t border-[var(--border-primary)] animate-slide-down">
          <div className="h-2" /> {/* spacing */}
          {steps.map((step, i) => (
            <ToolCallStep 
              key={i} 
              step={step} 
              index={i} 
              isRunning={isLoading && i === steps.length - 1 && !step.output} 
            />
          ))}
        </div>
      )}
    </div>
  )
}
