// Print-to-PDF helper extracted from ChatPage.
// Opens a new window with a self-contained styled HTML document and triggers
// `window.print()` so the user can save it as PDF via the browser dialog.

const REPORT_STYLES = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;font-size:13px;line-height:1.7;color:#1a1a1a;background:#fff;max-width:820px;margin:0 auto;padding:32px 24px}
h1.report-title{font-size:20px;font-weight:700;color:#1e1e2e;border-bottom:2px solid #6366f1;padding-bottom:8px;margin-bottom:4px}
p.meta{color:#888;font-size:11px;margin-bottom:28px}
.msg{margin-bottom:20px;padding:14px 16px;border-radius:8px;page-break-inside:avoid}
.user-msg{background:#f5f5ff;border-left:3px solid #6366f1}
.ai-msg{background:#f4faf7;border-left:3px solid #10b981}
.role-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
.user-label{color:#6366f1}
.ai-label{color:#10b981}
.body h1,.body h2,.body h3{margin:12px 0 6px;font-weight:600}
.body h1{font-size:16px}.body h2{font-size:14px}.body h3{font-size:13px}
.body p{margin-bottom:8px}
.body ul,.body ol{padding-left:20px;margin-bottom:8px}
.body li{margin-bottom:3px}
.body strong{font-weight:600}.body em{font-style:italic}
.body code{background:#eef;color:#5046e5;padding:1px 5px;border-radius:3px;font-family:monospace;font-size:12px}
.code-block{background:#1e1e2e;color:#a6e3a1;border-radius:6px;margin:10px 0;padding:12px 14px;font-family:'Cascadia Code','Consolas',monospace;font-size:11.5px;overflow:hidden;page-break-inside:avoid}
.code-block pre{white-space:pre-wrap;word-break:break-all}
.output-block{background:#fafafa;border:1px solid #e0e0e0;border-radius:6px;margin:4px 0 10px;padding:10px 14px;font-family:monospace;font-size:11px;color:#444;overflow:hidden}
.output-block pre{white-space:pre-wrap;word-break:break-all}
.chart-wrap{margin:12px 0;text-align:center}
.chart-wrap img{max-width:100%;border-radius:6px;border:1px solid #e0e0e0}
.plan-box{background:#f5f0ff;border-left:3px solid #8b5cf6;border-radius:6px;padding:10px 14px;margin:8px 0}
.plan-box strong{color:#6d28d9;font-size:12px;display:block;margin-bottom:6px}
.plan-box ol{padding-left:18px}
.plan-box li{font-size:12px;color:#4c1d95;margin-bottom:3px}
h4.task-header{font-size:12px;color:#7c3aed;margin:10px 0 4px}
.agent-label-badge{font-size:10px;font-weight:600;color:#6d28d9;background:#f5f0ff;border-radius:99px;padding:2px 8px;display:inline-block;margin:8px 0 4px;text-transform:uppercase;letter-spacing:.05em}
.insight-box{background:#f0fdf4;border-left:3px solid #22c55e;border-radius:6px;padding:10px 14px;margin:8px 0}
.insight-header{font-size:11px;font-weight:600;color:#15803d;margin-bottom:6px}
@media print{
  body{padding:16px;font-size:12px}
  .code-block{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .chart-wrap img{max-width:90%}
}
`

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function markdownToHtml(text) {
  let h = escHtml(text)
  h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>')
       .replace(/^## (.+)$/gm, '<h2>$1</h2>')
       .replace(/^# (.+)$/gm, '<h1>$1</h1>')
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
       .replace(/\*(.+?)\*/g, '<em>$1</em>')
       .replace(/`([^`]+)`/g, '<code>$1</code>')
  h = h.replace(/((?:^- .+\n?)+)/gm, (b) =>
    `<ul>${b.trim().split('\n').map(l => `<li>${l.replace(/^- /, '')}</li>`).join('')}</ul>`)
  h = h.replace(/((?:^\d+\. .+\n?)+)/gm, (b) =>
    `<ol>${b.trim().split('\n').map(l => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('')}</ol>`)
  h = h.split(/\n{2,}/).map(p => p.startsWith('<') ? p : `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('\n')
  return h
}

function renderMessage(m) {
  if (m.role === 'user') {
    return `<div class="msg user-msg"><div class="role-label user-label">Pengguna</div><div class="body">${escHtml(m.content || '')}</div></div>`
  }
  const parts = m.parts?.length ? m.parts : (m.content ? [{ type: 'text', content: m.content }] : [])
  const steps = m.codeSteps || []
  let html = '<div class="msg ai-msg"><div class="role-label ai-label">AI Analyst</div><div class="body">'
  for (const part of parts) {
    if (part.type === 'text' && part.content) {
      html += markdownToHtml(part.content)
    } else if (part.type === 'plan' && Array.isArray(part.content)) {
      const items = part.content.map(t => typeof t === 'string' ? t : (t?.task || String(t)))
      html += `<div class="plan-box"><strong>Rencana Eksekusi</strong><ol>${items.map(t => `<li>${escHtml(t)}</li>`).join('')}</ol></div>`
    } else if (part.type === 'task_start') {
      html += `<h4 class="task-header">Langkah ${(part.index ?? 0) + 1}/${part.total ?? '?'} — ${escHtml(part.content)}</h4>`
    } else if (part.type === 'agent_label') {
      html += `<div class="agent-label-badge">${escHtml(part.content)} Agent</div>`
    } else if (part.type === 'insight') {
      html += `<div class="insight-box"><div class="insight-header">Insight & Summary</div><div>${markdownToHtml(part.content)}</div></div>`
    } else if (part.type === 'image' && part.content) {
      html += `<div class="chart-wrap"><img src="data:image/png;base64,${part.content}" alt="grafik"/></div>`
    }
  }
  for (const step of steps) {
    if (step.code) html += `<div class="code-block"><pre>${escHtml(step.code)}</pre></div>`
    if (step.output) html += `<div class="output-block"><pre>${escHtml(step.output)}</pre></div>`
  }
  html += '</div></div>'
  return html
}

export function exportChatToPDF({ messages, username }) {
  const printWin = window.open('', '_blank')
  if (!printWin) return

  const bodyHtml = messages.map(renderMessage).join('\n')
  const dateStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  printWin.document.write(
    `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"/><title>Laporan Analisis</title>` +
    `<style>${REPORT_STYLES}</style>` +
    `</head><body>` +
    `<h1 class="report-title">Laporan Analisis Data</h1>` +
    `<p class="meta">Dibuat oleh ${escHtml(username || '')} &nbsp;·&nbsp; ${dateStr}</p>` +
    bodyHtml +
    `<script>setTimeout(()=>{window.print()},600)<\/script>` +
    `</body></html>`
  )
  printWin.document.close()
}
