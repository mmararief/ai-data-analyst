import { useState, useEffect, useRef } from 'react'
import ToolCallStep from './ToolCallStep'

// Deduplicate steps: skip steps with identical code as previous
function dedupeSteps(steps) {
  const seen = new Set()
  return steps.filter(s => {
    const key = (s.code || '').trim()
    if (!key) return true
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export default function ToolCallGroup({ steps, projectId, isLoading }) {
  const [open, setOpen] = useState(true) // starts open while running
  const prevLoadingRef = useRef(isLoading)

  // Auto-collapse when done
  useEffect(() => {
    if (prevLoadingRef.current && !isLoading) {
      setOpen(false)
    }
    prevLoadingRef.current = isLoading
  }, [isLoading])

  if (steps.length === 0) return null

  const deduped = dedupeSteps(steps)
  const doneCount = deduped.filter(s => s.output !== undefined && s.output !== '').length
  const isRunningNow = isLoading && doneCount < deduped.length

  return (
    <div className="my-3 select-none">
      {/* ── Header ── */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-[12.5px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors group mb-1"
      >
        {/* chevron */}
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>

        {isRunningNow ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
            </span>
            <span className="font-medium">
              Menjalankan {deduped.length} langkah analisis…
            </span>
          </>
        ) : (
          <>
            {/* checkmark */}
            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">
              Selesai · {deduped.length} langkah
            </span>
          </>
        )}
      </button>

      {/* ── Steps list ── */}
      {open && (
        <div className="ml-1 pl-3 border-l border-[var(--border-primary)] space-y-0.5 py-1">
          {deduped.map((step, i) => (
            <ToolCallStep
              key={i}
              step={step}
              index={i}
              isRunning={isLoading && i === deduped.length - 1 && !step.output}
            />
          ))}
        </div>
      )}
    </div>
  )
}
