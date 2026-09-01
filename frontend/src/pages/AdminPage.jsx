import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../api'
import { useTheme } from '../ThemeContext'

export default function AdminPage({ username, role, onLogout }) {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'users' | 'worker' | 'maintenance'
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)

  // Data states
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [workerData, setWorkerData] = useState(null)
  const [sandboxes, setSandboxes] = useState([])
  
  // Search & filter
  const [searchUser, setSearchUser] = useState('')
  
  // Action feedback
  const [actionLoading, setActionLoading] = useState(null)
  const [actionMessage, setActionMessage] = useState(null) // { type: 'success'|'error', text: '' }

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true)
    try {
      const [resStats, resUsers, resWorker, resSandboxes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users'),
        api.get('/admin/workers'),
        api.get('/admin/sandboxes'),
      ])
      setStats(resStats.data)
      setUsers(resUsers.data.users || [])
      setWorkerData(resWorker.data)
      setSandboxes(resSandboxes.data.sandboxes || [])
    } catch (err) {
      if (err.response?.status === 403) {
        alert('Akses Ditolak: Anda bukan Administrator.')
        navigate('/')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [navigate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      fetchData(true)
    }, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchData])

  // Role Toggle
  const handleToggleRole = async (targetUserId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin'
    if (!confirm(`Ubah role pengguna ini menjadi '${newRole}'?`)) return
    setActionLoading(`role_${targetUserId}`)
    try {
      const res = await api.put(`/admin/users/${targetUserId}/role`, { role: newRole })
      setActionMessage({ type: 'success', text: res.data.message })
      fetchData(true)
    } catch (err) {
      setActionMessage({ type: 'error', text: err.response?.data?.detail || 'Gagal mengubah role' })
    } finally {
      setActionLoading(null)
    }
  }

  // Maintenance Actions
  const handleCleanSandboxes = async () => {
    if (!confirm('Bersihkan seluruh kontainer sandbox Docker yatim?')) return
    setActionLoading('clean_sandboxes')
    setActionMessage(null)
    try {
      const res = await api.post('/admin/maintenance/clean-sandboxes')
      setActionMessage({ type: 'success', text: res.data.message })
      fetchData(true)
    } catch (err) {
      setActionMessage({ type: 'error', text: err.response?.data?.detail || 'Gagal membersihkan sandbox' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleCleanTemp = async () => {
    if (!confirm('Hapus folder sementara analisis (>30 menit) untuk membebaskan ruang disk?')) return
    setActionLoading('clean_temp')
    setActionMessage(null)
    try {
      const res = await api.post('/admin/maintenance/clean-temp')
      setActionMessage({ type: 'success', text: res.data.message })
      fetchData(true)
    } catch (err) {
      setActionMessage({ type: 'error', text: err.response?.data?.detail || 'Gagal membersihkan folder sementara' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleCleanRedis = async () => {
    if (!confirm('Reset seluruh marker active job di Redis? (Gunakan jika ada job yang macet)')) return
    setActionLoading('clean_redis')
    setActionMessage(null)
    try {
      const res = await api.post('/admin/maintenance/clean-redis-jobs')
      setActionMessage({ type: 'success', text: res.data.message })
      fetchData(true)
    } catch (err) {
      setActionMessage({ type: 'error', text: err.response?.data?.detail || 'Gagal mereset Redis' })
    } finally {
      setActionLoading(null)
    }
  }

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchUser.toLowerCase()) ||
    u.user_id.toLowerCase().includes(searchUser.toLowerCase())
  )

  const formatNumber = (num) => (num || 0).toLocaleString('id-ID')
  const formatDate = (isoStr) => {
    if (!isoStr) return '—'
    return new Date(isoStr).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* ── HEADER ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-primary)',
        padding: '0.8rem 1.5rem',
      }}>
        <div style={{
          maxWidth: 1280, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '1rem', flexWrap: 'wrap',
        }}>
          {/* Logo & Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => navigate('/')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.4rem 0.8rem', borderRadius: 8,
                background: 'var(--bg-hover)', border: '1px solid var(--border-primary)',
                color: 'var(--text-secondary)', cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem',
                transition: 'all 0.15s',
              }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Workspace
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6,
                background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 800, fontSize: 13,
              }}>
                A
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <h1 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
                    AnalisAI Admin Panel
                  </h1>
                  <span style={{
                    fontSize: '0.6rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                    background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    ADMIN
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  Sistem Monitoring, Manajemen Pengguna & Pemeliharaan
                </p>
              </div>
            </div>
          </div>

          {/* Actions & Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            {/* Auto Refresh Switch */}
            <label style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              fontSize: '0.72rem', color: 'var(--text-muted)', cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={e => setAutoRefresh(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              Auto-sync (5s)
            </label>

            {/* Refresh Button */}
            <button
              onClick={() => fetchData()}
              disabled={refreshing}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.4rem 0.8rem', borderRadius: 8,
                background: 'var(--bg-hover)', border: '1px solid var(--border-primary)',
                color: 'var(--analisai-cyan)', cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem',
              }}
            >
              <svg
                width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshing ? 'Memuat...' : 'Refresh'}
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'var(--bg-hover)', border: '1px solid var(--border-primary)',
                color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {/* User Avatar */}
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--analisai-cyan)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800, color: 'white',
            }}>
              {username ? username.charAt(0).toUpperCase() : 'A'}
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTAINER ── */}
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '1.5rem 1.5rem 4rem' }}>
        {/* Action Alert Banner */}
        <AnimatePresence>
          {actionMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                marginBottom: '1.2rem', padding: '0.75rem 1rem', borderRadius: 8,
                background: actionMessage.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${actionMessage.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                color: actionMessage.type === 'success' ? '#22c55e' : '#ef4444',
                fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <span>{actionMessage.text}</span>
              <button
                onClick={() => setActionMessage(null)}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 700 }}
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── NAVIGATION TABS ── */}
        <div style={{
          display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-primary)',
          marginBottom: '1.5rem', overflowX: 'auto',
        }}>
          {[
            { id: 'overview', label: 'Ringkasan Sistem', icon: '📊' },
            { id: 'users', label: `Pengguna & Token (${users.length})`, icon: '👥' },
            { id: 'worker', label: `Worker & Sandbox (${workerData?.active_jobs_count || 0})`, icon: '⚡' },
            { id: 'maintenance', label: 'Pemeliharaan Sistem', icon: '🛠️' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.65rem 1.1rem', background: 'none', border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--analisai-cyan)' : '2px solid transparent',
                color: activeTab === tab.id ? 'var(--analisai-cyan)' : 'var(--text-muted)',
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── TAB CONTENT ── */}
        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{
              width: 36, height: 36, border: '3px solid var(--border-primary)',
              borderTopColor: 'var(--analisai-cyan)', borderRadius: '50%',
              margin: '0 auto 1rem', animation: 'spin 1s linear infinite'
            }} />
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem' }}>Memuat data analitik sistem...</p>
          </div>
        ) : (
          <>
            {/* ── TAB 1: OVERVIEW ── */}
            {activeTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Metric Cards Grid */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '1rem',
                }}>
                  {/* Card 1: Total Users */}
                  <div style={{
                    padding: '1.2rem', borderRadius: 12,
                    background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                        Total Pengguna
                      </span>
                      <span style={{ fontSize: '1.1rem' }}>👥</span>
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                      {formatNumber(stats?.total_users)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                      Terdaftar pada basis data
                    </div>
                  </div>

                  {/* Card 2: Total Projects */}
                  <div style={{
                    padding: '1.2rem', borderRadius: 12,
                    background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                        Total Proyek Analisis
                      </span>
                      <span style={{ fontSize: '1.1rem' }}>📁</span>
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8' }}>
                      {formatNumber(stats?.total_projects)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                      Ruang kerja aktif
                    </div>
                  </div>

                  {/* Card 3: Total Token Usage */}
                  <div style={{
                    padding: '1.2rem', borderRadius: 12,
                    background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                        Total Token Terpakai
                      </span>
                      <span style={{ fontSize: '1.1rem' }}>🪙</span>
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#a855f7' }}>
                      {formatNumber(stats?.token_usage?.total_tokens)}
                    </div>
                    <div style={{
                      fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.3rem',
                      display: 'flex', gap: '0.6rem', fontFamily: "'JetBrains Mono', monospace"
                    }}>
                      <span>In: {formatNumber(stats?.token_usage?.prompt_tokens)}</span>
                      <span>•</span>
                      <span>Out: {formatNumber(stats?.token_usage?.completion_tokens)}</span>
                    </div>
                  </div>

                  {/* Card 4: Worker Queue & Sandbox */}
                  <div style={{
                    padding: '1.2rem', borderRadius: 12,
                    background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                        Status Worker & Sandbox
                      </span>
                      <span style={{ fontSize: '1.1rem' }}>⚡</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.8rem', fontWeight: 800, color: stats?.worker?.active_jobs > 0 ? '#eab308' : '#22c55e' }}>
                        {stats?.worker?.active_jobs || 0}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>job aktif</span>
                    </div>
                    <div style={{
                      fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.3rem',
                      display: 'flex', gap: '0.6rem', fontFamily: "'JetBrains Mono', monospace"
                    }}>
                      <span>Queue: {stats?.worker?.queue_len || 0}</span>
                      <span>•</span>
                      <span>Containers: {stats?.worker?.sandbox_containers || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Storage & Hardware Overview */}
                <div style={{
                  padding: '1.5rem', borderRadius: 12,
                  background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
                }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>💾</span> Penggunaan Penyimpanan Disk Host VPS
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span>Terpakai: <b>{stats?.system?.disk_used_gb} GB</b> / {stats?.system?.disk_total_gb} GB</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--analisai-cyan)' }}>
                        {stats?.system?.disk_percent}%
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div style={{
                      height: 8, borderRadius: 4, background: 'var(--bg-hover)',
                      overflow: 'hidden', border: '1px solid var(--border-primary)',
                    }}>
                      <div style={{
                        height: '100%', borderRadius: 4,
                        background: (stats?.system?.disk_percent > 85) ? '#ef4444' : 'var(--analisai-cyan)',
                        width: `${stats?.system?.disk_percent || 0}%`,
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Tersedia: {stats?.system?.disk_free_gb} GB untuk dataset, file output analisis, dan kontainer Docker.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 2: USERS & TOKEN TRACKING ── */}
            {activeTab === 'users' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Search Toolbar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="Cari berdasarkan username atau ID pengguna..."
                    value={searchUser}
                    onChange={e => setSearchUser(e.target.value)}
                    style={{
                      padding: '0.55rem 1rem', borderRadius: 8,
                      background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
                      color: 'var(--text-primary)', fontSize: '0.82rem', width: '100%', maxWidth: 360,
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                    Menampilkan {filteredUsers.length} dari {users.length} pengguna
                  </span>
                </div>

                {/* Users Table */}
                <div style={{
                  overflowX: 'auto', borderRadius: 12,
                  border: '1px solid var(--border-primary)', background: 'var(--bg-card)',
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{
                        background: 'var(--bg-hover)', borderBottom: '1px solid var(--border-primary)',
                        fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', color: 'var(--text-muted)',
                      }}>
                        <th style={{ padding: '0.8rem 1rem' }}>PENGGUNA</th>
                        <th style={{ padding: '0.8rem 1rem' }}>ROLE</th>
                        <th style={{ padding: '0.8rem 1rem' }}>TGL REGISTRASI</th>
                        <th style={{ padding: '0.8rem 1rem', textAlign: 'center' }}>PROYEK</th>
                        <th style={{ padding: '0.8rem 1rem', textAlign: 'center' }}>PERMINTAAN</th>
                        <th style={{ padding: '0.8rem 1rem', textAlign: 'right' }}>PROMPT TOKENS</th>
                        <th style={{ padding: '0.8rem 1rem', textAlign: 'right' }}>OUTPUT TOKENS</th>
                        <th style={{ padding: '0.8rem 1rem', textAlign: 'right' }}>TOTAL TOKEN</th>
                        <th style={{ padding: '0.8rem 1rem', textAlign: 'center' }}>AKSI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            Tidak ada pengguna yang cocok.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map(u => (
                          <tr
                            key={u.user_id}
                            style={{
                              borderBottom: '1px solid var(--border-primary)',
                              transition: 'background 0.15s',
                            }}
                          >
                            {/* User Info */}
                            <td style={{ padding: '0.8rem 1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <div style={{
                                  width: 28, height: 28, borderRadius: '50%',
                                  background: u.role === 'admin' ? '#ef4444' : 'var(--analisai-cyan)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: 'white', fontWeight: 700, fontSize: '0.72rem',
                                }}>
                                  {u.username.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{u.username}</div>
                                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                                    {u.user_id.slice(0, 13)}...
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Role Badge */}
                            <td style={{ padding: '0.8rem 1rem' }}>
                              <span style={{
                                padding: '2px 7px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 700,
                                fontFamily: "'JetBrains Mono', monospace",
                                background: u.role === 'admin' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(56, 189, 248, 0.12)',
                                color: u.role === 'admin' ? '#ef4444' : 'var(--analisai-cyan)',
                                border: `1px solid ${u.role === 'admin' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(56, 189, 248, 0.25)'}`,
                              }}>
                                {u.role.toUpperCase()}
                              </span>
                            </td>

                            {/* Created At */}
                            <td style={{ padding: '0.8rem 1rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                              {formatDate(u.created_at)}
                            </td>

                            {/* Projects */}
                            <td style={{ padding: '0.8rem 1rem', textAlign: 'center', fontWeight: 600 }}>
                              {u.project_count}
                            </td>

                            {/* Requests */}
                            <td style={{ padding: '0.8rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                              {u.requests_count}
                            </td>

                            {/* Prompt Tokens */}
                            <td style={{ padding: '0.8rem 1rem', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
                              {formatNumber(u.tokens?.prompt)}
                            </td>

                            {/* Completion Tokens */}
                            <td style={{ padding: '0.8rem 1rem', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
                              {formatNumber(u.tokens?.completion)}
                            </td>

                            {/* Total Tokens */}
                            <td style={{ padding: '0.8rem 1rem', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#a855f7' }}>
                              {formatNumber(u.tokens?.total)}
                            </td>

                            {/* Action Button */}
                            <td style={{ padding: '0.8rem 1rem', textAlign: 'center' }}>
                              <button
                                onClick={() => handleToggleRole(u.user_id, u.role)}
                                disabled={actionLoading === `role_${u.user_id}`}
                                style={{
                                  padding: '0.3rem 0.6rem', borderRadius: 6,
                                  background: 'var(--bg-hover)', border: '1px solid var(--border-primary)',
                                  color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.68rem',
                                  fontFamily: "'JetBrains Mono', monospace",
                                }}
                              >
                                {u.role === 'admin' ? 'Jadikan User' : 'Jadikan Admin'}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── TAB 3: WORKER & SANDBOX MONITOR ── */}
            {activeTab === 'worker' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Active Jobs Section */}
                <div style={{
                  padding: '1.2rem', borderRadius: 12,
                  background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
                }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>🔄</span> Pekerjaan yang Sedang Berjalan Aktif ({workerData?.active_jobs_count || 0})
                  </h3>
                  {workerData?.active_jobs?.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      Tidak ada pekerjaan analisis yang sedang aktif saat ini.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {workerData?.active_jobs?.map((job, i) => (
                        <div
                          key={i}
                          style={{
                            padding: '0.75rem 1rem', borderRadius: 8,
                            background: 'var(--bg-hover)', border: '1px solid var(--border-primary)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-heading)' }}>
                              {job.question || 'Sedang memproses...'}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                              Job ID: {job.job_id || job.key}
                            </div>
                          </div>
                          <span style={{
                            fontSize: '0.65rem', padding: '2px 8px', borderRadius: 4,
                            background: 'rgba(234,179,8,0.15)', color: '#eab308',
                            fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                          }}>
                            RUNNING
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Docker Sandboxes Section */}
                <div style={{
                  padding: '1.2rem', borderRadius: 12,
                  background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>📦</span> Kontainer Docker Sandbox ({sandboxes.length})
                    </h3>
                    {sandboxes.length > 0 && (
                      <button
                        onClick={handleCleanSandboxes}
                        disabled={actionLoading === 'clean_sandboxes'}
                        style={{
                          padding: '0.35rem 0.75rem', borderRadius: 6,
                          background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600,
                        }}
                      >
                        Bersihkan Semua
                      </button>
                    )}
                  </div>

                  {sandboxes.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      Tidak ada kontainer sandbox yang sedang aktif.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {sandboxes.map((sb, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '0.75rem 1rem', borderRadius: 8,
                            background: 'var(--bg-hover)', border: '1px solid var(--border-primary)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.8rem', fontFamily: "'JetBrains Mono', monospace" }}>
                              {sb.name}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                              ID: {sb.id} · Image: {sb.image}
                            </div>
                          </div>
                          <span style={{
                            fontSize: '0.65rem', padding: '2px 8px', borderRadius: 4,
                            background: sb.status === 'running' ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.15)',
                            color: sb.status === 'running' ? '#22c55e' : '#64748b',
                            fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                          }}>
                            {sb.status.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── TAB 4: MAINTENANCE ACTIONS ── */}
            {activeTab === 'maintenance' && (
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '1.2rem',
              }}>
                {/* Action Card 1: Clean Sandboxes */}
                <div style={{
                  padding: '1.5rem', borderRadius: 12,
                  background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem',
                }}>
                  <div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.4rem', color: 'var(--text-heading)' }}>
                      🧹 Bersihkan Kontainer Docker Sandbox
                    </h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                      Menghentikan dan menghapus seluruh kontainer Docker sandbox yatim (*orphan containers*) yang tertinggal untuk membebaskan RAM dan CPU server.
                    </p>
                  </div>
                  <button
                    onClick={handleCleanSandboxes}
                    disabled={actionLoading === 'clean_sandboxes'}
                    style={{
                      padding: '0.6rem 1rem', borderRadius: 8,
                      background: 'var(--bg-hover)', border: '1px solid var(--border-primary)',
                      color: 'var(--analisai-cyan)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem',
                    }}
                  >
                    {actionLoading === 'clean_sandboxes' ? 'Sedang Membersihkan...' : 'Jalankan Pembersihan Sandbox'}
                  </button>
                </div>

                {/* Action Card 2: Clean Temp Files */}
                <div style={{
                  padding: '1.5rem', borderRadius: 12,
                  background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem',
                }}>
                  <div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.4rem', color: 'var(--text-heading)' }}>
                      🗑️ Bersihkan Folder Sementara (Temp)
                    </h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                      Menghapus folder kerja analisis sementara (`temp/sbx_*`) yang berusia lebih dari 30 menit untuk membebaskan ruang disk server.
                    </p>
                  </div>
                  <button
                    onClick={handleCleanTemp}
                    disabled={actionLoading === 'clean_temp'}
                    style={{
                      padding: '0.6rem 1rem', borderRadius: 8,
                      background: 'var(--bg-hover)', border: '1px solid var(--border-primary)',
                      color: '#38bdf8', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem',
                    }}
                  >
                    {actionLoading === 'clean_temp' ? 'Sedang Membersihkan...' : 'Jalankan Pembersihan Temp'}
                  </button>
                </div>

                {/* Action Card 3: Clean Redis Jobs */}
                <div style={{
                  padding: '1.5rem', borderRadius: 12,
                  background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem',
                }}>
                  <div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.4rem', color: 'var(--text-heading)' }}>
                      ⚡ Reset Kunci Active Job Redis
                    </h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                      Mereset marker `active:user_id:session_id` di Redis jika terdapat proses analisis yang macet atau tidak dapat merespon kembali.
                    </p>
                  </div>
                  <button
                    onClick={handleCleanRedis}
                    disabled={actionLoading === 'clean_redis'}
                    style={{
                      padding: '0.6rem 1rem', borderRadius: 8,
                      background: 'var(--bg-hover)', border: '1px solid var(--border-primary)',
                      color: '#eab308', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem',
                    }}
                  >
                    {actionLoading === 'clean_redis' ? 'Sedang Mereset...' : 'Reset Active Jobs'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
