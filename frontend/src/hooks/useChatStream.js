// useChatStream owns all the streaming-chat state (messages, loading,
// abort controller, status text) plus the SSE event loop and the
// `start job → stream events` orchestration.
//
// PERFORMANCE NOTE — re-render batching:
//   The previous implementation called setMessages(prev => ...) for *every*
//   SSE event. With long streams (hundreds of token events) this caused a
//   re-render storm. We now keep the live message array in a ref, mutate it
//   immutably in-place, and flush to React state once per animation frame.
//   The visible behavior is unchanged but render count drops by ~10–20×.

import { useCallback, useEffect, useRef, useState } from 'react'
import api from '../api'
import {
  applyEventToLastMessage,
  hydrateMessages,
  makeAssistantPlaceholder,
  makeUserMessage,
  nextUid,
  statusForEvent,
} from '../utils/messageHelpers'

export function useChatStream({ projectId, sessionId, setSessionId }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [fileRefreshTrigger, setFileRefreshTrigger] = useState(0)

  // Refs that don't trigger re-renders.
  const messagesRef = useRef(messages)
  const flushScheduledRef = useRef(false)
  const abortRef = useRef(null)

  // Keep ref in sync when external setMessages calls happen (history load etc).
  useEffect(() => { messagesRef.current = messages }, [messages])

  // Schedule a single React state flush per animation frame.
  const scheduleFlush = useCallback(() => {
    if (flushScheduledRef.current) return
    flushScheduledRef.current = true
    requestAnimationFrame(() => {
      flushScheduledRef.current = false
      setMessages(messagesRef.current)
    })
  }, [])

  // Mutator helper: takes (prev) => next, updates the ref + schedules flush.
  const updateMessages = useCallback((mutator) => {
    const next = mutator(messagesRef.current)
    messagesRef.current = next
    scheduleFlush()
  }, [scheduleFlush])

  // Direct setter for cases where we want the change to be visible immediately
  // (history load, new chat, error replacement). Keeps the ref in sync.
  const replaceMessages = useCallback((next) => {
    const arr = typeof next === 'function' ? next(messagesRef.current) : next
    messagesRef.current = arr
    setMessages(arr)
  }, [])

  // ── SSE processing ────────────────────────────────────────────────────────
  const processEventStream = useCallback(async (response, signal) => {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const accumulated = { content: '', parts: [], codeSteps: [], images: [] }

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
        let event
        try {
          event = JSON.parse(line.slice(6))
        } catch (parseErr) {
          // A single malformed SSE line must not kill the stream.
          console.warn('Skipping malformed SSE line:', parseErr?.message || parseErr, line.slice(0, 200))
          continue
        }
        if (!event || typeof event !== 'object' || !event.type) continue

        // Status text update (cheap).
        const nextStatus = statusForEvent(event)
        if (nextStatus !== null) setStatusText(nextStatus)

        // Mirror the change into both the live messages and the local
        // `accumulated` snapshot used for the final history-save call.
        applyEventToAccumulator(accumulated, event)
        updateMessages(prev => applyEventToLastMessage(prev, event))
      }
    }
    return accumulated
  }, [updateMessages])

  // ── Main entry: start a job and stream its events ────────────────────────
  const streamFromEndpoint = useCallback(async (body, userLabel) => {
    if (loading) return
    const priorMessages = messagesRef.current
    let currentSessionId = sessionId
    const ac = new AbortController()
    abortRef.current = ac

    replaceMessages([
      ...priorMessages,
      makeUserMessage(userLabel),
      makeAssistantPlaceholder(),
    ])
    setLoading(true)

    let accumulated = { content: '', parts: [], codeSteps: [], images: [] }
    try {
      const token = localStorage.getItem('token')
      const startRes = await fetch('/chat/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mode: 'full', ...body,
          session_id: currentSessionId,
        }),
        signal: ac.signal,
      })
      if (!startRes.ok) throw new Error('Gagal memulai job')
      const { job_id, session_id: assignedSessionId } = await startRes.json()
      if (!currentSessionId) {
        currentSessionId = assignedSessionId
        setSessionId(assignedSessionId)
      }
      const response = await fetch(`/chat/events/${job_id}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: ac.signal,
      })
      accumulated = await processEventStream(response, ac.signal)
    } catch (err) {
      const errContent = err?.name === 'AbortError'
        ? 'Generasi dihentikan.'
        : 'Terjadi kesalahan saat memproses permintaan.'
      replaceMessages(prev => {
        const out = prev.slice()
        out[out.length - 1] = {
          uid: out[out.length - 1]?.uid || nextUid(),
          role: 'assistant',
          content: errContent,
          parts: [{ type: 'error', content: errContent }],
          images: [],
          codeSteps: [],
        }
        return out
      })
    } finally {
      abortRef.current = null
      setLoading(false)
      setStatusText('')
      // Persist to history
      const toSave = [
        ...priorMessages.map(m => ({
          role: m.role, content: m.content || '',
          parts: m.parts || [], codeSteps: m.codeSteps || [], images: m.images || [],
        })),
        { role: 'user', content: userLabel, parts: [{ type: 'text', content: userLabel }], codeSteps: [], images: [] },
        {
          role: 'assistant',
          content: accumulated.content,
          parts: accumulated.parts,
          codeSteps: accumulated.codeSteps,
          images: accumulated.images,
        },
      ]
      const firstUser = toSave.find(m => m.role === 'user')
      if (firstUser && accumulated.content) {
        try {
          await api.post(`/history/${projectId}/save`, {
            session_id: currentSessionId,
            title: firstUser.content.slice(0, 80),
            messages: toSave,
          })
        } catch { /* best effort */ }
      }
      setFileRefreshTrigger(t => t + 1)
    }
  }, [loading, sessionId, setSessionId, projectId, replaceMessages, processEventStream])

  const handleStopGeneration = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [])

  // ── Higher-level send helpers exposed to ChatPage ────────────────────────
  const buildHistory = useCallback(() => {
    return messagesRef.current
      .filter(m => m.content && m.content.trim())
      .map(m => ({ role: m.role, content: m.content }))
  }, [])

  const sendMessage = useCallback((question) => {
    if (!question?.trim() || loading) return
    streamFromEndpoint(
      { question, history: buildHistory(), project_id: projectId, mode: 'plan_only' },
      question,
    )
  }, [loading, buildHistory, projectId, streamFromEndpoint])

  const approvePlan = useCallback((plan) => {
    if (loading) return
    streamFromEndpoint(
      {
        question: 'Jalankan rencana eksekusi.',
        history: buildHistory(),
        project_id: projectId,
        mode: 'execute_only',
        approved_plan: plan,
      },
      'Setuju, jalankan rencana tersebut.',
    )
  }, [loading, buildHistory, projectId, streamFromEndpoint])

  const selectOption = useCallback((optionText) => {
    if (loading) return
    streamFromEndpoint(
      { question: optionText, history: buildHistory(), project_id: projectId, mode: 'plan_only' },
      optionText,
    )
  }, [loading, buildHistory, projectId, streamFromEndpoint])

  const submitClarification = useCallback(({ summary }) => {
    if (loading || !summary) return
    const userLabel = `Klarifikasi:\n${summary}`
    streamFromEndpoint(
      { question: userLabel, history: buildHistory(), project_id: projectId, mode: 'full' },
      userLabel,
    )
  }, [loading, buildHistory, projectId, streamFromEndpoint])

  // ── Imperative state setters for parent (history load / new chat / resume) ─
  const loadMessages = useCallback((rawMessages) => {
    replaceMessages(hydrateMessages(rawMessages))
  }, [replaceMessages])

  const clearMessages = useCallback(() => {
    if (loading) return
    replaceMessages([])
  }, [loading, replaceMessages])

  // For active-job resume: the parent already knows the question + job_id, we
  // just need to seed the placeholder messages and pump events through the
  // existing accumulator/flush machinery.
  const resumeActiveJob = useCallback(async ({ jobId, question, token }) => {
    setLoading(true)
    setStatusText('Menyambungkan ulang...')
    replaceMessages(prev => [
      ...prev,
      makeUserMessage(question),
      makeAssistantPlaceholder(),
    ])
    try {
      const response = await fetch(`/chat/events/${jobId}?from_idx=0`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      await processEventStream(response, null)
    } catch { /* swallow — connection drop is expected on stale jobs */ } finally {
      setLoading(false)
      setStatusText('')
    }
  }, [replaceMessages, processEventStream])

  return {
    // state
    messages, loading, statusText, fileRefreshTrigger,
    // setters / actions
    sendMessage, approvePlan, selectOption, submitClarification,
    handleStopGeneration, loadMessages, clearMessages, resumeActiveJob,
  }
}

// ── helper kept private to this module ──────────────────────────────────────
// Mirrors applyEventToLastMessage but mutates the supplied accumulator object
// in-place, since the accumulator is throw-away local state in a single
// stream call (no React diffing concerns).
function applyEventToAccumulator(acc, event) {
  switch (event.type) {
    case 'error':
      acc.parts.push({ type: 'error', content: event.content })
      acc.content += event.content
      break
    case 'text': {
      acc.content += event.content
      const last = acc.parts[acc.parts.length - 1]
      if (last?.type === 'text' && !acc._breakText) {
        last.content += event.content
      } else {
        acc.parts.push({ type: 'text', content: event.content })
        acc._breakText = false
      }
      break
    }
    case 'image':
      acc.parts.push({ type: 'image', content: event.content, filename: event.filename || '' })
      acc.images.push(event.content)
      break
    case 'code':
      acc.codeSteps.push({
        code: event.content, output: '', progressLines: [],
        tool: event.tool || 'python_repl_tool', filename: event.filename || '',
      })
      acc.parts.push({ type: 'code_step', stepIndex: acc.codeSteps.length - 1 })
      break
    case 'output':
      if (acc.codeSteps.length) acc.codeSteps[acc.codeSteps.length - 1].output = event.content
      break
    case 'plan':
      acc.parts.unshift({ type: 'plan', content: event.content })
      break
    case 'task_start':
      acc.parts.push({
        type: 'task_start', content: event.content,
        index: event.index, total: event.total, agent: event.agent,
      })
      acc._breakText = true
      break
    case 'agent_label':
      acc.parts.push({ type: 'agent_label', content: event.content })
      break
    case 'clarification':
      acc.parts.push({
        type: 'clarification',
        questions: event.questions,
        question: event.question,
        options: event.options,
        intent: event.intent,
        reasoning: event.reasoning,
      })
      break
    case 'critic':
      acc.parts.push({
        type: 'critic',
        judgment: event.judgment,
        feedback: event.feedback,
        additional_tasks: event.additional_tasks,
      })
      break
    case 'insight':
      acc.content += event.content
      acc.parts.push({ type: 'insight', content: event.content })
      break
    case 'file_export_done':
      acc.parts.push({
        type: 'file_export', filename: event.filename,
        format: event.format, size_bytes: event.size_bytes, error: event.error,
      })
      break
    default:
      break
  }
}
