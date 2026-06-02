import { useEffect, useState, useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'
import { useTheme } from '../ThemeContext'

// Register AG Grid Modules
ModuleRegistry.registerModules([AllCommunityModule])

export default function DataPreviewModal({ projectId, filename, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { theme } = useTheme()

  useEffect(() => {
    const token = localStorage.getItem('token')
    fetch(`/datasets/${projectId}/preview/${encodeURIComponent(filename)}?rows=100`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => { setError('Gagal memuat preview'); setLoading(false) })
  }, [projectId, filename])

  const { rowData, columnDefs } = useMemo(() => {
    if (!data || !data.columns || !data.data) {
      return { rowData: [], columnDefs: [] }
    }
    const cols = data.columns.map((col, index) => ({
      headerName: col,
      field: `col_${index}`,
      tooltipValueGetter: (params) => params.value,
    }))
    const rows = data.data.map((row) => {
      const rowObj = {}
      row.forEach((cell, index) => {
        rowObj[`col_${index}`] = cell
      })
      return rowObj
    })
    return { rowData: rows, columnDefs: cols }
  }, [data])

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[var(--bg-page)] animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)] shrink-0 bg-[var(--bg-card)]">
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
        <button 
          onClick={onClose} 
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1.5 rounded-lg hover:bg-[var(--bg-hover)]"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* Grid Content */}
      <div className="flex-1 min-h-0 p-6 flex flex-col bg-[var(--bg-page)]">
        {loading && (
          <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm">
            <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Memuat data...
          </div>
        )}
        {error && <div className="text-red-400 text-sm p-6">{error}</div>}
        {data && (
          <div className={`${theme === 'dark' ? 'ag-theme-quartz-dark' : 'ag-theme-quartz'} flex-1 w-full rounded-xl overflow-hidden border border-[var(--border-primary)] shadow-sm`}>
            <AgGridReact
              rowData={rowData}
              columnDefs={columnDefs}
              pagination={true}
              paginationPageSize={25}
              paginationPageSizeSelector={[10, 25, 50, 100]}
              enableBrowserTooltips={true}
              defaultColDef={{
                sortable: true,
                filter: true,
                resizable: true,
                flex: 1,
                minWidth: 120,
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
