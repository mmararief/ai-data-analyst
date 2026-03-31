export default function CriticCard({ part }) {
  const isOk = part.judgment === 'ok'
  return (
    <div
      className={`my-2 rounded-lg border px-4 py-3 ${
        isOk
          ? 'border-emerald-500/30 bg-emerald-100/60 dark:bg-emerald-500/5'
          : 'border-amber-500/30 bg-amber-100/60 dark:bg-amber-500/5'
      }`}
    >
      <div
        className={`flex items-center gap-2 text-[12px] font-semibold mb-1.5 ${
          isOk ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
        }`}
      >
        {isOk ? (
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        )}
        <span>Evaluasi: {isOk ? 'Analisis Sudah Baik' : 'Perlu Perbaikan'}</span>
      </div>
      <p
        className={`text-[12px] leading-relaxed ${
          isOk ? 'text-emerald-800 dark:text-emerald-300/80' : 'text-amber-800 dark:text-amber-300/80'
        }`}
      >
        {part.feedback}
      </p>
      {!isOk && part.additional_tasks && part.additional_tasks.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-amber-500/20">
          <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400/60 uppercase tracking-wider mb-1.5">
            Langkah perbaikan
          </p>
          <ul className="space-y-1">
            {part.additional_tasks.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-[11.5px] text-amber-800 dark:text-amber-300/70">
                <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full border border-amber-500/40 flex items-center justify-center text-[9px] font-bold text-amber-700 dark:text-amber-400">
                  {i + 1}
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
