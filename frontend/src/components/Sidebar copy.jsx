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
    } catch { /* belum login atau kosong */ }
    finally { if (showSpinner) setRefreshing(false) }
  }

  const fetchHistory = async () => {
    if (!projectId) return
    try {
      const res = await api.get(`/history/${projectId}`)
      setSessions(Array.isArray(res.data?.sessions) ? res.data.sessions : [])
    } catch { /* ignore */ }
  }

  useEffect(() => { fetchFiles(false, ''); fetchHistory() }, [projectId])
  useEffect(() => { if (refreshTrigger > 0) { fetchFiles(false, currentPath); fetchHistory() } }, [refreshTrigger])

  const formatDate = (iso) => {
    const d = new Date(iso)
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

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
      for (let i = 0; i < fileList.length; i += 1) {
        const file = fileList[i]
        const form = new FormData()
        form.append('file', file)
        form.append('batch_total', String(fileList.length))
        form.append('batch_index', String(i + 1))
        setUploadProgress((prev) => ({ ...prev, current: i + 1, total: fileList.length, currentName: file.name }))

        try {
          await api.post(`/datasets/${projectId}/upload`, form)
          successCount += 1
          setUploadProgress((prev) => ({ ...prev, success: successCount }))
        } catch (err) {
          failedUploads.push(`${file.name}: ${err.response?.data?.detail || 'Upload gagal'}`)
          setUploadProgress((prev) => ({ ...prev, failed: prev.failed + 1 }))
        }
      }

      await fetchFiles()

      if (failedUploads.length > 0) {
        alert(`Sebagian file gagal diupload:\n${failedUploads.join('\n')}`)
      }
    } finally {
      setUploading(false)
      setUploadProgress({ current: 0, total: 0, currentName: '', success: 0, failed: 0 })
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleUpload = (e) => uploadFiles(e.target.files)
  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    uploadFiles(e.dataTransfer.files)
  }

  const handleDownload = (name) => {
    const token = localStorage.getItem('token')
    const downloadName = (name || '').split('/').pop() || name
    fetch(`/datasets/${projectId}/download/${encodeURIComponent(name)}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = downloadName
        a.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => alert('Gagal mengunduh file'))
  }

  const handleDelete = async (name) => {
    if (!confirm(`Hapus ${name}?`)) return
    await api.delete(`/datasets/${projectId}/${encodeURIComponent(name)}`)
    fetchFiles(false, currentPath)
  }

  const handleDeleteAll = async () => {
    if (files.length === 0) return
    if (!confirm(`Hapus semua ${files.length} file? Tindakan ini tidak dapat dibatalkan.`)) return
    try {
      await api.delete(`/datasets/${projectId}/`)
      await fetchFiles(false, '')
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal menghapus semua file')
    }
  }

  const goToFolder = async (folderPath) => {
    await fetchFiles(false, folderPath)
  }

  const goUpFolder = async () => {
    if (!currentPath) return
    const parts = currentPath.split('/').filter(Boolean)
    const parent = parts.slice(0, -1).join('/')
    await fetchFiles(false, parent)
  }

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside
        className={`
        fixed inset-y-0 left-0 z-50 bg-[var(--bg-sidebar)] border-r border-[var(--border-light)] 
        flex flex-col overflow-y-auto custom-scrollbar transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
        style={{ width: width || 288, maxWidth: 420, minWidth: 220 }}
      >
        {/* Logo + Back to Dashboard */}
        <div className="px-5 py-4 border-b border-[var(--border-light)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="p-1 text-[var(--text-muted)] hover:text-sky-400 transition-colors"
              title="Kembali ke Dashboard"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="font-bold text-lg tracking-tight text-[var(--text-heading)]">Analis<span className="text-sky-400">ai</span></span>
          </div>
          <button onClick={onClose} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] md:hidden">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex flex-col gap-5 p-4 flex-1">
          {/* File Manager */}
          <div>
            <h2 className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-3 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
              File Manager
              {files.length > 0 && (
                <span className="ml-1 text-[10px] font-normal text-[var(--text-secondary)]">
                  {files.length} item
                </span>
              )}
              <button
                onClick={() => fetchFiles(true)}
                title="Refresh daftar file"
                className="ml-auto text-gray-600 hover:text-sky-400 transition-colors"
              >
                <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
              {files.length > 0 && (
                <button
                  onClick={handleDeleteAll}
                  title="Hapus semua file"
                  className="text-gray-600 hover:text-red-400 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              )}
            </h2>

            {currentPath && (
              <div className="mb-2 flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                <button
                  onClick={goUpFolder}
                  className="px-2 py-0.5 rounded border border-[var(--border-light)] hover:bg-[var(--bg-hover)]"
                >
                  Up
                </button>
                <span className="truncate" title={currentPath}>/{currentPath}</span>
              </div>
            )}

            {/* Drop Zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current.click()}
              className={`border border-dashed rounded-xl px-4 py-5 text-center cursor-pointer transition-all duration-200 ${dragOver
                ? 'border-sky-400 bg-sky-500/10 shadow-sm'
                : 'border-[var(--border-input)] bg-[var(--bg-tertiary)]/70 hover:border-sky-500/40 hover:bg-[var(--bg-hover)]'
                }`}
            >
              {uploading ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin text-sky-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    <span className="text-xs text-sky-400 text-left">
                      Mengupload {uploadProgress.current}/{uploadProgress.total}{uploadProgress.currentName ? `: ${uploadProgress.currentName}` : ''}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-500 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] text-center">
                    Berhasil {uploadProgress.success} · Gagal {uploadProgress.failed}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <svg className="w-6 h-6 text-[var(--text-muted)] mx-auto mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  <p className="text-xs text-[var(--text-secondary)]">Klik atau drop beberapa file di sini</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">CSV, XLSX, JSON, Parquet, PKL, Joblib</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Maksimal {MAX_FILES_PER_UPLOAD} file per upload</p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".csv,.xlsx,.xls,.json,.parquet,.pkl,.joblib"
              className="hidden"
              onChange={handleUpload}
            />

            {/* File List */}
            <div className="mt-3 space-y-1.5">
              {files.length === 0 && (
                <p className="text-[var(--text-muted)] text-xs px-1">
                  Belum ada file. Upload dataset untuk memulai analisis.
                </p>
              )}
              {files.map((f) => (
                <div
                  key={f.path || f.name}
                  onClick={() => { if (f.type === 'folder') goToFolder(f.path || f.name) }}
                  className={`group flex items-center justify-between bg-[var(--bg-sidebar-item)]/80 hover:bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-xl px-3 py-2.5 transition-all duration-150 ${f.type === 'folder' ? 'cursor-pointer' : ''}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {f.type === 'folder' ? (
                      <svg className="w-3.5 h-3.5 text-yellow-400/70 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
                    ) : (
                      <svg className="w-3.5 h-3.5 text-sky-400/60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    )}
                    <div className="min-w-0">
                      <span className="text-xs text-[var(--text-secondary)] truncate block" title={f.path || f.name}>
                        {f.name}
                      </span>
                      {f.type === 'folder' && (
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {f.image_count} gambar · {f.size_kb} KB
                        </span>
                      )}
                      {f.type !== 'folder' && (
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {f.size_kb} KB
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Preview - only for tabular data files */}
                    {['.csv', '.xlsx', '.xls', '.json', '.parquet'].some(e => f.name.toLowerCase().endsWith(e)) && (
                      <button onClick={(ev) => { ev.stopPropagation(); setPreviewFilename(f.path || f.name) }} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-sky-400 transition-all" title="Preview">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      </button>
                    )}
                    {/* Download - only for files, not folders */}
                    {f.type !== 'folder' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownload(f.path || f.name) }}
                        className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-sky-400 transition-all duration-150"
                        title="Download"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(f.path || f.name) }}
                      className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all duration-150"
                      title="Hapus"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[var(--border-light)]" />

          {/* ── RIWAYAT CHAT ── */}
          <div>
            <button onClick={() => setHistOpen(o => !o)} className="w-full text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-2 flex items-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Riwayat Chat
              <svg className={`w-3 h-3 ml-auto transition-transform ${histOpen ? '' : '-rotate-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {histOpen && (
              <div className="space-y-1">
                {(sessions?.length || 0) === 0 && <p className="text-[var(--text-muted)] text-xs px-1">Belum ada riwayat tersimpan</p>}
                {(sessions || []).map((s) => (
                  <div key={s.session_id} onClick={() => handleLoadSession(s.session_id)} className="group flex items-start justify-between bg-[var(--bg-sidebar-item)] hover:bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-2 cursor-pointer transition-all duration-150">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-[var(--text-secondary)] truncate font-medium" title={s.title}>{s.title}</p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{formatDate(s.created_at)} · {s.message_count} pesan</p>
                    </div>
                    <button onClick={(e) => handleDeleteSession(e, s.session_id)} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 shrink-0 mt-0.5 ml-2" title="Hapus">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── SARAN PERTANYAAN ── */}
          <div>
            <button onClick={() => setSuggestOpen(o => !o)} className="w-full text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-2 flex items-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Saran Pertanyaan
              <svg className={`w-3 h-3 ml-auto transition-transform ${suggestOpen ? '' : '-rotate-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {suggestOpen && (
              <div className="space-y-1">
                {SUGGESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => { onSuggest(q); if (onClose) onClose() }}
                    className="w-full text-left text-xs bg-[var(--bg-sidebar-item)] hover:bg-sky-500/10 hover:text-sky-300 border border-[var(--border-light)] hover:border-sky-500/20 rounded-lg px-3 py-2 text-[var(--text-muted)] transition-all duration-200"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modals */}
        {previewFilename && (
          <DataPreviewModal
            projectId={projectId}
            filename={previewFilename}
            onClose={() => setPreviewFilename(null)}
          />
        )}
      </aside>
    </>
  )
}
