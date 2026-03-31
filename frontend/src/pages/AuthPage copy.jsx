import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import Logo from '../components/Logo'

function EyeIcon({ open }) {
  if (open) {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    )
  }
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18" />
    </svg>
  )
}

export default function AuthPage({ onLogin }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [transitioning, setTransitioning] = useState(false)

  const switchMode = (newMode) => {
    setTransitioning(true)
    setTimeout(() => {
      setMode(newMode)
      setError('')
      setPassword('')
      setConfirmPassword('')
      setShowPassword(false)
      setShowConfirm(false)
      setTransitioning(false)
    }, 150)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (mode === 'register' && password !== confirmPassword) {
      setError('Password dan konfirmasi password tidak cocok')
      return
    }

    setLoading(true)
    try {
      if (mode === 'register') {
        await api.post('/auth/register', { username, password })
        switchMode('login')
        setError('Registrasi berhasil! Silakan login.')
      } else {
        const form = new URLSearchParams()
        form.append('username', username)
        form.append('password', password)
        const res = await api.post('/auth/login', form, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
        localStorage.setItem('token', res.data.access_token)
        onLogin(username)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-200">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-sky-400/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm msg-appear">
        {/* Back button */}
        <button
          onClick={() => navigate('/')}
          className="absolute -top-16 left-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-2 text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
          Kembali ke Beranda
        </button>

        <div className="flex flex-col items-center mb-8">
          <div className="mb-4">
            <Logo className="w-14 h-14 rounded-2xl" iconSize="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-[var(--text-heading)] tracking-tight">Analisai</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            {mode === 'login' ? 'Masuk ke akun Anda' : 'Buat akun baru'}
          </p>
        </div>

        {/* Card */}
        <div className={`bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl p-7 backdrop-blur-sm shadow-[var(--shadow-md)] transition-all duration-150 ${transitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Username</label>
              <input
                className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)] rounded-xl px-4 py-3 outline-none focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20 text-sm placeholder-[var(--text-muted)] transition-all duration-200"
                placeholder="Masukkan username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <input
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)] rounded-xl px-4 py-3 pr-11 outline-none focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20 text-sm placeholder-[var(--text-muted)] transition-all duration-200"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  tabIndex={-1}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Konfirmasi Password</label>
                <div className="relative">
                  <input
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)] rounded-xl px-4 py-3 pr-11 outline-none focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20 text-sm placeholder-[var(--text-muted)] transition-all duration-200"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Ulangi password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    tabIndex={-1}
                  >
                    <EyeIcon open={showConfirm} />
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p className={`text-sm rounded-lg px-3 py-2 ${
                error.includes('berhasil')
                  ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                  : 'text-red-400 bg-red-500/10 border border-red-500/20'
              }`}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium rounded-xl py-3 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 text-sm"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  Memproses...
                </>
              ) : mode === 'login' ? 'Masuk' : 'Daftar'}
            </button>
          </form>
        </div>

        {/* Toggle */}
        <p className="text-[var(--text-muted)] text-sm text-center mt-5">
          {mode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}{' '}
          <button
            className="text-sky-400 hover:text-sky-300 font-medium transition-colors duration-200"
            onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? 'Daftar' : 'Masuk'}
          </button>
        </p>
      </div>
    </div>
  )
}
