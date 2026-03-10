import { useState, useEffect, useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import Logo from '../components/Logo'
import { useTheme } from '../ThemeContext'

function RevealSection({ children, className = '', delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, delay: delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export default function HomePage({ onStart }) {
  const { theme, toggleTheme } = useTheme()
  const containerRef = useRef(null)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  })

  const { scrollY } = useScroll()

  // Parallax effects
  const heroY = useTransform(scrollY, [0, 500], [0, 200])
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0])

  const branchesY = useTransform(scrollY, [0, 500], [0, -100])

  const featuresY = useTransform(scrollY, [500, 1000], [100, -50])

  return (
    <div ref={containerRef} className="min-h-screen bg-[var(--bg-page)] text-[var(--text-secondary)] selection:bg-sky-500/30 font-sans overflow-x-hidden transition-colors duration-200">

      {/* Navbar Minimalist */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
        className="absolute top-0 w-full z-50 transition-all"
      >
        <div className="max-w-[1400px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo className="w-8 h-8 rounded-lg" iconSize="w-4 h-4" />
            <span className="font-bold text-xl tracking-tight text-[var(--text-heading)]">Analisai</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[var(--text-secondary)]">
            <a href="#features" className="hover:text-[var(--text-heading)] transition-colors">Fitur Unggulan</a>
            <a href="#demo" className="hover:text-[var(--text-heading)] transition-colors">Cara Kerja</a>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={onStart}
              className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-heading)] transition-colors"
            >
              Log in
            </button>
            <button
              onClick={toggleTheme}
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text-heading)] transition-colors p-2 rounded-md"
              title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            >
              {theme === 'dark' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
            </button>
            <button
              onClick={onStart}
              className="text-sm font-medium bg-sky-600 text-white px-5 py-2.5 rounded-md hover:bg-sky-500 transition-colors"
            >
              Mulai Gratis
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Parallax Background Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div
          animate={{
            x: [0, 50, 0],
            y: [0, 30, 0],
            scale: [1, 1.1, 1]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] bg-sky-600/5 rounded-full blur-[120px]"
        />
        <motion.div
          animate={{
            x: [0, -40, 0],
            y: [0, 60, 0],
            scale: [1, 1.2, 1]
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[20%] -right-[10%] w-[50%] h-[50%] bg-indigo-600/5 rounded-full blur-[120px]"
        />
      </div>

      {/* Hero Section */}
      <main className="relative z-10 pt-32 md:pt-48 pb-20 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <motion.div
            style={{ y: heroY, opacity: 0.5 }}
            className="absolute -top-[300px] -right-[300px] w-[800px] h-[800px] bg-sky-500/10 rounded-full blur-[120px]"
          />
          <motion.div
            style={{ y: useTransform(scrollY, [0, 500], [0, 100]), opacity: 0.3 }}
            className="absolute top-[200px] -left-[200px] w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[100px]"
          />
        </div>

        <section className="max-w-[1000px] mx-auto px-6 text-center relative z-10">
          <motion.div style={{ y: heroY, opacity: heroOpacity }}>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="text-5xl md:text-7xl lg:text-[80px] font-semibold tracking-tight mb-8 leading-[1.1] text-[var(--text-heading)]"
            >
              Data Analyst AI yang <span className="text-glow-blue relative inline-block">
                memukau
                <motion.svg
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ delay: 0.8, duration: 1 }}
                  className="absolute -bottom-2 left-0 w-full h-3 text-sky-500"
                  viewBox="0 0 100 10"
                  preserveAspectRatio="none"
                >
                  <path d="M0 5 Q 50 10 100 5" fill="none" stroke="currentColor" strokeWidth="2" />
                </motion.svg>
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              className="text-lg md:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-10 leading-relaxed"
            >
              Eksplorasi, visualisasi, hingga machine learning. Cukup gunakan bahasa natural, biarkan AI menyusun rencana dan mengeksekusi kode Python secara otomatis di background.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-24"
            >
              <button
                onClick={onStart}
                className="h-12 flex items-center justify-center px-8 rounded-md bg-sky-600 text-white font-medium text-base hover:bg-sky-500 transition-all hover:scale-105 shadow-lg shadow-sky-600/20"
              >
                Mulai Analisis
              </button>
              <button
                onClick={onStart}
                className="h-12 flex items-center justify-center px-8 rounded-md border border-[var(--border-primary)] bg-transparent text-[var(--text-heading)] font-medium text-base hover:bg-[var(--bg-hover)] transition-all hover:scale-105"
              >
                Lihat Demo
              </button>
            </motion.div>
          </motion.div>

          {/* Glowing Branches Graphic like LangChain */}
          <motion.div
            style={{ y: branchesY }}
            className="relative w-full max-w-4xl mx-auto h-[200px] flex justify-between items-start"
          >
            {/* The nodes */}
            <div className="relative z-10 flex justify-between w-full px-12 md:px-24 text-sm font-mono text-slate-400">
              {['Upload', 'Analisis', 'Visualisasi', 'Prediksi'].map((text, i) => (
                <motion.div
                  key={text}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + (i * 0.1) }}
                  className="bg-[var(--bg-page)] px-4 py-1.5 rounded-full border border-sky-500/30 text-sky-500 z-10 shadow-lg shadow-sky-500/10"
                >
                  {text}
                </motion.div>
              ))}
            </div>

            {/* SVG Connecting Lines - Branches down to a central point */}
            <svg className="absolute inset-0 w-full h-[300px] pointer-events-none" viewBox="0 0 1000 300" preserveAspectRatio="none">
              <defs>
                <linearGradient id="line-glow" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                  <stop offset="60%" stopColor="#38bdf8" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
                </linearGradient>
                <filter id="glow-blur" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="8" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <g className="branch-path" stroke="url(#line-glow)" strokeWidth="1.5" fill="none" filter="url(#glow-blur)">
                {/* Node 1 to Center */}
                <motion.path
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.5, delay: 0.5, ease: "easeInOut" }}
                  d="M 150 15 C 150 120, 500 80, 500 300"
                />
                <motion.path
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.5, delay: 0.6, ease: "easeInOut" }}
                  d="M 383 15 C 383 120, 500 80, 500 300"
                />
                <motion.path
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.5, delay: 0.7, ease: "easeInOut" }}
                  d="M 616 15 C 616 120, 500 80, 500 300"
                />
                <motion.path
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.5, delay: 0.8, ease: "easeInOut" }}
                  d="M 850 15 C 850 120, 500 80, 500 300"
                />
              </g>
              {/* Core solid lines without blur for sharpness */}
              <g className="branch-path" stroke="url(#line-glow)" strokeWidth="1" fill="none">
                <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 0.5 }} d="M 150 15 C 150 120, 500 80, 500 300" />
                <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 0.6 }} d="M 383 15 C 383 120, 500 80, 500 300" />
                <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 0.7 }} d="M 616 15 C 616 120, 500 80, 500 300" />
                <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 0.8 }} d="M 850 15 C 850 120, 500 80, 500 300" />
              </g>
            </svg>
          </motion.div>
        </section>
      </main>

      <div className="h-px w-full bg-linear-to-r from-transparent via-[var(--border-primary)] to-transparent"></div>

      {/* Feature Left-Right Section (Like LangChain Observability) */}
      <section id="features" className="py-32 relative overflow-hidden">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">

            {/* Left: Text Content */}
            <div className="flex-1 lg:max-w-lg z-10">
              <RevealSection>
                <div className="inline-flex items-center gap-3 text-sky-400 font-mono text-sm mb-6 bg-sky-950/30 px-3 py-1.5 rounded-md border border-sky-900/50">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  Deep Analysis
                </div>

                <h2 className="text-4xl md:text-5xl font-semibold mb-6 text-[var(--text-heading)] leading-tight">
                  Selesaikan analisis kompleks dalam hitungan detik
                </h2>

                <p className="text-[var(--text-secondary)] text-lg mb-8 leading-relaxed">
                  Ilmu data tidak harus rumit dan memakan waktu. Mulai dari pembersihan data, visualisasi, hingga pembuatan model ML, Analisai memecah tugas Anda menjadi rencana yang terstruktur. Biarkan AI Agent kami mengeksekusi kode Python untuk Anda.
                </p>

                <ul className="space-y-4 mb-10 text-[var(--text-secondary)]">
                  {['Pro Mode dengan Planner Agent & Executor Agent (LangGraph)',
                    'Laporan yang berlimpah: PDF Render, Jupyter Notebook, & Chart Interaktif',
                    'Asynchronous background job yang tahan terhadap refresh halaman'
                  ].map((item, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1, duration: 0.5 }}
                      className="flex items-start gap-3"
                    >
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0"></span>
                      <span>{item}</span>
                    </motion.li>
                  ))}
                </ul>

                <button
                  onClick={onStart}
                  className="group flex items-center justify-between gap-4 w-full sm:w-auto px-6 py-4 rounded-lg bg-[var(--bg-card)] border border-[var(--border-primary)] hover:border-sky-500/50 hover:bg-[var(--bg-hover)] transition-all text-[var(--text-heading)] font-medium"
                >
                  Explore Features
                  <svg className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </RevealSection>
            </div>

            {/* Right: Code/UI Mockup */}
            <motion.div
              style={{ y: featuresY }}
              className="flex-1 w-full bg-[var(--bg-tertiary)] rounded-2xl border border-[var(--border-primary)] p-2 shadow-2xl relative overflow-hidden z-0"
            >
              {/* Header mock */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-primary)]">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[var(--text-muted)]/30"></div>
                  <div className="w-3 h-3 rounded-full bg-[var(--text-muted)]/30"></div>
                  <div className="w-3 h-3 rounded-full bg-[var(--text-muted)]/30"></div>
                </div>
                <div className="ml-4 px-3 py-1 rounded bg-[var(--bg-sidebar)] text-xs text-[var(--text-muted)] font-mono border border-[var(--border-primary)]">
                  Trace &#x2022; Workspace
                </div>
              </div>

              {/* Body mock */}
              <div className="h-[400px] flex">
                {/* Sidebar Mock */}
                <div className="w-1/3 border-r border-slate-800 p-4 font-mono text-xs flex flex-col gap-3 text-slate-500">
                  <div className="flex items-center text-slate-300 gap-2">
                    <span className="text-sky-400">⚡</span> Data Agent
                    <span className="ml-auto text-[10px] bg-sky-900/40 text-sky-300 px-1 rounded">12.4s</span>
                  </div>
                  <div className="pl-4 flex flex-col gap-3 border-l hover:border-slate-600 border-slate-800 ml-1.5 mt-1">
                    <div className="text-slate-400">&gt; buat_rencana_analisis <span className="text-emerald-500 text-[10px]">✔</span></div>
                    <div className="text-slate-400">&gt; bersihkan_nilai_kosong <span className="text-emerald-500 text-[10px]">✔</span></div>
                    <div className="text-sky-300 bg-sky-900/20 py-1 -ml-4 pl-4 border-l-2 border-sky-500">&gt; render_grafik_korelasi</div>
                    <div className="text-slate-500">&gt; buat_model_prediksi</div>
                  </div>
                </div>

                {/* Content Mock */}
                <div className="flex-1 bg-[#050812] p-5 font-mono text-xs flex flex-col relative">
                  <div className="absolute top-0 right-0 w-[400px] h-[300px] bg-sky-500/5 blur-[120px] rounded-full pointer-events-none"></div>
                  <div className="text-slate-400 mb-2">Input</div>
                  <div className="bg-[#0f172a] p-3 rounded border border-slate-800 text-slate-300 mb-4 whitespace-pre">
                    <span className="text-sky-400">Dataset</span>: employee_data.csv
                    <br /><span className="text-sky-400">Goal</span>: Predict churn
                  </div>

                  <div className="text-slate-400 mb-2 mt-2">Output</div>
                  <div className="bg-[#0f172a] p-3 rounded border border-slate-800 text-slate-300 flex-1 whitespace-pre-wrap overflow-hidden">
                    <span className="text-emerald-400">Results generated successfully.</span>
                    <br /><br />
                    <span className="text-slate-500">import matplotlib.pyplot as plt</span>
                    <br />
                    <span className="text-slate-500">df.plot(kind='bar', x='Department', y='Churn')</span>
                    <br />
                    <span className="text-fuchsia-400">[[CHART_FILE]]/app/data/_chart.png</span>
                    <div className="mt-3 w-full h-16 bg-slate-800/50 rounded flex items-end p-2 gap-1 opacity-80">
                      <motion.div
                        initial={{ height: "0%" }}
                        whileInView={{ height: "40%" }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="w-4 bg-sky-500/60 rounded-t-sm"
                      ></motion.div>
                      <motion.div
                        initial={{ height: "0%" }}
                        whileInView={{ height: "70%" }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="w-4 bg-sky-500/60 rounded-t-sm"
                      ></motion.div>
                      <motion.div
                        initial={{ height: "0%" }}
                        whileInView={{ height: "30%" }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                        className="w-4 bg-sky-500/60 rounded-t-sm"
                      ></motion.div>
                      <motion.div
                        initial={{ height: "0%" }}
                        whileInView={{ height: "90%" }}
                        transition={{ duration: 0.5, delay: 0.5 }}
                        className="w-4 bg-sky-500/60 rounded-t-sm"
                      ></motion.div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* How it Works / Architecture */}
      <section id="demo" className="py-24 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)]">
        <div className="max-w-[1400px] mx-auto px-6">
          <RevealSection className="text-center mb-16">
            <div className="inline-flex items-center justify-center gap-2 text-sky-400 font-mono text-sm mb-4">
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>
              Under the Hood
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold mb-4 text-[var(--text-heading)]">How Analisai Works</h2>
            <p className="text-[var(--text-secondary)] max-w-xl mx-auto">Kami menghubungkan instruksi bahasa natural Anda ke dalam environment komputasi Python yang terisolasi dan aman.</p>
          </RevealSection>

          <div className="relative">
            {/* Horizontal connecting line (Desktop only) */}
            <div className="hidden md:block absolute top-[20%] left-[10%] right-[10%] h-px bg-linear-to-r from-sky-900/0 via-sky-500/30 to-sky-900/0" />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative z-10">
              {[
                { step: '1', title: 'Upload & Chat', desc: 'Unggah file data Anda (CSV/Excel) dengan aman dan tanyakan apa yang ingin Anda analisis.', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
                { step: '2', title: 'Agent Planning', desc: 'Metode Pro Mode memecah instruksi menggunakan LangGraph menjadi tahapan kode Python yang presisi.', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
                { step: '3', title: 'Secure Sandbox', desc: 'Kode dieksekusi secara otomatis dalam container Docker berstatus offline demi privasi penuh.', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
                { step: '4', title: 'Rich Output', desc: 'Hasil Streamlit, grafik matplotlib, dan file PDF dikirim secara real-time kembali ke antarmuka Anda.', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' }
              ].map((s, i) => (
                <RevealSection key={i} delay={i * 0.15} className="bg-[var(--bg-card)] border border-[var(--border-primary)] p-8 rounded-2xl flex flex-col items-center text-center hover:border-sky-500/30 transition-colors shadow-[var(--shadow-lg)] h-full">
                  <div className="w-14 h-14 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-sky-400 flex items-center justify-center mb-6 relative group">
                    <div className="absolute inset-0 bg-sky-400/20 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <svg className="w-6 h-6 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={s.icon} /></svg>
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 mb-3 tracking-widest">STEP {s.step}</div>
                  <h3 className="text-lg font-medium text-[var(--text-primary)] mb-3">{s.title}</h3>
                  <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{s.desc}</p>
                </RevealSection>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Grid Features */}
      <section className="py-24 border-t border-[var(--border-primary)]">
        <div className="max-w-[1400px] mx-auto px-6">
          <RevealSection className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold mb-4">Complete toolset for data teams</h2>
            <p className="text-[var(--text-secondary)] max-w-xl mx-auto">Build, observe, evaluate, and deploy models directly from plain text instructions.</p>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { t: 'Pro Mode & Planning', d: 'AI Agent cerdas berbasis LangGraph yang merencanakan tugas kompleks menjadi tahapan terstruktur sebelum mengeksekusi kode.' },
              { t: 'Secure Docker Sandbox', d: 'Seluruh eksekusi kode berjalan aman dalam container terisolasi, lengkap dengan integrasi MinIO Object Storage.' },
              { t: 'High-Fidelity Exports', d: 'Ekspor hasil chat, grafik, dan tabel secara sempurna ke dokumen PDF atau file Jupyter Notebook (.ipynb).' },
              { t: 'Resilient Job Streaming', d: 'Proses AI tetap berjalan di latar belakang. Anda dapat me-refresh halaman kapan pun tanpa takut kehilangan proses.' },
              { t: 'Interactive Dashboards', d: 'Otomatis temukan insight dan konversi data Anda menjadi aplikasi web dashboard interaktif dengan seketika.' },
              { t: 'Multi-format Data Support', d: 'Dukungan luas untuk file CSV, Excel, JSON, Parquet, Pickle, dan format data tabular populer lainnya.' }
            ].map((f, i) => (
              <RevealSection key={i} delay={i * 0.1}>
                <motion.div
                  whileHover={{ y: -5 }}
                  className="card-hover-glow bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-6 h-full flex flex-col items-start text-left cursor-default shadow-[var(--shadow-sm)]"
                >
                  <div className="w-10 h-10 rounded-lg bg-sky-900/30 border border-sky-500/20 flex items-center justify-center mb-5 text-sky-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h3 className="text-lg font-medium text-[var(--text-heading)] mb-2">{f.t}</h3>
                  <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{f.d}</p>
                </motion.div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border-primary)] bg-[var(--bg-secondary)] py-12 px-6">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-between text-sm text-[var(--text-muted)] gap-4">
          <div className="flex items-center gap-2">
            <Logo className="w-5 h-5 rounded" iconSize="w-3 h-3" />
            <span className="font-semibold text-[var(--text-secondary)]">Analisai</span>
          </div>
          <p>© {new Date().getFullYear()} Analisai Platform. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
