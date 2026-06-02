import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

// ── Eye icon ──────────────────────────────────────────────────────────────────
function EyeIcon({ open }) {
  return open ? (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18" />
    </svg>
  )
}

const DEMO_LINES = [
  { prefix: '> ', text: 'prediksi churn customers.csv', color: 'var(--text-primary)' },
  { prefix: '  ✓ ', text: 'Planner: 3 tasks, 2 phases', color: 'var(--analisai-cyan)' },
  { prefix: '  ✓ ', text: 'EDA: distribusi & korelasi', color: '#10b981' },
  { prefix: '  ✓ ', text: 'Critic: judgment = ok', color: '#10b981' },
  { prefix: '> ', text: 'visualisasi korelasi features', color: 'var(--text-primary)' },
  { prefix: '  ✓ ', text: 'Chart saved: _chart_ab3f.png', color: 'var(--analisai-cyan)' },
  { prefix: '> ', text: '_', color: 'var(--analisai-cyan)' },
]

function TerminalLines() {
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (shown >= DEMO_LINES.length) return
    const t = setTimeout(() => setShown(s => s + 1), shown === 0 ? 600 : 900)
    return () => clearTimeout(t)
  }, [shown])

  useEffect(() => {
    const loop = setInterval(() => setShown(0), 10000)
    return () => clearInterval(loop)
  }, [])

  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.72rem',
        lineHeight: 2,
        color: 'var(--text-secondary)',
      }}
    >
      {DEMO_LINES.slice(0, shown).map((line, i) => (
        <div
          key={i}
          style={{
            opacity: 0,
            animation: 'termLine 0.3s ease forwards',
            color: line.color,
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>{line.prefix}</span>
          {line.text}
          {i === shown - 1 && line.text === '_' && (
            <span style={{
              display: 'inline-block',
              width: 7, height: 13,
              background: 'var(--analisai-cyan)',
              verticalAlign: 'text-bottom',
              animation: 'blink 1s step-end infinite',
            }} />
          )}
        </div>
      ))}
    </div>
  )
}

