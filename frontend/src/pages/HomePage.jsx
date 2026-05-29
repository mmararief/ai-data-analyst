import { motion, useScroll, useTransform } from 'framer-motion'
import Logo from '../components/Logo'
import TerminalMockup from '../components/TerminalMockup'
import ModelLeaderboard from '../components/ModelLeaderboard'

function RevealSection({ children, className = '', delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay: delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function PipelineNode({ icon, label, delay }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.5 }}
        whileHover={{ y: -2, backgroundColor: 'rgba(255,255,255,0.1)' }}
        className="w-11 h-11 rounded-xl flex items-center justify-center bg-white/[0.04] border border-white/10 text-sky-400 transition-all duration-300"
      >
        {icon}
      </motion.div>
      <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider uppercase text-center w-24">{label}</span>
    </div>
  )
}

export default function HomePage({ onStart }) {
  const { scrollY } = useScroll()

  // Parallax for the pipeline section
  const pipelineY = useTransform(scrollY, [0, 400], [0, 60])
  const pipelineOpacity = useTransform(scrollY, [0, 400], [1, 0])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-sky-500/30 overflow-x-hidden">
      {/* Clean Background */}

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-[100] px-8 py-5 flex items-center justify-between bg-slate-950/90 backdrop-blur-md border-b border-white/5 animate-slide-in-bottom">
        <div className="flex items-center gap-2.5 font-bold text-lg tracking-tight text-white">
          <div className="w-7 h-7 bg-sky-600 rounded-lg flex items-center justify-center text-[13px]">A</div>
          Analisai
        </div>
        <ul className="hidden md:flex gap-8 text-[13px] font-medium text-[#64748b]">
          <li><a href="#features" className="hover:text-[#94a3b8] transition-colors tracking-widest uppercase">Fitur</a></li>
          <li><a href="#how" className="hover:text-[#94a3b8] transition-colors tracking-widest uppercase">Cara Kerja</a></li>
          <li><a href="#models" className="hover:text-[#94a3b8] transition-colors tracking-widest uppercase">Model</a></li>
          <li><a href="#architecture" className="hover:text-[#94a3b8] transition-colors tracking-widest uppercase">Arsitektur</a></li>
        </ul>
        <div className="flex items-center gap-3">
          <button className="text-[13px] font-medium text-[#64748b] hover:text-white transition-colors px-4 py-2">Masuk</button>
          <button 
            className="bg-sky-600 text-white px-5 py-2.5 rounded-lg text-[13px] font-semibold hover:bg-sky-500 transition-all duration-200"
          >
            Mulai Gratis
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section id="hero" className="relative z-10 min-h-screen flex flex-col items-center justify-center pt-32 px-6 text-center">
        <RevealSection delay={0.2} className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full bg-sky-900/30 border border-sky-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
          <span className="font-mono text-[11px] font-medium tracking-widest text-sky-400 uppercase">Powered by LangGraph · 3-Agent Pipeline</span>
        </RevealSection>

        <motion.h1 
          className="text-[clamp(2.5rem,7vw,5.5rem)] font-extrabold leading-[1.05] tracking-tight text-white mb-6"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          Data Analyst AI<br />
          yang <span className="text-sky-400">Kuat & Akurat</span>
        </motion.h1>

        <motion.p 
          className="text-[1.1rem] leading-[1.7] text-[#64748b] max-w-[600px] mx-auto mb-10"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45 }}
        >
          Eksplorasi, visualisasi, hingga machine learning. Cukup gunakan bahasa natural — biarkan AI menyusun rencana dan mengeksekusi kode Python secara otomatis.
        </motion.p>

        <motion.div 
          className="flex flex-wrap gap-4 items-center justify-center mb-16"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.55 }}
        >
          <button 
            onClick={onStart}
            className="h-[52px] px-8 bg-sky-600 rounded-xl text-white font-bold text-[15px] flex items-center gap-2 hover:bg-sky-500 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            Mulai Analisis
          </button>
          <button 
            onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })}
            className="h-[52px] px-8 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 font-semibold text-[15px] flex items-center gap-2 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Lihat Demo
          </button>
        </motion.div>

        {/* Pipeline viz */}
        <motion.div 
          style={{ y: pipelineY, opacity: pipelineOpacity }}
          className="w-full max-w-[900px] mb-8"
        >
          <div className="flex justify-between px-16 mb-[-18px] relative z-20">
            <PipelineNode delay={0.7} label="upload" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>} />
            <PipelineNode delay={0.8} label="analisis" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>} />
            <PipelineNode delay={0.9} label="visualisasi" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"/></svg>} />
            <PipelineNode delay={1.0} label="insight" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>} />
          </div>

          <div className="relative h-[120px]">
            <svg viewBox="0 0 900 120" preserveAspectRatio="none" className="w-full h-full">
              <defs>
                <linearGradient id="lg1" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8"/>
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0"/>
                </linearGradient>
                <filter id="glow-f">
                  <feGaussianBlur stdDeviation="3" result="b"/>
                  <feComposite in="SourceGraphic" in2="b" operator="over"/>
                </filter>
              </defs>
              <g stroke="url(#lg1)" strokeWidth="1.5" fill="none">
                <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.8, duration: 1.0 }} d="M127 0 C127 60 450 40 450 120"/>
                <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.9, duration: 1.0 }} d="M342 0 C342 60 450 40 450 120"/>
                <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.0, duration: 1.0 }} d="M558 0 C558 60 450 40 450 120"/>
                <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.1, duration: 1.0 }} d="M773 0 C773 60 450 40 450 120"/>
              </g>
              <motion.circle 
                cx="450" cy="118" r="4" fill="#38bdf8"
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.5, duration: 0.2 }}
              />
            </svg>
          </div>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-12 mt-8 animate-fade-in">
          {[
            { val: 'Auto', accent: 'EDA', label: 'pipeline' },
            { val: '3', accent: '-agent', label: 'pipeline' },
            { val: 'Docker', accent: '✓', label: 'isolated sandbox' },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-[1.4rem] font-bold text-[#f0f9ff] tracking-tight">
                {stat.val}<span className="text-[#38bdf8]">{stat.accent}</span>
              </div>
              <div className="font-mono text-[11px] text-[#64748b] tracking-widest uppercase">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-white/5 to-transparent relative z-10"></div>

      {/* FEATURES */}
      <section id="features" className="relative z-10 py-32 px-6">
        <div className="max-w-[1200px] mx-auto">
          <RevealSection className="text-center mb-20">
            <div className="font-mono text-[11px] tracking-[0.15em] text-[#38bdf8] uppercase flex items-center justify-center gap-4 mb-4">
              Fitur Unggulan
              <span className="w-5 h-px bg-[#38bdf8]"></span>
            </div>
            <h2 className="text-[clamp(2rem,4vw,3.2rem)] font-extrabold tracking-tight text-[#f0f9ff] leading-[1.1] mb-6">
              Perangkat lengkap<br />untuk tim data
            </h2>
            <p className="text-[1rem] text-[#64748b] leading-[1.7] max-w-[520px] mx-auto">
              Dari eksplorasi data hingga deployment model — semua dalam satu pipeline terintegrasi.
            </p>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 bg-white/5 border border-white/5 rounded-3xl overflow-hidden gap-px">
            {[
              { icon: 'planner', title: 'Planner + Executor Agent', desc: 'Pipeline 3-agent berbasis LangGraph: Planner menyusun rencana, Executor menjalankan kode paralel per fase, Critic mengevaluasi hasil secara otomatis.' },
              { icon: 'shield', title: 'Sandbox Docker Terisolasi', desc: 'Seluruh eksekusi kode Python berjalan dalam container Docker offline. Data Anda tidak pernah meninggalkan environment terisolasi.' },
              { icon: 'chart', title: 'Visualisasi Otomatis', desc: 'Grafik distribusi, korelasi, heatmap, dan chart interaktif dihasilkan otomatis dari instruksi bahasa natural menggunakan matplotlib, seaborn, dan plotly.' },
              { icon: 'sync', title: 'Streaming Job Tangguh', desc: 'Proses AI berjalan di background via Redis queue. Refresh halaman kapanpun — progres tidak hilang. Event streaming real-time ke frontend.' },
              { icon: 'storage', title: 'Multi-format & MinIO Storage', desc: 'Dukungan CSV, Excel, JSON, Parquet, Pickle. File disimpan di MinIO object storage — aman, persisten, dan dapat diakses lintas sesi.' },
            ].map((f, i) => (
              <div key={i} className="group relative bg-slate-900/50 p-10 hover:bg-slate-800/80 transition-colors duration-200">
                <div className="font-mono text-[10px] text-slate-500 tracking-widest mb-6">0{i+1} ——</div>
                <div className="w-12 h-12 rounded-xl bg-sky-900/40 border border-sky-700/50 flex items-center justify-center text-sky-400 mb-6">
                  {/* Simplistic Icon representations */}
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                </div>
                <h3 className="text-[1.1rem] font-bold text-[#f0f9ff] mb-3 tracking-tight">{f.title}</h3>
                <p className="text-[0.88rem] text-[#64748b] leading-[1.7]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-white/5 to-transparent relative z-10"></div>

      {/* HOW IT WORKS */}
      <section id="how" className="relative z-10 py-32 px-6 bg-gradient-to-b from-transparent via-[#060916] to-transparent">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
            <RevealSection>
              <div className="font-mono text-[11px] tracking-[0.15em] text-[#38bdf8] uppercase flex items-center gap-4 mb-4">
                <span className="w-5 h-px bg-[#38bdf8]"></span>
                Cara Kerja
              </div>
              <h2 className="text-[clamp(2rem,4vw,3.2rem)] font-extrabold tracking-tight text-[#f0f9ff] leading-[1.1] mb-6">
                Dari teks ke insight<br />dalam detik
              </h2>
              <p className="text-[1rem] text-[#64748b] leading-[1.7] max-w-[520px] mb-12">
                Pipeline otomatis yang mengubah pertanyaan bahasa natural menjadi analisis data yang komprehensif.
              </p>

              <div className="space-y-0">
                {[
                  { num: '01', title: 'Unggah & Tanya', desc: 'Upload file data (CSV/Excel/JSON) dan ketik pertanyaan dalam bahasa Indonesia. Tidak perlu syntax SQL atau kode apapun.' },
                  { num: '02', title: 'Planner Agent Menyusun Rencana', desc: 'LLM planner menganalisis pertanyaan dan membuat JSON task plan dengan fase paralel — seperti sprint planning tapi dalam milidetik.' },
                  { num: '03', title: 'Executor Menjalankan Kode', desc: 'Kode Python dieksekusi secara paralel per fase di sandbox Docker terisolasi. Grafik, model, dan output dikirim real-time ke browser Anda.' },
                  { num: '04', title: 'Critic Agent Mengevaluasi', desc: 'Critic memeriksa kelengkapan hasil. Jika kurang, ia membuat additional tasks untuk refinement otomatis — tanpa intervensi manual.' },
                ].map((s, i) => (
                  <div key={i} className="group flex gap-6 py-7 border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-default last:border-0 px-2">
                    <span className="font-mono text-[11px] text-[#64748b] pt-1 tracking-widest">{s.num}.</span>
                    <div>
                      <h4 className="text-[1rem] font-bold text-[#e2e8f0] mb-2 group-hover:text-[#38bdf8] transition-colors tracking-tight">{s.title}</h4>
                      <p className="text-[0.85rem] text-[#64748b] leading-[1.65]">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </RevealSection>

            <RevealSection delay={0.2}>
              <TerminalMockup />
            </RevealSection>
          </div>
        </div>
      </section>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-white/5 to-transparent relative z-10"></div>

      {/* MODELS */}
      <section id="models" className="relative z-10 py-32 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-start">
            <RevealSection>
              <div className="font-mono text-[11px] tracking-[0.15em] text-[#38bdf8] uppercase flex items-center gap-4 mb-4">
                <span className="w-5 h-px bg-[#38bdf8]"></span>
                EDA Engine
              </div>
              <h2 className="text-[clamp(2rem,4vw,3.2rem)] font-extrabold tracking-tight text-[#f0f9ff] leading-[1.1] mb-6">
                Analisis otomatis,<br />insight instan
              </h2>
              <p className="text-[1rem] text-[#64748b] leading-[1.7] mb-8">
                Pipeline EDA otomatis menganalisis distribusi, korelasi, missing values, outlier, dan menghasilkan visualisasi komprehensif.
              </p>

              <div className="space-y-3">
                {[
                  'Deteksi otomatis: tipe kolom, distribusi, dan statistik deskriptif',
                  'Visualisasi: histogram, boxplot, heatmap, pairplot otomatis',
                  'Preprocessing: handling missing values, encoding, transformasi',
                ].map((text, i) => (
                  <div key={i} className="flex items-center gap-3 p-3.5 bg-white/[0.03] border border-white/5 rounded-xl">
                    <div className="w-2 h-2 rounded-full bg-[#38bdf8] shadow-[0_0_8px_#38bdf8] shrink-0"></div>
                    <span className="text-[0.82rem] text-[#64748b]">{text}</span>
                  </div>
                ))}
              </div>
            </RevealSection>

            <RevealSection delay={0.2}>
              <ModelLeaderboard />
            </RevealSection>
          </div>
        </div>
      </section>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-white/5 to-transparent relative z-10"></div>

      {/* ARCHITECTURE */}
      <section id="architecture" className="relative z-10 py-32 px-6 bg-gradient-to-b from-transparent via-[#060916] to-transparent">
        <div className="max-w-[1200px] mx-auto">
          <RevealSection className="text-center mb-16">
            <div className="font-mono text-[11px] tracking-[0.15em] text-[#38bdf8] uppercase flex items-center justify-center gap-4 mb-4">
              <span className="w-5 h-px bg-[#38bdf8]"></span>
              Arsitektur
            </div>
            <h2 className="text-[clamp(2rem,4vw,3.2rem)] font-extrabold tracking-tight text-[#f0f9ff] leading-[1.1] mb-6">
              Pipeline yang<br />dirancang untuk skala
            </h2>
            <p className="text-[1rem] text-[#64748b] leading-[1.7] max-w-[500px] mx-auto">
              Setiap komponen terisolasi, scalable, dan dapat dikonfigurasi secara independen.
            </p>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 bg-white/5 border border-white/5 rounded-2xl overflow-hidden gap-px">
            {[
              { label: 'input layer', title: 'Classifier & Router', desc: 'LLM classifier menentukan routing: smalltalk, simple task, atau full 3-agent pipeline.', tags: ['classifier.py'] },
              { label: 'planning layer', title: 'Planner Agent', desc: 'MODEL_PLANNER menghasilkan JSON task plan dengan fase paralel. Fallback otomatis jika LLM gagal.', tags: ['pipeline.py'] },
              { label: 'execution layer', title: 'Executor + Sandbox', desc: 'Tasks dijalankan paralel per fase via threading. Python sandbox Docker terisolasi dengan timeout 300s.', tags: ['executor.py', 'sandbox.py'] },
              { label: 'evaluation layer', title: 'Critic Agent', desc: 'Evaluasi output dengan threshold metrik. Jika performa rendah, Critic menghasilkan additional tasks.', tags: ['critic.py'] },
            ].map((a, i) => (
              <div key={i} className="relative bg-[#060916] p-8 flex flex-col gap-4">
                <span className="absolute top-4 right-5 font-mono text-[10px] text-white/10 tracking-widest">0{i+1}</span>
                <span className="font-mono text-[10px] text-[#38bdf8] tracking-widest uppercase">{a.label}</span>
                <h3 className="text-[0.95rem] font-bold text-[#e2e8f0] tracking-tight">{a.title}</h3>
                <p className="text-[0.8rem] text-[#64748b] leading-[1.65] flex-1">{a.desc}</p>
                <div className="flex gap-2 flex-wrap">
                  {a.tags.map(tag => (
                    <span key={tag} className="font-mono text-[10px] text-[#38bdf8] bg-sky-400/10 px-2 py-0.5 rounded border border-sky-400/10">{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 bg-white/5 border border-white/5 rounded-xl overflow-hidden gap-px mt-4">
            {[
              { label: 'infra', val: 'Redis · MinIO · Docker · FastAPI' },
              { label: 'ml', val: 'XGBoost · LightGBM · sklearn' },
              { label: 'ai', val: 'LangGraph · LangChain · SumoPod' },
              { label: 'viz', val: 'matplotlib · Plotly · Seaborn' },
            ].map((inf, i) => (
              <div key={i} className="bg-[#0a0e1a] p-5 flex items-center gap-4">
                <span className="font-mono text-[10px] text-[#64748b]">{inf.label}</span>
                <span className="font-mono text-[11px] font-medium text-[#94a3b8]">{inf.val}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-white/5 to-transparent relative z-10"></div>

      {/* CTA */}
      <section id="cta" className="relative z-10 py-32 px-6">
        <div className="max-w-[1200px] mx-auto">
          <RevealSection className="max-w-[800px] mx-auto bg-[#060916] border border-white/5 rounded-[40px] p-12 lg:p-24 text-center relative overflow-hidden">
            <div className="absolute -top-[120px] left-1/2 -translate-x-1/2 w-[400px] h-[300px] bg-sky-400/[0.08] blur-[100px] pointer-events-none" />
            <h2 className="text-[clamp(2.5rem,5vw,3.5rem)] font-extrabold tracking-tight text-[#f0f9ff] leading-[1.1] mb-6">
              Siap menganalisis<br />data Anda?
            </h2>
            <p className="text-[1rem] text-[#64748b] leading-[1.7] mb-12 max-w-[500px] mx-auto">
              Upload file data pertama Anda dan lihat bagaimana AI Agent memecah masalah kompleks menjadi insight yang actionable dalam hitungan detik.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <button 
                onClick={onStart}
                className="h-[52px] px-8 bg-sky-600 rounded-xl text-white font-bold text-[15px] flex items-center gap-2 hover:bg-sky-500 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                Mulai Sekarang — Gratis
              </button>
              <button className="h-[52px] px-8 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 font-semibold text-[15px] flex items-center gap-2 hover:bg-slate-700 hover:text-white transition-colors">
                Lihat Dokumentasi
              </button>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-white/5 bg-[#060916] px-8 py-10">
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-[13px] text-[#64748b]">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-[#38bdf8]/10 text-[#38bdf8] flex items-center justify-center rounded font-bold text-[11px]">A</div>
            <span className="font-bold text-[#e2e8f0]">Analisai Platform</span>
            <span className="text-white/10 hidden md:block">·</span>
            <span className="hidden md:block">Dibuat oleh Muhammad Ammar Arief</span>
          </div>
          <div className="font-mono tracking-widest uppercase text-[11px]">© 2025 · ALL RIGHTS RESERVED</div>
        </div>
      </footer>
    </div>
  )
}
