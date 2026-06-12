import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

const getScoreColor = (score) => {
  if (score >= 90) return { stroke: '#22c55e', text: 'text-green-400', label: 'Excellent Match 🚀', bg: 'bg-green-500/10' };
  if (score >= 70) return { stroke: '#f59e0b', text: 'text-amber-400', label: 'Strong Match 💪',   bg: 'bg-amber-500/10' };
  if (score >= 50) return { stroke: '#3b82f6', text: 'text-blue-400',  label: 'Good Match 👍',     bg: 'bg-blue-500/10'  };
  return           { stroke: '#ef4444', text: 'text-red-400',   label: 'Needs Work 🔧',    bg: 'bg-red-500/10'   };
};

// Confetti burst component
function Confetti({ active }) {
  const pieces = Array.from({ length: 32 }, (_, i) => i);
  const colors = ['#22c55e', '#06b6d4', '#a855f7', '#f59e0b', '#ec4899', '#3b82f6'];

  if (!active) return null;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
      {pieces.map((i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-sm"
          style={{
            backgroundColor: colors[i % colors.length],
            left: `${Math.random() * 100}%`,
            top: '-8px',
          }}
          initial={{ y: 0, opacity: 1, rotate: 0, scale: 1 }}
          animate={{
            y: 260 + Math.random() * 100,
            opacity: 0,
            rotate: Math.random() * 720 - 360,
            scale: Math.random() * 0.8 + 0.4,
            x: Math.random() * 120 - 60,
          }}
          transition={{ duration: 1.4 + Math.random() * 0.8, ease: 'easeOut', delay: Math.random() * 0.3 }}
        />
      ))}
    </div>
  );
}

export default function CVScoreGauge({ score, isAnalyzing = false, onRescan, cvName }) {
  const [displayScore, setDisplayScore] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const prevScore = useRef(null);

  // Animate number counter on mount / score change
  useEffect(() => {
    if (score == null) return;
    const target = Math.round(score);
    const duration = 1200;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + increment, target);
      setDisplayScore(Math.round(current));
      if (current >= target) clearInterval(timer);
    }, duration / steps);

    // Trigger confetti if score >= 90 and it's a new high
    if (target >= 90 && prevScore.current !== target) {
      setTimeout(() => setShowConfetti(true), 800);
      setTimeout(() => setShowConfetti(false), 2800);
    }
    prevScore.current = target;
    return () => clearInterval(timer);
  }, [score]);

  const colors   = getScoreColor(score ?? 0);
  const radius   = 80;
  const stroke   = 10;
  const normalR  = radius - stroke / 2;
  const circ     = 2 * Math.PI * normalR;
  const progress = score != null ? ((score / 100) * circ) : 0;

  return (
    <div className="relative glass-card p-6 flex flex-col items-center gap-4 overflow-hidden">
      <Confetti active={showConfetti} />

      {/* Title row */}
      <div className="flex items-center justify-between w-full">
        <div>
          <p className="text-text-secondary text-xs uppercase tracking-wider font-medium">ATS Score</p>
          {cvName && <p className="text-text-muted text-xs mt-0.5 truncate max-w-[160px]">{cvName}</p>}
        </div>
        {onRescan && (
          <button
            onClick={onRescan}
            disabled={isAnalyzing}
            className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-brand-cyan transition-colors disabled:opacity-50 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/10"
          >
            <RefreshCw className={`w-3 h-3 ${isAnalyzing ? 'animate-spin' : ''}`} />
            {isAnalyzing ? 'Analyzing…' : 'Rescan'}
          </button>
        )}
      </div>

      {/* SVG Gauge */}
      <div className="relative flex items-center justify-center">
        <svg width={radius * 2 + stroke} height={radius * 2 + stroke} className="-rotate-90">
          {/* Track */}
          <circle
            cx={radius + stroke / 2}
            cy={radius + stroke / 2}
            r={normalR}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={stroke}
          />
          {/* Progress */}
          <motion.circle
            cx={radius + stroke / 2}
            cy={radius + stroke / 2}
            r={normalR}
            fill="none"
            stroke={isAnalyzing ? '#334155' : colors.stroke}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: isAnalyzing ? circ : circ - progress }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>

        {/* Center score */}
        <div className="absolute flex flex-col items-center justify-center">
          {isAnalyzing ? (
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="text-text-muted text-sm font-medium"
            >
              Analyzing…
            </motion.div>
          ) : score != null ? (
            <>
              <span className={`text-4xl font-black ${colors.text}`}>{displayScore}</span>
              <span className="text-text-muted text-xs">/100</span>
            </>
          ) : (
            <span className="text-text-muted text-sm">No CV</span>
          )}
        </div>
      </div>

      {/* Score label badge */}
      <AnimatePresence>
        {score != null && !isAnalyzing && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium ${colors.bg} ${colors.text} border border-white/10`}
          >
            {colors.label}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Score bar breakdown */}
      {score != null && !isAnalyzing && (
        <div className="w-full space-y-1.5 mt-1">
          <div className="flex justify-between text-xs text-text-muted">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
          <div className="w-full bg-white/8 rounded-full h-1.5 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${colors.stroke}88, ${colors.stroke})` }}
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
