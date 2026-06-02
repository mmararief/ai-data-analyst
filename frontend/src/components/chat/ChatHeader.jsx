// Top header for the chat page: collapse-burger when sidebar is hidden,
// title, status pill, theme toggle, and user avatar.

import { useNavigate } from 'react-router-dom'
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
  panelVisible,
  hasPanelContent,
  onTogglePanel,
  hasTodoWidget,
  todoVisible,
  onToggleTodo,
  todoProgress,
}) {
  const navigate = useNavigate()

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

        <button
          onClick={() => navigate('/')}
          style={{
            height: 30, borderRadius: 7,
            background: 'transparent', border: '1px solid var(--border-primary)',
            color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            cursor: 'pointer', transition: 'all 0.2s',
            padding: '0 10px',
            fontSize: '11px',
            fontFamily: "'JetBrains Mono', monospace",
            marginLeft: '0.5rem',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
          title="Kembali ke Dashboard"
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
          </svg>
          Dashboard
        </button>

        {loading && (
          <div style={{ marginLeft: '1rem' }}>
            <StatusBadge text={statusText} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        {/* To-Do List toggle */}
        {hasTodoWidget && (
          <button
            onClick={onToggleTodo}
            style={{
              height: 30, borderRadius: 7,
              background: todoVisible ? 'rgba(16,185,129,0.1)' : 'transparent',
              border: todoVisible ? '1px solid rgba(16,185,129,0.25)' : '1px solid transparent',
              color: todoVisible ? '#10b981' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              cursor: 'pointer', transition: 'all 0.2s',
              padding: '0 10px',
              fontSize: '11px',
              fontFamily: "'JetBrains Mono', monospace",
            }}
            onMouseEnter={e => { if (!todoVisible) { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-hover)' } }}
            onMouseLeave={e => { if (!todoVisible) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' } }}
            title={todoVisible ? 'Sembunyikan To-Do List' : 'Tampilkan To-Do List'}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            To-Do List ({todoProgress}%)
          </button>
        )}

        {/* Computer Panel toggle */}
        {hasPanelContent && (
          <button
            onClick={onTogglePanel}
            style={{
              height: 30, borderRadius: 7,
              background: panelVisible ? 'rgba(56,189,248,0.1)' : 'transparent',
              border: panelVisible ? '1px solid rgba(56,189,248,0.25)' : '1px solid transparent',
              color: panelVisible ? '#38bdf8' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              cursor: 'pointer', transition: 'all 0.2s',
              padding: '0 10px',
              fontSize: '11px',
              fontFamily: "'JetBrains Mono', monospace",
            }}
            onMouseEnter={e => { if (!panelVisible) { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-hover)' } }}
            onMouseLeave={e => { if (!panelVisible) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' } }}
            title={panelVisible ? 'Sembunyikan Panel Komputer' : 'Tampilkan Panel Komputer'}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
            Computer
          </button>
        )}
      </div>
    </header>
  )
}
