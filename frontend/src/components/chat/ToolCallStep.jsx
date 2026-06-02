import { useState, useRef, useEffect } from 'react'

// SVG Icons matching Kimi design
const DOC_ICON = (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
  </svg>
)

const TERMINAL_ICON = (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
  </svg>
)

const NOTEBOOK_EDIT_ICON = (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
  </svg>
)

const CODE_ICON = (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
  </svg>
)

const DOWNLOAD_ICON = (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
)

function SpinIcon() {
  return (
    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  )
}

function formatStepLabel(step) {
  const tool = step.tool || 'python_repl_tool'
  const code = step.code || ''
  
  if (tool === 'read_data_tool') {
    const match = code.match(/read_data_tool\(['"]([^'"]+)['"]/);
    const fname = match ? match[1] : (step.filename || 'dataset')
    return `Read ${fname}`
  }
  if (tool === 'download_dataset_tool') {
    const matchFname = code.match(/filename=['"]([^'"]+)['"]/);
    const matchUrl = code.match(/url=['"]([^'"]+)['"]/);
    const fname = matchFname && matchFname[1] ? matchFname[1] : '';
    const url = matchUrl && matchUrl[1] ? matchUrl[1] : '';
    return fname ? `Download ${fname}` : (url ? `Download dari internet` : 'Download dataset');
  }
  if (tool === 'bash_tool') {
    if (code.includes('head')) {
      return 'Execute Terminal | Preview CSV file structure'
    }
    if (code.includes('todo') || code.includes('TODO')) {
      return 'Write Todo'
    }
    const cleanCmd = code.replace(/^\$\s*/, '').trim()
    return `Execute Terminal | ${cleanCmd.slice(0, 30)}`
  }
  if (tool === 'render_chart_tool') {
    return 'Membuat Chart'
  }
  if (tool === 'data_profile_tool') {
    return 'Profiling Dataset'
  }
  return 'Execute Python code'
}

function getStepIcon(step, label) {
  const tool = step.tool || 'python_repl_tool'
  if (label.startsWith('Read')) {
    return { icon: DOC_ICON, color: 'text-sky-400' }
  }
  if (label.startsWith('Download')) {
    return { icon: DOWNLOAD_ICON, color: 'text-emerald-400' }
  }
  if (label === 'Write Todo') {
    return { icon: NOTEBOOK_EDIT_ICON, color: 'text-amber-400' }
  }
  if (tool === 'bash_tool') {
    return { icon: TERMINAL_ICON, color: 'text-pink-400' }
  }
  return { icon: CODE_ICON, color: 'text-blue-400' }
}

export default function ToolCallStep({ step, index, isRunning, isSelected, onSelect }) {
  const label = formatStepLabel(step)
  const { icon, color } = getStepIcon(step, label)

  return (
    <button
      onClick={() => onSelect(index)}
      className={`group flex items-center gap-3.5 w-full text-left py-2.5 px-3.5 rounded-xl transition-all border shadow-sm cursor-pointer ${
        isSelected 
          ? 'bg-[var(--bg-hover)] border-[var(--text-accent)] text-[var(--text-primary)] font-semibold shadow-md' 
          : 'bg-[var(--bg-secondary)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-primary)]'
      }`}
    >
      <div className={`w-4.5 h-4.5 shrink-0 flex items-center justify-center ${color}`}>
        {isRunning ? <SpinIcon /> : icon}
      </div>

      <div className="flex-1 min-w-0">
        <span className="text-[12.5px] leading-relaxed truncate block">
          {label}
        </span>
      </div>

      <span className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors shrink-0">
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </button>
  )
}
