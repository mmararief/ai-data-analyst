import { motion, useScroll, useTransform } from 'framer-motion'
import Logo from '../components/Logo'
import TerminalMockup from '../components/TerminalMockup'
import ModelLeaderboard from '../components/ModelLeaderboard'

// Distinct, on-brand icon per feature (avoids the repeated-bolt look)
const featureIcons = {
  code: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 18l6-6-6-6M8 6l-6 6 6 6" />,
  sandbox: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />,
  chart: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 3v18h18M8 17V9m4 8V6m4 11v-4" />,
  stream: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12h4l3 8 4-16 3 8h4" />,
  storage: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7c0 1.657-3.582 3-8 3S4 8.657 4 7m16 0c0-1.657-3.582-3-8-3S4 5.343 4 7m16 0v10c0 1.657-3.582 3-8 3s-8-1.343-8-3V7" />,
  dashboard: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.2" strokeWidth="1.5" />
      <rect x="13" y="4" width="7" height="4" rx="1.2" strokeWidth="1.5" />
      <rect x="13" y="11" width="7" height="9" rx="1.2" strokeWidth="1.5" />
      <rect x="4" y="14" width="7" height="6" rx="1.2" strokeWidth="1.5" />
    </>
  ),
}

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
        whileHover={{ y: -2, backgroundColor: 'var(--bg-hover)' }}
        className="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-primary)',
          color: 'var(--analisai-cyan)'
        }}
      >
        {icon}
      </motion.div>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }} className="text-[10px] tracking-wider uppercase text-center w-24">
        {label}
      </span>
    </div>
  )
}

