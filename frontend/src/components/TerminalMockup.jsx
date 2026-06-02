import { useState } from 'react'

const tabContents = {
  agent: [
    { type: 'comment', text: '# asisten AI menganalisis kueri & merencanakan tugas' },
    { type: 'key', text: 'query' }, { type: 'op', text: ' = ' }, { type: 'str', text: '"analisis penjualan terlaris di sales.csv"' },
    { type: '', text: '\u00A0' },
    { type: 'comment', text: '# update to-do list widget' },
    { type: 'fn', text: 'update_task_list_tool' }, { type: 'op', text: '([' },
    { type: '', text: '\u00A0 ' }, { type: 'str', text: '"Inspeksi struktur data"' }, { type: 'op', text: ', ' },
    { type: '', text: '\u00A0 ' }, { type: 'str', text: '"Analisis penjualan bulanan"' },
    { type: 'op', text: '])' },
    { type: '', text: '\u00A0' },
    { type: 'comment', text: '# memanggil tool pembaca data pertama kali' },
    { type: 'fn', text: 'read_data_tool' }, { type: 'op', text: '(' }, { type: 'str', text: '"/app/data/sales.csv"' }, { type: 'op', text: ')' },
  ],
  sandbox: [
    { type: 'comment', text: '# mengeksekusi analisis di sandbox docker terisolasi' },
    { type: 'fn', text: 'python_repl_tool' }, { type: 'op', text: '(' },
    { type: '', text: '\u00A0 ' }, { type: 'str', text: '"import pandas as pd"' }, { type: 'op', text: ',' },
    { type: '', text: '\u00A0 ' }, { type: 'str', text: '"df = pd.read_csv(\'/app/data/sales.csv\')"' }, { type: 'op', text: ',' },
    { type: '', text: '\u00A0 ' }, { type: 'str', text: '"print(df.groupby(\'kategori\')[\'total\'].sum())"' },
    { type: 'op', text: ')' },
    { type: '', text: '\u00A0' },
    { type: 'comment', text: '# membuat visualisasi grafik secara aman' },
    { type: 'fn', text: 'render_chart_tool' }, { type: 'op', text: '(' },
    { type: '', text: '\u00A0 ' }, { type: 'key', text: 'chart_type' }, { type: 'op', text: '=' }, { type: 'str', text: '"bar"' }, { type: 'op', text: ',' },
    { type: '', text: '\u00A0 ' }, { type: 'key', text: 'x' }, { type: 'op', text: '=' }, { type: 'str', text: '"kategori"' },
    { type: 'op', text: ')' },
  ],
  output: [
    { type: 'comment', text: '# asisten memberikan ringkasan analisis' },
    { type: 'key', text: 'hasil_analisis' }, { type: 'op', text: ' = ' }, { type: 'str', text: '"kategori Electronics memimpin dengan total Rp 156jt (34.4%)."' },
    { type: '', text: '\u00A0' },
    { type: 'comment', text: '# pertanyaan follow-up di akhir respons' },
    { type: 'key', text: 'follow_up' }, { type: 'op', text: ' = ' }, { type: 'str', text: '"Apakah Anda ingin melihat korelasi antara harga dan kuantitas, atau membuat dashboard?"' },
    { type: '', text: '\u00A0' },
    { type: 'comment', text: '# analisis selesai dan siap disajikan ✓' },
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
  const [activeTab, setActiveTab] = useState('agent')

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
