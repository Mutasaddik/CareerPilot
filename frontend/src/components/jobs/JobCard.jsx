import { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Clock, Bookmark, BookmarkCheck, ThumbsUp, ThumbsDown, Wifi, ArrowRight } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { saveJob, submitJobFeedback } from '../../api/jobApi.js';
import useJobStore from '../../store/jobStore.js';

const CompanyLogo = ({ logoUrl, domain, name, size = 46 }) => {
  const [srcIndex, setSrcIndex] = useState(0);
  const initials = (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const colors   = ['#06b6d4','#8b5cf6','#f59e0b','#22c55e','#ef4444','#3b82f6','#ec4899'];
  const color    = colors[(name?.charCodeAt(0) || 0) % colors.length];
  const sources  = [logoUrl, domain ? `https://logo.clearbit.com/${domain}` : null].filter(Boolean);
  if (sources.length === 0 || srcIndex >= sources.length) {
    return (
      <div className="rounded-xl flex items-center justify-center text-white font-bold shrink-0"
        style={{ width: size, height: size, background: `linear-gradient(135deg, ${color}, ${color}cc)`, fontSize: size * 0.34,
                 boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -2px 4px rgba(0,0,0,0.25), 0 4px 12px rgba(0,0,0,0.35)' }}>
        {initials}
      </div>
    );
  }
  return (
    <img src={sources[srcIndex]} alt={name} width={size} height={size}
      className="rounded-xl object-contain bg-white/5 shrink-0" onError={() => setSrcIndex((i) => i + 1)} />
  );
};

const scoreColor   = (s) => s >= 90 ? '#34d399' : s >= 70 ? '#fbbf24' : s >= 50 ? '#06b6d4' : '#9ca3af';
const accentBorder = (s) => s >= 90 ? '#22c55e' : s >= 70 ? '#f59e0b' : s >= 50 ? '#3b82f6' : 'rgba(255,255,255,0.1)';

const timeAgo = (dateStr) => {
  if (!dateStr) return 'recently';
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000), d = Math.floor(h / 24);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const ExpiryBar = ({ pct }) => {
  const p = Math.max(0, Math.min(100, pct ?? 100));
  const tier = p <= 15 ? 'urgent' : p <= 35 ? 'warn' : 'ok';
  const fill = { urgent: 'linear-gradient(90deg,#f87171,#dc2626)', warn: 'linear-gradient(90deg,#fbbf24,#d97706)', ok: 'linear-gradient(90deg,#34d399,#16a34a)' }[tier];
  const glow = { urgent: 'rgba(239,68,68,0.6)', warn: 'rgba(245,158,11,0.5)', ok: 'rgba(34,197,94,0.5)' }[tier];
  const label = { urgent: 'Expiring soon', warn: 'Closing soon', ok: 'Open' }[tier];
  const labelColor = { urgent: '#f87171', warn: '#fbbf24', ok: '#4ade80' }[tier];
  return (
    <div className="my-3">
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-text-muted">Application window</span>
        <span className="font-bold" style={{ color: labelColor }}>{label}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/8 overflow-hidden" style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)' }}>
        <motion.div className="h-full rounded-full" style={{ background: fill, boxShadow: `0 0 8px ${glow}` }}
          initial={{ width: 0 }} animate={{ width: `${p}%` }} transition={{ duration: 1, ease: 'easeOut' }} />
      </div>
    </div>
  );
};

const MatchGauge = ({ score }) => {
  const R = 24, C = 2 * Math.PI * R;
  const color = scoreColor(score);
  return (
    <div className="relative shrink-0" style={{ width: 54, height: 54 }}>
      <svg width="54" height="54" style={{ transform: 'rotate(-90deg)', filter: `drop-shadow(0 0 6px ${color}66)` }}>
        <circle cx="27" cy="27" r={R} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="5" />
        <motion.circle cx="27" cy="27" r={R} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C - (score / 100) * C }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xs font-extrabold" style={{ color }}>{score}%</div>
    </div>
  );
};

export default function JobCard({ job, onClick }) {
  const store    = useJobStore();
  const savedIds = store.savedIds instanceof Set ? store.savedIds : new Set();
  const isSaved  = savedIds.has(job?.id) || job?.user_feedback === 'saved';
  const score    = job?.relevance_score || 0;
  const skills   = job?.match_breakdown_json?.matched_skills || [];
  const sources  = job?.sources || [];

  const expiryPct = (() => {
    if (job?.expiry_pct != null) return job.expiry_pct;
    if (job?.posted_date) {
      const days = (Date.now() - new Date(job.posted_date).getTime()) / 86400000;
      return Math.max(5, Math.min(100, 100 - days * 3));
    }
    return 60;
  })();

  const saveMutation = useMutation({
    mutationFn: (saved) => saveJob(job.id, saved),
    onMutate:   (saved) => { store.toggleSaved?.(job.id); store.updateJob?.(job.id, { user_feedback: saved ? 'saved' : null }); },
    onError:    ()      => { store.toggleSaved?.(job.id); },
  });
  const feedbackMutation = useMutation({
    mutationFn: (type) => submitJobFeedback(job.id, type),
    onSuccess:  (_, type) => store.updateJob?.(job.id, { user_feedback: type }),
  });

  return (
    <motion.div
      layout
      whileHover={{ scale: 1.25, zIndex: 10 }}
      transition={{ layout: { duration: 0.4, ease: [0.16, 1, 0.3, 1] }, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="relative rounded-2xl p-5 overflow-hidden"
      style={{
        background: 'linear-gradient(150deg, rgba(124,58,237,0.10) 0%, rgba(6,182,212,0.04) 100%), rgba(18,18,32,0.55)',
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        borderLeft: `3px solid ${accentBorder(score)}`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.45), inset 0 1px 1px rgba(255,255,255,0.10)',
      }}
    >
      <div className="pointer-events-none absolute inset-0 rounded-2xl" style={{
        padding: '1px',
        background: 'linear-gradient(160deg, rgba(255,255,255,0.35), rgba(255,255,255,0.05) 35%, rgba(255,255,255,0) 70%)',
        WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
        WebkitMaskComposite: 'xor', maskComposite: 'exclude',
      }} />

      <div className="relative">
        <div className="flex items-start gap-3 mb-4">
          <CompanyLogo logoUrl={job?.company_logo_url} domain={job?.company_domain} name={job?.company} />
          <div className="flex-1 min-w-0">
            <p className="text-text-primary font-bold text-sm leading-tight" style={{ textShadow: '0 1px 8px rgba(10,10,20,0.6)' }}>{job?.title}</p>
            <p className="text-text-secondary text-xs mt-0.5 truncate">{job?.company}</p>
            <span className="flex items-center gap-1 text-text-muted text-xs mt-1">
              <MapPin className="w-3 h-3" />{job?.location}
              {job?.is_remote && <span className="flex items-center gap-1 text-green-400 ml-1"><Wifi className="w-3 h-3" /> Remote</span>}
            </span>
          </div>
          <MatchGauge score={score} />
          <button onClick={(e) => { e.stopPropagation(); saveMutation.mutate(!isSaved); }}
            className="text-text-muted hover:text-brand-cyan transition-colors shrink-0 p-1 absolute top-0 right-0">
            {isSaved ? <BookmarkCheck className="w-4 h-4 text-brand-cyan" /> : <Bookmark className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-1">
          {skills.slice(0, 3).map((skill) => (
            <span key={skill} className="text-xs px-2.5 py-1 rounded-full bg-white/7 border border-white/10 text-text-secondary">{skill}</span>
          ))}
        </div>

        <ExpiryBar pct={expiryPct} />

        <div className="h-px my-3" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)' }} />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            {job?.salary_min_bdt ? (
              <span className="text-xs font-bold" style={{ color: '#06b6d4', textShadow: '0 0 10px rgba(6,182,212,0.4)' }}>
                ৳{(job.salary_min_bdt / 1000).toFixed(0)}k{job.salary_max_bdt ? `–${(job.salary_max_bdt / 1000).toFixed(0)}k` : '+'} BDT
              </span>
            ) : (<span className="text-xs text-text-muted">Salary not listed</span>)}
            {sources.slice(0, 2).map((src) => (
              <span key={src} className="text-xs px-1.5 py-0.5 bg-white/5 text-text-muted rounded border border-white/8">{src}</span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={(e) => { e.stopPropagation(); feedbackMutation.mutate('positive'); }}
              className={`p-1 rounded transition-colors ${job?.user_feedback === 'positive' ? 'text-green-400' : 'text-text-muted hover:text-green-400'}`}>
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); feedbackMutation.mutate('negative'); }}
              className={`p-1 rounded transition-colors ${job?.user_feedback === 'negative' ? 'text-red-400' : 'text-text-muted hover:text-red-400'}`}>
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
            <span className="flex items-center gap-1 text-text-muted text-xs"><Clock className="w-3 h-3" />{timeAgo(job?.posted_date || job?.scraped_at)}</span>
          </div>
        </div>

        <button onClick={(e) => { e.stopPropagation(); onClick && onClick(); }}
          className="w-full border-0 cursor-pointer py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-transform active:translate-y-1"
          style={{
            background: 'linear-gradient(135deg,#8b5cf6 0%,#6366f1 50%,#06b6d4 100%)',
            boxShadow: '0 4px 0 rgba(76,29,149,0.9), 0 7px 18px rgba(124,58,237,0.45), inset 0 1px 0 rgba(255,255,255,0.3)',
          }}>
          View Details <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
