import { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Clock, Bookmark, BookmarkCheck, ThumbsUp, ThumbsDown, Wifi, Building2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { saveJob, submitJobFeedback } from '../../api/jobApi.js';
import useJobStore from '../../store/jobStore.js';

// Clearbit logo with colored initials fallback
const CompanyLogo = ({ domain, name, size = 40 }) => {
  const [failed, setFailed] = useState(false);
  const initials = (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const colors   = ['#06b6d4','#8b5cf6','#f59e0b','#22c55e','#ef4444','#3b82f6','#ec4899'];
  const color    = colors[(name?.charCodeAt(0) || 0) % colors.length];

  if (!domain || failed) {
    return (
      <div
        className="rounded-xl flex items-center justify-center text-white font-bold shrink-0"
        style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.35 }}
      >
        {initials}
      </div>
    );
  }
  return (
    <img
      src={`https://logo.clearbit.com/${domain}`}
      alt={name}
      width={size} height={size}
      className="rounded-xl object-contain bg-white/5 shrink-0"
      onError={() => setFailed(true)}
    />
  );
};

const scoreStyle = (score) => {
  if (score >= 90) return { border: 'border-green-500/50',  badge: 'bg-green-500/15 text-green-400',  label: 'Perfect Match'  };
  if (score >= 70) return { border: 'border-amber-500/50',  badge: 'bg-amber-500/15 text-amber-400',  label: 'Strong Match'   };
  if (score >= 50) return { border: 'border-blue-500/50',   badge: 'bg-blue-500/15  text-blue-400',   label: 'Good Match'     };
  return              { border: 'border-white/10',       badge: 'bg-white/10     text-text-muted', label: 'Low Match'      };
};

const timeAgo = (dateStr) => {
  if (!dateStr) return 'recently';
  const diff = Date.now() - new Date(dateStr).getTime();
  const h    = Math.floor(diff / 3600000);
  const d    = Math.floor(h / 24);
  if (h < 1)  return 'just now';
  if (h < 24) return `${h}h ago`;
  if (d < 7)  return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

export default function JobCard({ job, onClick }) {
  const qc               = useQueryClient();
  const { toggleSaved, savedIds, updateJob } = useJobStore();
  const isSaved          = savedIds.has(job.id) || job.user_feedback === 'saved';
  const score            = job.relevance_score || 0;
  const style            = scoreStyle(score);

  const saveMutation = useMutation({
    mutationFn: (saved) => saveJob(job.id, saved),
    onMutate:   (saved) => { toggleSaved(job.id); updateJob(job.id, { user_feedback: saved ? 'saved' : null }); },
    onError:    ()      => { toggleSaved(job.id); }, // revert
  });

  const feedbackMutation = useMutation({
    mutationFn: (type) => submitJobFeedback(job.id, type),
    onSuccess:  (_, type) => updateJob(job.id, { user_feedback: type }),
  });

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      className={`glass-card p-4 cursor-pointer border-l-2 ${style.border} transition-all hover:bg-white/3`}
    >
      {/* Top row */}
      <div className="flex items-start gap-3">
        <CompanyLogo domain={job.company_domain} name={job.company} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-text-primary font-semibold text-sm truncate">{job.title}</p>
              <p className="text-text-secondary text-xs mt-0.5 truncate">{job.company}</p>
            </div>
            {/* Bookmark */}
            <button
              onClick={(e) => { e.stopPropagation(); saveMutation.mutate(!isSaved); }}
              className="text-text-muted hover:text-brand-cyan transition-colors shrink-0 p-1"
            >
              {isSaved
                ? <BookmarkCheck className="w-4 h-4 text-brand-cyan" />
                : <Bookmark className="w-4 h-4" />}
            </button>
          </div>

          {/* Location + Remote */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-text-muted text-xs">
              <MapPin className="w-3 h-3" />{job.location}
            </span>
            {job.is_remote && (
              <span className="flex items-center gap-1 text-green-400 text-xs">
                <Wifi className="w-3 h-3" /> Remote
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Match score + tags */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${style.badge}`}>
            {score}% · {style.label}
          </span>
          {(job.match_breakdown_json?.matched_skills || []).slice(0, 3).map((skill) => (
            <span key={skill} className="text-xs px-2 py-0.5 bg-white/5 border border-white/10 text-text-muted rounded-lg">
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* Salary + Sources + Time */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/8">
        <div className="flex items-center gap-3">
          {job.salary_min_bdt ? (
            <span className="text-xs text-text-secondary font-medium">
              ৳{(job.salary_min_bdt / 1000).toFixed(0)}k
              {job.salary_max_bdt ? `–${(job.salary_max_bdt / 1000).toFixed(0)}k` : '+'} BDT
            </span>
          ) : (
            <span className="text-xs text-text-muted">Salary not listed</span>
          )}

          {/* Source tags */}
          <div className="flex gap-1">
            {(job.sources || []).slice(0, 2).map((src) => (
              <span key={src} className="text-xs px-1.5 py-0.5 bg-white/5 text-text-muted rounded border border-white/8">
                {src}
              </span>
            ))}
            {(job.sources || []).length > 2 && (
              <span className="text-xs text-text-muted">+{job.sources.length - 2}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Feedback */}
          <button
            onClick={(e) => { e.stopPropagation(); feedbackMutation.mutate('positive'); }}
            className={`p-1 rounded transition-colors ${job.user_feedback === 'positive' ? 'text-green-400' : 'text-text-muted hover:text-green-400'}`}
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); feedbackMutation.mutate('negative'); }}
            className={`p-1 rounded transition-colors ${job.user_feedback === 'negative' ? 'text-red-400' : 'text-text-muted hover:text-red-400'}`}
          >
            <ThumbsDown className="w-3.5 h-3.5" />
          </button>
          <span className="flex items-center gap-1 text-text-muted text-xs">
            <Clock className="w-3 h-3" />{timeAgo(job.posted_date || job.scraped_at)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
