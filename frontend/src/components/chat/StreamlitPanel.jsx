import { useState } from 'react'
import api from '../../api'

export default function StreamlitPanel({ projectId, filename }) {
  const [info, setInfo] = useState(null)
  const [launching, setLaunching] = useState(false)
  const [iframeReady, setIframeReady] = useState(false)
  const [error, setError] = useState('')

  const launch = async () => {
    setLaunching(true); setError(''); setIframeReady(false)
    try {
      const res = await api.post('/streamlit/run', { filename, project_id: projectId })
      setInfo(res.data)
      setTimeout(() => setIframeReady(true), 1000)
    } catch (e) {
      setError(e.response?.data?.detail || 'Gagal menjalankan Streamlit')
    } finally { setLaunching(false) }
  }

  const stop = async () => {
    try { await api.post('/streamlit/stop'); setInfo(null); setIframeReady(false) } catch {}
  }

  return (
    <div className="rounded-lg border border-sky-500/25 bg-sky-950/20 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          <span className="text-xs font-mono text-sky-300">{filename}</span>
        </div>
        <div className="flex items-center gap-2">
          {info ? (
            <>
              <a href={info.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-sky-400 hover:text-sky-300 border border-sky-600/30 px-2.5 py-1 rounded transition-colors">Buka ↗</a>
              <button onClick={stop} className="text-[11px] text-red-400 hover:text-red-300 border border-red-600/20 px-2.5 py-1 rounded transition-colors">Stop</button>
            </>
          ) : (
            <button onClick={launch} disabled={launching} className="text-[11px] text-sky-300 bg-sky-900/40 hover:bg-sky-900/60 disabled:opacity-50 px-3 py-1 rounded transition-colors flex items-center gap-1.5">
              {launching ? <><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Starting...</> : <>▶ Run Dashboard</>}
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-red-400 px-3 pb-2">{error}</p>}
      {info && !iframeReady && <div className="flex items-center justify-center gap-2 py-6 text-sky-400 text-xs border-t border-sky-500/20"><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Mempersiapkan dashboard...</div>}
      {info && iframeReady && <iframe src={info.url} className="w-full border-t border-sky-500/20" style={{ height: '600px' }} title="Streamlit Dashboard" />}
    </div>
  )
}
