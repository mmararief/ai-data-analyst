import { useState } from 'react'
import { motion } from 'framer-motion'
import api from '../api'

export default function CreateProjectModal({ open, onClose, onCreate }) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || loading) return
    setLoading(true)
    try {
      const res = await api.post('/projects/', { name: name.trim(), description: desc.trim() })
      onCreate(res.data)
      setName('')
      setDesc('')
      onClose()
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal membuat project')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-2xl shadow-2xl w-full max-w-md p-6"
      >
        <h2 className="text-lg font-bold text-[var(--text-heading)] mb-4">Buat Project Baru</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Nama Project *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="contoh: Analisis Penjualan Q1"
              className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-input)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/50 outline-none transition-all"
              autoFocus
              maxLength={120}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Deskripsi (opsional)</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Deskripsi singkat tentang project ini..."
              rows={3}
              className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-input)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/50 outline-none transition-all resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="px-5 py-2 text-sm font-medium bg-sky-500 text-white rounded-xl hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-sky-500/20"
            >
              {loading ? 'Membuat...' : 'Buat Project'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
