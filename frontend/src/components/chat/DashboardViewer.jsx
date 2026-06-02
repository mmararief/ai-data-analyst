import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from '../../ThemeContext'
import NativeChartRenderer from './NativeChartRenderer'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'

// Register AG Grid Modules
ModuleRegistry.registerModules([AllCommunityModule])

const buildFilteredQuery = (baseQuery, activeFilters, filtersConfig) => {
  if (!baseQuery) return ''
  
  const conditions = []
  Object.entries(activeFilters).forEach(([filterId, activeVal]) => {
    const fConfig = filtersConfig?.find(f => f.id === filterId)
    if (!fConfig) return
    
    if (fConfig.type === 'search') {
      if (activeVal && activeVal.trim() !== '') {
        const safeVal = activeVal.replace(/'/g, "''")
        conditions.push(`LOWER(${filterId}) LIKE '%${safeVal.toLowerCase()}%'`)
      }
    } else {
      if (activeVal !== 'Semua' && activeVal !== '') {
        const safeVal = activeVal.replace(/'/g, "''")
        conditions.push(`${filterId} = '${safeVal}'`)
      }
    }
  })
  
  if (conditions.length === 0) return baseQuery
  
  const whereClause = conditions.join(' AND ')
  return `SELECT * FROM (${baseQuery}) AS subquery WHERE ${whereClause}`
}

export default function DashboardViewer({ projectId, filename, onClose }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // Theme-specific styling variables for high-contrast rendering
  const cardBg = isDark ? '#18181b' : '#ffffff'
  const hoverBg = isDark ? '#232329' : '#eef2f6'
  const borderCol = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const textMuted = isDark ? '#8e918f' : '#6b7280'
  const textSecondary = isDark ? '#c4c7c5' : '#4b5563'
  const textPrimary = isDark ? '#e3e3e3' : '#111827'
  const cyanAccent = isDark ? '#a8c7fa' : '#0b57d0'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [config, setConfig] = useState(null)
  
  // State for active filters
  const [activeFilters, setActiveFilters] = useState({})
  const [searchInputs, setSearchInputs] = useState({})
  
  // State for fetched dynamic widget data
  const [widgetData, setWidgetData] = useState({})
  const [widgetsLoading, setWidgetsLoading] = useState({})

  // Fetch dashboard.json
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')

    const token = localStorage.getItem('token')
    fetch(`/datasets/${projectId}/download/${encodeURIComponent(filename)}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        if (!res.ok) throw new Error('Gagal memuat file dashboard')
        return res.json()
      })
      .then((data) => {
        if (!active) return
        setConfig(data)
        
        // Initialize filters state
        const initialFilters = {}
        const initialSearchInputs = {}
        if (data.filters && Array.isArray(data.filters)) {
          data.filters.forEach((f) => {
            if (f.type === 'search') {
              initialFilters[f.id] = f.default || ''
              initialSearchInputs[f.id] = f.default || ''
            } else {
              initialFilters[f.id] = f.default || 'Semua'
            }
          })
        }
        setActiveFilters(initialFilters)
        setSearchInputs(initialSearchInputs)
        setLoading(false)
      })
      .catch((err) => {
        if (!active) return
        setError(err.message || 'Gagal memuat data dashboard')
        setLoading(false)
      })

    return () => { active = false }
  }, [projectId, filename])

  // Debounce search inputs to activeFilters
  useEffect(() => {
    const handler = setTimeout(() => {
      setActiveFilters(prev => {
        const next = { ...prev }
        Object.entries(searchInputs).forEach(([fid, val]) => {
          next[fid] = val
        })
        return next
      })
    }, 500)
    return () => clearTimeout(handler)
  }, [searchInputs])

  // Fetch widget dataset from backend Query Engine
  const fetchWidgetData = async (widgetId, baseQuery, datasetName) => {
    if (!datasetName || !baseQuery) return
    
    setWidgetsLoading(prev => ({ ...prev, [widgetId]: true }))
    const token = localStorage.getItem('token')
    
    // Wrap base query with current filter values
    const queryToRun = buildFilteredQuery(baseQuery, activeFilters, config?.filters)
    
    try {
      const response = await fetch(`/datasets/${projectId}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          dataset_name: datasetName,
          query: queryToRun
        })
      })
      
      if (!response.ok) {
        throw new Error('Gagal memproses data widget')
      }
      
      const result = await response.json()
      
      // Transform raw rows back to array of objects for Recharts/Chart.js/AG Grid
      const columns = result.columns
      const rows = result.data.map(rowArr => {
        const rowObj = {}
        rowArr.forEach((val, idx) => {
          const colName = columns[idx]
          if (val === '') {
            rowObj[colName] = ''
          } else {
            const parsedNum = Number(val)
            rowObj[colName] = isNaN(parsedNum) ? val : parsedNum
          }
        })
        return rowObj
      })
      
      setWidgetData(prev => ({ ...prev, [widgetId]: rows }))
    } catch (err) {
      console.error(`Error loading widget ${widgetId}:`, err)
    } finally {
      setWidgetsLoading(prev => ({ ...prev, [widgetId]: false }))
    }
  }

  // Load datasets dynamically when configuration or filters update
  useEffect(() => {
    if (!config) return
    
    const datasetName = config.dataset_name
    if (!datasetName) return
    
    // Query each chart and table
    const allWidgets = [
      ...(config.charts || []).map(c => ({ id: c.id, query: c.query })),
      ...(config.tables || []).map(t => ({ id: t.id, query: t.query }))
    ]
    
    allWidgets.forEach(w => {
      if (w.query) {
        fetchWidgetData(w.id, w.query, datasetName)
      }
    })
  }, [config, activeFilters])

  // Filter change handler
  const handleFilterChange = (filterId, val) => {
    const filterConfig = config?.filters?.find(f => f.id === filterId)
    if (filterConfig?.type === 'search') {
      setSearchInputs(prev => ({ ...prev, [filterId]: val }))
    } else {
      setActiveFilters((prev) => ({
        ...prev,
        [filterId]: val,
      }))
    }
  }

  // Dynamic charts with overridden types
  const [chartTypes, setChartTypes] = useState({})

  const toggleChartType = (chartId, currentType) => {
    const nextTypes = { line: 'bar', bar: 'pie', pie: 'doughnut', doughnut: 'area', area: 'scatter', scatter: 'line' }
    setChartTypes((prev) => ({
      ...prev,
      [chartId]: nextTypes[prev[chartId] || currentType] || 'bar',
    }))
  }

  if (loading) {
    return (
      <div className="absolute inset-0 z-[100] flex items-center justify-center bg-[var(--bg-page)]/80 backdrop-blur-md">
        <div className="flex flex-col items-center gap-3 p-8 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-3xl shadow-lg">
          <svg className="w-10 h-10 text-[var(--analisai-cyan)] animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-xs font-semibold font-mono text-[var(--text-secondary)] tracking-wider">MEMUAT DASHBOARD BI...</span>
        </div>
      </div>
    )
  }

  if (error || !config) {
    return (
      <div className="absolute inset-0 z-[100] flex items-center justify-center bg-[var(--bg-page)]/80 backdrop-blur-md">
        <div className="max-w-md p-8 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-3xl shadow-lg text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto text-xl font-bold">⚠️</div>
          <h3 className="text-lg font-bold text-[var(--text-heading)]">Gagal Memuat</h3>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">{error || 'Konfigurasi dashboard tidak valid.'}</p>
          <button onClick={onClose} className="px-5 py-2 bg-[var(--bg-hover)] border border-[var(--border-primary)] text-sm rounded-xl font-medium text-[var(--text-primary)] cursor-pointer transition-colors hover:bg-[var(--bg-tertiary)]">
            Tutup
          </button>
        </div>
      </div>
    )
  }

  const { 
    title = 'Interactive Dashboard', 
    description = '', 
    insights = [], 
    metrics = [], 
    filters = [], 
    charts = [],
    tables = [] 
  } = config

  const formatValue = (value, formatType) => {
    if (value === undefined || value === null) return ''
    if (typeof value === 'string') return value
    
    const numValue = Number(value)
    if (isNaN(numValue)) return String(value)
    
    if (formatType === 'currency') {
      return new Intl.NumberFormat('id-ID', { 
        style: 'currency', 
        currency: 'IDR', 
        maximumFractionDigits: 0 
      }).format(numValue)
    }
    if (formatType === 'percent') {
      return `${numValue.toFixed(1)}%`
    }
    if (formatType === 'number') {
      return new Intl.NumberFormat('id-ID').format(numValue)
    }
    return new Intl.NumberFormat('id-ID').format(numValue)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[100] flex flex-col overflow-y-auto"
      style={{
        fontFamily: "'Outfit', sans-serif",
        background: isDark ? '#0f0f11' : '#f8fafc',
        color: textPrimary
      }}
    >
      <style>{`
        .hover-card-accent:hover {
          border-color: ${isDark ? 'rgba(168,199,250,0.2)' : 'rgba(11,87,208,0.1)'} !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 20px ${isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)'} !important;
        }
        .filter-select-hover:hover {
          background: ${isDark ? '#2d2d34' : '#eef2f6'} !important;
          border-color: ${cyanAccent} !important;
        }
      `}</style>

      {/* Header bar */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4"
        style={{
          background: isDark ? '#0f0f11' : '#f8fafc',
          borderBottom: `1px solid ${borderCol}`
        }}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span style={{
              padding: '2px 8px',
              fontSize: '9px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              fontWeight: 700,
              fontFamily: "'JetBrains Mono', monospace",
              background: hoverBg,
              color: cyanAccent,
              borderRadius: '4px',
              border: `1px solid ${borderCol}`
            }}>
              BI Engine
            </span>
            <h1 className="text-lg font-extrabold tracking-tight font-sans" style={{ color: textPrimary }}>{title}</h1>
          </div>
          {description && <p className="text-xs font-sans" style={{ color: textMuted, maxWidth: '40rem' }}>{description}</p>}
        </div>

        <button
          onClick={onClose}
          style={{
            width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '12px',
            background: hoverBg,
            border: `1px solid ${borderCol}`,
            color: textMuted,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => { e.currentTarget.style.color = textPrimary; e.currentTarget.style.background = isDark ? '#2d2d34' : '#e2e8f0' }}
          onMouseLeave={e => { e.currentTarget.style.color = textMuted; e.currentTarget.style.background = hoverBg }}
          title="Tutup Dashboard"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      {/* Main Workspace container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 space-y-8 relative z-10">
        
        {/* Global AI Insights */}
        {insights && insights.length > 0 && (
          <div style={{
            padding: '1.25rem',
            borderRadius: '16px',
            background: isDark ? 'linear-gradient(135deg, rgba(168,199,250,0.06) 0%, rgba(139,92,246,0.06) 100%)' : 'linear-gradient(135deg, rgba(11,87,208,0.03) 0%, rgba(139,92,246,0.03) 100%)',
            border: `1px solid ${isDark ? 'rgba(168,199,250,0.12)' : 'rgba(11,87,208,0.08)'}`,
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '10px',
              fontWeight: 800,
              textTransform: 'uppercase',
              color: cyanAccent,
              letterSpacing: '0.05em',
              fontFamily: "'JetBrains Mono', monospace"
            }}>
              <span className="text-sm">✨</span> Analisai AI Insights
            </div>
            <ul className="space-y-2">
              {insights.map((insight, index) => (
                <li key={index} className="text-xs flex items-start gap-2 text-[var(--text-secondary)] leading-relaxed">
                  <span className="text-indigo-400 mt-0.5 shrink-0">•</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* KPI Metrics row */}
        {metrics && metrics.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((m, idx) => {
              const isPositive = m.change && !m.change.startsWith('-')
              return (
                <div key={idx} 
                  style={{
                    padding: '1.25rem',
                    borderRadius: '16px',
                    background: cardBg,
                    border: `1px solid ${borderCol}`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.25s ease'
                  }}
                  className="hover-card-accent"
                >
                  <div className="space-y-1.5 relative z-10" style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{
                      fontSize: '10px',
                      color: textMuted,
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      fontFamily: "'Outfit', sans-serif"
                    }}>
                      {m.label}
                    </span>
                    <div style={{
                      fontSize: '1.5rem',
                      fontWeight: 800,
                      color: textPrimary,
                      fontFamily: "'JetBrains Mono', monospace",
                      lineHeight: '1.2'
                    }}>
                      {formatValue(m.value, m.format)}
                    </div>
                    {m.change && (
                      <div style={{ display: 'flex', alignItems: 'center', paddingTop: '0.2rem' }}>
                        <span style={{
                          padding: '2px 6px',
                          fontSize: '9px',
                          fontWeight: 700,
                          borderRadius: '4px',
                          background: isPositive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                          color: isPositive ? '#10b981' : '#ef4444'
                        }}>
                          {m.change}
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Thin brand colored top accent bar */}
                  <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0,
                    height: '3px',
                    background: cyanAccent,
                    opacity: 0.6
                  }} />
                </div>
              )
            })}
          </div>
        )}

        {/* Dynamic Filters Section */}
        {filters && filters.length > 0 && (
          <div 
            style={{
              padding: '1.25rem',
              borderRadius: '16px',
              background: cardBg,
              border: `1px solid ${borderCol}`,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '1.5rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: textMuted,
              textTransform: 'uppercase',
              fontFamily: "'JetBrains Mono', monospace"
            }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: cyanAccent }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filter Interaktif:
            </div>
            
            <div className="flex flex-wrap items-center gap-4">
              {filters.map((f) => (
                <div key={f.id} className="flex flex-col gap-1.5">
                  <label style={{
                    fontSize: '9px',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    color: textMuted,
                    letterSpacing: '0.05em',
                    fontFamily: "'Outfit', sans-serif"
                  }}>
                    {f.label}
                  </label>
                  {f.type === 'search' ? (
                    <input
                      type="text"
                      placeholder={`Cari...`}
                      value={searchInputs[f.id] || ''}
                      onChange={(e) => handleFilterChange(f.id, e.target.value)}
                      style={{
                        padding: '0.4rem 0.9rem',
                        fontSize: '12px',
                        borderRadius: '10px',
                        background: isDark ? '#232329' : '#eef2f6',
                        border: `1px solid ${borderCol}`,
                        color: textPrimary,
                        outline: 'none',
                        fontWeight: 500,
                        transition: 'all 0.2s',
                        width: '180px'
                      }}
                      className="filter-select-hover"
                    />
                  ) : (
                    <select
                      value={activeFilters[f.id] || 'Semua'}
                      onChange={(e) => handleFilterChange(f.id, e.target.value)}
                      style={{
                        padding: '0.4rem 0.9rem',
                        fontSize: '12px',
                        borderRadius: '10px',
                        background: isDark ? '#232329' : '#eef2f6',
                        border: `1px solid ${borderCol}`,
                        color: textPrimary,
                        outline: 'none',
                        cursor: 'pointer',
                        fontWeight: 500,
                        transition: 'all 0.2s'
                      }}
                      className="filter-select-hover"
                    >
                      <option value="Semua">Semua {f.label}</option>
                      {f.options && f.options.map((opt) => (
                        <option key={opt} value={opt} style={{ background: cardBg, color: textPrimary }}>{opt}</option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Charts Grid */}
        {charts && charts.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {charts.map((c) => {
              const chartType = chartTypes[c.id] || c.type || 'bar'
              const filteredData = widgetData[c.id] || []

              return (
                <div key={c.id} 
                  style={{
                    padding: '1.5rem',
                    borderRadius: '16px',
                    background: cardBg,
                    border: `1px solid ${borderCol}`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: '380px',
                    height: 'auto',
                    transition: 'all 0.25s ease'
                  }}
                  className="hover-card-accent"
                >
                  <header className="flex items-center justify-between mb-4 pb-2" style={{ borderBottom: `1px solid ${borderCol}` }}>
                    <h3 style={{
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: textPrimary,
                      fontFamily: "'Outfit', sans-serif"
                    }}>
                      {c.title}
                    </h3>
                    
                    <div className="flex items-center gap-2">
                      <span style={{
                        fontSize: '9px',
                        fontFamily: "'JetBrains Mono', monospace",
                        color: textMuted,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: hoverBg,
                        border: `1px solid ${borderCol}`
                      }}>
                        {filteredData.length} pts
                      </span>

                      <button
                        onClick={() => toggleChartType(c.id, c.type || 'bar')}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '8px',
                          border: `1px solid ${borderCol}`,
                          color: textMuted,
                          background: hoverBg,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          fontSize: '9px',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          fontFamily: "'JetBrains Mono', monospace"
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = textPrimary; e.currentTarget.style.background = isDark ? '#2d2d34' : '#e2e8f0' }}
                        onMouseLeave={e => { e.currentTarget.style.color = textMuted; e.currentTarget.style.background = hoverBg }}
                        title="Ubah tipe grafik"
                      >
                        {chartType} ⇄
                      </button>
                    </div>
                  </header>

                  <div className="flex-1 min-h-[250px] relative">
                    {widgetsLoading[c.id] ? (
                      <div className="absolute inset-0 flex items-center justify-center text-xs font-mono" style={{ color: textMuted }}>
                        <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Mengeksekusi SQL...
                      </div>
                    ) : filteredData.length > 0 ? (
                      <NativeChartRenderer
                        type={chartType}
                        data={filteredData}
                        xKey={c.xKey}
                        yKeys={c.yKeys}
                        mapping={c.mapping}
                        title={c.title}
                        isDark={isDark}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-xs font-mono" style={{ color: textMuted }}>
                        Tidak ada data yang cocok dengan filter aktif.
                      </div>
                    )}
                  </div>
                  
                  {c.insight && (
                    <div style={{
                      marginTop: '0.75rem',
                      paddingTop: '0.75rem',
                      borderTop: `1px solid ${borderCol}`,
                      fontSize: '11px',
                      color: textMuted,
                      lineHeight: '1.4'
                    }}>
                      <strong style={{ color: cyanAccent }}>AI Insight:</strong> {c.insight}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="p-12 text-center border border-dashed rounded-3xl text-sm" style={{ borderColor: borderCol, color: textMuted }}>
            Belum ada grafik yang dikonfigurasi.
          </div>
        )}

        {/* Tables Section */}
        {tables && tables.length > 0 && (
          <div className="space-y-6">
            <h2 style={{
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: cyanAccent,
              fontFamily: "'JetBrains Mono', monospace",
              marginTop: '2rem'
            }}>
              Tabel Detail & Data Mentah
            </h2>
            <div className="grid grid-cols-1 gap-6">
              {tables.map((t) => {
                const columnDefs = (t.columns || []).map(col => ({
                  headerName: col.replace(/_/g, ' ').toUpperCase(),
                  field: col,
                  filter: true,
                  sortable: true,
                }))
                
                const filteredTableData = widgetData[t.id] || []

                return (
                  <div key={t.id}
                    style={{
                      padding: '1.5rem',
                      borderRadius: '16px',
                      background: cardBg,
                      border: `1px solid ${borderCol}`,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                    }}
                    className="hover-card-accent"
                  >
                    <header className="flex items-center justify-between pb-2" style={{ borderBottom: `1px solid ${borderCol}` }}>
                      <h3 style={{
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        color: textPrimary,
                        fontFamily: "'Outfit', sans-serif"
                      }}>
                        {t.title}
                      </h3>
                      <span style={{
                        fontSize: '9px',
                        fontFamily: "'JetBrains Mono', monospace",
                        color: textMuted,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: hoverBg,
                        border: `1px solid ${borderCol}`
                      }}>
                        {filteredTableData.length} baris
                      </span>
                    </header>
                    
                    <div className={`${theme === 'dark' ? 'ag-theme-quartz-dark' : 'ag-theme-quartz'} h-[300px] w-full rounded-xl overflow-hidden border border-[var(--border-primary)] relative`}>
                      {widgetsLoading[t.id] ? (
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-mono bg-[var(--bg-page)]/50 backdrop-blur-sm z-10" style={{ color: textMuted }}>
                          <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          Mengeksekusi SQL...
                        </div>
                      ) : null}
                      <AgGridReact
                        rowData={filteredTableData}
                        columnDefs={columnDefs}
                        pagination={true}
                        paginationPageSize={10}
                        defaultColDef={{
                          sortable: true,
                          filter: true,
                          resizable: true,
                          flex: 1,
                          minWidth: 100,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>
      
      <footer className="py-6 text-center text-[9px] font-mono uppercase tracking-widest"
        style={{
          borderTop: `1px solid ${borderCol}`,
          color: textMuted,
          background: isDark ? '#0f0f11' : '#f8fafc'
        }}
      >
        Dihasilkan secara native oleh Analisai Data Dashboard
      </footer>
    </motion.div>
  )
}
