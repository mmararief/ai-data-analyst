import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../api'
import { useTheme } from '../ThemeContext'
import CreateProjectModal from '../components/CreateProjectModal'
import DeleteConfirmModal from '../components/DeleteConfirmModal'

// ── Tiny canvas bg ────────────────────────────────────────────────────────────
function GridCanvas() {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d')
    let W, H, raf
    const resize = () => { W = c.width = c.offsetWidth; H = c.height = c.offsetHeight }
    resize()
    window.addEventListener('resize', resize)
    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      ctx.strokeStyle = 'rgba(56,189,248,0.08)'; ctx.lineWidth = 0.5
      for (let x = 0; x < W; x += 72) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke() }
      for (let y = 0; y < H; y += 72) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke() }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={ref} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', opacity:0.6 }} />
}

// ── Stat chip ─────────────────────────────────────────────────────────────────
function StatChip({ icon, value, label }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:'0.5rem',
      padding:'0.45rem 0.9rem',
      background:'var(--bg-hover)',
      border:'1px solid var(--border-primary)',
      borderRadius:8,
    }}>
      <span style={{ color:'var(--analisai-cyan)', display:'flex' }}>{icon}</span>
      <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'0.72rem', color:'var(--analisai-cyan)', fontWeight:500 }}>{value}</span>
      <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'0.62rem', color:'var(--text-muted)', letterSpacing:'0.06em' }}>{label}</span>
    </div>
  )
}

