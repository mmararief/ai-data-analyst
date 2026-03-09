import { useState } from 'react'

const DATA_EXTS = ['.csv', '.xlsx', '.xls', '.json', '.parquet']

export default function PredictModal({ files, onClose, onSendMessage }) {
  const [modelFile, setModelFile] = useState('')
  const [dataFile, setDataFile] = useState('')

  const modelFiles = files.filter((f) =>
    f.name.endsWith('.pkl') || f.name.endsWith('.joblib')
  )
  const dataFiles = files.filter((f) =>
    DATA_EXTS.some((ext) => f.name.toLowerCase().endsWith(ext))
  )

  const handlePredict = () => {
    if (!modelFile || !dataFile) return
    onSendMessage(
      `Gunakan model \`${modelFile}\` yang tersimpan di \`/app/data/${modelFile}\` untuk memprediksi data dari file \`/app/data/${dataFile}\`. ` +
      `Langkah yang harus dilakukan:\n` +
      `1. Muat model menggunakan joblib\n` +
      `2. Baca dataset dari file tersebut\n` +
      `3. Jalankan prediksi (pastikan preprocessing sesuai dengan saat training)\n` +
      `4. Simpan hasil prediksi ke \`/app/data/hasil_prediksi.csv\`\n` +
      `5. Tampilkan 10 baris pertama hasil prediksi beserta statistik ringkasan`
    )
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] backdrop-blur-sm p-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-light)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-600/20 border border-green-500/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Prediksi dengan Model</h2>
              <p className="text-xs text-[var(--text-muted)]">Gunakan model tersimpan untuk prediksi</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              File Model <span className="text-green-400">(.pkl / .joblib)</span>
            </label>
            {modelFiles.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] italic px-1">Belum ada file model tersimpan. Latih model terlebih dahulu.</p>
            ) : (
              <select
                value={modelFile}
                onChange={(e) => setModelFile(e.target.value)}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-500/50 transition-all"
              >
                <option value="">-- Pilih model --</option>
                {modelFiles.map((f) => (
                  <option key={f.name} value={f.name}>{f.name}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              Data untuk Diprediksi
            </label>
            {dataFiles.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] italic px-1">Belum ada file data. Upload dataset terlebih dahulu.</p>
            ) : (
              <select
                value={dataFile}
                onChange={(e) => setDataFile(e.target.value)}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-500/50 transition-all"
              >
                <option value="">-- Pilih file data --</option>
                {dataFiles.map((f) => (
                  <option key={f.name} value={f.name}>{f.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="bg-green-600/5 border border-green-500/10 rounded-xl px-4 py-3">
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              AI akan memuat model, menjalankan prediksi, menyimpan hasilnya, dan menampilkan ringkasan hasil dalam chat.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[var(--border-light)]">
          <button
            onClick={onClose}
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-input)] hover:border-[var(--border-primary)] rounded-xl px-4 py-2 transition-all"
          >
            Batal
          </button>
          <button
            onClick={handlePredict}
            disabled={!modelFile || !dataFile}
            className={`text-sm font-medium rounded-xl px-5 py-2 transition-all flex items-center gap-2 ${
              modelFile && dataFile
                ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-600/20'
                : 'bg-[var(--bg-input)] text-[var(--text-muted)] cursor-not-allowed'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Jalankan Prediksi
          </button>
        </div>
      </div>
    </div>
  )
}