function AuthInput({ label, type, placeholder, value, onChange, required, rightEl, autoFocus }) {
  const [focused, setFocused] = useState(false)

  return (
    <div>
      <label style={{
        display: 'block',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.62rem',
        letterSpacing: '0.12em',
        color: focused ? 'var(--analisai-cyan)' : 'var(--text-secondary)',
        marginBottom: '0.5rem',
        textTransform: 'uppercase',
        transition: 'color 0.2s',
      }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="auth-input-placeholder"
          style={{
            width: '100%',
            background: 'var(--bg-input)',
            border: `1px solid ${focused ? 'var(--analisai-cyan)' : 'var(--border-primary)'}`,
            borderRadius: 10,
            padding: rightEl ? '0.8rem 2.8rem 0.8rem 1rem' : '0.8rem 1rem',
            fontFamily: "sans-serif",
            fontSize: '0.9rem',
            color: 'var(--text-primary)',
            outline: 'none',
            transition: 'border-color 0.2s, box-shadow 0.2s',
            boxShadow: focused ? '0 0 0 3px rgba(56,189,248,0.1)' : 'none',
          }}
        />
        {rightEl && (
          <div style={{
            position: 'absolute', right: '0.75rem', top: '50%',
            transform: 'translateY(-50%)',
          }}>
            {rightEl}
          </div>
        )}
      </div>
    </div>
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
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [])

  const switchMode = (newMode) => {
    setSwitching(true)
    setTimeout(() => {
      setMode(newMode)
      setError(''); setSuccess('')
      setPassword(''); setConfirmPassword('')
      setShowPassword(false); setShowConfirm(false)
      setSwitching(false)
    }, 200)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setSuccess('')

    if (mode === 'register' && password !== confirmPassword) {
      setError('Password tidak cocok')
      return
    }
    setLoading(true)
    try {
      if (mode === 'register') {
        await api.post('/auth/register', { username, password })
        setSuccess('Akun berhasil dibuat!')
        setTimeout(() => switchMode('login'), 1200)
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
    <>
      <style>{`
        @keyframes fadeInUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes termLine { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes blink { 0%, 100% {opacity:1} 50% {opacity:0} }

        .auth-input-placeholder::placeholder { color: var(--text-muted); opacity: 0.6; }

        .auth-submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(11,87,208,0.2);
        }
        .auth-submit-btn:active:not(:disabled) { transform: translateY(0); }

        .mode-toggle-btn:hover { color: var(--analisai-cyan2) !important; }

        .back-btn:hover { color: var(--text-primary) !important; }
        .back-btn:hover svg { transform: translateX(-3px); }
        .back-btn svg { transition: transform 0.2s; }

        .feature-tag { transition: border-color 0.2s, background 0.2s; }
        .feature-tag:hover {
          border-color: rgba(11,87,208,0.3) !important;
          background: rgba(11,87,208,0.06) !important;
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: 'var(--bg-page)',
        display: 'flex',
        justifyContent: 'center',
        fontFamily: "sans-serif",
      }}>

        {/* ── Left panel — decorative ── */}
        <div style={{
          flex: 1,
          display: 'none',
          position: 'relative',
          borderRight: '1px solid var(--border-primary)',
          background: 'var(--bg-secondary)',
          overflow: 'hidden',
        }} className="lg:block" >

          {/* Subtle grid background */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: `
              linear-gradient(rgba(11,87,208,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(11,87,208,0.03) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black 20%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black 20%, transparent 100%)'
          }} />

          {/* Content */}
          <div style={{
            position: 'relative', zIndex: 10,
            height: '100%',
            display: 'flex', flexDirection: 'column',
            padding: '3rem',
            justifyContent: 'space-between',
          }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'var(--analisai-cyan)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 800, color: '#fff'
              }}>A</div>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-heading)', letterSpacing: '-0.02em' }}>
                Analisai
              </span>
            </div>

            {/* Center content */}
            <div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.65rem', letterSpacing: '0.12em',
                color: 'var(--analisai-cyan)',
                background: 'rgba(11,87,208,0.08)',
                border: '1px solid rgba(11,87,208,0.2)',
                padding: '0.35rem 0.8rem', borderRadius: 100,
                marginBottom: '1.5rem',
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--analisai-cyan)',
                  boxShadow: '0 0 8px var(--analisai-cyan)',
                  animation: 'blink 2s ease-in-out infinite',
                }} />
                LIVE · 3-AGENT PIPELINE
              </div>

              <h2 style={{
                fontSize: 'clamp(1.8rem, 3vw, 2.6rem)',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: 'var(--text-heading)',
                lineHeight: 1.1,
                marginBottom: '1rem',
              }}>
                Analisis data<br />
                <span style={{
                  background: 'linear-gradient(135deg, var(--analisai-cyan), #818cf8)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>lebih cepat</span>
              </h2>

              <p style={{
                color: 'var(--text-secondary)', fontSize: '0.88rem',
                lineHeight: 1.7, marginBottom: '2rem',
                maxWidth: 340,
              }}>
                Dari eksplorasi data hingga pelaporan mendalam — berinteraksi dengan dataset menggunakan bahasa natural.
              </p>

              {/* Terminal */}
              <div style={{
                background: 'var(--bg-code)',
                border: '1px solid var(--border-primary)',
                borderRadius: 12, overflow: 'hidden',
                marginBottom: '2rem',
                boxShadow: 'var(--shadow-md)',
              }}>
                <div style={{
                  background: 'var(--bg-tertiary)',
                  padding: '0.65rem 1rem',
                  borderBottom: '1px solid var(--border-primary)',
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                }}>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#ff5f57' }} />
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#febc2e' }} />
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#28c840' }} />
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.62rem', color: 'var(--text-muted)',
                    marginLeft: '0.5rem', letterSpacing: '0.06em',
                  }}>analisai · terminal</span>
                </div>
                <div style={{ padding: '1.25rem 1rem', minHeight: 130 }}>
                  <TerminalLines />
                </div>
              </div>

              {/* Feature tags */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {['EDA', 'Agentic Workflow', 'Python Sandbox', 'Streaming'].map(tag => (
                  <div key={tag} className="feature-tag" style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.62rem', letterSpacing: '0.08em',
                    color: 'var(--text-secondary)',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-primary)',
                    padding: '0.3rem 0.7rem', borderRadius: 6,
                    cursor: 'default',
                  }}>
                    {tag}
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom */}
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.62rem', color: 'var(--text-muted)',
              letterSpacing: '0.08em',
            }}>
              © 2026 ANALISAI
            </div>
          </div>
        </div>

        {/* ── Right panel — form ── */}
        <div style={{
          width: '100%',
          maxWidth: 480,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '2rem',
          position: 'relative',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(16px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}>

          {/* Back button */}
          <button
            className="back-btn"
            onClick={() => navigate('/')}
            style={{
              position: 'absolute', top: '1.5rem', left: '1.5rem',
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              color: 'var(--text-muted)', background: 'none', border: 'none',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.65rem', letterSpacing: '0.08em',
              cursor: 'pointer', transition: 'color 0.2s',
            }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
            </svg>
            KEMBALI
          </button>

          {/* Form container */}
          <div style={{
            width: '100%', maxWidth: 380,
            opacity: switching ? 0 : 1,
            transform: switching ? 'translateY(8px) scale(0.98)' : 'translateY(0) scale(1)',
            transition: 'opacity 0.2s, transform 0.2s',
          }}>
            {/* Header */}
            <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
              {/* Logo mark */}
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: 'var(--analisai-cyan)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 800, color: '#fff',
                margin: '0 auto 1.25rem',
                boxShadow: '0 4px 14px rgba(11,87,208,0.15)'
              }}>A</div>

              <h1 style={{
                fontSize: '1.6rem', fontWeight: 800,
                color: 'var(--text-heading)', letterSpacing: '-0.03em',
                marginBottom: '0.35rem',
              }}>
                {mode === 'login' ? 'Selamat datang' : 'Buat akun baru'}
              </h1>
              <p style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.68rem', color: 'var(--text-muted)',
                letterSpacing: '0.08em',
              }}>
                {mode === 'login' ? '— MASUK KE ANALISAI —' : '— DAFTAR GRATIS —'}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <AuthInput
                label="Username"
                type="text"
                placeholder="masukkan username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
              />

              <AuthInput
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="masukkan password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                rightEl={
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', padding: 0, display: 'flex',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--analisai-cyan)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                }
              />

              {mode === 'register' && (
                <div style={{
                  animation: 'fadeInUp 0.3s ease both',
                }}>
                  <AuthInput
                    label="Konfirmasi Password"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="ulangi password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    rightEl={
                      <button
                        type="button"
                        onClick={() => setShowConfirm(v => !v)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--text-muted)', padding: 0, display: 'flex',
                          transition: 'color 0.2s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--analisai-cyan)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                      >
                        <EyeIcon open={showConfirm} />
                      </button>
                    }
                  />
                </div>
              )}

              {/* Error / success */}
              {(error || success) && (
                <div style={{
                  padding: '0.65rem 0.9rem',
                  borderRadius: 8,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.7rem', letterSpacing: '0.04em',
                  ...(success ? {
                    background: 'rgba(16,185,129,0.1)',
                    border: '1px solid rgba(16,185,129,0.2)',
                    color: '#10b981',
                  } : {
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    color: '#ef4444',
                  }),
                  animation: 'fadeInUp 0.2s ease both',
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                }}>
                  <span>{success ? '✓' : '!'}</span>
                  {success || error}
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="auth-submit-btn"
                style={{
                  width: '100%', height: 48, marginTop: '0.5rem',
                  background: loading ? 'var(--analisai-cyan2)' : 'var(--analisai-cyan)',
                  border: 'none', borderRadius: 10,
                  color: '#fff', fontFamily: "sans-serif",
                  fontSize: '0.9rem', fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  transition: 'transform 0.15s, background 0.2s, box-shadow 0.2s',
                  position: 'relative', overflow: 'hidden',
                  opacity: loading ? 0.7 : 1,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
              >
                <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {loading ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        style={{ animation: 'spin 0.8s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" strokeWidth="3" strokeOpacity="0.25"/>
                        <path d="M12 2a10 10 0 0110 10" strokeWidth="3" strokeLinecap="round"/>
                      </svg>
                      Memproses...
                    </>
                  ) : (
                    <>
                      {mode === 'login' ? 'Masuk ke Analisai' : 'Buat Akun'}
                      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                      </svg>
                    </>
                  )}
                </span>
              </button>
            </form>

            {/* Divider */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '1rem',
              margin: '1.5rem 0',
            }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border-primary)' }} />
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.6rem', color: 'var(--text-muted)',
                letterSpacing: '0.1em',
              }}>ATAU</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border-primary)' }} />
            </div>

            {/* Toggle mode */}
            <p style={{
              textAlign: 'center',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.7rem', color: 'var(--text-secondary)',
              letterSpacing: '0.04em',
            }}>
              {mode === 'login' ? 'BELUM PUNYA AKUN?' : 'SUDAH PUNYA AKUN?'}{' '}
              <button
                className="mode-toggle-btn"
                onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--analisai-cyan)', fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.7rem', fontWeight: 600,
                  letterSpacing: '0.04em', textDecoration: 'underline',
                  textUnderlineOffset: 3,
                  transition: 'color 0.2s',
                }}
              >
                {mode === 'login' ? 'DAFTAR' : 'MASUK'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
