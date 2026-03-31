import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const PipelineDemo = () => {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState({ state: 'idle', label: 'menunggu input' });
  const [activeStage, setActiveStage] = useState(null); // 'classifier', 'planner', 'executor', 'critic'
  const [stagesStatus, setStagesStatus] = useState({
    classifier: 'idle',
    planner: 'idle',
    executor: 'idle',
    critic: 'idle',
  });
  const [logs, setLogs] = useState([{ msg: '— menunggu —', cls: '' }]);
  const [tasks, setTasks] = useState({
    a: { state: 'idle', msg: 'idle' },
    b: { state: 'idle', msg: 'idle' },
    c: { state: 'idle', msg: 'idle' },
  });

  const timersRef = useRef([]);

  const addLog = (msg, cls = '') => {
    setLogs((prev) => {
      const newLogs = prev[0]?.msg === '— menunggu —' ? [] : [...prev];
      const updated = [...newLogs, { msg, cls }];
      return updated.slice(-6); // Keep last 6 for UI compactness
    });
  };

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const t = (fn, ms) => {
    timersRef.current.push(setTimeout(fn, ms));
  };

  const resetVisuals = () => {
    setStagesStatus({ classifier: 'idle', planner: 'idle', executor: 'idle', critic: 'idle' });
    setTasks({
      a: { state: 'idle', msg: 'idle' },
      b: { state: 'idle', msg: 'idle' },
      c: { state: 'idle', msg: 'idle' },
    });
    setLogs([{ msg: '— menunggu —', cls: '' }]);
  };

  const resetDemo = () => {
    clearTimers();
    setRunning(false);
    resetVisuals();
    setStatus({ state: 'idle', label: 'menunggu input' });
  };

  const runDemo = () => {
    if (running) return;
    setRunning(true);
    resetVisuals();
    setStatus({ state: 'active', label: 'memproses...' });

    t(() => {
      setStagesStatus(s => ({ ...s, classifier: 'active' }));
      addLog('> classify_request_type(question)', 'info');
    }, 200);

    t(() => {
      addLog('  → data_task (complex)', 'success');
      setStagesStatus(s => ({ ...s, classifier: 'done', planner: 'active' }));
      addLog('> Planner Agent: membuat rencana...', 'info');
    }, 1200);

    t(() => {
      addLog('  phase 0: [muat dataset]');
      addLog('  phase 1: [statistik, distribusi, outlier]');
      setStagesStatus(s => ({ ...s, planner: 'done', executor: 'active' }));
      addLog('> Executor: phase 0 dimulai', 'info');
    }, 2500);

    t(() => {
      addLog('  task 0/3: muat dataset... ', 'info');
    }, 3200);

    t(() => {
      addLog('  selesai (0.4s)', 'success');
      addLog('> Executor: phase 1 — paralel', 'info');
      setTasks({
        a: { state: 'running', msg: 'running...' },
        b: { state: 'running', msg: 'running...' },
        c: { state: 'running', msg: 'running...' },
      });
    }, 4200);

    t(() => { 
        setTasks(prev => ({ ...prev, a: { state: 'done', msg: 'selesai 1.2s' } })); 
        addLog('  task statistik selesai', 'success'); 
    }, 5500);
    t(() => { 
        setTasks(prev => ({ ...prev, b: { state: 'done', msg: 'selesai 1.5s' } })); 
        addLog('  task distribusi selesai', 'success'); 
    }, 6000);
    t(() => { 
        setTasks(prev => ({ ...prev, c: { state: 'done', msg: 'selesai 1.8s' } })); 
        addLog('  task outlier selesai', 'success'); 
    }, 6500);

    t(() => {
      setStagesStatus(s => ({ ...s, executor: 'done', critic: 'active' }));
      addLog('> Critic Agent: evaluasi output...', 'info');
    }, 7200);

    t(() => {
      addLog('  judgment: ok', 'success');
      addLog('  feedback: analisis lengkap', 'success');
      setStagesStatus(s => ({ ...s, critic: 'done' }));
      setStatus({ state: 'done', label: 'selesai' });
      setRunning(false);
    }, 8500);
  };

  useEffect(() => {
    return () => clearTimers();
  }, []);

  const StageCard = ({ id, label, sub, colorClass }) => {
    const state = stagesStatus[id];
    let borderColor = 'var(--border-primary)';
    let bg = 'var(--bg-secondary)';
    let dotClass = 'bg-[var(--text-muted)]';

    if (state === 'active') {
      borderColor = '#38bdf8';
      bg = 'rgba(56, 189, 248, 0.08)';
      dotClass = 'bg-[#38bdf8] shadow-[0_0_0_3px_rgba(56,189,248,0.2)] animate-pulse';
    } else if (state === 'done') {
      borderColor = '#22c55e';
      bg = 'rgba(34, 197, 94, 0.08)';
      dotClass = 'bg-[#22c55e]';
    }

    return (
      <div 
        className="stage-card flex-1 min-w-0 rounded-xl border p-3 md:p-4 transition-all duration-300"
        style={{ borderColor, backgroundColor: bg }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${colorClass}`}>
            {label}
          </span>
          <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${dotClass}`}></div>
        </div>
        <div className="text-[13px] font-semibold text-[var(--text-primary)] mb-1 truncate">{sub}</div>
        <div className="text-[10px] text-[var(--text-muted)] truncate">
          {id === 'classifier' && 'smalltalk / model / simple'}
          {id === 'planner' && 'JSON tasks (phase paralel)'}
          {id === 'executor' && 'Sandbox / phase parallel'}
          {id === 'critic' && 'ok / refine evaluation'}
        </div>
      </div>
    );
  };

  const FlowArrow = ({ speed }) => (
    <div className="hidden md:flex items-center justify-center w-8 px-1">
      <svg width="24" height="12" viewBox="0 0 24 12" className="overflow-visible">
        <path 
           d="M0 6 L20 6" 
           stroke="var(--border-primary)" 
           strokeWidth="1.5" 
           fill="none" 
           className={`stroke-dasharray-[4,4] ${running ? 'animate-flowDash' : ''}`}
           style={{ animationDuration: speed || '1.5s' }}
        />
        <path d="M18 2 L23 6 L18 10" fill="none" stroke="var(--border-primary)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );

  return (
    <div className="w-full max-w-5xl mx-auto py-8">
      <style>{`
        @keyframes flowDash { to { stroke-dashoffset: -20; } }
        .animate-flowDash { 
          stroke-dasharray: 5 5;
          animation: flowDash 1.5s linear infinite; 
        }
      `}</style>

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-500"></span>
            <span className="text-sm font-medium text-[var(--text-primary)]">Sistem Multi-Agent LangGraph</span>
        </div>
        
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono border transition-colors ${
            status.state === 'idle' ? 'border-sky-500/20 bg-sky-500/5 text-sky-400' :
            status.state === 'active' ? 'border-sky-500/40 bg-sky-500/10 text-sky-400' :
            'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${
              status.state === 'active' ? 'bg-sky-400 animate-pulse' : 
              status.state === 'done' ? 'bg-emerald-400' : 'bg-sky-400/50'
            }`}></div>
            {status.label}
          </div>
          
          <button 
            onClick={runDemo} 
            disabled={running}
            className="text-xs px-4 py-1.5 rounded-md bg-sky-600 text-white hover:bg-sky-500 transition-colors disabled:opacity-50"
          >
            Jalankan demo
          </button>
          <button 
            onClick={resetDemo}
            className="text-xs px-4 py-1.5 rounded-md border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* The Cards Grid */}
      <div className="flex flex-col md:flex-row gap-2 md:gap-0 items-center mb-8">
        <StageCard id="classifier" label="Classifier" sub="Route request" colorClass="bg-sky-500/10 text-sky-500 border-sky-500/20" />
        <FlowArrow speed="1.2s" />
        <StageCard id="planner" label="Planner Agent" sub="Buat rencana" colorClass="bg-purple-500/10 text-purple-500 border-purple-500/20" />
        <FlowArrow speed="2s" />
        <StageCard id="executor" label="Executor Agent" sub="Eksekusi paralel" colorClass="bg-teal-500/10 text-teal-500 border-teal-500/20" />
        <FlowArrow speed="1.3s" />
        <StageCard id="critic" label="Critic Agent" sub="Evaluasi hasil" colorClass="bg-amber-500/10 text-amber-500 border-amber-500/20" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Logs Panel */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-4 min-h-[140px] flex flex-col">
            <div className="text-[10px] font-mono text-[var(--text-muted)] mb-3 tracking-widest uppercase">Execution Log</div>
            <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                <AnimatePresence initial={false}>
                    {logs.map((log, i) => (
                        <motion.div 
                            key={i}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`font-mono text-[12px] ${
                                log.cls === 'info' ? 'text-sky-400' : 
                                log.cls === 'success' ? 'text-emerald-400' : 
                                'text-[var(--text-muted)]'
                            }`}
                        >
                            {log.msg}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>

        {/* Paralel Tasks Panel */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-4">
            <div className="text-[10px] font-mono text-[var(--text-muted)] mb-3 tracking-widest uppercase">Fase Paralel — Phase 1</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {['a', 'b', 'c'].map((id) => {
                    const task = tasks[id];
                    const label = id === 'a' ? 'Statistik' : id === 'b' ? 'Distribusi' : 'Outliers';
                    
                    let border = 'var(--border-primary)';
                    let color = 'var(--text-muted)';
                    if (task.state === 'running') { border = '#38bdf8'; color = '#38bdf8'; }
                    if (task.state === 'done') { border = '#22c55e'; color = '#22c55e'; }

                    return (
                        <div 
                            key={id} 
                            className="bg-[var(--bg-page)] rounded-lg border p-3 transition-all duration-300"
                            style={{ borderColor: border }}
                        >
                            <div className="text-[9px] font-mono text-[var(--text-muted)] mb-1">TASK {id.toUpperCase()}</div>
                            <div className="text-[12px] font-medium mb-2">{label}</div>
                            <div className="text-[10px] transition-colors duration-300" style={{ color }}>{task.msg}</div>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>

      <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-4 text-center">
        <div className="text-[10px] font-mono text-[var(--text-muted)] mb-3 tracking-widest uppercase">Ekosistem Tool</div>
        <div className="flex flex-wrap items-center justify-center gap-6">
            <div className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                <div className="w-6 h-6 rounded flex items-center justify-center bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor"><rect x="2" y="4" width="12" height="8" rx="1.5"/><path d="M5 8h3m-3 2h5"/></svg>
                </div>
                python_repl_tool
            </div>
            <div className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                <div className="w-6 h-6 rounded flex items-center justify-center bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/></svg>
                </div>
                automl_train_tool
            </div>
            <div className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                <div className="w-6 h-6 rounded flex items-center justify-center bg-teal-500/10 text-teal-400 border border-teal-500/20">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor"><path d="M3 4h10M3 8h10M3 12h5" strokeLinecap="round"/></svg>
                </div>
                automl_list_models_tool
            </div>
            <div className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                <div className="w-6 h-6 rounded flex items-center justify-center bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor"><path d="M2 8h3l2-5 3 10 2-5h2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                automl_predict_tool
            </div>
        </div>
      </div>
    </div>
  );
};

export default PipelineDemo;
