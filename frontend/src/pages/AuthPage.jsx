import { useState } from 'react'
import api from '../api'
import Logo from '../components/Logo'

export default function AuthPage({ onLogin, onBack }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'register') {
        await api.post('/auth/register', { username, password })
        setMode('login')
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
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm msg-appear">
        {/* Logo */}
        <button onClick={onBack} className="absolute -top-16 left-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-2 text-sm transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
          Kembali ke Home
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
        <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl p-7 backdrop-blur-sm shadow-[var(--shadow-md)]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Username</label>
              <input
                className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)] rounded-xl px-4 py-3 outline-none focus:border-indigo-500/50 text-sm placeholder-[var(--text-muted)] transition-all duration-200"
                placeholder="Masukkan username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Password</label>
              <input
                className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)] rounded-xl px-4 py-3 outline-none focus:border-indigo-500/50 text-sm placeholder-[var(--text-muted)] transition-all duration-200"
                type="password"
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

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
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-xl py-3 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 text-sm"
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
            className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors duration-200"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
          >
            {mode === 'login' ? 'Daftar' : 'Masuk'}
          </button>
        </p>
      </div>
    </div>
  )
}
