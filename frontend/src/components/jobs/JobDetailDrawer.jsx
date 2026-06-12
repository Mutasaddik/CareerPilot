import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, ExternalLink, Bookmark, BookmarkCheck, MapPin, Wifi,
  ChevronRight, Loader2, Star, Building2, TrendingUp,
  Target, CheckCircle, XCircle, AlertCircle, Briefcase,
} from 'lucide-react';
import { fetchJobById, saveJob, submitJobFeedback } from '../../api/jobApi.js';
import useJobStore from '../../store/jobStore.js';

// ── Tab definitions ───────────────────────────────────────────────
const TABS = ['Match Analysis', 'CV Gap', 'Company Intel', 'Interview Intel'];

// ── Helpers ───────────────────────────────────────────────────────
const ScoreBar = ({ label, value, max = 100, color = 'cyan' }) => {
  const colors = { cyan: 'from-cyan-500 to-blue-500', green: 'from-green-500 to-emerald-500', amber: 'from-amber-500 to-yellow-500', red: 'from-red-500 to-rose-500' };
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-text-secondary">{label}</span>
        <span className="text-text-primary font-semibold">{value}%</span>
      </div>
      <div className="w-full bg-white/8 rounded-full h-1.5 overflow-hidden">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${colors[color] || colors.cyan}`}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
};

const SkillTag = ({ skill, present }) => (
  <span className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs border ${
    present
      ? 'bg-green-500/10 border-green-500/20 text-green-400'
      : 'bg-red-500/10 border-red-500/20 text-red-400'
  }`}>
    {present ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
    {skill}
  </span>
);

