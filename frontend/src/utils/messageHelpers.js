// Message helpers shared by ChatPage / useChatStream.
// Keeping these pure (no React) so they are trivially testable and reusable.

let __uidCounter = 0
function fallbackUid() {
  __uidCounter += 1
  return `m-${Date.now().toString(36)}-${__uidCounter.toString(36)}`
}

export function nextUid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return fallbackUid()
}

// Normalize a server-side message into the shape ChatPage expects.
// Older history rows may store `content` only (no `parts`).
export function hydrateMessage(m) {
  return {
    uid: m.uid || nextUid(),
    role: m.role,
    content: m.content || '',
    parts:
      m.parts?.length
        ? m.parts
        : (m.role === 'assistant' && m.content
          ? [{ type: 'text', content: m.content }]
          : []),
    images: m.images || [],
    codeSteps: m.codeSteps || [],
  }
}

export function hydrateMessages(list) {
  return (list || []).map(hydrateMessage)
}

export function makeUserMessage(content) {
  return { uid: nextUid(), role: 'user', content }
}

export function makeAssistantPlaceholder() {
  return {
    uid: nextUid(),
    role: 'assistant',
    content: '',
    parts: [],
    images: [],
    codeSteps: [],
  }
}

// Apply a single SSE event to the last assistant message immutably.
// Returns a NEW array (so React re-renders) but only allocates new objects
// for the message that actually changed.
export function applyEventToLastMessage(messages, event) {
  if (!messages.length) return messages
  const lastIdx = messages.length - 1
  const prev = messages[lastIdx]
  const next = { ...prev }

  switch (event.type) {
    case 'error': {
      const parts = [...(prev.parts || []), { type: 'error', content: event.content }]
      next.parts = parts
      next.content = (prev.content || '') + event.content
      break
    }
    case 'text': {
      const parts = [...(prev.parts || [])]
      const lastPart = parts.length ? parts[parts.length - 1] : null
      if (lastPart?.type === 'text' && !prev._breakText) {
        parts[parts.length - 1] = { type: 'text', content: lastPart.content + event.content }
      } else {
        parts.push({ type: 'text', content: event.content })
      }
      next.parts = parts
      next.content = (prev.content || '') + event.content
      next._breakText = false
      break
    }
    case 'image':
      next.parts = [...(prev.parts || []), { type: 'image', content: event.content, filename: event.filename || '' }]
      next.images = [...(prev.images || []), event.content]
      break
    case 'code': {
      const newSteps = [
        ...(prev.codeSteps || []),
        { code: event.content, progressLines: [], tool: event.tool || 'python_repl_tool', filename: event.filename || '' },
      ]
      next.codeSteps = newSteps
      next.parts = [...(prev.parts || []), { type: 'code_step', stepIndex: newSteps.length - 1 }]
      break
    }
    case 'output': {
      const steps = [...(prev.codeSteps || [])]
      if (steps.length) steps[steps.length - 1] = { ...steps[steps.length - 1], output: event.content }
      next.codeSteps = steps
      break
    }
    case 'progress': {
      const steps = [...(prev.codeSteps || [])]
      if (steps.length) {
        const lastStep = steps[steps.length - 1]
        if (!lastStep.output) {
          steps[steps.length - 1] = {
            ...lastStep,
            progressLines: [...(lastStep.progressLines || []), event.content],
          }
        }
      }
      next.codeSteps = steps
      break
    }
    case 'plan':
      next.parts = [{ type: 'plan', content: event.content }, ...(prev.parts || [])]
      break
    case 'task_start':
      next.parts = [
        ...(prev.parts || []),
        { type: 'task_start', content: event.content, index: event.index, total: event.total, agent: event.agent },
      ]
      next._breakText = true
      break
    case 'agent_label':
      next.parts = [...(prev.parts || []), { type: 'agent_label', content: event.content }]
      next._breakText = true
      break
    case 'clarification':
      next.parts = [
        ...(prev.parts || []),
        {
          type: 'clarification',
          questions: event.questions,
          // legacy fields kept for backwards-compat with older messages
          question: event.question,
          options: event.options,
          intent: event.intent,
          reasoning: event.reasoning,
        },
      ]
      break
    case 'critic':
      next.parts = [
        ...(prev.parts || []),
        {
          type: 'critic',
          judgment: event.judgment,
          feedback: event.feedback,
          additional_tasks: event.additional_tasks,
        },
      ]
      break
    case 'insight':
      next.parts = [...(prev.parts || []), { type: 'insight', content: event.content }]
      next.content = (prev.content || '') + event.content
      break
    case 'file_export_done':
      next.parts = [
        ...(prev.parts || []),
        {
          type: 'file_export',
          filename: event.filename,
          format: event.format,
          size_bytes: event.size_bytes,
          error: event.error,
        },
      ]
      break
    default:
      // Unknown event types are ignored at the message level (status text was
      // already updated by the caller).
      return messages
  }

  const out = messages.slice()
  out[lastIdx] = next
  return out
}

// Map SSE event type to a status string for the header badge.
const AGENT_LABEL_MAP = {
  Intent: 'Memahami pertanyaan Anda...',
  Planner: 'Merencanakan...',
  Execution: 'Menjalankan...',
  Critic: 'Mengevaluasi...',
}

export function statusForEvent(event) {
  switch (event?.type) {
    case 'text': return 'Menyusun jawaban...'
    case 'code':
    case 'progress': return 'Menjalankan kode...'
    case 'output': return 'Membaca hasil eksekusi...'
    case 'image': return 'Membuat grafik...'
    case 'error': return 'Terjadi kesalahan...'
    case 'agent_label': return AGENT_LABEL_MAP[event.content] || `${event.content} Agent`
    case 'critic': return 'Evaluasi Critic Agent...'
    case 'plan': return `Merencanakan ${event.content?.length || 0} langkah...`
    case 'task_start': return `[${(event.index ?? 0) + 1}/${event.total}] ${event.content}`
    case 'file_export_start': return `📄 Mengekspor ${event.filename}...`
    case 'file_export_done': return `✅ File diekspor: ${event.filename}`
    case 'chart_start': return `📈 Membuat chart: ${event.filename}`
    default: return null
  }
}
