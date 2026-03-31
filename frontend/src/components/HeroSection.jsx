import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion'
import Logo from '../components/Logo'

// ── Floating particle background ─────────────────────────────────────────────
function Particles() {
  const particles = Array.from({ length: 28 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 1,
    duration: Math.random() * 12 + 8,
    delay: Math.random() * 6,
    opacity: Math.random() * 0.25 + 0.05,
  }))

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-sky-400"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [p.opacity, p.opacity * 2.5, p.opacity],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

// ── Animated grid lines ───────────────────────────────────────────────────────
function GridLines() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `
          linear-gradient(rgba(56,189,248,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(56,189,248,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
        maskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 30%, transparent 100%)',
      }}
    />
  )
}

// ── Pipeline node pill ────────────────────────────────────────────────────────
function PipelineNode({ label, index, total, isActive }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7 + index * 0.1, duration: 0.5, ease: 'easeOut' }}
      className="relative z-10"
    >
      <motion.div
        animate={isActive ? {
          boxShadow: ['0 0 0 0 rgba(56,189,248,0)', '0 0 0 6px rgba(56,189,248,0.15)', '0 0 0 0 rgba(56,189,248,0)'],
        } : {}}
        transition={{ duration: 2, repeat: Infinity, delay: index * 0.3 }}
        className="px-4 py-1.5 rounded-full border text-sm font-medium tracking-wide"
        style={{
          background: 'rgba(14,165,233,0.08)',
          borderColor: 'rgba(56,189,248,0.45)',
          color: '#93c5fd',
          backdropFilter: 'blur(8px)',
        }}
      >
        {label}
      </motion.div>
    </motion.div>
  )
}

// ── Animated SVG branches ─────────────────────────────────────────────────────
function BranchGraphic({ scrollY }) {
  const opacity = useTransform(scrollY, [0, 280], [1, 0])
  const y = useTransform(scrollY, [0, 400], [0, 60])

  const paths = [
    'M 150 20 C 150 110, 500 80, 500 260',
    'M 350 20 C 350 110, 500 80, 500 260',
    'M 650 20 C 650 110, 500 80, 500 260',
    'M 850 20 C 850 110, 500 80, 500 260',
  ]

  return (
    <motion.div
      style={{ opacity, y }}
      className="relative w-full max-w-4xl mx-auto h-[280px] hidden md:block"
    >
      {/* Node pills row */}
      <div className="relative z-10 flex justify-between px-16 pt-0">
        {['Upload', 'Analisis', 'Visualisasi', 'Prediksi'].map((label, i) => (
          <PipelineNode key={label} label={label} index={i} total={4} isActive />
        ))}
      </div>

      {/* SVG branch lines */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1000 280"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="branch-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.7" />
            <stop offset="70%" stopColor="#38bdf8" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
          </linearGradient>
          <filter id="branch-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Glow layer */}
        <g stroke="url(#branch-grad)" strokeWidth="2.5" fill="none" filter="url(#branch-glow)" opacity="0.5">
          {paths.map((d, i) => (
            <motion.path
              key={i}
              d={d}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.6, delay: 0.5 + i * 0.12, ease: 'easeInOut' }}
            />
          ))}
        </g>

        {/* Sharp layer */}
        <g stroke="url(#branch-grad)" strokeWidth="1" fill="none">
          {paths.map((d, i) => (
            <motion.path
              key={i}
              d={d}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.6, delay: 0.5 + i * 0.12, ease: 'easeInOut' }}
            />
          ))}
        </g>

        {/* Convergence dot */}
        <motion.circle
          cx="500"
          cy="260"
          r="5"
          fill="#38bdf8"
          fillOpacity="0.8"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.8, duration: 0.4, ease: 'backOut' }}
        />
        <motion.circle
          cx="500"
          cy="260"
          r="12"
          fill="none"
          stroke="#38bdf8"
          strokeWidth="1"
          strokeOpacity="0.3"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.8, 1], opacity: [0, 0.5, 0.2] }}
          transition={{ delay: 1.9, duration: 0.8, ease: 'easeOut' }}
        />

        {/* Animated travelling dots on each path */}
        {paths.map((_, i) => (
          <motion.circle
            key={`dot-${i}`}
            r="3"
            fill="#7dd3fc"
            fillOpacity="0.9"
            initial={{ offsetDistance: '0%', opacity: 0 }}
            animate={{
              opacity: [0, 0.9, 0.9, 0],
            }}
            style={{ offsetPath: `path("${paths[i]}")` }}
            transition={{
              duration: 1.8,
              delay: 2.2 + i * 0.2,
              repeat: Infinity,
              repeatDelay: 2.5,
            }}
          />
        ))}
      </svg>
    </motion.div>
  )
}

// ── Main hero section ─────────────────────────────────────────────────────────
export default function HeroSection({ onStart }) {
  const { scrollY } = useScroll()
  const heroY = useTransform(scrollY, [0, 500], [0, 120])
  const heroOpacity = useTransform(scrollY, [0, 320], [1, 0])

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-start pt-32 md:pt-44 pb-0 overflow-hidden">

      {/* Background layers */}
      <GridLines />
      <Particles />

      {/* Ambient glow blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ x: [0, 40, 0], y: [0, 25, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-[15%] -left-[5%] w-[55%] h-[55%] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(14,165,233,0.07) 0%, transparent 70%)' }}
        />
        <motion.div
          animate={{ x: [0, -30, 0], y: [0, 50, 0], scale: [1, 1.12, 1] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[10%] -right-[5%] w-[50%] h-[50%] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(99,102,241,0.06) 0%, transparent 70%)' }}
        />
      </div>

      {/* Hero content */}
      <motion.div
        style={{ y: heroY, opacity: heroOpacity }}
        className="relative z-10 w-full max-w-[960px] mx-auto px-6 text-center"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="inline-flex items-center gap-2 mb-8 px-3 py-1.5 rounded-full text-xs font-medium tracking-widest"
          style={{
            background: 'rgba(14,165,233,0.08)',
            border: '0.5px solid rgba(56,189,248,0.3)',
            color: '#7dd3fc',
            letterSpacing: '0.1em',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full bg-sky-400"
            style={{ boxShadow: '0 0 6px #38bdf8' }}
          />
          AI DATA ANALYST · POWERED BY LANGGRAPH
        </motion.div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut' }}
          className="text-5xl md:text-7xl lg:text-[78px] font-semibold tracking-tight leading-[1.08] mb-6"
          style={{ color: '#f0f9ff' }}
        >
          Data Analyst AI yang{' '}
          <span className="relative inline-block" style={{ color: '#38bdf8' }}>
            memukau
            {/* Underline SVG */}
            <motion.svg
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ delay: 0.9, duration: 1.1, ease: 'easeInOut' }}
              className="absolute -bottom-2 left-0 w-full"
              style={{ height: '10px' }}
              viewBox="0 0 200 10"
              preserveAspectRatio="none"
            >
              <path
                d="M2 6 Q50 2 100 6 Q150 10 198 5"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </motion.svg>
            {/* Glow behind the word */}
            <span
              className="absolute inset-0 -z-10 blur-2xl rounded-full"
              style={{ background: 'rgba(56,189,248,0.15)', transform: 'scale(1.2)' }}
            />
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: 'easeOut' }}
          className="text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed"
          style={{ color: '#94a3b8' }}
        >
          Eksplorasi, visualisasi, hingga machine learning. Cukup gunakan bahasa
          natural — biarkan AI menyusun rencana dan mengeksekusi kode Python
          secara otomatis di background.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4, ease: 'easeOut' }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-20"
        >
          {/* Primary */}
          <motion.button
            onClick={onStart}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="relative h-12 px-8 rounded-lg text-sm font-semibold text-white overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
              boxShadow: '0 0 24px rgba(14,165,233,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          >
            <span className="relative z-10 flex items-center gap-2">
              Mulai Analisis
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
            {/* Shimmer */}
            <motion.span
              className="absolute inset-0 -translate-x-full"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)' }}
              animate={{ x: ['−100%', '200%'] }}
              transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1.5 }}
            />
          </motion.button>

          {/* Secondary — now visible */}
          <motion.button
            onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="h-12 px-8 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.14)',
              color: '#cbd5e1',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(56,189,248,0.45)'
              e.currentTarget.style.color = '#e0f2fe'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'
              e.currentTarget.style.color = '#cbd5e1'
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Lihat Cara Kerja
          </motion.button>
        </motion.div>

        {/* Social proof / stats strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.8 }}
          className="flex items-center justify-center gap-8 mb-16"
          style={{ color: '#475569' }}
        >
          {[
            { val: '5 model', label: 'ML candidates' },
            { val: 'Auto', label: 'hyperparameter tuning' },
            { val: 'Docker', label: 'isolated sandbox' },
          ].map((stat, i) => (
            <div key={i} className="flex items-center gap-6">
              {i > 0 && <span style={{ color: '#1e293b' }}>·</span>}
              <div className="text-center">
                <div className="text-sm font-semibold" style={{ color: '#94a3b8' }}>{stat.val}</div>
                <div className="text-xs" style={{ color: '#475569' }}>{stat.label}</div>
              </div>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Branch graphic */}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-6">
        <BranchGraphic scrollY={scrollY} />
      </div>

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, transparent, var(--bg-page, #020617))',
        }}
      />
    </section>
  )
}
