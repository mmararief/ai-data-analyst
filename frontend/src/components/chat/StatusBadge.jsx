// Pulsing status pill shown next to the page title while a job is streaming.

export default function StatusBadge({ text }) {
  if (!text) return null
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
      padding: '0.3rem 0.8rem',
      background: 'var(--bg-hover)',
      border: '1px solid var(--border-primary)',
      borderRadius: 100,
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '0.65rem', letterSpacing: '0.04em',
      color: 'var(--analisai-cyan)',
      maxWidth: 300,
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%',
        background: 'var(--analisai-cyan)',
        animation: 'pulse-status 1.5s ease-in-out infinite',
        flexShrink: 0,
      }} />
      {text}
    </div>
  )
}
