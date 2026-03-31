import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import DataPreviewModal from './DataPreviewModal'

const SUGGESTIONS = [
  'Tampilkan 5 baris pertama',
  'Berapa banyak data dan kolom?',
  'Apakah ada nilai kosong?',
  'Tampilkan statistik deskriptif',
  'Buat bar chart kolom pertama',
  'Tampilkan korelasi antar kolom numerik',
]

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

function SectionHeader({ icon, label, open, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.4rem 0',
        background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.6rem', letterSpacing: '0.12em',
        color: 'var(--text-muted)', textTransform: 'uppercase',
        transition: 'color 0.2s',
        marginBottom: '0.6rem',
      }}
      onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
    >
      <span style={{ color: '#38bdf8', display: 'flex', flexShrink: 0 }}>{icon}</span>
      {label}
      <svg
        width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor"
        style={{
          marginLeft: 'auto', flexShrink: 0,
          transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform 0.2s',
        }}
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
      </svg>
    </button>
  )
}

export default function Sidebar({ projectId, onSuggest, onLoadHistory, refreshTrigger, isOpen, onClose, width }) {
  const [files, setFiles] = useState([])
  const [currentPath, setCurrentPath] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, currentName: '', success: 0, failed: 0 })
  const [dragOver, setDragOver] = useState(false)
  const [previewFilename, setPreviewFilename] = useState(null)
  const [sessions, setSessions] = useState([])
  const [histOpen, setHistOpen] = useState(true)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [filesOpen, setFilesOpen] = useState(true)
  const fileRef = useRef()
  const navigate = useNavigate()

  const fetchFiles = async (showSpinner = false, pathOverride = null) => {
    if (!projectId) return
    if (showSpinner) setRefreshing(true)
    try {
      const pathToLoad = pathOverride !== null ? pathOverride : currentPath
      const params = pathToLoad ? { path: pathToLoad } : {}
      const res = await api.get(`/datasets/${projectId}/`, { params })
      setCurrentPath(res.data?.path || pathToLoad || '')
      setFiles(Array.isArray(res.data?.files) ? res.data.files : [])
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

  useEffect(() => { fetchFiles(false, ''); fetchHistory() }, [projectId])
  useEffect(() => { if (refreshTrigger > 0) { fetchFiles(false, currentPath); fetchHistory() } }, [refreshTrigger])

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
    fetchFiles(false, currentPath)
  }

  const handleDeleteAll = async () => {
    if (files.length === 0) return
    if (!confirm(`Hapus semua ${files.length} file?`)) return
    try {
      await api.delete(`/datasets/${projectId}/all`)
      await fetchFiles(false, '')
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal menghapus semua file')
    }
  }

  const sidebarContent = (
    <aside style={{
      width: width || 288,
      minWidth: width || 288,
      height: '100%',
      background: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border-primary)',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Syne', sans-serif",
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem 1rem 0.75rem',
        borderBottom: '1px solid var(--border-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: 22, height: 22, borderRadius: 5,
            background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, color: 'white',
          }}>A</div>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.65rem', letterSpacing: '0.1em',
            color: 'var(--text-muted)', textTransform: 'uppercase',
          }}>workspace</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <button
            onClick={() => fetchFiles(true, currentPath)}
            title="Refresh"
            style={{
              width: 26, height: 26, borderRadius: 6,
              background: 'none', border: '1px solid var(--border-primary)',
              color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'color 0.2s, border-color 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--analisai-cyan)'; e.currentTarget.style.borderColor = 'rgba(56,189,248,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-primary)' }}
          >
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"
              style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden flex items-center justify-center"
              style={{
                width: 26, height: 26, borderRadius: 6,
                background: 'none', border: '1px solid var(--border-primary)',
                color: 'var(--text-muted)',
                cursor: 'pointer', transition: 'color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        padding: '0.75rem',
        display: 'flex', flexDirection: 'column', gap: '1rem',
      }}
        className="sidebar-scroll"
      >
        {/* ── DATASET FILES ── */}
        <div>
          <SectionHeader
            icon={<svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/></svg>}
            label="Dataset"
            open={filesOpen}
            onToggle={() => setFilesOpen(o => !o)}
          />

          {filesOpen && (
            <>
              {/* Breadcrumb */}
              {currentPath && (
                <button
                  onClick={() => {
                    const parts = currentPath.split('/').filter(Boolean)
                    parts.pop()
                    goToFolder(parts.join('/'))
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                    fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem',
                    color: 'var(--text-muted)', background: 'none', border: 'none',
                    cursor: 'pointer', marginBottom: '0.5rem', padding: 0,
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--analisai-cyan)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                  </svg>
                  ../{currentPath}
                </button>
              )}

              {/* Drop zone */}
              <div
                onClick={() => !uploading && fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                style={{
                  border: `1px dashed ${dragOver ? 'rgba(56,189,248,0.5)' : 'var(--border-light)'}`,
                  borderRadius: 10,
                  padding: '0.85rem 0.75rem',
                  textAlign: 'center', cursor: 'pointer',
                  background: dragOver ? 'rgba(56,189,248,0.04)' : 'transparent',
                  transition: 'border-color 0.2s, background 0.2s',
                  marginBottom: '0.6rem',
                }}
              >
                {uploading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.62rem', color: 'var(--analisai-cyan)', letterSpacing: '0.06em',
                    }}>
                      {uploadProgress.current}/{uploadProgress.total} · {uploadProgress.currentName.slice(0, 16)}
                    </div>
                    <div style={{ height: 3, background: 'var(--border-light)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 2,
                        background: 'linear-gradient(90deg, #0ea5e9, #6366f1)',
                        width: `${uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0}%`,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                    <div style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.58rem', color: 'var(--text-muted)',
                    }}>
                      ✓ {uploadProgress.success} · ✗ {uploadProgress.failed}
                    </div>
                  </div>
                ) : (
                  <>
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="var(--text-muted)"
                      style={{ margin: '0 auto 0.4rem' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                    </svg>
                    <div style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.62rem', color: 'var(--text-muted)',
                      letterSpacing: '0.04em', lineHeight: 1.6,
                    }}>
                      klik atau drop file<br/>
                      <span style={{ color: 'var(--text-muted)', opacity: 0.6, fontSize: '0.58rem' }}>csv · xlsx · json · parquet · pkl</span>
                    </div>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" multiple
                accept=".csv,.xlsx,.xls,.json,.parquet,.pkl,.joblib"
                style={{ display: 'none' }} onChange={handleUpload}
              />

              {/* File list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {files.length === 0 && (
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.62rem', color: 'var(--text-muted)',
                    padding: '0.25rem 0.25rem',
                  }}>belum ada file</div>
                )}
                {files.map(f => (
                  <div
                    key={f.path || f.name}
                    onClick={() => f.type === 'folder' && goToFolder(f.path || f.name)}
                    className="sidebar-file-row"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.5rem 0.6rem',
                      borderRadius: 8,
                      background: 'var(--bg-hover)',
                      border: '1px solid var(--border-light)',
                      cursor: f.type === 'folder' ? 'pointer' : 'default',
                      transition: 'background 0.15s, border-color 0.15s',
                      position: 'relative',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'var(--bg-sidebar-item)'
                      e.currentTarget.style.borderColor = 'var(--border-primary)'
                      e.currentTarget.querySelectorAll('.file-action').forEach(b => b.style.opacity = '1')
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'var(--bg-hover)'
                      e.currentTarget.style.borderColor = 'var(--border-light)'
                      e.currentTarget.querySelectorAll('.file-action').forEach(b => b.style.opacity = '0')
                    }}
                  >
                    <FileIcon name={f.name} type={f.type} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.78rem', color: '#94a3b8',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }} title={f.path || f.name}>{f.name}</div>
                      <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.58rem', color: 'var(--text-muted)',
                      }}>{f.size_kb} KB</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.2rem', flexShrink: 0 }}>
                      {['.csv','.xlsx','.xls','.json','.parquet'].some(e => f.name.toLowerCase().endsWith(e)) && (
                        <button className="file-action" onClick={ev => { ev.stopPropagation(); setPreviewFilename(f.path || f.name) }}
                          style={{ opacity:0, width:22, height:22, borderRadius:5, background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', transition:'color 0.15s, opacity 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.color='#38bdf8'}
                          onMouseLeave={e => e.currentTarget.style.color='#334155'}
                          title="Preview"
                        >
                          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                        </button>
                      )}
                      {f.type !== 'folder' && (
                        <button className="file-action" onClick={e => { e.stopPropagation(); handleDownload(f.path || f.name) }}
                          style={{ opacity:0, width:22, height:22, borderRadius:5, background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', transition:'color 0.15s, opacity 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.color='#38bdf8'}
                          onMouseLeave={e => e.currentTarget.style.color='#334155'}
                          title="Download"
                        >
                          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                        </button>
                      )}
                      <button className="file-action" onClick={e => { e.stopPropagation(); handleDelete(f.path || f.name) }}
                        style={{ opacity:0, width:22, height:22, borderRadius:5, background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', transition:'color 0.15s, opacity 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.color='#f87171'}
                        onMouseLeave={e => e.currentTarget.style.color='var(--text-muted)'}
                        title="Hapus"
                      >
                        <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>
                  </div>
                ))}

                {files.length > 1 && (
                  <button
                    onClick={handleDeleteAll}
                    style={{
                      width: '100%', padding: '0.4rem',
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.6rem', letterSpacing: '0.08em',
                      color: 'var(--text-muted)', background: 'none',
                      border: '1px solid var(--border-light)',
                      borderRadius: 6, cursor: 'pointer',
                      transition: 'color 0.2s, border-color 0.2s',
                      marginTop: '0.25rem',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-light)' }}
                  >
                    hapus semua ({files.length})
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', flexShrink: 0 }} />

        {/* ── RIWAYAT CHAT ── */}
        <div>
          <SectionHeader
            icon={<svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
            label="Riwayat"
            open={histOpen}
            onToggle={() => setHistOpen(o => !o)}
          />
          {histOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {sessions.length === 0 && (
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.62rem', color: 'var(--text-muted)', padding: '0.25rem',
                }}>belum ada riwayat</div>
              )}
              {sessions.map(s => (
                <div
                  key={s.session_id}
                  onClick={() => handleLoadSession(s.session_id)}
                  style={{
                    padding: '0.6rem 0.7rem',
                    borderRadius: 8, cursor: 'pointer',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.04)',
                    transition: 'background 0.15s, border-color 0.15s',
                    position: 'relative',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--bg-sidebar-item)'
                    e.currentTarget.style.borderColor = 'rgba(56,189,248,0.15)'
                    e.currentTarget.querySelector('.hist-del').style.opacity = '1'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'var(--bg-hover)'
                    e.currentTarget.style.borderColor = 'var(--border-light)'
                    e.currentTarget.querySelector('.hist-del').style.opacity = '0'
                  }}
                >
                  <div style={{
                    fontSize: '0.78rem', color: '#64748b',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    paddingRight: '1.5rem', marginBottom: '0.2rem',
                  }} title={s.title}>{s.title}</div>
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.58rem', color: 'var(--text-muted)',
                  }}>{formatDate(s.created_at)} · {s.message_count} pesan</div>
                  <button
                    className="hist-del"
                    onClick={e => handleDeleteSession(e, s.session_id)}
                    style={{
                      opacity: 0, position: 'absolute', top: '0.5rem', right: '0.5rem',
                      width: 20, height: 20, borderRadius: 5,
                      background: 'none', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-muted)', transition: 'color 0.15s, opacity 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  >
                    <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', flexShrink: 0 }} />

        {/* ── SARAN PERTANYAAN ── */}
        <div>
          <SectionHeader
            icon={<svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
            label="Saran"
            open={suggestOpen}
            onToggle={() => setSuggestOpen(o => !o)}
          />
          {suggestOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              {SUGGESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => { onSuggest(q); if (onClose) onClose() }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '0.55rem 0.7rem',
                    borderRadius: 7, cursor: 'pointer', fontSize: '0.78rem',
                    color: 'var(--text-muted)', background: 'var(--bg-hover)',
                    border: '1px solid var(--border-light)',
                    fontFamily: "'Syne', sans-serif",
                    transition: 'color 0.15s, background 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = 'var(--analisai-cyan)'
                    e.currentTarget.style.background = 'rgba(56,189,248,0.05)'
                    e.currentTarget.style.borderColor = 'rgba(56,189,248,0.2)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = 'var(--text-muted)'
                    e.currentTarget.style.background = 'var(--bg-hover)'
                    e.currentTarget.style.borderColor = 'var(--border-light)'
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {previewFilename && (
        <DataPreviewModal
          projectId={projectId}
          filename={previewFilename}
          onClose={() => setPreviewFilename(null)}
        />
      )}
    </aside>
  )

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .sidebar-scroll::-webkit-scrollbar { width: 3px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(56,189,248,0.15); border-radius: 2px; }
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
