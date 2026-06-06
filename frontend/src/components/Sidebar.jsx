import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import DataPreviewModal from './DataPreviewModal'
import DashboardViewer from './chat/DashboardViewer'

const MAX_FILES_PER_UPLOAD = 20

const FILE_COLORS = {
  csv: '#38bdf8', xlsx: '#22c55e', xls: '#22c55e',
  json: '#f59e0b', parquet: '#a78bfa', pkl: '#f472b6',
  joblib: '#fb923c',
}

function getFileColor(name) {
  const ext = (name || '').split('.').pop().toLowerCase()
  return FILE_COLORS[ext] || '#475569'
}

function FileIcon({ name, type }) {
  const color = type === 'folder' ? '#fbbf24' : getFileColor(name)
  if (type === 'folder') return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={color}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
    </svg>
  )
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={color}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
    </svg>
  )
}

function SectionHeader({ icon, label, open, onToggle, textMuted, textSecondary, cyanAccent }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '0.45rem',
        padding: '0.5rem 0.35rem',
        background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em',
        color: textMuted, textTransform: 'uppercase',
        transition: 'color 0.15s',
        marginBottom: '0.4rem',
      }}
      onMouseEnter={e => e.currentTarget.style.color = textSecondary}
      onMouseLeave={e => e.currentTarget.style.color = textMuted}
    >
      <span style={{ color: cyanAccent, display: 'flex', flexShrink: 0 }}>{icon}</span>
      {label}
      <svg
        width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor"
        style={{
          marginLeft: 'auto', flexShrink: 0,
          transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform 0.15s',
        }}
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7"/>
      </svg>
    </button>
  )
}

function FileBadge({ name }) {
  const ext = (name || '').split('.').pop().toLowerCase()
  let bg = 'rgba(142,145,143,0.1)'
  let color = '#8e918f'
  if (ext === 'csv') {
    bg = 'rgba(56,189,248,0.12)'
    color = '#0284c7'
  } else if (ext === 'xlsx' || ext === 'xls') {
    bg = 'rgba(34,197,94,0.12)'
    color = '#16a34a'
  } else if (ext === 'json') {
    bg = 'rgba(245,158,11,0.12)'
    color = '#d97706'
  } else if (ext === 'parquet') {
    bg = 'rgba(167,139,250,0.12)'
    color = '#7c3aed'
  } else if (ext === 'pdf') {
    bg = 'rgba(239,68,68,0.12)'
    color = '#dc2626'
  }
  return (
    <span style={{
      fontSize: '8px',
      fontWeight: 800,
      padding: '1px 4px',
      borderRadius: '4px',
      background: bg,
      color: color,
      textTransform: 'uppercase',
      fontFamily: "'JetBrains Mono', monospace",
      display: 'inline-block',
      marginLeft: '0.35rem',
      verticalAlign: 'middle',
    }}>
      {ext}
    </span>
  )
}

function FileRowContent({ file, textSecondary, textMuted }) {
  if (file.type === 'folder') {
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.78rem', color: textSecondary,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontWeight: 500,
        }} title={file.path || file.name}>
          {file.name}
        </div>
      </div>
    )
  }

  const parts = file.name.split('.')
  const ext = parts.length > 1 ? parts.pop() : ''
  const baseName = parts.join('.')

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <span style={{
          fontSize: '0.78rem', color: textSecondary,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontWeight: 500,
        }} title={file.path || file.name}>
          {baseName || file.name}
        </span>
        {ext && <FileBadge name={file.name} />}
      </div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.6rem', color: textMuted, opacity: 0.7, marginTop: '0.05rem'
      }}>{file.size_kb} KB</div>
    </div>
  )
}

