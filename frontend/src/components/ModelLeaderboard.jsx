import { motion } from 'framer-motion'

const profileStats = [
  { label: 'Data Quality Score', value: '98%', weight: 98, isGold: true },
  { label: 'Missing Values', value: '0.2%', weight: 5, color: 'bg-emerald-500' },
  { label: 'Duplicate Rows', value: '0%', weight: 0, color: 'bg-emerald-500' },
  { label: 'Numeric Columns', value: '12', weight: 60, color: 'bg-sky-500' },
  { label: 'Categorical Columns', value: '4', weight: 20, color: 'bg-purple-500' },
]

export default function ModelLeaderboard() {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <span className="font-mono text-[11px] tracking-widest text-slate-500 uppercase">Data Profiling</span>
        <span className="font-mono text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700 tracking-wider">OVERVIEW</span>
      </div>
      <div className="p-0">
        {profileStats.map((stat, i) => (
          <div 
            key={stat.label} 
            className={`flex items-center gap-4 px-6 py-4 hover:bg-slate-900 transition-colors border-slate-800 ${i < profileStats.length - 1 ? 'border-b' : ''}`}
          >
            <span className="text-[14px] font-semibold text-slate-200 flex-1">{stat.label}</span>
            <div className="flex-[1.5] h-1 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${stat.weight}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1.0, ease: "easeOut", delay: 0.1 * i }}
                className={`h-full rounded-full ${stat.isGold ? 'bg-sky-400' : (stat.color || 'bg-slate-500')}`}
              />
            </div>
            <span className="font-mono text-[13px] text-slate-400 w-12 text-right">{stat.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
