import { useState } from 'react'
import PartRenderer from './chat/PartRenderer'
import ToolCallGroup from './chat/ToolCallGroup'

async function generateAndDownloadNotebook(allMessages) {
  const token = localStorage.getItem('token')
  const payload = allMessages.map(m => ({
    role: m.role,
    content: m.content || '',
    parts: m.parts || [],
    codeSteps: (m.codeSteps || []).map(s => ({ code: s.code || '', output: s.output || '' })),
    images: m.images || [],
  }))
  const res = await fetch('/notebook/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ messages: payload }),
  })
  if (!res.ok) throw new Error('Gagal generate notebook')
  const notebook = await res.json()
  const blob = new Blob([JSON.stringify(notebook, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `analisis_${Date.now()}.ipynb`
  a.click()
  URL.revokeObjectURL(url)
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex gap-1.5">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      <span className="text-xs text-[var(--text-muted)]">Berfikir...</span>
    </div>
  )
}

export default function MessageBubble({ message, isLoading, statusText, allMessages, projectId, isLastMessage, onApprovePlan, onSelectOption, onSubmitClarification, computerPanelOpen, selectedStepIndex, onSelectCodeStep }) {
  const isUser = message.role === 'user'
  const isEmpty = !message.parts?.length && !message.codeSteps?.length
  const [nbLoading, setNbLoading] = useState(false)
  const [nbError, setNbError] = useState('')
  const [openInsights, setOpenInsights] = useState({})

  const toggleInsight = (index) => {
    setOpenInsights(prev => ({
      ...prev,
      [index]: !prev[index]
    }))
  }

  const handleDownloadNotebook = async () => {
    setNbLoading(true); setNbError('')
    try { await generateAndDownloadNotebook(allMessages) }
    catch { setNbError('Gagal generate, coba lagi.') }
    finally { setNbLoading(false) }
  }

  const buildOrderedParts = () => {
    let parts = message.parts || (message.content ? [{ type: 'text', content: message.content }] : [])

    const steps = message.codeSteps || []

    const nonInsightParts = parts.filter(p => p.type !== 'insight')
    const insightPart = parts.find(p => p.type === 'insight')

    const hasCodeStepRefs = nonInsightParts.some(p => p.type === 'code_step')

    const ordered = []

    if (hasCodeStepRefs) {
      let currentStepsGroup = []
      for (const part of nonInsightParts) {
        if (part.type === 'code_step' || part.type === 'task_start') {
          if (part.type === 'code_step') {
            if (steps[part.stepIndex]) {
              currentStepsGroup.push({ 
                type: 'code_step',
                ...steps[part.stepIndex], 
                globalIndex: part.stepIndex 
              })
            }
          } else {
            currentStepsGroup.push({
              type: 'task_start',
              content: part.content,
              index: part.index,
              total: part.total,
              agent: part.agent
            })
          }
        } else {
          if (currentStepsGroup.length > 0) {
            ordered.push({ type: 'steps', value: currentStepsGroup })
            currentStepsGroup = []
          }
          ordered.push({ type: 'part', value: part })
        }
      }
      if (currentStepsGroup.length > 0) {
        ordered.push({ type: 'steps', value: currentStepsGroup })
      }
    } else {
      if (steps.length === 0) {
        const legacyOrdered = nonInsightParts.map(p => ({ type: 'part', value: p }))
        if (insightPart) legacyOrdered.push({ type: 'part', value: insightPart })
        return { ordered: legacyOrdered, parts, steps: [] }
      }

      let stepIdx = 0
      let textCountSinceTask = 0

      const groupSteps = () => {
        const currentGroup = []
        while (stepIdx < steps.length) {
          currentGroup.push({ ...steps[stepIdx], globalIndex: stepIdx, type: 'code_step' })
          stepIdx++
        }
        if (currentGroup.length > 0) {
          ordered.push({ type: 'steps', value: currentGroup })
        }
      }

      for (const part of nonInsightParts) {
        ordered.push({ type: 'part', value: part })

        if (part.type === 'task_start') {
          textCountSinceTask = 0
        } else if (part.type === 'text') {
          textCountSinceTask++
          if (textCountSinceTask === 1 && stepIdx < steps.length) {
            groupSteps()
          }
        }
      }
      groupSteps()
    }

    if (insightPart) ordered.push({ type: 'part', value: insightPart })
    return { ordered, parts, steps }
  }
  const { ordered, steps } = buildOrderedParts()

  return (
    <div className="msg-appear max-w-4xl mx-auto w-full">
      {isUser ? (
        <div className="flex justify-end gap-2.5">
          <div className="bg-[var(--bg-bubble-user)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[78%]">
            <p className="text-sm leading-relaxed">{message.content}</p>
          </div>
          <div className="w-7 h-7 rounded-full bg-sky-500/15 border border-sky-500/30 flex items-center justify-center shrink-0 mt-1">
            <svg className="w-3.5 h-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          </div>
        </div>
      ) : (
        <div className="space-y-0.5">
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-[#3880ff] flex items-center justify-center shrink-0 mt-1 shadow-sm select-none">
              {/* Kimi face avatar */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="translate-y-[0.5px]">
                <ellipse cx="8" cy="12" rx="2" ry="5.5" fill="white" />
                <ellipse cx="16" cy="12" rx="2" ry="5.5" fill="white" />
              </svg>
            </div>

            <div className="flex-1 min-w-0 space-y-2 pb-1">
              {isLoading && isEmpty && (
                <div className="h-px w-full shimmer-bar rounded-full" />
              )}

              {isEmpty ? (
                <TypingIndicator />
              ) : (
                <>
                  {ordered.map((item, i) =>
                    item.type === 'part' ? (
                      <PartRenderer 
                        key={i} 
                        part={item.value} 
                        index={i} 
                        openInsights={openInsights} 
                        toggleInsight={toggleInsight} 
                        isLoading={isLoading} 
                        projectId={projectId} 
                        isLastMessage={isLastMessage}
                        onApprovePlan={onApprovePlan}
                        onSelectOption={onSelectOption}
                        onSubmitClarification={onSubmitClarification}
                      />
                    ) : (
                      <ToolCallGroup
                        key={i}
                        steps={item.value}
                        isLoading={isLoading}
                        projectId={projectId}
                        selectedIndex={selectedStepIndex}
                        onSelectStep={onSelectCodeStep}
                      />
                    )
                  )}

                  {isLoading && (
                    <div className="flex items-center gap-2 pt-0.5">
                      <div className="flex gap-1">
                        <span className="typing-dot" style={{ width: 4, height: 4 }} />
                        <span className="typing-dot" style={{ width: 4, height: 4 }} />
                        <span className="typing-dot" style={{ width: 4, height: 4 }} />
                      </div>
                      <span className="text-[11px] text-[var(--text-muted)] italic">{statusText || 'Memproses...'}</span>
                    </div>
                  )}


                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
