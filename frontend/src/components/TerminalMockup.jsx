import { useState } from 'react'

const tabContents = {
  planner: [
    { type: 'comment', text: '# pertanyaan pengguna' },
    { type: 'key', text: 'question' }, { type: 'op', text: ' = ' }, { type: 'str', text: '"prediksi churn pada customers.csv"' },
    { type: '', text: '\u00A0' },
    { type: 'comment', text: '# planner agent' },
    { type: 'fn', text: 'plan' }, { type: 'op', text: ' = [' },
    { type: '', text: '\u00A0 ' }, { type: 'op', text: '{' }, { type: 'key', text: '"task"' }, { type: 'op', text: ': ' }, { type: 'str', text: '"profiling dataset"' }, { type: 'op', text: ', ' }, { type: 'key', text: '"phase"' }, { type: 'op', text: ': ' }, { type: 'val', text: '0' }, { type: 'op', text: '},' },
    { type: '', text: '\u00A0 ' }, { type: 'op', text: '{' }, { type: 'key', text: '"task"' }, { type: 'op', text: ': ' }, { type: 'str', text: '"analisis distribusi"' }, { type: 'op', text: ', ' }, { type: 'key', text: '"phase"' }, { type: 'op', text: ': ' }, { type: 'val', text: '1' }, { type: 'op', text: '},' },
    { type: 'op', text: ']' },
  ],
  executor: [
    { type: 'comment', text: '# executor running phase 1' },
    { type: 'key', text: 'tasks' }, { type: 'op', text: ' = ' }, { type: 'fn', text: 'run_phase_parallel' }, { type: 'op', text: '(generators)' },
    { type: '', text: '\u00A0' },
    { type: 'comment', text: '# tool calls' },
    { type: 'fn', text: 'python_repl_tool' }, { type: 'op', text: '(' },
    { type: '', text: '\u00A0 ' }, { type: 'str', text: '"import pandas as pd"' }, { type: 'op', text: ',' },
    { type: '', text: '\u00A0 ' }, { type: 'str', text: '"df = pd.read_csv(\'customers.csv\')"' }, { type: 'op', text: ',' },
    { type: '', text: '\u00A0 ' }, { type: 'str', text: '"df.describe()"' },
    { type: 'op', text: ')' },
    { type: '', text: '\u00A0' },
    { type: 'key', text: 'rows' }, { type: 'op', text: '    = ' }, { type: 'val', text: '10,423' },
    { type: 'key', text: 'columns' }, { type: 'op', text: ' = ' }, { type: 'val', text: '12' },
  ],
  critic: [
    { type: 'comment', text: '# critic agent evaluation' },
    { type: 'fn', text: 'judgment' }, { type: 'op', text: ' = ' }, { type: 'fn', text: 'run_critic_agent' }, { type: 'op', text: '(' },
    { type: '', text: '\u00A0 ' }, { type: 'key', text: 'question' }, { type: 'op', text: ',' }, { type: 'key', text: 'execution_output' },
    { type: 'op', text: ')' },
    { type: '', text: '\u00A0' },
    { type: 'comment', text: '# result' },
    { type: 'key', text: 'judgment' }, { type: 'op', text: ' = ' }, { type: 'val', text: '"ok"' },
    { type: 'key', text: 'feedback' }, { type: 'op', text: ' = ' }, { type: 'str', text: '"analisis sudah lengkap"' },
    { type: 'key', text: 'additional_tasks' }, { type: 'op', text: ' = ' }, { type: 'op', text: '[]' },
    { type: '', text: '\u00A0' },
    { type: 'comment', text: '# pipeline selesai ✓' },
  ]
}

const styles = {
  comment: 'text-[#475569]',
  key: 'text-[#38bdf8]',
  val: 'text-[#86efac]',
  str: 'text-[#fde68a]',
  fn: 'text-[#c084fc]',
  op: 'text-[#94a3b8]',
}

export default function TerminalMockup() {
  const [activeTab, setActiveTab] = useState('planner')

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
      <div className="bg-slate-900 px-5 py-3.5 flex items-center gap-2 border-b border-slate-800">
        <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
        <span className="ml-2 font-mono text-[11px] text-[#64748b] tracking-wider uppercase">analisai · pipeline · live</span>
      </div>
      <div className="flex border-b border-slate-800 bg-slate-950">
        {Object.keys(tabContents).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 font-mono text-[11px] border-r border-slate-800 transition-colors uppercase tracking-widest ${
              activeTab === tab ? 'text-sky-400 bg-sky-900/10' : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="p-6 font-mono text-[13px] leading-relaxed min-h-[340px]">
        {tabContents[activeTab].map((line, i) => (
          <div key={i}>
            {!line.type ? (
              <span dangerouslySetInnerHTML={{ __html: line.text }} />
            ) : (
              <span className={styles[line.type]}>{line.text}</span>
            )}
          </div>
        ))}
        <div className="mt-1">
          <span className="inline-block w-2 h-3.5 bg-sky-400 align-bottom animate-pulse"></span>
        </div>
      </div>
    </div>
  )
}
