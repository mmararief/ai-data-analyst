import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import Sidebar from '../components/Sidebar'
import MessageBubble from '../components/MessageBubble'
import { useTheme } from '../ThemeContext'

const QUICK_PROMPTS = [
  {
    label: 'Analisis data',
    desc: 'Ringkasan insight utama',
    prompt: 'Analisis dataset dan berikan ringkasan insight utama',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
      </svg>
    ),
    color: '#38bdf8',
  },
  {
    label: 'Visualisasi',
    desc: 'Distribusi & korelasi',
    prompt: 'Buat visualisasi distribusi dan korelasi kolom-kolom penting',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"/>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"/>
      </svg>
    ),
    color: '#818cf8',
  },
  {
    label: 'Buat model ML',
    desc: 'AutoML pipeline',
    prompt: 'Buat model machine learning untuk dataset ini',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
      </svg>
    ),
    color: '#34d399',
  },
  {
    label: 'Cek kualitas data',
    desc: 'Missing, duplikat, outlier',
    prompt: 'Cek kualitas data: missing values, duplikat, outlier, dan tipe data',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    ),
    color: '#f59e0b',
  },
]

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ text }) {
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

export default function ChatPage({ username, onLogout }) {
  const { projectId, sessionId: urlSessionId } = useParams()
  const navigate = useNavigate()

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [fileRefreshTrigger, setFileRefreshTrigger] = useState(0)
  const [sessionId, setSessionId] = useState(urlSessionId || null)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [inputFocused, setInputFocused] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const scrollAreaRef = useRef(null)
  const abortRef = useRef(null)
  const userScrolledUpRef = useRef(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(272)
  const resizingRef = useRef(false)
  const { theme, toggleTheme } = useTheme()

  const isNearBottom = useCallback(() => {
    const el = scrollAreaRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }, [])

  useEffect(() => {
    if (!userScrolledUpRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleScrollArea = useCallback(() => {
    const scrolledUp = !isNearBottom()
    userScrolledUpRef.current = scrolledUp
    setShowScrollBtn(scrolledUp)
  }, [isNearBottom])

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizingRef.current) return
      setSidebarWidth(Math.min(Math.max(e.clientX, 220), 420))
    }
    const handleMouseUp = () => { resizingRef.current = false }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  useEffect(() => {
    if (!projectId) return
    api.get(`/projects/${projectId}`)
      .then(res => setProjectName(res.data.name || ''))
      .catch(() => {})
  }, [projectId])

  useEffect(() => {
    if (sessionId) navigate(`/project/${projectId}/chat/${sessionId}`, { replace: true })
    else if (projectId) navigate(`/project/${projectId}`, { replace: true })
  }, [sessionId])

  useEffect(() => {
    if (!urlSessionId) { setHistoryLoaded(true); return }
    api.get(`/history/${projectId}/${urlSessionId}`)
      .then(res => {
        setMessages(res.data.messages.map(m => ({
          ...m,
          parts: m.parts?.length ? m.parts : (m.role === 'assistant' && m.content ? [{ type: 'text', content: m.content }] : []),
          images: m.images || [],
          codeSteps: m.codeSteps || [],
        })))
        setSessionId(urlSessionId)
      })
      .catch(() => navigate(`/project/${projectId}`, { replace: true }))
      .finally(() => setHistoryLoaded(true))
  }, [])

  useEffect(() => {
    if (!historyLoaded || !urlSessionId) return
    const token = localStorage.getItem('token')
    if (!token) return
    ;(async () => {
      try {
        const res = await fetch(`/chat/session/${urlSessionId}/active-job`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const data = await res.json()
        if (!data.active) {
          if (data.done) {
            try {
              const histRes = await api.get(`/history/${projectId}/${urlSessionId}`)
              setMessages(histRes.data.messages.map(m => ({
                ...m,
                parts: m.parts?.length ? m.parts : (m.role === 'assistant' && m.content ? [{ type: 'text', content: m.content }] : []),
                images: m.images || [],
                codeSteps: m.codeSteps || [],
              })))
            } catch { }
          }
          return
        }
        const { job_id, question } = data
        setSessionId(urlSessionId)
        setLoading(true)
        setStatusText('Menyambungkan ulang...')
        setMessages(prev => [
          ...prev,
          { role: 'user', content: question },
          { role: 'assistant', content: '', parts: [], images: [], codeSteps: [] },
        ])
        const accParts = [], accCodeSteps = [], accImages = []
        const response = await fetch(`/chat/events/${job_id}?from_idx=0`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        await processEventStream(response, '', accParts, accCodeSteps, accImages)
      } catch { } finally {
        setLoading(false); setStatusText('')
      }
    })()
  }, [historyLoaded])

  const sendMessage = async (question) => {
    if (!question.trim() || loading) return
    setInput('')
    const history = messages
      .filter(m => m.content && m.content.trim())
      .map(m => ({ role: m.role, content: m.content }))
    streamFromEndpoint({ question, history, project_id: projectId }, question)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
      if (inputRef.current) inputRef.current.style.height = '52px'
    }
  }

  const processEventStream = async (response, accContent, accParts, accCodeSteps, accImages, signal) => {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let localAccContent = accContent
    let forceNewTextBlock = false

    while (true) {
      if (signal?.aborted) { await reader.cancel(); break }
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const event = JSON.parse(line.slice(6))

        if (event.type === 'text') setStatusText('Menyusun jawaban...')
        else if (event.type === 'code') setStatusText('Menjalankan kode...')
        else if (event.type === 'output') setStatusText('Membaca hasil eksekusi...')
        else if (event.type === 'progress') setStatusText('Menjalankan kode...')
        else if (event.type === 'automl_train_start') setStatusText(`AutoML: ${event.dataset} → ${event.target}`)
        else if (event.type === 'automl_progress') setStatusText(`Training: ${event.content}`)
        else if (event.type === 'automl_train_done') setStatusText('Model berhasil dilatih!')
        else if (event.type === 'image') setStatusText('Membuat grafik...')
        else if (event.type === 'streamlit') setStatusText('Mempersiapkan dashboard...')
        else if (event.type === 'error') setStatusText('Terjadi kesalahan...')
        else if (event.type === 'agent_label') setStatusText(`${event.content} Agent`)
        else if (event.type === 'critic') setStatusText('Evaluasi Critic Agent...')
        else if (event.type === 'plan') setStatusText(`Merencanakan ${event.content?.length || 0} langkah...`)
        else if (event.type === 'task_start') setStatusText(`[${(event.index ?? 0) + 1}/${event.total}] ${event.content}`)
        else if (event.type === 'web_search') setStatusText(`🔍 Mencari: ${event.query}`)
        else if (event.type === 'web_search_result') setStatusText('Hasil pencarian diterima')
        else if (event.type === 'file_export_start') setStatusText(`📄 Mengekspor ${event.filename}...`)
        else if (event.type === 'file_export_done') setStatusText(`✅ File diekspor: ${event.filename}`)

        if (event.type === 'error') {
          accParts.push({ type: 'error', content: event.content })
          localAccContent += event.content
        } else if (event.type === 'text') {
          localAccContent += event.content
          if (!forceNewTextBlock && accParts.length > 0 && accParts[accParts.length - 1].type === 'text') {
            accParts[accParts.length - 1].content += event.content
          } else { accParts.push({ type: 'text', content: event.content }); forceNewTextBlock = false }
        } else if (event.type === 'image') { accParts.push({ type: 'image', content: event.content }); accImages.push(event.content) }
        else if (event.type === 'streamlit') accParts.push({ type: 'streamlit', content: event.content })
        else if (event.type === 'code') accCodeSteps.push({ code: event.content, output: '', progressLines: [] })
        else if (event.type === 'output') { if (accCodeSteps.length > 0) accCodeSteps[accCodeSteps.length - 1].output = event.content }
        else if (event.type === 'plan') accParts.unshift({ type: 'plan', content: event.content })
        else if (event.type === 'task_start') { accParts.push({ type: 'task_start', content: event.content, index: event.index, total: event.total, agent: event.agent }); forceNewTextBlock = true }
        else if (event.type === 'agent_label') { accParts.push({ type: 'agent_label', content: event.content }) }
        else if (event.type === 'critic') accParts.push({ type: 'critic', judgment: event.judgment, feedback: event.feedback, additional_tasks: event.additional_tasks })
        else if (event.type === 'insight') { localAccContent += event.content; accParts.push({ type: 'insight', content: event.content }) }
        else if (event.type === 'automl_train_start') accParts.push({ type: 'automl_train', dataset: event.dataset, target: event.target, problem_type: event.problem_type, progressLines: [], done: false })
        else if (event.type === 'automl_progress') {
          const lastAutoml = [...accParts].reverse().find(p => p.type === 'automl_train')
          if (lastAutoml) lastAutoml.progressLines = [...(lastAutoml.progressLines || []), event.content]
        } else if (event.type === 'automl_train_done') {
          const lastAutoml = [...accParts].reverse().find(p => p.type === 'automl_train')
          if (lastAutoml) { lastAutoml.done = true; lastAutoml.result = event }
        }
        else if (event.type === 'web_search_result') {
          accParts.push({ type: 'web_search', query: event.query, answer: event.answer, sources: event.sources, error: event.error })
        }
        else if (event.type === 'file_export_done') {
          accParts.push({ type: 'file_export', filename: event.filename, format: event.format, size_bytes: event.size_bytes, error: event.error })
        }

        setMessages(prev => {
          const updated = [...prev]
          const last = { ...updated[updated.length - 1] }
          if (event.type === 'error') {
            const parts = [...(last.parts || [])]
            const idx = [...parts].map((p, i) => p.type === 'automl_train' ? i : -1).filter(i => i >= 0).pop()
            if (idx !== undefined && !parts[idx]?.done) parts[idx] = { ...parts[idx], done: true, result: { ...(parts[idx].result || {}), error: true, message: event.content } }
            parts.push({ type: 'error', content: event.content })
            last.parts = parts; last.content = (last.content || '') + event.content
          } else if (event.type === 'text') {
            const parts = [...(last.parts || [])]
            const lastPart = parts.length > 0 ? parts[parts.length - 1] : null
            if (lastPart?.type === 'text' && !last._breakText) {
              parts[parts.length - 1] = { type: 'text', content: lastPart.content + event.content }
            } else { parts.push({ type: 'text', content: event.content }) }
            last.parts = parts; last.content = (last.content || '') + event.content; last._breakText = false
          } else if (event.type === 'image') { last.parts = [...(last.parts || []), { type: 'image', content: event.content }]; last.images = [...(last.images || []), event.content] }
          else if (event.type === 'streamlit') last.parts = [...(last.parts || []), { type: 'streamlit', content: event.content }]
          else if (event.type === 'code') last.codeSteps = [...(last.codeSteps || []), { code: event.content, progressLines: [] }]
          else if (event.type === 'output') {
            const steps = [...(last.codeSteps || [])]
            if (steps.length > 0) steps[steps.length - 1] = { ...steps[steps.length - 1], output: event.content }
            last.codeSteps = steps
          } else if (event.type === 'progress') {
            const steps = [...(last.codeSteps || [])]
            if (steps.length > 0) {
              const lastStep = steps[steps.length - 1]
              if (!lastStep.output) steps[steps.length - 1] = { ...lastStep, progressLines: [...(lastStep.progressLines || []), event.content] }
            }
            last.codeSteps = steps
          } else if (event.type === 'plan') last.parts = [{ type: 'plan', content: event.content }, ...(last.parts || [])]
          else if (event.type === 'task_start') { last.parts = [...(last.parts || []), { type: 'task_start', content: event.content, index: event.index, total: event.total, agent: event.agent }]; last._breakText = true }
          else if (event.type === 'agent_label') { last.parts = [...(last.parts || []), { type: 'agent_label', content: event.content }]; last._breakText = true }
          else if (event.type === 'critic') last.parts = [...(last.parts || []), { type: 'critic', judgment: event.judgment, feedback: event.feedback, additional_tasks: event.additional_tasks }]
          else if (event.type === 'insight') { last.parts = [...(last.parts || []), { type: 'insight', content: event.content }]; last.content = (last.content || '') + event.content }
          else if (event.type === 'automl_train_start') last.parts = [...(last.parts || []), { type: 'automl_train', dataset: event.dataset, target: event.target, problem_type: event.problem_type, progressLines: [], done: false }]
          else if (event.type === 'automl_progress') {
            const parts = [...(last.parts || [])]
            const idx = [...parts].map((p, i) => p.type === 'automl_train' ? i : -1).filter(i => i >= 0).pop()
            if (idx !== undefined) parts[idx] = { ...parts[idx], progressLines: [...(parts[idx].progressLines || []), event.content] }
            last.parts = parts
          } else if (event.type === 'automl_train_done') {
            const parts = [...(last.parts || [])]
            const idx = [...parts].map((p, i) => p.type === 'automl_train' ? i : -1).filter(i => i >= 0).pop()
            if (idx !== undefined) parts[idx] = { ...parts[idx], done: true, result: event }
            last.parts = parts
          } else if (event.type === 'web_search_result') {
            last.parts = [...(last.parts || []), { type: 'web_search', query: event.query, answer: event.answer, sources: event.sources, error: event.error }]
          } else if (event.type === 'file_export_done') {
            last.parts = [...(last.parts || []), { type: 'file_export', filename: event.filename, format: event.format, size_bytes: event.size_bytes, error: event.error }]
          }
          updated[updated.length - 1] = last
          return updated
        })
      }
    }
    return localAccContent
  }

  const handleStopGeneration = () => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null }
  }

  const streamFromEndpoint = async (body, userLabel) => {
    if (loading) return
    const priorMessages = messages
    let currentSessionId = sessionId
    let accContent = ''
    const accParts = [], accCodeSteps = [], accImages = []
    const ac = new AbortController()
    abortRef.current = ac
    userScrolledUpRef.current = false
    setShowScrollBtn(false)
    setMessages(prev => [...prev, { role: 'user', content: userLabel }])
    setLoading(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '', parts: [], images: [], codeSteps: [] }])

    try {
      const token = localStorage.getItem('token')
      const startRes = await fetch('/chat/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...body, session_id: currentSessionId }),
      })
      if (!startRes.ok) throw new Error('Gagal memulai job')
      const { job_id, session_id: assignedSessionId } = await startRes.json()
      if (!currentSessionId) { currentSessionId = assignedSessionId; setSessionId(assignedSessionId) }
      const response = await fetch(`/chat/events/${job_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      accContent = await processEventStream(response, accContent, accParts, accCodeSteps, accImages, ac.signal)
    } catch (err) {
      const errContent = err?.name === 'AbortError' ? 'Generasi dihentikan.' : 'Terjadi kesalahan saat memproses permintaan.'
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: errContent, parts: [{ type: 'error', content: errContent }], images: [], codeSteps: [] }
        return updated
      })
    } finally {
      abortRef.current = null; setLoading(false); setStatusText('')
      const toSave = [
        ...priorMessages.map(m => ({ role: m.role, content: m.content || '', parts: m.parts || [], codeSteps: m.codeSteps || [], images: m.images || [] })),
        { role: 'user', content: userLabel, parts: [{ type: 'text', content: userLabel }], codeSteps: [], images: [] },
        { role: 'assistant', content: accContent, parts: accParts, codeSteps: accCodeSteps, images: accImages },
      ]
      const firstUser = toSave.find(m => m.role === 'user')
      if (firstUser && accContent) {
        try { await api.post(`/history/${projectId}/save`, { session_id: currentSessionId, title: firstUser.content.slice(0, 80), messages: toSave }) } catch { }
      }
      setFileRefreshTrigger(t => t + 1)
      inputRef.current?.focus()
    }
  }

  const handleNewChat = () => { if (loading) return; setMessages([]); setSessionId(null) }

  const handleLoadHistory = (sid, msgs) => {
    if (loading) return
    setMessages(msgs.map(m => ({
      ...m,
      parts: m.parts?.length ? m.parts : (m.role === 'assistant' && m.content ? [{ type: 'text', content: m.content }] : []),
      images: m.images || [], codeSteps: m.codeSteps || [],
    })))
    setSessionId(sid)
  }

  const handleExportPDF = () => {
    const printWin = window.open('', '_blank')
    if (!printWin) return
    const escHtml = (str) => String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    const markdownToHtml = (text) => {
      let h = escHtml(text)
      h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^# (.+)$/gm, '<h1>$1</h1>')
      h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`([^`]+)`/g, '<code>$1</code>')
      h = h.replace(/((?:^- .+\n?)+)/gm, (b) => `<ul>${b.trim().split('\n').map(l=>`<li>${l.replace(/^- /,'')}</li>`).join('')}</ul>`)
      h = h.replace(/((?:^\d+\. .+\n?)+)/gm, (b) => `<ol>${b.trim().split('\n').map(l=>`<li>${l.replace(/^\d+\. /,'')}</li>`).join('')}</ol>`)
      h = h.split(/\n{2,}/).map(p => p.startsWith('<') ? p : `<p>${p.replace(/\n/g,'<br/>')}</p>`).join('\n')
      return h
    }
    const renderMessage = (m) => {
      if (m.role === 'user') return `<div class="msg user-msg"><div class="role-label user-label">Pengguna</div><div class="body">${escHtml(m.content||'')}</div></div>`
      const parts = m.parts?.length ? m.parts : (m.content ? [{type:'text',content:m.content}] : [])
      const steps = m.codeSteps || []
      let html = '<div class="msg ai-msg"><div class="role-label ai-label">AI Analyst</div><div class="body">'
      for (const part of parts) {
        if (part.type==='text'&&part.content) html += markdownToHtml(part.content)
        else if (part.type==='plan'&&Array.isArray(part.content)) {
          const items = part.content.map(t=>typeof t==='string'?t:(t?.task||String(t)))
          html += `<div class="plan-box"><strong>Rencana Eksekusi</strong><ol>${items.map(t=>`<li>${escHtml(t)}</li>`).join('')}</ol></div>`
        } else if (part.type==='task_start') {
          html += `<h4 class="task-header">Langkah ${(part.index??0)+1}/${part.total??'?'} — ${escHtml(part.content)}</h4>`
        } else if (part.type==='agent_label') html += `<div class="agent-label-badge">${escHtml(part.content)} Agent</div>`
        else if (part.type==='insight') html += `<div class="insight-box"><div class="insight-header">Insight & Summary</div><div>${markdownToHtml(part.content)}</div></div>`
        else if (part.type==='image'&&part.content) html += `<div class="chart-wrap"><img src="data:image/png;base64,${part.content}" alt="grafik"/></div>`
      }
      for (const step of steps) {
        if (step.code) html += `<div class="code-block"><pre>${escHtml(step.code)}</pre></div>`
        if (step.output) html += `<div class="output-block"><pre>${escHtml(step.output)}</pre></div>`
      }
      html += '</div></div>'
      return html
    }
    const bodyHtml = messages.map(renderMessage).join('\n')
    const dateStr = new Date().toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })
    printWin.document.write(`<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"/><title>Laporan Analisis</title><style>*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',system-ui,sans-serif;font-size:13px;line-height:1.7;color:#1a1a1a;background:#fff;max-width:820px;margin:0 auto;padding:32px 24px}h1.report-title{font-size:20px;font-weight:700;color:#1e1e2e;border-bottom:2px solid #6366f1;padding-bottom:8px;margin-bottom:4px}p.meta{color:#888;font-size:11px;margin-bottom:28px}.msg{margin-bottom:20px;padding:14px 16px;border-radius:8px;page-break-inside:avoid}.user-msg{background:#f5f5ff;border-left:3px solid #6366f1}.ai-msg{background:#f4faf7;border-left:3px solid #10b981}.role-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}.user-label{color:#6366f1}.ai-label{color:#10b981}.body h1,.body h2,.body h3{margin:12px 0 6px;font-weight:600}.body h1{font-size:16px}.body h2{font-size:14px}.body h3{font-size:13px}.body p{margin-bottom:8px}.body ul,.body ol{padding-left:20px;margin-bottom:8px}.body li{margin-bottom:3px}.body strong{font-weight:600}.body em{font-style:italic}.body code{background:#eef;color:#5046e5;padding:1px 5px;border-radius:3px;font-family:monospace;font-size:12px}.code-block{background:#1e1e2e;color:#a6e3a1;border-radius:6px;margin:10px 0;padding:12px 14px;font-family:'Cascadia Code','Consolas',monospace;font-size:11.5px;overflow:hidden;page-break-inside:avoid}.code-block pre{white-space:pre-wrap;word-break:break-all}.output-block{background:#fafafa;border:1px solid #e0e0e0;border-radius:6px;margin:4px 0 10px;padding:10px 14px;font-family:monospace;font-size:11px;color:#444;overflow:hidden}.output-block pre{white-space:pre-wrap;word-break:break-all}.chart-wrap{margin:12px 0;text-align:center}.chart-wrap img{max-width:100%;border-radius:6px;border:1px solid #e0e0e0}.plan-box{background:#f5f0ff;border-left:3px solid #8b5cf6;border-radius:6px;padding:10px 14px;margin:8px 0}.plan-box strong{color:#6d28d9;font-size:12px;display:block;margin-bottom:6px}.plan-box ol{padding-left:18px}.plan-box li{font-size:12px;color:#4c1d95;margin-bottom:3px}h4.task-header{font-size:12px;color:#7c3aed;margin:10px 0 4px}.agent-label-badge{font-size:10px;font-weight:600;color:#6d28d9;background:#f5f0ff;border-radius:99px;padding:2px 8px;display:inline-block;margin:8px 0 4px;text-transform:uppercase;letter-spacing:.05em}.insight-box{background:#f0fdf4;border-left:3px solid #22c55e;border-radius:6px;padding:10px 14px;margin:8px 0}.insight-header{font-size:11px;font-weight:600;color:#15803d;margin-bottom:6px}@media print{body{padding:16px;font-size:12px}.code-block{-webkit-print-color-adjust:exact;print-color-adjust:exact}.chart-wrap img{max-width:90%}}</style></head><body><h1 class="report-title">Laporan Analisis Data</h1><p class="meta">Dibuat oleh ${username} &nbsp;·&nbsp; ${dateStr}</p>${bodyHtml}<script>setTimeout(()=>{window.print()},600)<\/script></body></html>`)
    printWin.document.close()
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500&display=swap');
        @keyframes pulse-status { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.7)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideInLeft { from{opacity:0;transform:translateX(-10px)} to{opacity:1;transform:translateX(0)} }
        .chat-scroll::-webkit-scrollbar { width: 3px; }
        .chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .chat-scroll::-webkit-scrollbar-thumb { background: rgba(56,189,248,0.1); border-radius: 2px; }
        .quick-card:hover { border-color: rgba(56,189,248,0.3) !important; background: rgba(255,255,255,0.04) !important; transform: translateY(-2px); }
        .scroll-to-bottom:hover { border-color: rgba(56,189,248,0.4) !important; color: #38bdf8 !important; }
        .header-btn:hover { border-color: rgba(56,189,248,0.3) !important; color: #7dd3fc !important; }
        .send-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 0 20px rgba(56,189,248,0.3) !important; }
      `}</style>

      <div style={{
        display: 'flex', height: '100vh',
        background: 'var(--bg-page)',
        fontFamily: "'Syne', sans-serif",
        color: 'var(--text-primary)',
        overflow: 'hidden',
      }}>

        {/* Sidebar */}
        <Sidebar
          projectId={projectId}
          onSuggest={q => sendMessage(q)}
          onLoadHistory={handleLoadHistory}
          refreshTrigger={fileRefreshTrigger}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          width={sidebarWidth}
        />

        {/* Resize handle */}
        <div
          className="hidden md:block"
          style={{
            width: 4, cursor: 'col-resize',
            background: 'transparent',
            flexShrink: 0,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,189,248,0.2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          onMouseDown={e => { e.preventDefault(); resizingRef.current = true }}
        />

        {/* Main area */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          minWidth: 0, position: 'relative',
          background: 'var(--bg-page)',
        }}>

          {/* Subtle grid bg */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: `
              linear-gradient(rgba(56,189,248,0.025) 1px, transparent 1px),
              linear-gradient(90deg, rgba(56,189,248,0.025) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black 20%, transparent 100%)',
          }} />

          {/* ── HEADER ── */}
          <header style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 1.25rem',
            height: 54,
            borderBottom: '1px solid var(--border-light)',
            background: 'var(--bg-header)',
            backdropFilter: 'blur(12px)',
            flexShrink: 0,
            position: 'relative', zIndex: 10,
            animation: 'slideInLeft 0.4s ease both',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {/* Mobile menu */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex md:hidden header-btn items-center justify-center"
                style={{
                  width: 32, height: 32, borderRadius: 7,
                  background: 'var(--bg-hover)',
                  border: '1px solid var(--border-primary)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer', transition: 'color 0.2s, border-color 0.2s',
                }}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
              </button>

              {/* Back to Dashboard */}
              <button
                onClick={() => navigate('/')}
                className="header-btn"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  height: 30, padding: '0 0.75rem',
                  background: 'var(--bg-hover)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 7, cursor: 'pointer',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.62rem', letterSpacing: '0.08em',
                  color: 'var(--text-muted)', transition: 'color 0.2s, border-color 0.2s',
                }}
              >
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                </svg>
                <span className="hidden sm:inline">DASHBOARD</span>
              </button>

              {/* Project name */}
              {projectName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    fontSize: '0.88rem', fontWeight: 600,
                    color: 'var(--text-secondary)', letterSpacing: '-0.01em',
                    maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{projectName}</span>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.6rem', letterSpacing: '0.08em',
                    color: 'var(--text-muted)',
                    background: 'var(--bg-hover)',
                    border: '1px solid var(--border-light)',
                    padding: '0.15rem 0.5rem', borderRadius: 4,
                  }}>
                    {sessionId ? 'SESI AKTIF' : 'BARU'}
                  </span>
                </div>
              )}

              {/* Status badge */}
              {loading && <StatusBadge text={statusText} />}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {/* New chat */}
              <button
                onClick={handleNewChat}
                disabled={loading}
                className="header-btn"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  height: 30, padding: '0 0.75rem',
                  background: 'var(--bg-hover)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 7, cursor: 'pointer',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.62rem', letterSpacing: '0.08em',
                  color: 'var(--text-muted)', transition: 'color 0.2s, border-color 0.2s',
                  opacity: loading ? 0.4 : 1,
                }}
              >
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/>
                </svg>
                <span className="hidden sm:inline">BARU</span>
              </button>

              {/* Export PDF */}
              {messages.length > 0 && !loading && (
                <button
                  onClick={handleExportPDF}
                  className="header-btn"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                    height: 30, padding: '0 0.75rem',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 7, cursor: 'pointer',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.62rem', letterSpacing: '0.08em',
                    color: '#334155', transition: 'color 0.2s, border-color 0.2s',
                  }}
                >
                  <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  <span className="hidden sm:inline">PDF</span>
                </button>
              )}

              {/* Theme */}
              <button
                onClick={toggleTheme}
                className="header-btn"
                style={{
                  width: 30, height: 30, borderRadius: 7,
                  background: 'var(--bg-hover)',
                  border: '1px solid var(--border-primary)',
                  color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'color 0.2s, border-color 0.2s',
                }}
              >
                {theme === 'dark' ? (
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                ) : (
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
                )}
              </button>

              {/* Username */}
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.62rem', color: 'var(--text-muted)',
                letterSpacing: '0.06em',
                padding: '0.2rem 0.6rem',
                background: 'var(--bg-hover)',
                border: '1px solid var(--border-light)',
                borderRadius: 5,
              }} className="hidden lg:block">
                {username}
              </div>

              {/* Logout */}
              <button
                onClick={onLogout}
                className="header-btn"
                style={{
                  height: 30, padding: '0 0.75rem',
                  background: 'var(--bg-hover)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 7, cursor: 'pointer',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.62rem', letterSpacing: '0.08em',
                  color: 'var(--text-muted)', transition: 'color 0.2s, border-color 0.2s',
                }}
              >
                KELUAR
              </button>
            </div>
          </header>

          {/* ── MESSAGES ── */}
          <div
            ref={scrollAreaRef}
            onScroll={handleScrollArea}
            className="chat-scroll"
            style={{
              flex: 1, overflowY: 'auto',
              padding: '2rem 1.5rem',
              display: 'flex', flexDirection: 'column',
              gap: '0.75rem',
              position: 'relative', zIndex: 1,
            }}
          >
            {messages.length === 0 && (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                textAlign: 'center', animation: 'fadeInUp 0.6s ease both',
                padding: '4rem 1rem',
              }}>
                {/* Logo */}
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, fontWeight: 800, color: 'white',
                  marginBottom: '1.25rem',
                  boxShadow: '0 0 40px rgba(56,189,248,0.2)',
                }}>A</div>

                <h2 style={{
                  fontSize: 'clamp(1.4rem,3vw,1.8rem)',
                  fontWeight: 800, letterSpacing: '-0.03em',
                  color: 'var(--text-heading)', marginBottom: '0.6rem',
                }}>
                  Analis<span style={{ color: 'var(--analisai-cyan)' }}>ai</span>
                </h2>
                <p style={{
                  fontSize: '0.88rem', color: 'var(--text-muted)',
                  maxWidth: 400, lineHeight: 1.7, marginBottom: '2.5rem',
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  Upload dataset via sidebar, lalu tanyakan apa yang ingin Anda analisis.
                </p>

                {/* Quick prompts */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '0.6rem', maxWidth: 480, width: '100%',
                }}>
                  {QUICK_PROMPTS.map(qp => (
                    <button
                      key={qp.label}
                      onClick={() => sendMessage(qp.prompt)}
                      className="quick-card"
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                        textAlign: 'left', padding: '0.85rem 1rem',
                        background: 'var(--bg-hover)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 10, cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      <span style={{ color: qp.color, flexShrink: 0, marginTop: 1 }}>{qp.icon}</span>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>{qp.label}</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>{qp.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <MessageBubble
                key={i}
                message={msg}
                isLoading={loading && i === messages.length - 1}
                statusText={loading && i === messages.length - 1 ? statusText : ''}
                allMessages={messages}
                projectId={projectId}
              />
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Scroll to bottom */}
          {showScrollBtn && messages.length > 0 && (
            <div style={{
              position: 'absolute', bottom: 130, left: '50%',
              transform: 'translateX(-50%)', zIndex: 20,
            }}>
              <button
                onClick={() => { userScrolledUpRef.current = false; setShowScrollBtn(false); bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }}
                className="scroll-to-bottom"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.4rem 0.9rem',
                    background: 'var(--bg-header)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 100, cursor: 'pointer',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.62rem', letterSpacing: '0.08em',
                    color: 'var(--text-muted)', transition: 'all 0.2s',
                    backdropFilter: 'blur(8px)',
                  }}
              >
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
                </svg>
                TERBARU
              </button>
            </div>
          )}

          {/* ── INPUT AREA ── */}
          <div style={{
            padding: '0.75rem 1.25rem 1rem',
            background: `linear-gradient(to top, var(--bg-page) 60%, transparent)`,
            position: 'relative', zIndex: 10, flexShrink: 0,
          }}>
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
              <div style={{
                display: 'flex', alignItems: 'flex-end',
                background: 'var(--bg-hover)',
                border: `1px solid ${inputFocused ? 'rgba(56,189,248,0.4)' : 'var(--border-primary)'}`,
                borderRadius: 14,
                transition: 'border-color 0.2s, box-shadow 0.2s',
                boxShadow: inputFocused ? '0 0 0 3px rgba(56,189,248,0.07), 0 0 24px rgba(56,189,248,0.05)' : 'none',
                overflow: 'hidden',
                paddingBottom: 6,
              }}>
                <textarea
                  ref={inputRef}
                  rows={1}
                  placeholder="Tanyakan sesuatu tentang data Anda..."
                  value={input}
                  onChange={e => {
                    setInput(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
                  }}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  disabled={loading}
                  style={{
                    flex: 1, background: 'transparent',
                    border: 'none', outline: 'none', resize: 'none',
                    padding: '0.9rem 1rem 0.4rem',
                    color: 'var(--text-primary)', fontFamily: "'Syne', sans-serif",
                    fontSize: '0.9rem', lineHeight: 1.6,
                    minHeight: 52, maxHeight: 160,
                    height: 52,
                  }}
                />
                <div style={{ padding: '0 0.5rem 0.25rem', display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                  {/* Stop */}
                  {loading && (
                    <button
                      onClick={handleStopGeneration}
                      style={{
                        width: 34, height: 34, borderRadius: 9,
                        background: 'rgba(239,68,68,0.08)',
                        border: '1px solid rgba(239,68,68,0.2)',
                        color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'background 0.2s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.14)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                      title="Hentikan"
                    >
                      <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                    </button>
                  )}
                  {/* Send */}
                  <button
                    onClick={() => { sendMessage(input); if (inputRef.current) inputRef.current.style.height = '52px' }}
                    disabled={loading || !input.trim()}
                    className="send-btn"
                    style={{
                      width: 34, height: 34, borderRadius: 9,
                      background: loading ? 'transparent' : input.trim() ? 'linear-gradient(135deg, #0ea5e9, #6366f1)' : 'var(--bg-hover)',
                      border: loading ? 'none' : input.trim() ? 'none' : '1px solid var(--border-primary)',
                      color: input.trim() && !loading ? 'white' : 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: input.trim() && !loading ? '0 0 16px rgba(56,189,248,0.2)' : 'none',
                    }}
                  >
                    {loading ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8"
                        style={{ animation: 'spin 0.8s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" strokeWidth="3" strokeOpacity="0.2"/>
                        <path d="M12 2a10 10 0 0110 10" strokeWidth="3" strokeLinecap="round"/>
                      </svg>
                    ) : (
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19V5m0 0l-6 6m6-6l6 6"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div style={{
                textAlign: 'center', marginTop: '0.5rem',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.58rem', color: 'var(--text-muted)', letterSpacing: '0.06em',
              }}>
                ANALISAI · PERIKSA KEMBALI HASIL ANALISIS AI
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