// ── Tab: Match Analysis ───────────────────────────────────────────
const MatchAnalysisTab = ({ job }) => {
  const breakdown = job.match_breakdown_json || {};
  const score     = job.relevance_score || 0;

  const scoreColor = score >= 90 ? 'text-green-400' : score >= 70 ? 'text-amber-400' : score >= 50 ? 'text-blue-400' : 'text-red-400';
  const barColor   = score >= 90 ? 'green' : score >= 70 ? 'amber' : 'cyan';

  return (
    <div className="space-y-5 p-5">
      {/* Overall score */}
      <div className="text-center py-4">
        <div className={`text-5xl font-black ${scoreColor}`}>{score}%</div>
        <p className="text-text-secondary text-sm mt-1">Match Score</p>
        {breakdown.success_probability && (
          <p className="text-text-muted text-xs mt-1">~{breakdown.success_probability}% success probability</p>
        )}
      </div>

      {/* Breakdown bars */}
      {breakdown.keyword_match != null && (
        <div className="glass-card p-4 space-y-3">
          <h4 className="text-text-primary font-semibold text-sm">Score Breakdown</h4>
          <ScoreBar label="Keyword Match"    value={breakdown.keyword_match    || 0} color={barColor} />
          <ScoreBar label="Skill Match"      value={breakdown.skill_match      || 0} color={barColor} />
          <ScoreBar label="Experience Match" value={breakdown.experience_match || 0} color={barColor} />
          <ScoreBar label="Salary Alignment" value={breakdown.salary_match     || 0} color={barColor} />
          <ScoreBar label="Title Match"      value={breakdown.title_match      || 0} color={barColor} />
        </div>
      )}

      {/* Matched skills */}
      {breakdown.matched_skills?.length > 0 && (
        <div className="glass-card p-4">
          <h4 className="text-text-primary font-semibold text-sm mb-3">Skills You Have</h4>
          <div className="flex flex-wrap gap-2">
            {breakdown.matched_skills.map((s) => <SkillTag key={s} skill={s} present />)}
          </div>
        </div>
      )}

      {/* Missing skills */}
      {breakdown.missing_skills?.length > 0 && (
        <div className="glass-card p-4">
          <h4 className="text-text-primary font-semibold text-sm mb-3">Missing Skills</h4>
          <div className="flex flex-wrap gap-2">
            {breakdown.missing_skills.map((s) => <SkillTag key={s} skill={s} present={false} />)}
          </div>
          <p className="text-text-muted text-xs mt-3">Adding these to your CV could significantly improve your match score.</p>
        </div>
      )}

      {/* Experience requirement */}
      {breakdown.required_years > 0 && (
        <div className="glass-card p-4 flex items-center gap-3">
          <Briefcase className="w-5 h-5 text-brand-cyan shrink-0" />
          <div>
            <p className="text-text-primary text-sm font-medium">Experience Required</p>
            <p className="text-text-secondary text-xs">{breakdown.required_years}+ years for this role</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Tab: CV Gap ───────────────────────────────────────────────────
const CVGapTab = ({ job }) => {
  const breakdown = job.match_breakdown_json || {};
  const missing   = breakdown.missing_skills || [];
  const desc      = job.description || '';

  // Extract important keywords from JD not in CV
  const jdKeywords = desc.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*|\b[A-Z]{2,}\b/g) || [];
  const uniqueKw   = [...new Set(jdKeywords)].filter((k) => k.length > 2).slice(0, 20);

  return (
    <div className="space-y-5 p-5">
      {missing.length > 0 ? (
        <>
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-red-400" />
              <h4 className="text-text-primary font-semibold text-sm">Skills to Add to Your CV</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {missing.map((s) => (
                <span key={s} className="px-2.5 py-1 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg">{s}</span>
              ))}
            </div>
          </div>

          <div className="glass-card p-4 border-l-2 border-brand-cyan">
            <p className="text-text-secondary text-sm">
              Adding these skills to your CV could raise your match score by an estimated
              <span className="text-brand-cyan font-semibold"> +{Math.min(missing.length * 4, 25)}%</span>.
            </p>
          </div>
        </>
      ) : (
        <div className="glass-card p-8 text-center">
          <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <p className="text-text-primary font-semibold">Great skill coverage!</p>
          <p className="text-text-secondary text-sm mt-1">Your CV covers the key skills for this role.</p>
        </div>
      )}

      {/* JD keywords */}
      {uniqueKw.length > 0 && (
        <div className="glass-card p-4">
          <h4 className="text-text-primary font-semibold text-sm mb-3">Keywords in Job Description</h4>
          <div className="flex flex-wrap gap-1.5">
            {uniqueKw.map((kw) => (
              <span key={kw} className="px-2 py-0.5 bg-white/5 border border-white/10 text-text-muted text-xs rounded">{kw}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Tab: Company Intel ────────────────────────────────────────────
const CompanyIntelTab = ({ job }) => {
  const siteUrl = job.company_domain ? "https://" + job.company_domain : null;
  return (
    <div className="space-y-4 p-5">
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-brand-cyan" />
          <h4 className="text-text-primary font-semibold">{job.company}</h4>
        </div>

        {siteUrl && (
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-brand-cyan text-sm hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {job.company_domain}
          </a>
        )}

        <div className="space-y-2.5">
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Location</span>
            <span className="text-text-primary">{job.location}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Work Type</span>
            <span className="text-text-primary">{job.is_remote ? "Remote Available" : "On-site"}</span>
          </div>
          {job.experience_level && (
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Level</span>
              <span className="text-text-primary capitalize">{job.experience_level}</span>
            </div>
          )}
          {job.salary_min_bdt && (
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Salary Range</span>
              <span className="text-green-400 font-medium">
                {"৳" + (job.salary_min_bdt / 1000).toFixed(0) + "k"}
                {job.salary_max_bdt ? "–" + (job.salary_max_bdt / 1000).toFixed(0) + "k" : "+"} BDT
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Sources</span>
            <div className="flex gap-1">
              {(job.sources || []).map((s) => (
                <span key={s} className="px-1.5 py-0.5 bg-white/5 border border-white/10 text-xs text-text-muted rounded">{s}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card p-4 border-l-2 border-amber-500/40">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-amber-400" />
          <p className="text-text-secondary text-xs font-medium">Company intelligence expands in Phase 9 with Glassdoor ratings, salary benchmarks, and hiring trends.</p>
        </div>
      </div>
    </div>
  );
};

// ── Tab: Interview Intel ──────────────────────────────────────────
const InterviewIntelTab = ({ job }) => (
  <div className="space-y-4 p-5">
    <div className="glass-card p-8 text-center space-y-3">
      <Star className="w-10 h-10 text-purple-400 mx-auto" />
      <p className="text-text-primary font-semibold">Interview data coming in Phase 12</p>
      <p className="text-text-secondary text-sm max-w-xs mx-auto">
        Real interview rounds, questions, and difficulty ratings scraped from candidates who interviewed at {job.company}.
      </p>
    </div>
  </div>
);

// ── Main Drawer ───────────────────────────────────────────────────
export default function JobDetailDrawer({ job, onClose }) {
  const [activeTab, setActiveTab] = useState(0);
  const qc = useQueryClient();
  const { updateJob, toggleSaved, savedIds } = useJobStore();
  const isSaved = savedIds.has(job?.id) || job?.user_feedback === 'saved';

  const [applyConfirm, setApplyConfirm] = useState(false);

  const saveMut = useMutation({
    mutationFn: (saved) => saveJob(job.id, saved),
    onMutate:   (saved) => { toggleSaved(job.id); updateJob(job.id, { user_feedback: saved ? 'saved' : null }); },
  });

  const handleApply = () => {
    window.open(job.job_url, '_blank');
    setApplyConfirm(true);
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 260 }}
      className="fixed right-0 top-0 h-full w-full md:w-[60%] bg-[#0d1526]/98 backdrop-blur-xl border-l border-white/10 z-40 flex flex-col shadow-2xl"
    >
      {/* Header */}
      <div className="p-5 border-b border-white/8 shrink-0">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3 min-w-0">
            {/* Company logo */}
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
              {job.company_logo_url
                ? <img src={job.company_logo_url} alt={job.company} className="w-full h-full object-contain p-1" onError={(e) => e.target.style.display='none'} />
                : <span className="text-text-primary font-bold text-lg">{(job.company||'?')[0]}</span>
              }
            </div>
            <div className="min-w-0">
              <h2 className="text-text-primary font-bold text-base leading-tight truncate">{job.title}</h2>
              <p className="text-text-secondary text-sm mt-0.5">{job.company}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="flex items-center gap-1 text-text-muted text-xs">
                  <MapPin className="w-3 h-3" />{job.location}
                </span>
                {job.is_remote && <span className="flex items-center gap-1 text-green-400 text-xs"><Wifi className="w-3 h-3" />Remote</span>}
                {job.salary_min_bdt && (
                  <span className="text-green-400 text-xs font-medium">
                    ৳{(job.salary_min_bdt/1000).toFixed(0)}k{job.salary_max_bdt ? `–${(job.salary_max_bdt/1000).toFixed(0)}k` : '+'} BDT
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => saveMut.mutate(!isSaved)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-text-muted hover:text-brand-cyan transition-colors">
              {isSaved ? <BookmarkCheck className="w-4 h-4 text-brand-cyan" /> : <Bookmark className="w-4 h-4" />}
            </button>
            <button onClick={onClose} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Apply button */}
        <AnimatePresence mode="wait">
          {!applyConfirm ? (
            <motion.button
              key="apply"
              onClick={handleApply}
              className="w-full btn-primary py-2.5 flex items-center justify-center gap-2 text-sm"
            >
              Apply Now <ExternalLink className="w-4 h-4" />
            </motion.button>
          ) : (
            <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2">
              <p className="flex-1 text-text-secondary text-sm py-2">Did you apply?</p>
              <button onClick={() => { setApplyConfirm(false); updateJob(job.id, { applied: true }); }}
                className="px-4 py-2 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-medium">
                Yes ✓
              </button>
              <button onClick={() => setApplyConfirm(false)}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-text-muted text-sm">
                No
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/8 shrink-0 px-2">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`flex-1 py-3 text-xs font-medium transition-colors relative ${
              activeTab === i ? 'text-brand-cyan' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab}
            {activeTab === i && (
              <motion.div layoutId="drawer-tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-cyan rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 0 && <MatchAnalysisTab job={job} />}
            {activeTab === 1 && <CVGapTab job={job} />}
            {activeTab === 2 && <CompanyIntelTab job={job} />}
            {activeTab === 3 && <InterviewIntelTab job={job} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Job description at bottom */}
      {job.description && (
        <div className="border-t border-white/8 p-5 max-h-48 overflow-y-auto shrink-0">
          <h4 className="text-text-secondary text-xs font-medium uppercase tracking-wider mb-2">Job Description</h4>
          <p className="text-text-muted text-xs leading-relaxed whitespace-pre-wrap">{job.description.slice(0, 1200)}{job.description.length > 1200 ? '…' : ''}</p>
        </div>
      )}
    </motion.div>
  );
}