// ── Project card ──────────────────────────────────────────────────────────────
function ProjectCard({ project, index, onNavigate, onEdit, onDelete }) {
  const [hovered, setHovered] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [editVal, setEditVal] = useState(project.name)

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })
  }

  const handleRenameCommit = () => {
    setEditingName(false)
    if (editVal.trim() && editVal.trim() !== project.name) onEdit(project.project_id, editVal.trim())
    else setEditVal(project.name)
  }

  // Deterministic accent color per project
  const accents = ['#38bdf8','#818cf8','#34d399','#f472b6','#fb923c','#a78bfa']
  const accent = accents[index % accents.length]

  return (
    <motion.div
      initial={{ opacity:0, y:20 }}
      animate={{ opacity:1, y:0 }}
      exit={{ opacity:0, scale:0.96 }}
      transition={{ delay: index * 0.06, duration:0.4, ease:'easeOut' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => !editingName && onNavigate(project.project_id)}
      style={{
        position:'relative',
        background: hovered ? 'var(--bg-hover)' : 'var(--bg-card)',
        border: `1px solid ${hovered ? accent + '40' : 'var(--border-primary)'}`,
        borderRadius:14,
        padding:'1.5rem',
        cursor:'pointer',
        transition:'all 0.2s',
        overflow:'hidden',
      }}
    >
      {/* Top accent line */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, height:1,
        background: hovered ? `linear-gradient(90deg, transparent, ${accent}60, transparent)` : 'transparent',
        transition:'background 0.3s',
      }} />

      {/* Corner glow */}
      <div style={{
        position:'absolute', top:-40, right:-40,
        width:120, height:120, borderRadius:'50%',
        background: `radial-gradient(circle, ${accent}10 0%, transparent 70%)`,
        opacity: hovered ? 1 : 0,
        transition:'opacity 0.3s', pointerEvents:'none',
      }} />

      {/* Actions */}
      <div style={{
        position:'absolute', top:'1rem', right:'1rem',
        display:'flex', gap:'0.25rem',
        opacity: hovered ? 1 : 0,
        transition:'opacity 0.15s',
      }}>
        <button
          onClick={e => { e.stopPropagation(); setEditingName(true); setEditVal(project.name) }}
          style={{
            width:28, height:28, borderRadius:6,
            background:'var(--bg-hover)',
            border:'1px solid var(--border-primary)',
            color:'var(--text-muted)', display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'pointer', transition:'color 0.2s, background 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color='var(--analisai-cyan)'; e.currentTarget.style.background='var(--bg-sidebar-item)' }}
          onMouseLeave={e => { e.currentTarget.style.color='var(--text-muted)'; e.currentTarget.style.background='var(--bg-hover)' }}
          title="Rename"
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(project) }}
          style={{
            width:28, height:28, borderRadius:6,
            background:'var(--bg-hover)',
            border:'1px solid var(--border-primary)',
            color:'var(--text-muted)', display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'pointer', transition:'color 0.2s, background 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color='#f87171'; e.currentTarget.style.background='rgba(239,68,68,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.color='var(--text-muted)'; e.currentTarget.style.background='var(--bg-hover)' }}
          title="Hapus"
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </div>

      {/* Icon */}
      <div style={{
        width:40, height:40, borderRadius:10,
        background: `${accent}12`,
        border:`1px solid ${accent}25`,
        display:'flex', alignItems:'center', justifyContent:'center',
        color: accent, marginBottom:'1.1rem',
        transition:'box-shadow 0.2s',
        boxShadow: hovered ? `0 0 16px ${accent}25` : 'none',
      }}>
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
        </svg>
      </div>

      {/* Name */}
      {editingName ? (
        <input
          autoFocus
          value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onBlur={handleRenameCommit}
          onKeyDown={e => { if(e.key==='Enter') handleRenameCommit(); if(e.key==='Escape'){setEditingName(false);setEditVal(project.name)} }}
          onClick={e => e.stopPropagation()}
          maxLength={120}
          style={{
            width:'100%', background:'var(--bg-hover)',
            border:`1px solid ${accent}50`, borderRadius:6,
            padding:'0.3rem 0.5rem', color:'var(--text-primary)',
            fontFamily:"'Syne',sans-serif", fontSize:'0.92rem', fontWeight:700,
            outline:'none', marginBottom:'0.35rem',
          }}
        />
      ) : (
        <div style={{
          fontSize:'0.92rem', fontWeight:700,
          color:'var(--text-heading)', marginBottom:'0.35rem',
          paddingRight:'4rem', letterSpacing:'-0.01em',
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>{project.name}</div>
      )}

      {project.description && (
        <div style={{
          fontSize:'0.78rem', color:'var(--text-muted)',
          lineHeight:1.6, marginBottom:'1rem',
          display:'-webkit-box', WebkitLineClamp:2,
          WebkitBoxOrient:'vertical', overflow:'hidden',
        }}>{project.description}</div>
      )}
      {!project.description && <div style={{ height:'1rem' }} />}

      {/* Meta */}
      <div style={{
        display:'flex', alignItems:'center', gap:'1rem',
        fontFamily:"'JetBrains Mono',monospace", fontSize:'0.65rem',
        color:'var(--text-muted)', borderTop:'1px solid var(--border-light)',
        paddingTop:'0.85rem', marginTop:'auto',
      }}>
        <span style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          {project.file_count} file
        </span>
        <span style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
          </svg>
          {project.chat_count} chat
        </span>
        <span style={{ marginLeft:'auto', color:'var(--text-muted)' }}>{formatDate(project.updated_at || project.created_at)}</span>
      </div>
    </motion.div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DashboardPage({ username, onLogout }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects/')
      setProjects(res.data.projects || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchProjects() }, [])

  const handleCreate = (p) => navigate(`/project/${p.project_id}`)

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/projects/${deleteTarget.project_id}`)
      setProjects(prev => prev.filter(p => p.project_id !== deleteTarget.project_id))
      setDeleteTarget(null)
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal menghapus project')
    } finally { setDeleting(false) }
  }

  const handleEdit = async (projectId, newName) => {
    try {
      await api.put(`/projects/${projectId}`, { name: newName })
      setProjects(prev => prev.map(p => p.project_id === projectId ? { ...p, name: newName } : p))
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal rename')
    }
  }

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(search.toLowerCase())
  )

  const totalFiles = projects.reduce((a, p) => a + (p.file_count || 0), 0)
  const totalChats = projects.reduce((a, p) => a + (p.chat_count || 0), 0)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500&display=swap');
        @keyframes fadeDown { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes floatUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .dash-create-btn:hover { transform:translateY(-1px); box-shadow:0 0 32px rgba(56,189,248,0.3),0 6px 20px rgba(0,0,0,0.4) !important; }
        .dash-create-btn:active { transform:translateY(0); }
        .dash-logout:hover { color:#94a3b8 !important; border-color:rgba(255,255,255,0.12) !important; }
        .dash-theme-btn:hover { color:#38bdf8 !important; border-color:rgba(56,189,248,0.3) !important; }
        .empty-create:hover { transform:translateY(-1px); box-shadow:0 0 28px rgba(56,189,248,0.25) !important; }
      `}</style>

      <div style={{
        minHeight:'100vh',
        background:'var(--bg-page)',
        fontFamily:"'Syne',sans-serif",
        color:'var(--text-primary)',
        position:'relative',
      }}>
        {/* Grid bg */}
        <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0 }}>
          <GridCanvas />
          {/* Ambient glow */}
          <div style={{
            position:'absolute', top:'-10%', left:'20%',
            width:'50%', height:'40%', borderRadius:'50%',
            background:'radial-gradient(ellipse, rgba(14,165,233,0.04) 0%, transparent 70%)',
          }} />
        </div>

        {/* ── HEADER ── */}
        <header style={{
          position:'sticky', top:0, zIndex:50,
          background:'var(--bg-header)',
          backdropFilter:'blur(16px)',
          borderBottom:'1px solid var(--border-primary)',
          animation:'fadeDown 0.5s ease both',
        }}>
          <div style={{
            maxWidth:1200, margin:'0 auto',
            padding:'0 1rem',
            height:60, gap: '0.5rem',
            display:'flex', alignItems:'center', justifyContent:'space-between',
          }}>
            {/* Logo */}
            <div style={{ display:'flex', alignItems:'center', gap:'0.6rem' }}>
              <div style={{
                width:28, height:28, borderRadius:7,
                background:'linear-gradient(135deg,#0ea5e9,#6366f1)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:13, fontWeight:800, color:'white',
                boxShadow:'0 0 16px rgba(56,189,248,0.2)',
              }}>A</div>
              <span style={{ fontSize:'1rem', fontWeight:800, color:'#f0f9ff', letterSpacing:'-0.02em' }}>
                Analisai
              </span>
            </div>

            {/* Right */}
            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
              {/* Username chip */}
              <div className="hidden sm:flex" style={{
                alignItems:'center', gap:'0.5rem',
                fontFamily:"'JetBrains Mono',monospace", fontSize:'0.68rem',
                color:'var(--text-muted)', letterSpacing:'0.06em',
                padding:'0.3rem 0.8rem',
                background:'var(--bg-hover)',
                border:'1px solid var(--border-primary)',
                borderRadius:6,
              }}>
                <div style={{
                  width:6, height:6, borderRadius:'50%',
                  background:'#22c55e',
                  boxShadow:'0 0 6px #22c55e',
                }} />
                {username}
              </div>

              {/* Theme toggle */}
              <button
                className="dash-theme-btn"
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                style={{
                  width:32, height:32, borderRadius:7,
                  background:'var(--bg-hover)',
                  border:'1px solid var(--border-primary)',
                  color:'var(--text-muted)', display:'flex', alignItems:'center', justifyContent:'center',
                  cursor:'pointer', transition:'color 0.2s, border-color 0.2s',
                }}
              >
                {theme === 'dark' ? (
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
                  </svg>
                )}
              </button>

              {/* Logout */}
              <button
                className="dash-logout"
                onClick={onLogout}
                style={{
                  fontFamily:"'JetBrains Mono',monospace", fontSize:'0.65rem',
                  letterSpacing:'0.08em', color:'var(--text-muted)',
                  background:'var(--bg-hover)',
                  border:'1px solid var(--border-primary)',
                  borderRadius:6, padding:'0.35rem 0.8rem',
                  cursor:'pointer', transition:'color 0.2s, border-color 0.2s',
                }}
              >
                KELUAR
              </button>
            </div>
          </div>
        </header>

        {/* ── MAIN ── */}
        <main style={{
          maxWidth:1200, margin:'0 auto',
          padding:'2rem 1rem',
          position:'relative', zIndex:1,
        }}>

          {/* Page header */}
          <motion.div
            initial={{ opacity:0, y:16 }}
            animate={{ opacity:1, y:0 }}
            transition={{ duration:0.5, ease:'easeOut' }}
            style={{
              display:'flex', alignItems:'flex-start',
              justifyContent:'space-between',
              marginBottom:'2.5rem', gap:'1rem',
              flexWrap:'wrap',
            }}
          >
            <div>
              <div style={{
                fontFamily:"'JetBrains Mono',monospace",
                fontSize:'0.62rem', letterSpacing:'0.14em',
                color:'#38bdf8', marginBottom:'0.6rem',
                display:'flex', alignItems:'center', gap:'0.4rem',
              }}>
                <span style={{ width:16, height:1, background:'#38bdf8', display:'block' }} />
                WORKSPACE
              </div>
              <h1 style={{
                fontSize:'clamp(1.6rem,3vw,2.2rem)',
                fontWeight:800, letterSpacing:'-0.03em',
                color:'var(--text-heading)', lineHeight:1.1,
                marginBottom:'0.4rem',
              }}>
                Project Saya
              </h1>
              <p style={{
                fontFamily:"'JetBrains Mono',monospace",
                fontSize:'0.68rem', color:'var(--text-muted)',
                letterSpacing:'0.04em',
              }}>
                {projects.length} project · {totalFiles} file · {totalChats} chat
              </p>
            </div>

            <button
              className="dash-create-btn"
              onClick={() => setShowCreate(true)}
              style={{
                display:'flex', alignItems:'center', gap:'0.5rem',
                height:44, padding:'0 1.4rem',
                background:'linear-gradient(135deg,#0ea5e9,#6366f1)',
                border:'none', borderRadius:10,
                fontFamily:"'Syne',sans-serif", fontSize:'0.88rem', fontWeight:700,
                color:'white', cursor:'pointer',
                transition:'transform 0.15s, box-shadow 0.2s',
                boxShadow:'0 0 24px rgba(56,189,248,0.2), 0 4px 16px rgba(0,0,0,0.4)',
              }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/>
              </svg>
              Buat Project
            </button>
          </motion.div>

          {/* Search bar */}
          {projects.length > 0 && (
            <motion.div
              initial={{ opacity:0, y:10 }}
              animate={{ opacity:1, y:0 }}
              transition={{ delay:0.15, duration:0.4 }}
              style={{ marginBottom:'2rem' }}
            >
              <div style={{ position:'relative', maxWidth:380 }}>
                <svg
                  width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  style={{
                    position:'absolute', left:'0.9rem', top:'50%',
                    transform:'translateY(-50%)',
                    color: searchFocused ? 'var(--analisai-cyan)' : 'var(--text-muted)',
                    transition:'color 0.2s',
                  }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input
                  placeholder="Cari project..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  style={{
                    width:'100%',
                    background:'var(--bg-hover)',
                    border:`1px solid ${searchFocused ? 'rgba(56,189,248,0.4)' : 'var(--border-primary)'}`,
                    borderRadius:8, padding:'0.65rem 1rem 0.65rem 2.4rem',
                    color:'var(--text-primary)', fontFamily:"'Syne',sans-serif", fontSize:'0.85rem',
                    outline:'none',
                    transition:'border-color 0.2s, box-shadow 0.2s',
                    boxShadow: searchFocused ? '0 0 0 3px rgba(56,189,248,0.07)' : 'none',
                  }}
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    style={{
                      position:'absolute', right:'0.75rem', top:'50%',
                      transform:'translateY(-50%)', background:'none', border:'none',
                      color:'#334155', cursor:'pointer', padding:0, display:'flex',
                    }}
                  >
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ display:'flex', justifyContent:'center', paddingTop:'6rem' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8"
                style={{ animation:'spin 0.9s linear infinite' }}>
                <circle cx="12" cy="12" r="10" strokeWidth="3" strokeOpacity="0.2"/>
                <path d="M12 2a10 10 0 0110 10" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            </div>
          )}

          {/* Empty state */}
          {!loading && projects.length === 0 && (
            <motion.div
              initial={{ opacity:0, y:24 }}
              animate={{ opacity:1, y:0 }}
              transition={{ duration:0.5 }}
              style={{
                display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center',
                paddingTop:'6rem', textAlign:'center',
              }}
            >
              {/* Animated icon */}
              <div style={{
                width:72, height:72, borderRadius:18,
                background:'rgba(56,189,248,0.07)',
                border:'1px solid rgba(56,189,248,0.15)',
                display:'flex', alignItems:'center', justifyContent:'center',
                color:'#38bdf8', marginBottom:'1.5rem',
                boxShadow:'0 0 30px rgba(56,189,248,0.1)',
              }}>
                <svg width="30" height="30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                </svg>
              </div>

              <h3 style={{
                fontSize:'1.2rem', fontWeight:800,
                color:'var(--text-heading)', letterSpacing:'-0.02em',
                marginBottom:'0.6rem',
              }}>Belum ada project</h3>

              <p style={{
                fontFamily:"'JetBrains Mono',monospace",
                fontSize:'0.72rem', color:'var(--text-muted)',
                letterSpacing:'0.04em', lineHeight:1.8,
                maxWidth:320, marginBottom:'2rem',
              }}>
                Buat project pertama Anda untuk mulai menganalisis data. Setiap project memiliki dataset dan riwayat chat terpisah.
              </p>

              <button
                className="empty-create"
                onClick={() => setShowCreate(true)}
                style={{
                  display:'flex', alignItems:'center', gap:'0.5rem',
                  height:44, padding:'0 1.5rem',
                  background:'linear-gradient(135deg,#0ea5e9,#6366f1)',
                  border:'none', borderRadius:10,
                  fontFamily:"'Syne',sans-serif", fontSize:'0.88rem', fontWeight:700,
                  color:'white', cursor:'pointer',
                  transition:'transform 0.15s, box-shadow 0.2s',
                  boxShadow:'0 0 20px rgba(56,189,248,0.15), 0 4px 14px rgba(0,0,0,0.4)',
                }}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/>
                </svg>
                Buat Project Pertama
              </button>
            </motion.div>
          )}

          {/* Search no results */}
          {!loading && projects.length > 0 && filtered.length === 0 && (
            <motion.div
              initial={{ opacity:0 }} animate={{ opacity:1 }}
              style={{
                textAlign:'center', paddingTop:'4rem',
                fontFamily:"'JetBrains Mono',monospace",
                fontSize:'0.72rem', color:'#334155', letterSpacing:'0.06em',
              }}
            >
              Tidak ada project yang cocok dengan "<span style={{ color:'#475569' }}>{search}</span>"
            </motion.div>
          )}

          {/* Project grid */}
          {!loading && filtered.length > 0 && (
            <div style={{
              display:'grid',
              gridTemplateColumns:'repeat(auto-fill, minmax(clamp(280px, 100%, 300px), 1fr))',
              gap:'1rem',
            }}>
              <AnimatePresence>
                {filtered.map((p, i) => (
                  <ProjectCard
                    key={p.project_id}
                    project={p}
                    index={i}
                    onNavigate={id => navigate(`/project/${id}`)}
                    onEdit={handleEdit}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </AnimatePresence>

              {/* New project card */}
              <motion.div
                initial={{ opacity:0, y:20 }}
                animate={{ opacity:1, y:0 }}
                transition={{ delay: filtered.length * 0.06 + 0.1 }}
                onClick={() => setShowCreate(true)}
                style={{
                  border:'1px dashed var(--border-primary)',
                  borderRadius:14, padding:'1.5rem',
                  display:'flex', flexDirection:'column',
                  alignItems:'center', justifyContent:'center',
                  cursor:'pointer', minHeight:160,
                  transition:'border-color 0.2s, background 0.2s',
                  gap:'0.75rem',
                }}
                whileHover={{
                  borderColor:'rgba(56,189,248,0.3)',
                  background:'rgba(56,189,248,0.03)',
                }}
              >
                <div style={{
                  width:36, height:36, borderRadius:9,
                  background:'rgba(255,255,255,0.02)',
                  border:'1px solid rgba(255,255,255,0.07)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color:'#334155',
                }}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                  </svg>
                </div>
                <span style={{
                  fontFamily:"'JetBrains Mono',monospace",
                  fontSize:'0.65rem', color:'#334155',
                  letterSpacing:'0.1em', textTransform:'uppercase',
                }}>
                  Buat project baru
                </span>
              </motion.div>
            </div>
          )}
        </main>
      </div>

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
    </>
  )
}