export default function Sidebar({ projectId, sessionId, onSuggest, onLoadHistory, onNewChat, onToggleCollapse, refreshTrigger, isOpen, onClose, width, username, theme, onToggleTheme, onLogout, previewFilename, setPreviewFilename }) {
  const [datasets, setDatasets] = useState([])
  const [exportsList, setExportsList] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, currentName: '', success: 0, failed: 0 })
  const [dragOver, setDragOver] = useState(false)
  const [sessions, setSessions] = useState([])
  const [histOpen, setHistOpen] = useState(true)

  const [filesOpen, setFilesOpen] = useState(true)
  const [exportsOpen, setExportsOpen] = useState(true)
  const fileRef = useRef()
  const navigate = useNavigate()

  const fetchFiles = async (showSpinner = false) => {
    if (!projectId) return
    if (showSpinner) setRefreshing(true)
    try {
      const res = await api.get(`/datasets/${projectId}/`)
      setDatasets(Array.isArray(res.data?.datasets) ? res.data.datasets : [])
      setExportsList(Array.isArray(res.data?.exports) ? res.data.exports : [])
    } catch { }
    finally { if (showSpinner) setRefreshing(false) }
  }

  const fetchHistory = async () => {
    if (!projectId) return
    try {
      const res = await api.get(`/history/${projectId}`)
      setSessions(Array.isArray(res.data?.sessions) ? res.data.sessions : [])
    } catch { }
  }

  useEffect(() => { fetchFiles(false); fetchHistory() }, [projectId])
  useEffect(() => { if (refreshTrigger > 0) { fetchFiles(false); fetchHistory() } }, [refreshTrigger])

  const formatDate = (iso) => {
    const d = new Date(iso)
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  const goToFolder = (path) => fetchFiles(false, path)

  const handleLoadSession = async (sid) => {
    try {
      const res = await api.get(`/history/${projectId}/${sid}`)
      onLoadHistory(sid, res.data.messages)
      if (onClose) onClose()
    } catch { alert('Gagal memuat riwayat') }
  }

  const handleDeleteSession = async (e, sid) => {
    e.stopPropagation()
    if (!confirm('Hapus riwayat ini?')) return
    await api.delete(`/history/${projectId}/${sid}`)
    fetchHistory()
  }

  const uploadFiles = async (selectedFiles) => {
    const fileList = Array.from(selectedFiles || [])
    if (fileList.length === 0) return
    if (fileList.length > MAX_FILES_PER_UPLOAD) {
      alert(`Maksimal upload ${MAX_FILES_PER_UPLOAD} file per batch`)
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setUploading(true)
    setUploadProgress({ current: 0, total: fileList.length, currentName: '', success: 0, failed: 0 })
    const failedUploads = []
    let successCount = 0
    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i]
        const form = new FormData()
        form.append('file', file)
        form.append('batch_total', String(fileList.length))
        form.append('batch_index', String(i + 1))
        setUploadProgress(prev => ({ ...prev, current: i + 1, currentName: file.name }))
        try {
          await api.post(`/datasets/${projectId}/upload`, form)
          successCount++
          setUploadProgress(prev => ({ ...prev, success: successCount }))
        } catch (err) {
          failedUploads.push(`${file.name}: ${err.response?.data?.detail || 'Upload gagal'}`)
          setUploadProgress(prev => ({ ...prev, failed: prev.failed + 1 }))
        }
      }
      await fetchFiles()
      if (failedUploads.length > 0) alert(`Sebagian file gagal:\n${failedUploads.join('\n')}`)
    } finally {
      setUploading(false)
      setUploadProgress({ current: 0, total: 0, currentName: '', success: 0, failed: 0 })
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleUpload = (e) => uploadFiles(e.target.files)
  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files) }

  const handleDownload = (name) => {
    const token = localStorage.getItem('token')
    const dlName = (name || '').split('/').pop() || name
    fetch(`/datasets/${projectId}/download/${encodeURIComponent(name)}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.blob()).then(blob => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = dlName; a.click()
      URL.revokeObjectURL(url)
    }).catch(() => alert('Gagal mengunduh file'))
  }

  const handleDelete = async (name) => {
    if (!confirm(`Hapus ${name}?`)) return
    await api.delete(`/datasets/${projectId}/${encodeURIComponent(name)}`)
    fetchFiles(false)
  }

  const handleDeleteAll = async () => {
    if (datasets.length === 0 && exportsList.length === 0) return
    const totalFiles = datasets.length + exportsList.length
    if (!confirm(`Hapus semua ${totalFiles} file?`)) return
    try {
      await api.delete(`/datasets/${projectId}/all`)
      await fetchFiles(false)
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal menghapus semua file')
    }
  }

  // ── Color Theme Variables for High Contrast ──────────────────────────────
  const isDark = theme === 'dark'
  const sidebarBg = isDark ? '#0f0f11' : '#f8fafc'
  const cardBg = isDark ? '#18181b' : '#ffffff'
  const hoverBg = isDark ? '#232329' : '#eef2f6'
  const borderCol = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const textMuted = isDark ? '#8e918f' : '#6b7280'
  const textSecondary = isDark ? '#c4c7c5' : '#4b5563'
  const textPrimary = isDark ? '#e3e3e3' : '#111827'
  const footerBg = isDark ? '#0a0a0c' : '#f1f5f9'
  const cyanAccent = isDark ? '#a8c7fa' : '#0b57d0'

  const sidebarContent = (
    <aside style={{
      width: width || 288,
      minWidth: width || 288,
      height: '100%',
      background: sidebarBg,
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter', sans-serif",
      overflow: 'hidden',
      flexShrink: 0,
      borderRight: `1px solid ${borderCol}`,
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem 1.1rem 0.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        {/* Burger icon — collapse sidebar */}
        <button
          onClick={onToggleCollapse || onClose}
          style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'none', border: 'none',
            color: textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.2s ease',
            flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = textPrimary; e.currentTarget.style.background = hoverBg }}
          onMouseLeave={e => { e.currentTarget.style.color = textMuted; e.currentTarget.style.background = 'none' }}
          title="Tutup Menu"
        >
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>

        <button
          onClick={() => fetchFiles(true)}
          title="Refresh"
          style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'none', border: 'none',
            color: textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = textPrimary; e.currentTarget.style.background = hoverBg }}
          onMouseLeave={e => { e.currentTarget.style.color = textMuted; e.currentTarget.style.background = 'none' }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"
            style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </button>
      </div>

      {/* NEW CHAT BUTTON */}
      <div style={{ padding: '0.2rem 1.1rem 0.5rem', flexShrink: 0 }}>
        <button
          onClick={() => { if (onNewChat) onNewChat(); if (onClose && window.innerWidth < 768) onClose() }}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            width: '100%', padding: '0.7rem 1rem',
            background: cardBg, border: `1px solid ${borderCol}`,
            borderRadius: 12, cursor: 'pointer',
            fontFamily: "'Inter', sans-serif", fontSize: '0.82rem', fontWeight: 600,
            color: textPrimary, transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = hoverBg
            e.currentTarget.style.borderColor = cyanAccent
            e.currentTarget.style.transform = 'scale(1.02)'
            e.currentTarget.style.boxShadow = `0 4px 15px ${isDark ? 'rgba(168,199,250,0.1)' : 'rgba(11,87,208,0.08)'}`
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = cardBg
            e.currentTarget.style.borderColor = borderCol
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'
          }}
        >
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: cyanAccent }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/>
          </svg>
          Chat Baru
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        padding: '0.6rem 1.1rem',
        display: 'flex', flexDirection: 'column', gap: '1rem',
      }}
        className="sidebar-scroll"
      >
        {/* ── DATASET FILES ── */}
        <div>
          <SectionHeader
            icon={<svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/></svg>}
            label="Dataset"
            open={filesOpen}
            onToggle={() => setFilesOpen(o => !o)}
            textMuted={textMuted}
            textSecondary={textSecondary}
            cyanAccent={cyanAccent}
          />

          {filesOpen && (
            <>


              {/* Add / Drop zone */}
              <div
                onClick={() => !uploading && fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                style={{
                  border: dragOver ? `1.5px dashed ${cyanAccent}` : `1px dashed ${borderCol}`,
                  borderRadius: 12,
                  padding: '0.75rem 1rem',
                  textAlign: 'center', cursor: 'pointer',
                  background: dragOver ? (isDark ? 'rgba(168,199,250,0.05)' : 'rgba(11,87,208,0.03)') : cardBg,
                  transition: 'all 0.2s ease',
                  marginBottom: '0.8rem',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.2rem',
                  color: dragOver ? cyanAccent : textPrimary,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                }}
                onMouseEnter={e => { if(!dragOver && !uploading) { e.currentTarget.style.background = hoverBg; e.currentTarget.style.borderColor = cyanAccent } }}
                onMouseLeave={e => { if(!dragOver && !uploading) { e.currentTarget.style.background = cardBg; e.currentTarget.style.borderColor = borderCol } }}
              >
                {uploading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', width: '100%' }}>
                    <div style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.58rem', color: cyanAccent, letterSpacing: '0.04em',
                    }}>
                      Uploading {uploadProgress.current}/{uploadProgress.total}...
                    </div>
                    <div style={{ height: 3, background: isDark ? '#27272a' : '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 2,
                        background: cyanAccent,
                        width: `${uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0}%`,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', fontWeight: 600 }}>
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                      </svg>
                      Tambah Dataset
                    </div>
                    <span style={{ fontSize: '9px', color: textMuted }}>
                      Klik atau seret file ke sini
                    </span>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" multiple
                accept=".csv,.xlsx,.xls,.json,.parquet,.pkl,.joblib"
                style={{ display: 'none' }} onChange={handleUpload}
              />

              {/* File list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                {datasets.length === 0 && (
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.62rem', color: textMuted,
                    padding: '0.25rem 0.25rem',
                  }}>belum ada dataset</div>
                )}
                {datasets.map(f => {
                  const isDashboardFile = f.name.toLowerCase().endsWith('dashboard.json')
                  return (
                    <div
                      key={f.path || f.name}
                      onClick={() => {
                        if (isDashboardFile) {
                          setPreviewFilename(f.path || f.name)
                        }
                      }}
                      className="sidebar-file-row"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.65rem',
                        padding: '0.55rem 0.65rem',
                        borderRadius: 8,
                        background: 'transparent',
                        cursor: isDashboardFile ? 'pointer' : 'default',
                        transition: 'all 0.15s ease',
                        position: 'relative',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = hoverBg
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <FileIcon name={f.name} type={f.type} />
                      <FileRowContent file={f} textSecondary={textSecondary} textMuted={textMuted} />
                      
                      <div style={{ display: 'flex', gap: '0.2rem', flexShrink: 0, position: 'absolute', right: '0.4rem', background: 'transparent' }} className="file-action-container">
                        {isDashboardFile ? (
                          <button className="file-action" onClick={ev => { ev.stopPropagation(); setPreviewFilename(f.path || f.name) }}
                            style={{
                              opacity: 0, width: 24, height: 24, borderRadius: 6,
                              background: cardBg, border: `1px solid ${borderCol}`,
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: cyanAccent, transition: 'all 0.2s ease',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.color = cyanAccent; e.currentTarget.style.borderColor = cyanAccent; e.currentTarget.style.transform = 'scale(1.1)' }}
                            onMouseLeave={e => { e.currentTarget.style.color = cyanAccent; e.currentTarget.style.borderColor = borderCol; e.currentTarget.style.transform = 'scale(1)' }}
                            title="Buka Dashboard"
                          >
                            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
                            </svg>
                          </button>
                        ) : (
                          ['.csv','.xlsx','.xls','.json','.parquet'].some(e => f.name.toLowerCase().endsWith(e)) && (
                            <button className="file-action" onClick={ev => { ev.stopPropagation(); setPreviewFilename(f.path || f.name) }}
                              style={{
                                opacity: 0, width: 24, height: 24, borderRadius: 6,
                                background: cardBg, border: `1px solid ${borderCol}`,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: textMuted, transition: 'all 0.2s ease',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.color = cyanAccent; e.currentTarget.style.borderColor = cyanAccent; e.currentTarget.style.transform = 'scale(1.1)' }}
                              onMouseLeave={e => { e.currentTarget.style.color = textMuted; e.currentTarget.style.borderColor = borderCol; e.currentTarget.style.transform = 'scale(1)' }}
                              title="Preview"
                            >
                              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                            </button>
                          )
                        )}
                        <button className="file-action" onClick={e => { e.stopPropagation(); handleDownload(f.path || f.name) }}
                          style={{
                            opacity: 0, width: 24, height: 24, borderRadius: 6,
                            background: cardBg, border: `1px solid ${borderCol}`,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: textMuted, transition: 'all 0.2s ease',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.color = cyanAccent; e.currentTarget.style.borderColor = cyanAccent; e.currentTarget.style.transform = 'scale(1.1)' }}
                          onMouseLeave={e => { e.currentTarget.style.color = textMuted; e.currentTarget.style.borderColor = borderCol; e.currentTarget.style.transform = 'scale(1)' }}
                          title="Download"
                        >
                          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                        </button>
                        <button className="file-action" onClick={e => { e.stopPropagation(); handleDelete(f.path || f.name) }}
                          style={{
                            opacity: 0, width: 24, height: 24, borderRadius: 6,
                            background: cardBg, border: `1px solid ${borderCol}`,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: textMuted, transition: 'all 0.2s ease',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#fee2e2'; e.currentTarget.style.transform = 'scale(1.1)' }}
                          onMouseLeave={e => { e.currentTarget.style.color = textMuted; e.currentTarget.style.borderColor = borderCol; e.currentTarget.style.transform = 'scale(1)' }}
                          title="Hapus"
                        >
                          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </div>
                  )
                })}

                {datasets.length + exportsList.length > 1 && (
                  <button
                    onClick={handleDeleteAll}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.4rem 0.85rem',
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.62rem', letterSpacing: '0.06em',
                      color: textMuted, background: 'none',
                      border: 'none',
                      borderRadius: 8, cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      marginTop: '0.25rem',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.04)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = textMuted; e.currentTarget.style.background = 'none' }}
                  >
                    <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                    Hapus semua ({datasets.length + exportsList.length})
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div style={{ height: 1, background: borderCol, flexShrink: 0 }} />

        {/* ── HASIL ANALISIS (EXPORTS) ── */}
        <div>
          <SectionHeader
            icon={<svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 17v-2a4 4 0 00-4-4H3m2 6H5a2 2 0 002-2v-4a2 2 0 00-2-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2m0 0z"/></svg>}
            label="Hasil Analisis"
            open={exportsOpen}
            onToggle={() => setExportsOpen(o => !o)}
            textMuted={textMuted}
            textSecondary={textSecondary}
            cyanAccent={cyanAccent}
          />

          {exportsOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              {exportsList.length === 0 && (
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.62rem', color: textMuted,
                  padding: '0.25rem 0.25rem',
                }}>belum ada hasil analisis</div>
              )}
              {exportsList.map(f => {
                const isDashboardFile = f.name.toLowerCase().endsWith('dashboard.json')
                return (
                  <div
                    key={f.path || f.name}
                    onClick={() => {
                      if (isDashboardFile) {
                        setPreviewFilename(f.path || f.name)
                      }
                    }}
                    className="sidebar-file-row"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.65rem',
                      padding: '0.55rem 0.65rem',
                      borderRadius: 8,
                      background: 'transparent',
                      cursor: isDashboardFile ? 'pointer' : 'default',
                      transition: 'all 0.15s ease',
                      position: 'relative',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = hoverBg
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <FileIcon name={f.name} type={f.type} />
                    <FileRowContent file={f} textSecondary={textSecondary} textMuted={textMuted} />
                    
                    <div style={{ display: 'flex', gap: '0.2rem', flexShrink: 0, position: 'absolute', right: '0.4rem', background: 'transparent' }} className="file-action-container">
                      {isDashboardFile ? (
                        <button className="file-action" onClick={ev => { ev.stopPropagation(); setPreviewFilename(f.path || f.name) }}
                          style={{
                            opacity: 0, width: 24, height: 24, borderRadius: 6,
                            background: cardBg, border: `1px solid ${borderCol}`,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: cyanAccent, transition: 'all 0.2s ease',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.color = cyanAccent; e.currentTarget.style.borderColor = cyanAccent; e.currentTarget.style.transform = 'scale(1.1)' }}
                          onMouseLeave={e => { e.currentTarget.style.color = cyanAccent; e.currentTarget.style.borderColor = borderCol; e.currentTarget.style.transform = 'scale(1)' }}
                          title="Buka Dashboard"
                        >
                          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
                          </svg>
                        </button>
                      ) : (
                        ['.csv','.xlsx','.xls','.json','.parquet'].some(e => f.name.toLowerCase().endsWith(e)) && (
                          <button className="file-action" onClick={ev => { ev.stopPropagation(); setPreviewFilename(f.path || f.name) }}
                            style={{
                              opacity: 0, width: 24, height: 24, borderRadius: 6,
                              background: cardBg, border: `1px solid ${borderCol}`,
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: textMuted, transition: 'all 0.2s ease',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.color = cyanAccent; e.currentTarget.style.borderColor = cyanAccent; e.currentTarget.style.transform = 'scale(1.1)' }}
                            onMouseLeave={e => { e.currentTarget.style.color = textMuted; e.currentTarget.style.borderColor = borderCol; e.currentTarget.style.transform = 'scale(1)' }}
                            title="Preview"
                          >
                            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                          </button>
                        )
                      )}
                      <button className="file-action" onClick={e => { e.stopPropagation(); handleDownload(f.path || f.name) }}
                        style={{
                          opacity: 0, width: 24, height: 24, borderRadius: 6,
                          background: cardBg, border: `1px solid ${borderCol}`,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: textMuted, transition: 'all 0.2s ease',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = cyanAccent; e.currentTarget.style.borderColor = cyanAccent; e.currentTarget.style.transform = 'scale(1.1)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = textMuted; e.currentTarget.style.borderColor = borderCol; e.currentTarget.style.transform = 'scale(1)' }}
                        title="Download"
                      >
                        <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                      </button>
                      <button className="file-action" onClick={e => { e.stopPropagation(); handleDelete(f.path || f.name) }}
                        style={{
                          opacity: 0, width: 24, height: 24, borderRadius: 6,
                          background: cardBg, border: `1px solid ${borderCol}`,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: textMuted, transition: 'all 0.2s ease',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#fee2e2'; e.currentTarget.style.transform = 'scale(1.1)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = textMuted; e.currentTarget.style.borderColor = borderCol; e.currentTarget.style.transform = 'scale(1)' }}
                        title="Hapus"
                      >
                        <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ height: 1, background: borderCol, flexShrink: 0 }} />

        {/* ── RIWAYAT CHAT ── */}
        <div>
          <SectionHeader
            icon={<svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
            label="Riwayat"
            open={histOpen}
            onToggle={() => setHistOpen(o => !o)}
            textMuted={textMuted}
            textSecondary={textSecondary}
            cyanAccent={cyanAccent}
          />
          {histOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              {sessions.length === 0 && (
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.62rem', color: textMuted, padding: '0.25rem',
                }}>belum ada riwayat</div>
              )}
              {sessions.map(s => {
                const isActive = s.session_id === sessionId
                return (
                  <div
                    key={s.session_id}
                    onClick={() => handleLoadSession(s.session_id)}
                    style={{
                      padding: '0.6rem 0.8rem 0.6rem 0.9rem',
                      borderRadius: 10, cursor: 'pointer',
                      background: isActive ? (isDark ? 'rgba(168,199,250,0.06)' : 'rgba(11,87,208,0.04)') : 'transparent',
                      border: isActive ? `1px solid ${isDark ? 'rgba(168,199,250,0.1)' : 'rgba(11,87,208,0.08)'}` : '1px solid transparent',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.1rem',
                      boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.02)' : 'none',
                    }}
                    onMouseEnter={e => {
                      if (!isActive) {
                        e.currentTarget.style.background = hoverBg
                        e.currentTarget.style.borderColor = borderCol
                      }
                      e.currentTarget.querySelector('.hist-del').style.opacity = '1'
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.borderColor = 'transparent'
                      }
                      e.currentTarget.querySelector('.hist-del').style.opacity = '0'
                    }}
                  >
                    {/* Glowing Left Indicator Line */}
                    {isActive && (
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        top: '15%',
                        bottom: '15%',
                        width: 3,
                        borderRadius: '0 4px 4px 0',
                        background: cyanAccent,
                        boxShadow: `0 0 8px ${cyanAccent}`,
                      }} />
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flex: 1 }}>
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={isActive ? cyanAccent : textMuted} style={{ flexShrink: 0 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
                      </svg>
                      <div style={{
                        fontSize: '0.78rem',
                        color: isActive ? textPrimary : textSecondary,
                        fontWeight: isActive ? 600 : 400,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        paddingRight: '1.2rem',
                      }} title={s.title}>{s.title}</div>
                    </div>

                    <button
                      className="hist-del"
                      onClick={e => handleDeleteSession(e, s.session_id)}
                      style={{
                        opacity: 0,
                        width: 22, height: 22, borderRadius: 5,
                        background: cardBg, border: `1px solid ${borderCol}`, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: textMuted, transition: 'all 0.15s ease',
                        flexShrink: 0,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#fee2e2' }}
                      onMouseLeave={e => { e.currentTarget.style.color = textMuted; e.currentTarget.style.borderColor = borderCol }}
                      title="Hapus Riwayat"
                    >
                      <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Footer (Profile, Theme, Logout) */}
      <div style={{
        padding: '0.85rem 1.1rem',
        borderTop: `1px solid ${borderCol}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: footerBg,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0, flex: 1, position: 'relative' }}>
          {/* Avatar bubble */}
          <div
            style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 800, color: 'white',
              flexShrink: 0,
              userSelect: 'none',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            {username ? username.charAt(0).toUpperCase() : 'A'}
          </div>

          {/* Active online status indicator */}
          <div style={{
            position: 'absolute',
            left: 20,
            bottom: 0,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#10b981',
            border: `1.5px solid ${footerBg}`,
            boxShadow: '0 0 4px #10b981',
          }} />

          {/* Username */}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, marginLeft: '0.15rem' }}>
            <span style={{
              fontSize: '0.78rem',
              color: textSecondary,
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }} title={username}>
              {username || 'Pengguna'}
            </span>
            <span style={{ fontSize: '9px', color: '#10b981', fontWeight: 500 }}>Online</span>
          </div>
        </div>

        {/* Action icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            style={{
              width: 28, height: 28, borderRadius: 7,
              background: 'transparent', border: 'none',
              color: textMuted,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = textPrimary; e.currentTarget.style.background = hoverBg }}
            onMouseLeave={e => { e.currentTarget.style.color = textMuted; e.currentTarget.style.background = 'transparent' }}
            title={theme === 'dark' ? 'Ganti ke Terang' : 'Ganti ke Gelap'}
          >
            {theme === 'dark' ? (
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
            ) : (
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
            )}
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            style={{
              width: 28, height: 28, borderRadius: 7,
              background: 'transparent', border: 'none',
              color: textMuted,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.color = textMuted; e.currentTarget.style.background = 'transparent' }}
            title="Keluar"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .sidebar-scroll::-webkit-scrollbar { width: 3px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(168,199,250,0.15); border-radius: 2px; }
        .sidebar-scroll::-webkit-scrollbar-thumb:hover { background: rgba(168,199,250,0.35); }
        .sidebar-file-row:hover .file-action {
          opacity: 1 !important;
          transform: translateY(0) scale(1) !important;
        }
        .file-action {
          opacity: 0;
          transform: translateY(2px) scale(0.95);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
      `}</style>

      {/* Desktop sidebar */}
      <div className="hidden md:flex" style={{ height: '100%', flexShrink: 0 }}>
        {sidebarContent}
      </div>

      {/* Mobile overlay */}
      {isOpen && (
        <div className="md:hidden" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
          <div
            style={{ flex: 1, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
          />
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 300 }}>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  )
}
