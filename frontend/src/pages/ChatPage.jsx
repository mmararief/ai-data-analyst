// Thin orchestrator: routing, sidebar layout, and the wiring between
// `useChatStream` (state + SSE) and the presentational chat components.

import { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api'
import Sidebar from '../components/Sidebar'
import { useTheme } from '../ThemeContext'
import ChatHeader from '../components/chat/ChatHeader'
import ChatMessageList from '../components/chat/ChatMessageList'
import ChatComposer from '../components/chat/ChatComposer'
import ComputerPanel from '../components/chat/ComputerPanel'
import TaskWidget from '../components/chat/TaskWidget'
import { useChatStream } from '../hooks/useChatStream'
import DataPreviewModal from '../components/DataPreviewModal'
import DashboardViewer from '../components/chat/DashboardViewer'

export default function ChatPage({ username, onLogout }) {
  const { projectId, sessionId: urlSessionId } = useParams()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()

  const [sessionId, setSessionId] = useState(urlSessionId || null)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(272)
  const [, setProjectName] = useState('') // currently unused in UI but fetched for future header use
  const [panelVisible, setPanelVisible] = useState(false)
  const [panelManuallyHidden, setPanelManuallyHidden] = useState(false)
  const [selectedStepIndex, setSelectedStepIndex] = useState(-1)
  const [previewFilename, setPreviewFilename] = useState(null)
  const resizingRef = useRef(false)

  const {
    messages, loading, statusText, fileRefreshTrigger,
    sendMessage, approvePlan, selectOption, submitClarification,
    handleStopGeneration, loadMessages, clearMessages, resumeActiveJob,
  } = useChatStream({ projectId, sessionId, setSessionId })

  // ── Sidebar resize via drag handle ──────────────────────────────────────
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

  // ── Project name fetch (currently consumed only by future UI) ───────────
  useEffect(() => {
    if (!projectId) return
    api.get(`/projects/${projectId}`)
      .then(res => setProjectName(res.data.name || ''))
      .catch(() => {})
  }, [projectId])

  // ── Keep URL in sync with sessionId ────────────────────────────────────
  useEffect(() => {
    if (sessionId) navigate(`/project/${projectId}/chat/${sessionId}`, { replace: true })
    else if (projectId) navigate(`/project/${projectId}`, { replace: true })
  }, [sessionId, projectId, navigate])

  // ── Initial history load when arriving with a session id ───────────────
  useEffect(() => {
    if (!urlSessionId) { setHistoryLoaded(true); return }
    api.get(`/history/${projectId}/${urlSessionId}`)
      .then(res => {
        loadMessages(res.data.messages)
        setSessionId(urlSessionId)
      })
      .catch(() => navigate(`/project/${projectId}`, { replace: true }))
      .finally(() => setHistoryLoaded(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Resume an in-flight job after page reload ──────────────────────────
  useEffect(() => {
    if (!historyLoaded || !urlSessionId) return
    const token = localStorage.getItem('token')
    if (!token) return
    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch(`/chat/session/${urlSessionId}/active-job`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (cancelled) return

        if (!data.active) {
          // Job finished while we were away → re-fetch the now-complete history.
          if (data.done) {
            try {
              const histRes = await api.get(`/history/${projectId}/${urlSessionId}`)
              if (!cancelled) loadMessages(histRes.data.messages)
            } catch { /* best effort */ }
          }
          return
        }

        setSessionId(urlSessionId)
        await resumeActiveJob({ jobId: data.job_id, question: data.question, token })
      } catch { /* best effort */ }
    })()

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyLoaded])

  // ── Sidebar callbacks ───────────────────────────────────────────────────
  const handleNewChat = () => {
    clearMessages()
    setSessionId(null)
    setPanelVisible(false)
    setPanelManuallyHidden(false)
  }

  const handleLoadHistory = (sid, msgs) => {
    if (loading) return
    loadMessages(msgs)
    setSessionId(sid)
    setPanelVisible(false)
    setPanelManuallyHidden(false)
  }

  // ── Computer panel logic ────────────────────────────────────────────────
  // Determine the last assistant message to feed into the panel.
  const lastAssistantMsg = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i]
    }
    return null
  }, [messages])

  // Has tool calls worth showing in panel?
  const hasPanelContent = useMemo(() => {
    if (!lastAssistantMsg) return false
    const parts = lastAssistantMsg.parts || []
    return parts.some(p =>
      p.type === 'code_step' || p.type === 'task_start' || p.type === 'agent_label'
    )
  }, [lastAssistantMsg])

  // Auto-show panel and select latest step when AI starts producing tool calls.
  useEffect(() => {
    if (loading && hasPanelContent) {
      if (!panelManuallyHidden) setPanelVisible(true)
      
      const codeSteps = lastAssistantMsg?.codeSteps || []
      if (codeSteps.length > 0) {
        setSelectedStepIndex(codeSteps.length - 1)
      }
    }
  }, [loading, hasPanelContent, panelManuallyHidden, lastAssistantMsg?.codeSteps?.length])

  // Reset manual-hide flag when a new message cycle starts.
  useEffect(() => {
    if (loading) setPanelManuallyHidden(false)
  }, [loading])

  const handleClosePanel = () => {
    setPanelVisible(false)
    setPanelManuallyHidden(true)
  }

  const handleTogglePanel = () => {
    if (panelVisible) {
      handleClosePanel()
    } else {
      setPanelVisible(true)
      setPanelManuallyHidden(false)
      // Select the last code step if none selected
      if (selectedStepIndex === -1 && lastAssistantMsg?.codeSteps?.length > 0) {
        setSelectedStepIndex(lastAssistantMsg.codeSteps.length - 1)
      }
    }
  }

  const handleSelectCodeStep = (index) => {
    setSelectedStepIndex(index)
    setPanelVisible(true)
    setPanelManuallyHidden(false)
  }

  // ── To-Do List widget logic ──────────────────────────────────────────────
  const [todoVisible, setTodoVisible] = useState(() => {
    try {
      const stored = localStorage.getItem('todo-widget-visible')
      return stored !== 'false'
    } catch (e) {
      return true
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('todo-widget-visible', todoVisible)
    } catch (e) {
      // ignore
    }
  }, [todoVisible])

  const todoWidgetData = lastAssistantMsg?.taskWidget
  const hasTodoWidget = !!(todoWidgetData?.tasks && todoWidgetData.tasks.length > 0)
  const todoProgress = useMemo(() => {
    if (!hasTodoWidget) return 0
    const tasks = todoWidgetData.tasks
    const completed = todoWidgetData.completed || []
    return Math.round((completed.length / tasks.length) * 100)
  }, [hasTodoWidget, todoWidgetData])

  return (
    <>
      <style>{`
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
        .send-btn:hover:not(:disabled) { transform: translateY(-1px); }
      `}</style>

      <div style={{
        display: 'flex', height: '100vh',
        background: 'var(--bg-page)',
        fontFamily: 'sans-serif',
        color: 'var(--text-primary)',
        overflow: 'hidden',
      }}>

        {/* Desktop sidebar */}
        <div
          className="hidden md:flex"
          style={{
            width: sidebarCollapsed ? 0 : (sidebarWidth || 288),
            minWidth: 0,
            overflow: 'hidden',
            flexShrink: 0,
            transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <Sidebar
            projectId={projectId}
            sessionId={sessionId}
            onSuggest={sendMessage}
            onLoadHistory={handleLoadHistory}
            onNewChat={handleNewChat}
            onToggleCollapse={() => setSidebarCollapsed(c => !c)}
            refreshTrigger={fileRefreshTrigger}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            width={sidebarWidth}
            username={username}
            theme={theme}
            onToggleTheme={toggleTheme}
            onLogout={onLogout}
            previewFilename={previewFilename}
            setPreviewFilename={setPreviewFilename}
          />
        </div>

        {/* Mobile sidebar */}
        <div className="flex md:hidden">
          <Sidebar
            projectId={projectId}
            sessionId={sessionId}
            onSuggest={sendMessage}
            onLoadHistory={handleLoadHistory}
            onNewChat={handleNewChat}
            refreshTrigger={fileRefreshTrigger}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            width={sidebarWidth}
            username={username}
            theme={theme}
            onToggleTheme={toggleTheme}
            onLogout={onLogout}
            previewFilename={previewFilename}
            setPreviewFilename={setPreviewFilename}
          />
        </div>

        {/* Resize handle (desktop only) */}
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

        {/* Workspace Column / Panel Wrapper */}
        <div style={{ flex: 1, display: 'flex', minWidth: 0, position: 'relative' }}>
          {/* Main column */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            minWidth: 0, position: 'relative',
            background: 'var(--bg-page)',
          }}>
            {hasTodoWidget && todoVisible && (
              <TaskWidget 
                tasks={todoWidgetData.tasks} 
                completed={todoWidgetData.completed || []} 
                onClose={() => setTodoVisible(false)}
              />
            )}
            {/* Subtle grid background */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              backgroundImage: `
                linear-gradient(rgba(56,189,248,0.025) 1px, transparent 1px),
                linear-gradient(90deg, rgba(56,189,248,0.025) 1px, transparent 1px)
              `,
              backgroundSize: '60px 60px',
              maskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black 20%, transparent 100%)',
            }} />

            <ChatHeader
              loading={loading}
              statusText={statusText}
              sidebarCollapsed={sidebarCollapsed}
              onExpandSidebar={() => setSidebarCollapsed(false)}
              panelVisible={panelVisible}
              hasPanelContent={hasPanelContent}
              onTogglePanel={handleTogglePanel}
              hasTodoWidget={hasTodoWidget}
              todoVisible={todoVisible}
              onToggleTodo={() => setTodoVisible(v => !v)}
              todoProgress={todoProgress}
            />

            {/* Chat messages area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <ChatMessageList
                messages={messages}
                loading={loading}
                statusText={statusText}
                username={username}
                projectId={projectId}
                onApprovePlan={approvePlan}
                onSelectOption={selectOption}
                onSubmitClarification={submitClarification}
                computerPanelOpen={panelVisible}
                selectedStepIndex={selectedStepIndex}
                onSelectCodeStep={handleSelectCodeStep}
              />
            </div>

            <ChatComposer
              loading={loading}
              showSuggestions={messages.length === 0}
              onSend={sendMessage}
              onStop={handleStopGeneration}
            />
          </div>

          {/* Computer panel (right side, full vertical height!) */}
          {panelVisible && hasPanelContent && (
            <ComputerPanel
              message={lastAssistantMsg}
              loading={loading}
              statusText={statusText}
              onClose={handleClosePanel}
              selectedStepIndex={selectedStepIndex}
            />
          )}

          {/* Overlays */}
          {previewFilename && (
            previewFilename.toLowerCase().endsWith('dashboard.json') ? (
              <DashboardViewer
                projectId={projectId}
                filename={previewFilename}
                onClose={() => setPreviewFilename(null)}
              />
            ) : (
              <DataPreviewModal
                projectId={projectId}
                filename={previewFilename}
                onClose={() => setPreviewFilename(null)}
              />
            )
          )}
        </div>
      </div>
    </>
  )
}
