import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../api'
import { useTheme } from '../ThemeContext'
import CreateProjectModal from '../components/CreateProjectModal'
import DeleteConfirmModal from '../components/DeleteConfirmModal'

export default function DashboardPage({ username, onLogout }) {
  const [projects, setProjects] = useState([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects/')
      setProjects(res.data.projects || [])
    } catch { /* ignore */ }
    finally { setLoadingProjects(false) }
  }

  useEffect(() => { fetchProjects() }, [])

  const handleCreate = (newProject) => {
    navigate(`/project/${newProject.project_id}`)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/projects/${deleteTarget.project_id}`)
      setProjects((prev) => prev.filter((p) => p.project_id !== deleteTarget.project_id))
      setDeleteTarget(null)
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal menghapus project')
    } finally {
      setDeleting(false)
    }
  }

  const handleRename = async (projectId) => {
    if (!editName.trim()) {
      setEditingId(null)
      return
    }
    try {
      await api.put(`/projects/${projectId}`, { name: editName.trim() })
      setProjects((prev) =>
        prev.map((p) => (p.project_id === projectId ? { ...p, name: editName.trim() } : p))
      )
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal rename project')
    }
    setEditingId(null)
  }

  const formatDate = (d) => {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] transition-colors duration-200">
      {/* Header */}
      <header className="border-b border-[var(--border-light)] bg-[var(--bg-header)] backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-heading)]">
            Analis<span className="text-sky-400">ai</span>
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="text-[var(--text-muted)] hover:text-sky-300 border border-[var(--border-primary)] rounded-lg p-2 transition-all"
              title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            >
              {theme === 'dark' ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
            </button>
            <span className="text-sm text-[var(--text-muted)] hidden sm:inline">{username}</span>
            <button
              onClick={onLogout}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border-primary)] rounded-lg px-3 py-1.5 transition-all"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Title row */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-heading)]">Project Saya</h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">Kelola project analisis data Anda</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-sky-500 text-white rounded-xl hover:bg-sky-400 transition-all shadow-lg shadow-sky-500/20 hover:-translate-y-0.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Buat Project
          </button>
        </div>

        {/* Loading */}
        {loadingProjects && (
          <div className="flex items-center justify-center py-20">
            <svg className="w-6 h-6 animate-spin text-sky-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {/* Empty state */}
        {!loadingProjects && projects.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-sky-500/10 flex items-center justify-center mb-5">
              <svg className="w-8 h-8 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-heading)] mb-2">Belum ada project</h3>
            <p className="text-sm text-[var(--text-muted)] max-w-sm mb-6">
              Buat project pertama Anda untuk mulai menganalisis data. Setiap project memiliki dataset dan riwayat chat terpisah.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-sky-500 text-white rounded-xl hover:bg-sky-400 transition-all shadow-lg shadow-sky-500/20"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Buat Project Pertama
            </button>
          </motion.div>
        )}

        {/* Project grid */}
        {!loadingProjects && projects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <AnimatePresence>
              {projects.map((p, i) => (
                <motion.div
                  key={p.project_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => navigate(`/project/${p.project_id}`)}
                  className="group relative bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-2xl p-5 cursor-pointer hover:border-sky-500/30 hover:shadow-lg hover:shadow-sky-500/5 transition-all duration-200 hover:-translate-y-0.5"
                >
                  {/* Actions */}
                  <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingId(p.project_id)
                        setEditName(p.name)
                      }}
                      className="p-1.5 text-[var(--text-muted)] hover:text-sky-400 rounded-lg hover:bg-[var(--bg-hover)] transition-all"
                      title="Rename"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTarget(p)
                      }}
                      className="p-1.5 text-[var(--text-muted)] hover:text-red-400 rounded-lg hover:bg-[var(--bg-hover)] transition-all"
                      title="Hapus"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>

                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center mb-4">
                    <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                  </div>

                  {/* Name (inline rename) */}
                  {editingId === p.project_id ? (
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => handleRename(p.project_id)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRename(p.project_id); if (e.key === 'Escape') setEditingId(null) }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-[var(--bg-tertiary)] border border-sky-500/50 rounded-lg px-2 py-1 text-sm font-semibold text-[var(--text-heading)] outline-none mb-1"
                      maxLength={120}
                    />
                  ) : (
                    <h3 className="text-sm font-semibold text-[var(--text-heading)] mb-1 truncate pr-16" title={p.name}>
                      {p.name}
                    </h3>
                  )}

                  {p.description && (
                    <p className="text-xs text-[var(--text-muted)] mb-4 line-clamp-2">{p.description}</p>
                  )}
                  {!p.description && <div className="mb-4" />}

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-[11px] text-[var(--text-muted)]">
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      {p.file_count} file
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                      {p.chat_count} chat
                    </span>
                    <span className="ml-auto">{formatDate(p.updated_at || p.created_at)}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showCreate && (
          <CreateProjectModal open={showCreate} onClose={() => setShowCreate(false)} onCreate={handleCreate} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {deleteTarget && (
          <DeleteConfirmModal
            open={!!deleteTarget}
            projectName={deleteTarget?.name}
            onClose={() => setDeleteTarget(null)}
            onConfirm={handleDelete}
            loading={deleting}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
