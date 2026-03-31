import { motion } from 'framer-motion'

export default function DeleteConfirmModal({ open, projectName, onClose, onConfirm, loading }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-2xl shadow-2xl w-full max-w-sm p-6"
      >
        <h2 className="text-lg font-bold text-red-400 mb-2">Hapus Project</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-5">
          Apakah Anda yakin ingin menghapus project <strong>"{projectName}"</strong>? Semua dataset dan riwayat chat di dalamnya akan dihapus permanen.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2 text-sm font-medium bg-red-500 text-white rounded-xl hover:bg-red-400 disabled:opacity-40 transition-all"
          >
            {loading ? 'Menghapus...' : 'Hapus'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
