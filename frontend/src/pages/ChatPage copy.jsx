import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import Sidebar from '../components/Sidebar'
import MessageBubble from '../components/MessageBubble'
import { useTheme } from '../ThemeContext'

const QUICK_PROMPTS = [
  { icon: '📊', label: 'Analisis data', prompt: 'Analisis dataset dan berikan ringkasan insight utama' },
  { icon: '📈', label: 'Visualisasi', prompt: 'Buat visualisasi distribusi dan korelasi kolom-kolom penting' },
  { icon: '🤖', label: 'Buat model ML', prompt: 'Buat model machine learning untuk dataset ini' },
  { icon: '🔍', label: 'Cek kualitas data', prompt: 'Cek kualitas data: missing values, duplikat, outlier, dan tipe data' },
]

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
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const scrollAreaRef = useRef(null)
  const abortRef = useRef(null)
  const userScrolledUpRef = useRef(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(288)
  const resizingRef = useRef(false)

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
      const newWidth = Math.min(Math.max(e.clientX, 220), 420)
      setSidebarWidth(newWidth)
    }
    const handleMouseUp = () => {
      if (resizingRef.current) {
        resizingRef.current = false
      }
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // Load project info
  useEffect(() => {
    if (!projectId) return
    api.get(`/projects/${projectId}`)
      .then(res => setProjectName(res.data.name || ''))
      .catch(() => {})
  }, [projectId])

  // Sync URL with active session
  useEffect(() => {
    if (sessionId) {
      navigate(`/project/${projectId}/chat/${sessionId}`, { replace: true })
    } else if (projectId) {
      navigate(`/project/${projectId}`, { replace: true })
    }
  }, [sessionId])

  // Auto-load session from URL on first mount
  useEffect(() => {
    if (!urlSessionId) {
      setHistoryLoaded(true)
      return
    }
    api.get(`/history/${projectId}/${urlSessionId}`)
      .then(res => {
        setMessages(res.data.messages.map(m => ({
          ...m,
          parts: m.parts?.length
            ? m.parts
            : (m.role === 'assistant' && m.content ? [{ type: 'text', content: m.content }] : []),
          images: m.images || [],
          codeSteps: m.codeSteps || [],
        })))
        setSessionId(urlSessionId)
      })
      .catch(() => navigate(`/project/${projectId}`, { replace: true }))
      .finally(() => setHistoryLoaded(true))
  }, [])

  // Reconnect to an active job
  useEffect(() => {
    if (!historyLoaded || !urlSessionId) return
    const token = localStorage.getItem('token')
    if (!token) return

      ; (async () => {
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

          const accParts = []
          const accCodeSteps = []
          const accImages = []
          const response = await fetch(`/chat/events/${job_id}?from_idx=0`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          await processEventStream(response, '', accParts, accCodeSteps, accImages)
        } catch { } finally {
          setLoading(false)
          setStatusText('')
        }
      })()
  }, [historyLoaded])

  const sendMessage = async (question) => {
    if (!question.trim() || loading) return
    setInput('')
    const history = messages
      .filter((m) => m.content && m.content.trim())
      .map((m) => ({ role: m.role, content: m.content }))
    streamFromEndpoint({ question, history, project_id: projectId }, question)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
      if (inputRef.current) {
        inputRef.current.style.height = '52px'
      }
    }
  }

  const processEventStream = async (response, accContent, accParts, accCodeSteps, accImages, signal) => {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let localAccContent = accContent
    let forceNewTextBlock = false

    while (true) {
      if (signal?.aborted) {
        await reader.cancel()
        break
      }
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
        else if (event.type === 'automl_train_start') setStatusText(`AutoML Training: ${event.dataset} → ${event.target}`)
        else if (event.type === 'automl_progress') setStatusText(`Training: ${event.content}`)
        else if (event.type === 'automl_train_done') setStatusText('Model berhasil dilatih!')
        else if (event.type === 'image') setStatusText('Membuat grafik...')
        else if (event.type === 'streamlit') setStatusText('Mempersiapkan dashboard...')
        else if (event.type === 'error') setStatusText('Terjadi kesalahan...')
        else if (event.type === 'agent_label') setStatusText(`${event.content} Agent`)
        else if (event.type === 'critic') setStatusText('Evaluasi Critic Agent...')
        else if (event.type === 'insight') setStatusText('Menyusun insight...')
        else if (event.type === 'plan') setStatusText(`Merencanakan ${event.content?.length || 0} langkah...`)
        else if (event.type === 'task_start') setStatusText(`[${(event.index ?? 0) + 1}/${event.total}] ${event.content}`)

        if (event.type === 'error') {
          accParts.push({ type: 'error', content: event.content })
          localAccContent += event.content
        } else if (event.type === 'text') {
          localAccContent += event.content
          if (!forceNewTextBlock && accParts.length > 0 && accParts[accParts.length - 1].type === 'text') {
            accParts[accParts.length - 1].content += event.content
          } else {
            accParts.push({ type: 'text', content: event.content })
            forceNewTextBlock = false
          }
        } else if (event.type === 'image') {
          accParts.push({ type: 'image', content: event.content })
          accImages.push(event.content)
        } else if (event.type === 'streamlit') {
          accParts.push({ type: 'streamlit', content: event.content })
        } else if (event.type === 'code') {
          accCodeSteps.push({ code: event.content, output: '', progressLines: [] })
        } else if (event.type === 'output') {
          if (accCodeSteps.length > 0) accCodeSteps[accCodeSteps.length - 1].output = event.content
        } else if (event.type === 'plan') {
          accParts.unshift({ type: 'plan', content: event.content })
        } else if (event.type === 'task_start') {
          accParts.push({ type: 'task_start', content: event.content, index: event.index, total: event.total, agent: event.agent })
          forceNewTextBlock = true
        } else if (event.type === 'agent_label') {
          accParts.push({ type: 'agent_label', content: event.content })
        } else if (event.type === 'critic') {
          accParts.push({ type: 'critic', judgment: event.judgment, feedback: event.feedback, additional_tasks: event.additional_tasks })
        } else if (event.type === 'insight') {
          localAccContent += event.content
          accParts.push({ type: 'insight', content: event.content })
        } else if (event.type === 'automl_train_start') {
          accParts.push({ type: 'automl_train', dataset: event.dataset, target: event.target, problem_type: event.problem_type, progressLines: [], done: false })
        } else if (event.type === 'automl_progress') {
          const lastAutoml = [...accParts].reverse().find(p => p.type === 'automl_train')
          if (lastAutoml) lastAutoml.progressLines = [...(lastAutoml.progressLines || []), event.content]
        } else if (event.type === 'automl_train_done') {
          const lastAutoml = [...accParts].reverse().find(p => p.type === 'automl_train')
          if (lastAutoml) {
            lastAutoml.done = true
            lastAutoml.result = event
          }
        }

        setMessages((prev) => {
          const updated = [...prev]
          const last = { ...updated[updated.length - 1] }
          if (event.type === 'error') {
            const parts = [...(last.parts || [])]
            const idx = [...parts].map((p, i) => p.type === 'automl_train' ? i : -1).filter(i => i >= 0).pop()
            if (idx !== undefined && !parts[idx]?.done) {
              parts[idx] = {
                ...parts[idx],
                done: true,
                result: { ...(parts[idx].result || {}), error: true, message: event.content },
              }
            }
            parts.push({ type: 'error', content: event.content })
            last.parts = parts
            last.content = (last.content || '') + event.content
          } else if (event.type === 'text') {
            const parts = [...(last.parts || [])]
            const lastPart = parts.length > 0 ? parts[parts.length - 1] : null
            const canMerge = lastPart?.type === 'text' && !last._breakText
            if (canMerge) {
              parts[parts.length - 1] = { type: 'text', content: lastPart.content + event.content }
            } else {
              parts.push({ type: 'text', content: event.content })
            }
            last.parts = parts
            last.content = (last.content || '') + event.content
            last._breakText = false
          } else if (event.type === 'image') {
            last.parts = [...(last.parts || []), { type: 'image', content: event.content }]
            last.images = [...(last.images || []), event.content]
          } else if (event.type === 'streamlit') {
            last.parts = [...(last.parts || []), { type: 'streamlit', content: event.content }]
          } else if (event.type === 'code') {
            last.codeSteps = [...(last.codeSteps || []), { code: event.content, progressLines: [] }]
          } else if (event.type === 'output') {
            const steps = [...(last.codeSteps || [])]
            if (steps.length > 0) steps[steps.length - 1] = { ...steps[steps.length - 1], output: event.content }
            last.codeSteps = steps
          } else if (event.type === 'progress') {
            const steps = [...(last.codeSteps || [])]
            if (steps.length > 0) {
              const lastStep = steps[steps.length - 1]
              if (!lastStep.output) {
                steps[steps.length - 1] = { ...lastStep, progressLines: [...(lastStep.progressLines || []), event.content] }
              }
            }
            last.codeSteps = steps
          } else if (event.type === 'plan') {
            last.parts = [{ type: 'plan', content: event.content }, ...(last.parts || [])]
          } else if (event.type === 'task_start') {
            last.parts = [...(last.parts || []), { type: 'task_start', content: event.content, index: event.index, total: event.total, agent: event.agent }]
            last._breakText = true
          } else if (event.type === 'agent_label') {
            last.parts = [...(last.parts || []), { type: 'agent_label', content: event.content }]
            last._breakText = true
          } else if (event.type === 'critic') {
            last.parts = [...(last.parts || []), { type: 'critic', judgment: event.judgment, feedback: event.feedback, additional_tasks: event.additional_tasks }]
          } else if (event.type === 'insight') {
            last.parts = [...(last.parts || []), { type: 'insight', content: event.content }]
            last.content = (last.content || '') + event.content
          } else if (event.type === 'automl_train_start') {
            last.parts = [...(last.parts || []), { type: 'automl_train', dataset: event.dataset, target: event.target, problem_type: event.problem_type, progressLines: [], done: false }]
          } else if (event.type === 'automl_progress') {
            const parts = [...(last.parts || [])]
            const idx = [...parts].map((p,i) => p.type === 'automl_train' ? i : -1).filter(i => i >= 0).pop()
            if (idx !== undefined) {
              parts[idx] = { ...parts[idx], progressLines: [...(parts[idx].progressLines || []), event.content] }
            }
            last.parts = parts
          } else if (event.type === 'automl_train_done') {
            const parts = [...(last.parts || [])]
            const idx = [...parts].map((p,i) => p.type === 'automl_train' ? i : -1).filter(i => i >= 0).pop()
            if (idx !== undefined) {
              parts[idx] = { ...parts[idx], done: true, result: event }
            }
            last.parts = parts
          }
          updated[updated.length - 1] = last
          return updated
        })
      }
    }
    return localAccContent
  }

  const handleStopGeneration = () => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }

  const streamFromEndpoint = async (body, userLabel) => {
    if (loading) return
    const priorMessages = messages
    let currentSessionId = sessionId
    let accContent = ''
    const accParts = []
    const accCodeSteps = []
    const accImages = []

    const ac = new AbortController()
    abortRef.current = ac
    userScrolledUpRef.current = false
    setShowScrollBtn(false)

    const userMsg = { role: 'user', content: userLabel }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)

    const aiMsg = { role: 'assistant', content: '', parts: [], images: [], codeSteps: [] }
    setMessages((prev) => [...prev, aiMsg])

    try {
      const token = localStorage.getItem('token')

      const startRes = await fetch('/chat/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...body, session_id: currentSessionId }),
      })
      if (!startRes.ok) throw new Error('Gagal memulai job')
      const { job_id, session_id: assignedSessionId } = await startRes.json()

      if (!currentSessionId) {
        currentSessionId = assignedSessionId
        setSessionId(assignedSessionId)
      }

      const response = await fetch(`/chat/events/${job_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      accContent = await processEventStream(response, accContent, accParts, accCodeSteps, accImages, ac.signal)
    } catch (err) {
      const errContent = err?.name === 'AbortError'
        ? 'Generasi dihentikan oleh pengguna.'
        : 'Terjadi kesalahan saat memproses permintaan Anda.'
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: errContent, parts: [{ type: 'error', content: errContent }], images: [], codeSteps: [] }
        return updated
      })
    } finally {
      abortRef.current = null
      setLoading(false)
      setStatusText('')

      const toSave = [
        ...priorMessages.map(m => ({
          role: m.role,
          content: m.content || '',
          parts: m.parts || [],
          codeSteps: m.codeSteps || [],
          images: m.images || [],
        })),
        { role: 'user', content: userLabel, parts: [{ type: 'text', content: userLabel }], codeSteps: [], images: [] },
        { role: 'assistant', content: accContent, parts: accParts, codeSteps: accCodeSteps, images: accImages },
      ]
      const firstUser = toSave.find(m => m.role === 'user')
      if (firstUser && accContent) {
        try {
          await api.post(`/history/${projectId}/save`, {
            session_id: currentSessionId,
            title: firstUser.content.slice(0, 80),
            messages: toSave,
          })
        } catch { }
      }

      setFileRefreshTrigger(t => t + 1)
      inputRef.current?.focus()
    }
  }

  const handleNewChat = () => {
    if (loading) return
    setMessages([])
    setSessionId(null)
  }

  const handleLoadHistory = (sid, msgs) => {
    if (loading) return
    setMessages(msgs.map(m => ({
      ...m,
      parts: m.parts?.length
        ? m.parts
        : (m.role === 'assistant' && m.content ? [{ type: 'text', content: m.content }] : []),
      images: m.images || [],
      codeSteps: m.codeSteps || [],
    })))
    setSessionId(sid)
  }

  const handleExportPDF = () => {
    const printWin = window.open('', '_blank')
    if (!printWin) return

    const renderMessage = (m) => {
      if (m.role === 'user') {
        return `<div class="msg user-msg">
          <div class="role-label user-label">Pengguna</div>
          <div class="body">${escHtml(m.content || '')}</div>
        </div>`
      }

      const parts = m.parts?.length
        ? m.parts
        : (m.content ? [{ type: 'text', content: m.content }] : [])
      const steps = m.codeSteps || []

      let html = '<div class="msg ai-msg"><div class="role-label ai-label">AI Analyst</div><div class="body">'

      for (const part of parts) {
        if (part.type === 'text' && part.content) {
          html += markdownToHtml(part.content)
        } else if (part.type === 'plan' && Array.isArray(part.content)) {
          const planItems = part.content.map(t => typeof t === 'string' ? t : (t?.task || String(t)))
          html += `<div class="plan-box"><strong>Rencana Eksekusi</strong><ol>${planItems.map(t => `<li>${escHtml(t)}</li>`).join('')}</ol></div>`
        } else if (part.type === 'task_start') {
          const idx = (part.index ?? 0) + 1
          const agentBadge = part.agent ? ` <span class="agent-badge ${part.agent}">${part.agent}</span>` : ''
          html += `<h4 class="task-header">Langkah ${idx}/${part.total ?? '?'} — ${escHtml(part.content)}${agentBadge}</h4>`
        } else if (part.type === 'agent_label') {
          html += `<div class="agent-label-badge">${escHtml(part.content)} Agent</div>`
        } else if (part.type === 'insight') {
          html += `<div class="insight-box"><div class="insight-header">Insight &amp; Summary</div><div>${markdownToHtml(part.content)}</div></div>`
        } else if (part.type === 'image' && part.content) {
          html += `<div class="chart-wrap"><img src="data:image/png;base64,${part.content}" alt="grafik"/></div>`
        }
      }

      for (const step of steps) {
        if (step.code) {
          html += `<div class="code-block"><pre>${escHtml(step.code)}</pre></div>`
        }
        if (step.output) {
          html += `<div class="output-block"><pre>${escHtml(step.output)}</pre></div>`
        }
      }

      html += '</div></div>'
      return html
    }

    const markdownToHtml = (text) => {
      let h = escHtml(text)
      h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>')
      h = h.replace(/^## (.+)$/gm, '<h2>$1</h2>')
      h = h.replace(/^# (.+)$/gm, '<h1>$1</h1>')
      h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      h = h.replace(/\*(.+?)\*/g, '<em>$1</em>')
      h = h.replace(/`([^`]+)`/g, '<code>$1</code>')
      h = h.replace(/((?:^- .+\n?)+)/gm, (block) => {
        const items = block.trim().split('\n').map(l => `<li>${l.replace(/^- /, '')}</li>`).join('')
        return `<ul>${items}</ul>`
      })
      h = h.replace(/((?:^\d+\. .+\n?)+)/gm, (block) => {
        const items = block.trim().split('\n').map(l => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('')
        return `<ol>${items}</ol>`
      })
      h = h.split(/\n{2,}/).map(p => p.startsWith('<') ? p : `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('\n')
      return h
    }

    const escHtml = (str) => String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    const bodyHtml = messages.map(renderMessage).join('\n')
    const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

    printWin.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8"/>
<title>Laporan Analisis</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 13px; line-height: 1.7; color: #1a1a1a; background: #fff; max-width: 820px; margin: 0 auto; padding: 32px 24px; }
  h1.report-title { font-size: 20px; font-weight: 700; color: #1e1e2e; border-bottom: 2px solid #6366f1; padding-bottom: 8px; margin-bottom: 4px; }
  p.meta { color: #888; font-size: 11px; margin-bottom: 28px; }
  .msg { margin-bottom: 20px; padding: 14px 16px; border-radius: 8px; page-break-inside: avoid; }
  .user-msg { background: #f5f5ff; border-left: 3px solid #6366f1; }
  .ai-msg { background: #f4faf7; border-left: 3px solid #10b981; }
  .role-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 8px; }
  .user-label { color: #6366f1; }
  .ai-label { color: #10b981; }
  .body h1, .body h2, .body h3 { margin: 12px 0 6px; font-weight: 600; }
  .body h1 { font-size: 16px; } .body h2 { font-size: 14px; } .body h3 { font-size: 13px; }
  .body p { margin-bottom: 8px; }
  .body ul, .body ol { padding-left: 20px; margin-bottom: 8px; }
  .body li { margin-bottom: 3px; }
  .body strong { font-weight: 600; }
  .body em { font-style: italic; }
  .body code { background: #eef; color: #5046e5; padding: 1px 5px; border-radius: 3px; font-family: monospace; font-size: 12px; }
  .code-block { background: #1e1e2e; color: #a6e3a1; border-radius: 6px; margin: 10px 0; padding: 12px 14px; font-family: 'Cascadia Code', 'Consolas', monospace; font-size: 11.5px; overflow: hidden; page-break-inside: avoid; }
  .code-block pre { white-space: pre-wrap; word-break: break-all; }
  .output-block { background: #fafafa; border: 1px solid #e0e0e0; border-radius: 6px; margin: 4px 0 10px; padding: 10px 14px; font-family: monospace; font-size: 11px; color: #444; overflow: hidden; page-break-inside: avoid; }
  .output-block pre { white-space: pre-wrap; word-break: break-all; }
  .chart-wrap { margin: 12px 0; text-align: center; page-break-inside: avoid; }
  .chart-wrap img { max-width: 100%; border-radius: 6px; border: 1px solid #e0e0e0; }
  .plan-box { background: #f5f0ff; border-left: 3px solid #8b5cf6; border-radius: 6px; padding: 10px 14px; margin: 8px 0; }
  .plan-box strong { color: #6d28d9; font-size: 12px; display: block; margin-bottom: 6px; }
  .plan-box ol { padding-left: 18px; } .plan-box li { font-size: 12px; color: #4c1d95; margin-bottom: 3px; }
  h4.task-header { font-size: 12px; color: #7c3aed; margin: 10px 0 4px; }
  .agent-label-badge { font-size: 10px; font-weight: 600; color: #6d28d9; background: #f5f0ff; border-radius: 99px; padding: 2px 8px; display: inline-block; margin: 8px 0 4px; text-transform: uppercase; letter-spacing: 0.05em; }
  .agent-badge { font-size: 9px; font-weight: 600; border-radius: 4px; padding: 1px 5px; vertical-align: middle; }
  .agent-badge.retrieval { background: #e0f2fe; color: #0369a1; }
  .agent-badge.analysis { background: #fef3c7; color: #92400e; }
  .insight-box { background: #f0fdf4; border-left: 3px solid #22c55e; border-radius: 6px; padding: 10px 14px; margin: 8px 0; }
  .insight-header { font-size: 11px; font-weight: 600; color: #15803d; margin-bottom: 6px; }
  @media print {
    body { padding: 16px; font-size: 12px; }
    .code-block { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .chart-wrap img { max-width: 90%; }
  }
</style>
</head>
<body>
<h1 class="report-title">Laporan Analisis Data</h1>
<p class="meta">Dibuat oleh ${username} &nbsp;·&nbsp; ${dateStr}</p>
${bodyHtml}
<script>setTimeout(() => { window.print() }, 600)<\/script>
</body>
</html>`)
    printWin.document.close()
  }

  const { theme, toggleTheme } = useTheme()

  return (
    <div className="flex h-screen bg-[var(--bg-page)] text-[var(--text-primary)] transition-colors duration-200">
      <Sidebar
        projectId={projectId}
        onSuggest={(q) => sendMessage(q)}
        onLoadHistory={handleLoadHistory}
        refreshTrigger={fileRefreshTrigger}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        width={sidebarWidth}
      />
      {/* Resizer only on desktop */}
      <div
        className="hidden md:block w-1 cursor-col-resize bg-transparent hover:bg-sky-500/40 transition-colors"
        onMouseDown={(e) => {
          e.preventDefault()
          resizingRef.current = true
        }}
      />

      <div className="flex flex-col flex-1 min-w-0 relative">
        {/* Header */}
        <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-[var(--border-light)] bg-[var(--bg-header)] backdrop-blur-sm animate-slide-in-bottom">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] md:hidden border border-[var(--border-primary)] rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            {projectName && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[var(--text-secondary)] truncate max-w-[200px]" title={projectName}>
                  {projectName}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--bg-secondary)] text-[var(--text-muted)] font-medium">
                  {sessionId ? 'Sesi aktif' : 'Chat baru'}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            {/* New Chat */}
            <button
              onClick={handleNewChat}
              disabled={loading}
              className="text-xs text-[var(--text-muted)] hover:text-sky-300 border border-[var(--border-primary)] rounded-lg px-2.5 md:px-3 py-1.5 hover:border-sky-500/30 transition-all duration-200 flex items-center gap-1.5 disabled:opacity-40"
              title="Chat Baru"
            >
              <svg className="w-4 h-4 md:w-3.5 md:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              <span className="hidden sm:inline">Baru</span>
            </button>
            {/* Export PDF */}
            {messages.length > 0 && !loading && (
              <button
                onClick={handleExportPDF}
                className="text-xs text-[var(--text-muted)] hover:text-green-300 border border-[var(--border-primary)] rounded-lg px-2.5 md:px-3 py-1.5 hover:border-green-500/30 transition-all duration-200 flex items-center gap-1.5"
                title="Export PDF"
              >
                <svg className="w-4 h-4 md:w-3.5 md:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <span className="hidden sm:inline">Export</span>
              </button>
            )}
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="text-xs text-[var(--text-muted)] hover:text-sky-300 border border-[var(--border-primary)] rounded-lg px-3 py-1.5 hover:border-sky-500/30 transition-all duration-200 flex items-center gap-1.5"
              title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            >
              {theme === 'dark' ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
            </button>
            <span className="text-[var(--text-muted)] text-sm hidden lg:inline">{username}</span>
            <button
              onClick={onLogout}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border-primary)] rounded-lg px-3 py-1.5 hover:border-[var(--border-primary)] transition-all duration-200"
            >
              Keluar
            </button>
          </div>
        </header>

        {/* Messages Area */}
        <div
          ref={scrollAreaRef}
          onScroll={handleScrollArea}
          className="flex-1 overflow-y-auto px-4 py-8 space-y-4"
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in-scale">
              <div className="mb-4">
                <h2 className="text-4xl font-bold tracking-tight text-[var(--text-heading)]">Analis<span className="text-sky-400">ai</span></h2>
              </div>
              <p className="text-sm text-[var(--text-secondary)] max-w-md mb-8">Upload dataset melalui sidebar, lalu ajukan pertanyaan tentang data Anda. Sistem akan menganalisis dan memberikan insight secara otomatis.</p>
              <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
                {QUICK_PROMPTS.map((qp) => (
                  <button
                    key={qp.label}
                    onClick={() => sendMessage(qp.prompt)}
                    className="flex items-start gap-3 text-left p-3.5 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-tertiary)] hover:border-sky-500/40 hover:bg-[var(--bg-secondary)] transition-all duration-200 group"
                  >
                    <span className="text-lg shrink-0 mt-0.5">{qp.icon}</span>
                    <span className="text-xs text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors leading-relaxed">{qp.label}</span>
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

        {/* Scroll to bottom FAB */}
        {showScrollBtn && messages.length > 0 && (
          <div className="absolute bottom-36 left-1/2 -translate-x-1/2 z-20">
            <button
              onClick={() => {
                userScrolledUpRef.current = false
                setShowScrollBtn(false)
                bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] shadow-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-200"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
              Terbaru
            </button>
          </div>
        )}

        {/* Input Area */}
        <div className="px-4 pb-6 pt-4 bg-gradient-to-t from-[var(--bg-page)] to-transparent relative z-10">
          <div className="max-w-3xl mx-auto relative group">
            <div className="flex bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-[1.25rem] shadow-sm focus-within:ring-2 focus-within:ring-sky-500/20 focus-within:border-sky-500/50 transition-all duration-300 items-end overflow-hidden pb-1">
              <textarea
                ref={inputRef}
                rows={1}
                className="flex-1 bg-transparent text-[var(--text-primary)] px-5 py-3.5 resize-none outline-none text-sm placeholder-[var(--text-muted)] min-h-[52px] max-h-40 leading-relaxed scrollbar-thin"
                placeholder="Tanyakan sesuatu tentang data Anda..."
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
                }}
                onKeyDown={handleKeyDown}
                disabled={loading}
                style={{ height: '52px' }}
              />
              <div className="pr-2 pb-1.5 shrink-0 flex items-center justify-center gap-1.5">
                {loading && (
                  <button
                    onClick={handleStopGeneration}
                    className="flex items-center justify-center w-[34px] h-[34px] rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all duration-200"
                    title="Hentikan"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                  </button>
                )}
                <button
                  onClick={() => {
                    sendMessage(input);
                    if (inputRef.current) inputRef.current.style.height = '52px';
                  }}
                  disabled={loading || !input.trim()}
                  className={`flex items-center justify-center w-[34px] h-[34px] rounded-xl transition-all duration-200 ${loading
                      ? 'text-sky-400 bg-transparent'
                      : input.trim()
                        ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20 hover:bg-sky-400 hover:-translate-y-0.5'
                        : 'bg-[var(--border-light)] text-[var(--text-muted)] cursor-not-allowed opacity-60'
                    }`}
                >
                  {loading ? (
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19V5m0 0l-6 6m6-6l6 6" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
          <div className="max-w-3xl mx-auto text-center mt-2.5">
            <span className="text-[11px] text-[var(--text-muted)] font-medium">Bantu kami berkembang — periksa kembali hasil analisis AI.</span>
          </div>
        </div>
      </div>
    </div>
  )
}