export default function HomePage({ onStart }) {
  const { scrollY } = useScroll()

  // Parallax for the pipeline section
  const pipelineY = useTransform(scrollY, [0, 400], [0, 60])
  const pipelineOpacity = useTransform(scrollY, [0, 400], [1, 0])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-primary)' }} className="font-sans selection:bg-sky-500/30 overflow-x-hidden transition-colors duration-200">
      
      {/* NAV */}
      <nav 
        style={{ background: 'var(--bg-header)', borderBottom: '1px solid var(--border-light)' }}
        className="fixed top-0 left-0 right-0 z-[100] px-8 py-5 flex items-center justify-between backdrop-blur-md animate-slide-in-bottom transition-colors duration-200"
      >
        <div style={{ color: 'var(--text-heading)' }} className="flex items-center gap-2.5 font-bold text-lg tracking-tight">
          <div style={{ background: 'var(--analisai-cyan)', color: 'white' }} className="w-7 h-7 rounded-lg flex items-center justify-center text-[13px]">A</div>
          Analisai
        </div>
        <ul className="hidden md:flex gap-8 text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>
          <li><a href="#features" className="hover:text-blue-500 transition-colors tracking-widest uppercase">Fitur</a></li>
          <li><a href="#how" className="hover:text-blue-500 transition-colors tracking-widest uppercase">Cara Kerja</a></li>
          <li><a href="#models" className="hover:text-blue-500 transition-colors tracking-widest uppercase">Kemampuan</a></li>
          <li><a href="#architecture" className="hover:text-blue-500 transition-colors tracking-widest uppercase">Sistem</a></li>
        </ul>
        <div className="flex items-center gap-3">
          <button 
            onClick={onStart}
            style={{ color: 'var(--text-secondary)' }} 
            className="text-[13px] font-medium hover:text-blue-500 transition-colors px-4 py-2"
          >
            Masuk
          </button>
          <button 
            onClick={onStart}
            style={{ background: 'var(--analisai-cyan)', color: 'white' }}
            className="px-5 py-2.5 rounded-lg text-[13px] font-semibold hover:opacity-90 active:scale-[0.98] transition-all duration-200"
          >
            Mulai Gratis
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section id="hero" className="relative z-10 min-h-screen flex flex-col items-center justify-center pt-32 px-6 text-center">
        <RevealSection delay={0.2} className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full" style={{ background: 'var(--bg-sidebar-item)', border: '1px solid var(--border-primary)' }}>
          <span style={{ background: 'var(--analisai-cyan)' }} className="w-1.5 h-1.5 rounded-full"></span>
          <span style={{ color: 'var(--analisai-cyan)' }} className="font-mono text-[11px] font-medium tracking-widest uppercase">AI Data Analyst Workspace</span>
        </RevealSection>

        <motion.h1 
          className="text-[clamp(2.5rem,7vw,5.5rem)] font-extrabold leading-[1.05] tracking-tight mb-6"
          style={{ color: 'var(--text-heading)' }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          Rekan Analis Data Anda<br />
          yang <span style={{ color: 'var(--analisai-cyan)' }}>Cerdas & Otomatis</span>
        </motion.h1>

        <motion.p 
          className="text-[1.1rem] leading-[1.7] max-w-[600px] mx-auto mb-10"
          style={{ color: 'var(--text-secondary)' }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45 }}
        >
          Mulai dari eksplorasi, pembersihan data, hingga visualisasi interaktif. Cukup sampaikan instruksi Anda, biarkan AI kami menulis dan mengeksekusi kode Python untuk Anda.
        </motion.p>

        <motion.div 
          className="flex flex-wrap gap-4 items-center justify-center mb-16"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.55 }}
        >
          <button 
            onClick={onStart}
            style={{ background: 'var(--analisai-cyan)', color: 'white' }}
            className="h-[52px] px-8 rounded-xl font-bold text-[15px] flex items-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            Mulai Analisis
          </button>
          <button 
            onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}
            className="h-[52px] px-8 rounded-xl font-semibold text-[15px] flex items-center gap-2 hover:[border-color:var(--analisai-cyan)] hover:[color:var(--text-heading)] active:scale-[0.98] transition-all duration-200"
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
            <PipelineNode delay={0.7} label="upload dataset" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>} />
            <PipelineNode delay={0.8} label="berikan instruksi" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>} />
            <PipelineNode delay={0.9} label="ai mengeksekusi" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>} />
            <PipelineNode delay={1.0} label="dapatkan hasil" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>} />
          </div>

          <div className="relative h-[120px]">
            <svg viewBox="0 0 900 120" preserveAspectRatio="none" className="w-full h-full">
              <defs>
                <linearGradient id="lg1" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="var(--analisai-cyan)" stopOpacity="0.5"/>
                  <stop offset="100%" stopColor="var(--analisai-cyan)" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <g stroke="url(#lg1)" strokeWidth="1.5" fill="none">
                <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.8, duration: 1.0 }} d="M127 0 C127 60 450 40 450 120"/>
                <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.9, duration: 1.0 }} d="M342 0 C342 60 450 40 450 120"/>
                <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.0, duration: 1.0 }} d="M558 0 C558 60 450 40 450 120"/>
                <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.1, duration: 1.0 }} d="M773 0 C773 60 450 40 450 120"/>
              </g>
              <motion.circle 
                cx="450" cy="118" r="4" fill="var(--analisai-cyan)"
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.5, duration: 0.2 }}
              />
            </svg>
          </div>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-12 mt-8 animate-fade-in">
          {[
            { val: 'Auto', accent: 'Code', label: 'generation' },
            { val: 'Real', accent: '-time', label: 'execution' },
            { val: 'Docker', accent: '✓', label: 'isolated sandbox' },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-[1.4rem] font-bold tracking-tight" style={{ color: 'var(--text-heading)' }}>
                {stat.val}<span style={{ color: 'var(--analisai-cyan)' }}>{stat.accent}</span>
              </div>
              <div className="font-mono text-[11px] tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ height: '1px', background: 'var(--border-primary)' }} className="w-full relative z-10"></div>

      {/* FEATURES */}
      <section id="features" className="relative z-10 py-32 px-6">
        <div className="max-w-[1200px] mx-auto">
          <RevealSection className="text-center mb-20">
            <div className="font-mono text-[11px] tracking-[0.15em] uppercase flex items-center justify-center gap-4 mb-4" style={{ color: 'var(--analisai-cyan)' }}>
              Fitur Unggulan
              <span className="w-5 h-px" style={{ background: 'var(--analisai-cyan)' }}></span>
            </div>
            <h2 className="text-[clamp(2rem,4vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] mb-6" style={{ color: 'var(--text-heading)' }}>
              Perangkat cerdas<br />untuk tim data Anda
            </h2>
            <p className="text-[1rem] leading-[1.7] max-w-[520px] mx-auto" style={{ color: 'var(--text-secondary)' }}>
              Dari upload dataset hingga visualisasi interaktif — semua berjalan secara instan dalam satu platform.
            </p>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 rounded-3xl overflow-hidden gap-px" style={{ background: 'var(--border-primary)', border: '1px solid var(--border-primary)' }}>
            {[
              { icon: 'code', title: 'Eksekusi kode otomatis', desc: 'AI akan menulis kode Python secara real-time berdasarkan permintaan Anda untuk mengolah dan menganalisis dataset.' },
              { icon: 'sandbox', title: 'Sandbox Docker terisolasi', desc: 'Seluruh eksekusi kode berjalan aman dalam container Docker offline. Data Anda tidak pernah terekspos.' },
              { icon: 'chart', title: 'Visualisasi interaktif', desc: 'Grafik distribusi, korelasi, dan chart lainnya langsung di-render secara visual ke layar Anda menggunakan pustaka matplotlib/seaborn.' },
              { icon: 'stream', title: 'Streaming background', desc: 'Proses AI dan eksekusi kode di-stream secara real-time layaknya terminal sungguhan ke browser Anda.' },
              { icon: 'storage', title: 'Mendukung multi-format', desc: 'Unggah file data dengan mudah: dukung format CSV, Excel, JSON. Semua file tersimpan dengan aman untuk analisis lanjutan.' },
              { icon: 'dashboard', title: 'Dashboard & klarifikasi interaktif', desc: 'Sajikan hasil temuan Anda dalam dashboard interaktif (dashboard.json) dan konfirmasi dataset via kartu klarifikasi khusus.' },
            ].map((f, i) => (
              <div key={i} className="group relative p-10 transition-colors duration-200" style={{ background: 'var(--bg-card)' }}>
                <div className="font-mono text-[10px] tracking-widest mb-6" style={{ color: 'var(--text-muted)' }}>0{i+1} ——</div>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 transition-transform duration-300 group-hover:-translate-y-0.5" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-primary)', color: 'var(--analisai-cyan)' }}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">{featureIcons[f.icon]}</svg>
                </div>
                <h3 className="text-[1.1rem] font-bold mb-3 tracking-tight" style={{ color: 'var(--text-heading)' }}>{f.title}</h3>
                <p className="text-[0.88rem] leading-[1.7]" style={{ color: 'var(--text-secondary)' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={{ height: '1px', background: 'var(--border-primary)' }} className="w-full relative z-10"></div>

      {/* HOW IT WORKS */}
      <section id="how" className="relative z-10 py-32 px-6" style={{ background: 'var(--bg-secondary)' }}>
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
            <RevealSection>
              <div className="font-mono text-[11px] tracking-[0.15em] uppercase flex items-center gap-4 mb-4" style={{ color: 'var(--analisai-cyan)' }}>
                <span className="w-5 h-px" style={{ background: 'var(--analisai-cyan)' }}></span>
                Cara Kerja
              </div>
              <h2 className="text-[clamp(2rem,4vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] mb-6" style={{ color: 'var(--text-heading)' }}>
                Ubah teks instruksi<br />menjadi insight
              </h2>
              <p className="text-[1rem] leading-[1.7] max-w-[520px] mb-12" style={{ color: 'var(--text-secondary)' }}>
                AI Assistant kami secara otomatis menerjemahkan pertanyaan bahasa natural menjadi skrip Python siap eksekusi.
              </p>

              <div className="space-y-0">
                {[
                  { num: '01', title: 'Unggah Data', desc: 'Upload file dataset Anda ke workspace. Sistem akan menyimpannya dengan aman.' },
                  { num: '02', title: 'Berikan Instruksi Teks', desc: 'Ketik apa yang ingin Anda ketahui (contoh: "buatkan chart korelasi"). Tanpa perlu menulis kode manual.' },
                  { num: '03', title: 'AI Menulis Kode', desc: 'Assistant AI akan meng-generate kode Python sesuai dengan kebutuhan analisis Anda di latar belakang.' },
                  { num: '04', title: 'Eksekusi & Visualisasi', desc: 'Kode dieksekusi di Sandbox, lalu grafik/tabel hasilnya dikirim langsung ke antarmuka obrolan.' },
                ].map((s, i) => (
                  <div key={i} className="group flex gap-6 py-7 cursor-default px-2" style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <span className="font-mono text-[11px] pt-1 tracking-widest" style={{ color: 'var(--text-muted)' }}>{s.num}.</span>
                    <div>
                      <h4 className="text-[1rem] font-bold mb-2 transition-colors tracking-tight" style={{ color: 'var(--text-heading)' }}>{s.title}</h4>
                      <p className="text-[0.85rem] leading-[1.65]" style={{ color: 'var(--text-secondary)' }}>{s.desc}</p>
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

      <div style={{ height: '1px', background: 'var(--border-primary)' }} className="w-full relative z-10"></div>

      {/* CAPABILITIES */}
      <section id="models" className="relative z-10 py-32 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-start">
            <RevealSection>
              <div className="font-mono text-[11px] tracking-[0.15em] uppercase flex items-center gap-4 mb-4" style={{ color: 'var(--analisai-cyan)' }}>
                <span className="w-5 h-px" style={{ background: 'var(--analisai-cyan)' }}></span>
                AI Data Analyst
              </div>
              <h2 className="text-[clamp(2rem,4vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] mb-6" style={{ color: 'var(--text-heading)' }}>
                Solusi satu pintu<br />untuk EDA instan
              </h2>
              <p className="text-[1rem] leading-[1.7] mb-8" style={{ color: 'var(--text-secondary)' }}>
                Assistant AI dapat menganalisis distribusi data, mencari missing values, melakukan pembersihan data, serta menghasilkan berbagai visualisasi komprehensif.
              </p>

              <div className="space-y-3">
                {[
                  'Pemrosesan dan pembersihan data menggunakan pandas dan numpy',
                  'Membuat visualisasi: histogram, boxplot, heatmap otomatis',
                  'Analisis statistik deskriptif dan pencarian korelasi tersembunyi',
                ].map((text, i) => (
                  <div key={i} className="flex items-center gap-3 p-3.5 rounded-xl" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-primary)' }}>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--analisai-cyan)', boxShadow: '0 0 8px var(--analisai-cyan)' }}></div>
                    <span className="text-[0.82rem]" style={{ color: 'var(--text-secondary)' }}>{text}</span>
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

      <div style={{ height: '1px', background: 'var(--border-primary)' }} className="w-full relative z-10"></div>

      {/* ARCHITECTURE */}
      <section id="architecture" className="relative z-10 py-32 px-6">
        <div className="max-w-[1200px] mx-auto">
          <RevealSection className="text-center mb-16">
            <div className="font-mono text-[11px] tracking-[0.15em] uppercase flex items-center justify-center gap-4 mb-4" style={{ color: 'var(--analisai-cyan)' }}>
              <span className="w-5 h-px" style={{ background: 'var(--analisai-cyan)' }}></span>
              Sistem
            </div>
            <h2 className="text-[clamp(2rem,4vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] mb-6" style={{ color: 'var(--text-heading)' }}>
              Dirancang untuk<br />keamanan & kecepatan
            </h2>
            <p className="text-[1rem] leading-[1.7] max-w-[500px] mx-auto" style={{ color: 'var(--text-secondary)' }}>
              Dibangun dengan infrastruktur yang aman dan terisolasi untuk menangani tugas analisis data yang intensif.
            </p>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-3 rounded-2xl overflow-hidden gap-px" style={{ background: 'var(--border-primary)', border: '1px solid var(--border-primary)' }}>
            {[
              { label: 'interface layer', title: 'Smart Chat UI', desc: 'Antarmuka obrolan yang menampilkan live streaming eksekusi terminal dan keluaran visual layaknya terminal IDE.', tags: ['frontend', 'react'] },
              { label: 'logic layer', title: 'AI Assistant', desc: 'LLM memahami konteks percakapan, menerjemahkannya ke dalam skrip kode, dan menganalisis keluaran.', tags: ['assistant', 'python'] },
              { label: 'execution layer', title: 'Sandbox Terisolasi', desc: 'Kode Python dieksekusi dengan aman pada lingkungan terisolasi di dalam container Docker tanpa akses jaringan keluar.', tags: ['docker', 'sandbox'] },
            ].map((a, i) => (
              <div key={i} className="relative p-8 flex flex-col gap-4" style={{ background: 'var(--bg-card)' }}>
                <span className="absolute top-4 right-5 font-mono text-[10px] tracking-widest" style={{ color: 'var(--border-primary)' }}>0{i+1}</span>
                <span className="font-mono text-[10px] tracking-widest uppercase" style={{ color: 'var(--analisai-cyan)' }}>{a.label}</span>
                <h3 className="text-[0.95rem] font-bold tracking-tight" style={{ color: 'var(--text-heading)' }}>{a.title}</h3>
                <p className="text-[0.8rem] leading-[1.65] flex-1" style={{ color: 'var(--text-secondary)' }}>{a.desc}</p>
                <div className="flex gap-2 flex-wrap">
                  {a.tags.map(tag => (
                    <span key={tag} className="font-mono text-[10px] px-2 py-0.5 rounded" style={{ color: 'var(--analisai-cyan)', background: 'var(--bg-hover)', border: '1px solid var(--border-primary)' }}>{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 rounded-xl overflow-hidden gap-px mt-4" style={{ background: 'var(--border-primary)', border: '1px solid var(--border-primary)' }}>
            {[
              { label: 'infra', val: 'Docker · FastAPI · Storage' },
              { label: 'backend', val: 'Python · Pandas · Numpy' },
              { label: 'ai', val: 'LLM Agent · Code Gen' },
              { label: 'viz', val: 'matplotlib · Seaborn' },
            ].map((inf, i) => (
              <div key={i} className="p-5 flex items-center gap-4" style={{ background: 'var(--bg-card)' }}>
                <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{inf.label}</span>
                <span className="font-mono text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>{inf.val}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={{ height: '1px', background: 'var(--border-primary)' }} className="w-full relative z-10"></div>

      {/* CTA */}
      <section id="cta" className="relative z-10 py-32 px-6">
        <div className="max-w-[1200px] mx-auto">
          <RevealSection className="max-w-[800px] mx-auto rounded-[40px] p-12 lg:p-24 text-center relative overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
            <h2 className="text-[clamp(2.5rem,5vw,3.5rem)] font-extrabold tracking-tight leading-[1.1] mb-6" style={{ color: 'var(--text-heading)' }}>
              Siap menganalisis<br />data Anda?
            </h2>
            <p className="text-[1rem] leading-[1.7] mb-12 max-w-[500px] mx-auto" style={{ color: 'var(--text-secondary)' }}>
              Mulai unggah dataset pertama Anda dan lihat bagaimana asisten AI kami memberikan insight komprehensif dalam hitungan detik.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <button 
                onClick={onStart}
                className="h-[52px] px-8 rounded-xl font-bold text-[15px] flex items-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all duration-200"
                style={{ background: 'var(--analisai-cyan)', color: 'white' }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                Mulai Sekarang — Gratis
              </button>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 px-8 py-10" style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-primary)' }}>
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-[13px]" style={{ color: 'var(--text-muted)' }}>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 flex items-center justify-center rounded font-bold text-[11px]" style={{ background: 'var(--bg-hover)', color: 'var(--analisai-cyan)' }}>A</div>
            <span className="font-bold" style={{ color: 'var(--text-heading)' }}>Analisai Platform</span>
            <span className="hidden md:block">·</span>
            <span className="hidden md:block">Dibuat oleh Muhammad Ammar Arief</span>
          </div>
          <div className="font-mono tracking-widest uppercase text-[11px] tabular-nums">© {new Date().getFullYear()} · All rights reserved</div>
        </div>
      </footer>
    </div>
  )
}
