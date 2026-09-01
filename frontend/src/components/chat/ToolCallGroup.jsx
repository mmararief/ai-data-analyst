import { useState, useEffect, useRef } from 'react'
import ToolCallStep from './ToolCallStep'

// Deduplicate steps: skip identical task names or duplicate code executions
function dedupeSteps(steps) {
  const seen = new Set()
  return steps.filter(s => {
    if (s.type === 'task_start') {
      const key = `task:${s.content || ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    } else {
      const key = `code:${(s.code || '').trim()}`
      if (!key) return true
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }
  })
}

export default function ToolCallGroup({ steps, projectId, isLoading, selectedIndex, onSelectStep }) {
  const containerRef = useRef(null)

  // Auto-scroll the steps container to the bottom as new steps appear
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [steps.length])

  if (steps.length === 0) return null

  const deduped = dedupeSteps(steps)

  return (
    <div className="my-3 select-none w-full">
      <div
        ref={containerRef}
        className="flex flex-col gap-0.5 w-full"
      >
        {deduped.map((step, i) => {
          if (step.type === 'task_start') {
            return (
              <div
                key={i}
                className="flex items-center gap-3 py-1.5 px-2 text-[12.5px] text-[var(--text-secondary)] font-medium select-text"
              >
                <span className="w-4 h-4 flex items-center justify-center font-bold text-[var(--text-muted)] select-none text-[16px]">•</span>
                <span className="truncate">{step.content}</span>
              </div>
            )
          } else {
            const isDone = !!step.output
            const isRunning = isLoading && i === deduped.length - 1 && !step.output
            return (
              <ToolCallStep
                key={i}
                step={step}
                index={step.globalIndex}
                isRunning={isRunning}
                isSelected={selectedIndex === step.globalIndex}
                onSelect={() => onSelectStep && onSelectStep(step.globalIndex)}
              />
            )
          }
        })}
      </div>
    </div>
  )
}

