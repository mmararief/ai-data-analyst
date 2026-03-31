import { useEffect, useState } from 'react'

export default function DataPreviewModal({ projectId, filename, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('token')
    fetch(`/datasets/${projectId}/preview/${encodeURIComponent(filename)}?rows=50`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => { setError('Gagal memuat preview'); setLoading(false) })
  }, [projectId, filename])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] backdrop-blur-sm p-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-light)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 6h18M3 14h18M3 18h18"/>
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">{filename}</h2>
              {data && (
                <p className="text-xs text-[var(--text-muted)]">
                  {data.columns.length} kolom · {data.total_rows} baris ditampilkan
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto p-1">
          {loading && (
            <div className="flex items-center justify-center h-48 text-[var(--text-muted)] text-sm">
              <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Memuat data...
            </div>
          )}
          {error && <div className="text-red-400 text-sm p-6">{error}</div>}
          {data && (
            <table className="w-full text-xs text-[var(--text-secondary)] border-collapse">
              <thead className="sticky top-0">
                <tr>
                  {data.columns.map((col, i) => (
                    <th
                      key={i}
                      className="text-left px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-light)] font-medium text-indigo-400 whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.data.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? 'bg-white/[0.01]' : ''}>
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="px-3 py-1.5 border border-[var(--border-light)] truncate max-w-[180px]"
                        title={cell}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
