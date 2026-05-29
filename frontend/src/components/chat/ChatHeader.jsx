// Top header for the chat page: collapse-burger when sidebar is hidden,
// title, status pill, theme toggle, and user avatar.

import StatusBadge from './StatusBadge'

export default function ChatHeader({
  username,
  loading,
  statusText,
  sidebarCollapsed,
  onExpandSidebar,
  theme,
  onToggleTheme,
  onLogout,
}) {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '1.25rem 1.5rem',
      background: 'transparent',
      flexShrink: 0,
      position: 'relative', zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {sidebarCollapsed && (
          <button
            onClick={onExpandSidebar}
            style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'transparent', border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer', transition: 'color 0.2s, background 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
            title="Buka Menu"
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
        )}

        <span style={{
          fontSize: '1.25rem', fontWeight: 500, letterSpacing: '-0.02em',
          color: 'var(--text-secondary)',
          fontFamily: "'Syne', sans-serif",
        }}>
          Analisai
        </span>

        {loading && (
          <div style={{ marginLeft: '1rem' }}>
            <StatusBadge text={statusText} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={onToggleTheme}
          style={{
            width: 32, height: 32, borderRadius: 7,
            background: 'transparent', border: 'none',
            color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'color 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          title={theme === 'dark' ? 'Ganti ke Terang' : 'Ganti ke Gelap'}
        >
          {theme === 'dark' ? (
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
          ) : (
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
          )}
        </button>

        <div
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: 'white',
            cursor: 'pointer',
          }}
          title="Keluar"
          onClick={onLogout}
        >
          {username ? username.charAt(0).toUpperCase() : 'A'}
        </div>
      </div>
    </header>
  )
}
