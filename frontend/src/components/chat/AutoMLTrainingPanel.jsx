import { useState, useRef, useEffect } from 'react'

export default function AutoMLTrainingPanel({ part, isLoading }) {
  const liveRef = useRef(null)
  const progressLines = part.progressLines || []
  const hasError = !!part?.result?.error
  const isDone = !!part.done || (!isLoading && progressLines.length > 0)
  const isRunning = !isDone && isLoading
  const result = part.result || {}
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (liveRef.current) {
      liveRef.current.scrollTop = liveRef.current.scrollHeight
    }
  }, [progressLines.length])

  const leaderboard = result.leaderboard || []
  const bestMetrics = result.best_metrics || {}
  const isClustering = result.problem_type === 'clustering' || part.problem_type === 'clustering'
  const nClusters = result.n_clusters

  return (
    <div className="my-3 rounded-lg border border-sky-500/25 bg-sky-950/10 overflow-hidden">
      <div className="flex items-center gap-2.5 px-3 py-2 bg-sky-950/20 border-b border-sky-500/20">
        {hasError ? (
          <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        ) : isDone ? (
          <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        ) : (
          <svg className="w-4 h-4 text-sky-400 animate-spin shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
        )}
        <div className="flex-1 min-w-0">
          <span className="text-[12px] font-semibold text-[var(--text-heading)] dark:text-sky-300">
            {isClustering ? 'Clustering AutoML' : 'AutoML Training'}
          </span>
          {isClustering
            ? (
              <span className="text-[11px] text-[var(--text-secondary)] dark:text-sky-500 ml-2">
                {part.dataset}
                {nClusters ? (
                  <> → <span className="text-[var(--text-heading)] dark:text-sky-300">{nClusters} cluster</span></>
                ) : ''}
              </span>
            ) : (
              <span className="text-[11px] text-[var(--text-secondary)] dark:text-sky-500 ml-2">
                {part.dataset} → <span className="text-[var(--text-heading)] dark:text-sky-300">{part.target}</span>
              </span>
            )
          }
        </div>
        {isDone && result.best_model_class && (
          <span className="text-[10px] text-emerald-400 bg-emerald-900/30 border border-emerald-500/25 px-2 py-0.5 rounded-full shrink-0">
            ✓ {result.best_model_class}
          </span>
        )}
        {hasError && (
          <span className="text-[10px] text-amber-400 bg-amber-900/30 border border-amber-500/25 px-2 py-0.5 rounded-full shrink-0">
            ⚠ Gagal
          </span>
        )}
      </div>

      {(!isDone || progressLines.length > 0) && (
        <div ref={liveRef} className="px-3 py-2.5 max-h-48 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {progressLines.map((line, i) => {
            const isHeader = line.startsWith('🏋️') || line.startsWith('📂') || line.startsWith('🔄') || line.startsWith('⚙️') || line.startsWith('🔍') || line.startsWith('🏆') || line.startsWith('🚀')
            const isSuccess = line.startsWith('  ✓')
            const isWarn = line.startsWith('  ⚠️')
            const isTuning = line.startsWith('🔍 Hyper')
            return (
              <div
                key={i}
                className={`text-[11px] font-mono leading-5 ${
                  isSuccess
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : isWarn
                    ? 'text-amber-600 dark:text-amber-400'
                    : isTuning
                    ? 'text-purple-700 dark:text-purple-400'
                    : isHeader
                    ? 'text-sky-700 dark:text-sky-300 font-medium'
                    : 'text-[var(--text-secondary)] dark:text-slate-400'
                }`}
              >
                {line}
              </div>
            )
          })}
          {isRunning && (
            <div className="text-[11px] font-mono text-sky-400 animate-pulse">▌</div>
          )}
        </div>
      )}

      {hasError && result.message && (
        <div className="px-3 py-2 border-t border-amber-500/20 text-[11px] text-amber-300 bg-amber-950/10">
          {result.message}
        </div>
      )}

      {isDone && leaderboard.length > 0 && (
        <div className="border-t border-sky-500/15">
          <button
            onClick={() => setOpen(v => !v)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] text-sky-400 hover:text-sky-300 hover:bg-sky-950/20 transition-colors"
          >
            <span className="font-medium">Leaderboard Model ({leaderboard.length} kandidat)</span>
            <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
          </button>
          {open && (
            <div className="px-3 pb-3">
              <div className="rounded border border-sky-500/15 overflow-hidden text-[11px]">
                <div className="grid grid-cols-4 gap-0 bg-sky-950/30 text-sky-500 font-semibold uppercase tracking-wider">
                  <div className="px-2 py-1.5">#</div>
                  <div className="px-2 py-1.5">Model</div>
                  <div className="px-2 py-1.5">{isClustering ? 'Silhouette' : 'CV Score'}</div>
                  <div className="px-2 py-1.5">Status</div>
                </div>
                {leaderboard.map((item, i) => {
                  const score = isClustering
                    ? (item.metrics?.silhouette ?? item.cv_score)
                    : item.cv_score
                  return (
                    <div key={i} className={`grid grid-cols-4 gap-0 border-t border-sky-500/10 ${item.is_best ? 'bg-emerald-900/15 dark:bg-emerald-900/15 bg-emerald-100/40' : ''}`}>
                      <div className="px-2 py-1.5 text-[var(--text-secondary)] dark:text-slate-400">{i + 1}</div>
                      <div className="px-2 py-1.5 text-[var(--text-heading)] dark:text-sky-300 font-medium truncate">{item.model_class}</div>
                      <div className="px-2 py-1.5 text-[var(--text-secondary)] dark:text-slate-300">{score?.toFixed ? score.toFixed(4) : score}</div>
                      <div className="px-2 py-1.5">
                        {item.is_best && <span className="text-emerald-400 font-semibold">✓ Best{item.tuned ? ' (tuned)' : ''}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
              {Object.keys(bestMetrics).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(bestMetrics).map(([k, v]) => (
                    <span
                      key={k}
                      className="text-[10px] bg-[var(--bg-tertiary)] dark:bg-sky-900/30 border border-[var(--border-primary)] text-[var(--text-secondary)] dark:text-sky-300 px-2 py-0.5 rounded-full"
                    >
                      {k}: <span className="font-semibold text-[var(--text-heading)] dark:text-sky-100">{typeof v === 'number' ? v.toFixed(4) : v}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
