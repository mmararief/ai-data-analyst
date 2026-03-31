import { motion } from 'framer-motion'

const models = [
  { rank: '01', name: 'LightGBM', score: '0.934', weight: 93, isGold: true },
  { rank: '02', name: 'XGBoost', score: '0.891', weight: 89 },
  { rank: '03', name: 'GradientBoosting', score: '0.862', weight: 86 },
  { rank: '04', name: 'RandomForest', score: '0.814', weight: 81 },
  { rank: '05', name: 'LogisticRegression', score: '0.731', weight: 73, isLast: true },
]

export default function ModelLeaderboard() {
  return (
    <div className="bg-[#060916] border border-white/5 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <span className="font-mono text-[11px] tracking-widest text-[#64748b] uppercase">Model Leaderboard</span>
        <span className="font-mono text-[10px] bg-sky-400/10 text-[#38bdf8] px-2 py-0.5 rounded border border-sky-400/20 tracking-wider">CLASSIFICATION</span>
      </div>
      <div className="p-0">
        {models.map((m, i) => (
          <div 
            key={m.name} 
            className={`flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors border-white/5 ${i < models.length - 1 ? 'border-b' : ''}`}
          >
            <span className={`font-mono text-[11px] w-5 ${m.isGold ? 'text-amber-400' : 'text-[#64748b]'}`}>{m.rank}</span>
            <span className="text-[14px] font-semibold text-[#e2e8f0] flex-1">{m.name}</span>
            <div className="flex-[1.5] h-1 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${m.weight}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, ease: "easeOut", delay: 0.1 * i }}
                className={`h-full rounded-full ${m.isLast ? 'bg-slate-600' : 'bg-gradient-to-r from-[#38bdf8] to-[#818cf8]'}`}
              />
            </div>
            <span className="font-mono text-[13px] text-[#94a3b8] w-12 text-right">{m.score}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
