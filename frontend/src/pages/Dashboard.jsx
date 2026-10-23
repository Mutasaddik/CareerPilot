import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  FileText, Briefcase, TrendingUp, Star, Target,
  CalendarClock, ArrowRight, Upload, Sparkles, Trophy,
} from 'lucide-react';
import useAuthStore from '../store/authStore.js';
import useCVStore from '../store/cvStore.js';
import useJobStore from '../store/jobStore.js';
import { fetchJobStats, fetchJobs } from '../api/jobApi.js';
import { getAllCVs } from '../api/cvApi.js';
import JobCard from '../components/jobs/JobCard.jsx';

// ── Animated ATS gauge ────────────────────────────────────────────
const ATSGauge = ({ score }) => {
  const pct   = Math.max(0, Math.min(100, score || 0));
  const color = pct >= 90 ? '#22c55e' : pct >= 70 ? '#f59e0b' : pct >= 50 ? '#06b6d4' : '#ef4444';
  const R = 70, C = 2 * Math.PI * R;
  const offset = C - (pct / 100) * C;

  return (
    <div className="relative w-44 h-44 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
        <motion.circle
          cx="80" cy="80" r={R} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-4xl font-black"
          style={{ color }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
        >
          {pct}%
        </motion.span>
        <span className="text-text-muted text-xs mt-1">ATS Score</span>
      </div>
    </div>
  );
};

// ── Match breakdown bars (from analysis_json) ─────────────────────
const BreakdownBars = ({ analysis }) => {
  // Tolerate multiple shapes the analysis_json may carry.
  const breakdown = analysis?.breakdown || analysis?.scores || analysis?.categories;
  const entries = breakdown && typeof breakdown === 'object'
    ? Object.entries(breakdown).filter(([, v]) => typeof v === 'number').slice(0, 5)
    : [];

  if (entries.length === 0) {
    return (
      <p className="text-text-muted text-sm">
        Detailed breakdown appears after your CV is analyzed.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map(([label, value]) => {
        const v = Math.max(0, Math.min(100, value));
        const color = v >= 90 ? 'bg-green-400' : v >= 70 ? 'bg-amber-400' : 'bg-brand-cyan';
        return (
          <div key={label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-text-secondary capitalize">{label}</span>
              <span className="text-text-primary font-medium">{v}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/8 overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${color}`}
                initial={{ width: 0 }} animate={{ width: `${v}%` }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Empty-state widget (used by future-phase zones) ───────────────
const EmptyWidget = ({ icon: Icon, title, sub, ctaLabel, onCta }) => (
  <div className="flex flex-col items-center text-center py-6">
    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
      <Icon className="w-6 h-6 text-text-muted" />
    </div>
    <p className="text-text-primary text-sm font-semibold">{title}</p>
    <p className="text-text-muted text-xs mt-1 mb-3 max-w-[200px]">{sub}</p>
    {ctaLabel && (
      <button onClick={onCta} className="btn-ghost text-xs px-3 py-1.5">{ctaLabel}</button>
    )}
  </div>
);

const Card = ({ children, className = '' }) => (
  <div className={`glass-card p-5 ${className}`}>{children}</div>
);

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const { atsScore, analysisData, primaryCV, setCVs } = useCVStore();
  const { setStats, setJobs, jobs } = useJobStore();

  // CV data → cvStore
  const { data: cvData } = useQuery({
    queryKey: ['dashboard-cvs'],
    queryFn:  getAllCVs,
    staleTime: 5 * 60 * 1000,
  });
  useEffect(() => { if (cvData?.cvs) setCVs(cvData.cvs); }, [cvData]);

  // Job stats → jobStore
  const { data: statsData } = useQuery({
    queryKey: ['dashboard-job-stats'],
    queryFn:  fetchJobStats,
    staleTime: 5 * 60 * 1000,
  });
  useEffect(() => { if (statsData?.stats) setStats(statsData.stats); }, [statsData]);

  // Top recommended jobs → jobStore
  const { data: jobsData } = useQuery({
    queryKey: ['dashboard-top-jobs'],
    queryFn:  () => fetchJobs({ limit: 3, offset: 0, minScore: 70, search: '' }),
    staleTime: 5 * 60 * 1000,
  });
  useEffect(() => { if (jobsData?.jobs) setJobs(jobsData.jobs, jobsData.total || 0); }, [jobsData]);

  const stats = statsData?.stats;
  const topJobs = useMemo(() => (jobs || []).slice(0, 3), [jobs]);
  const firstName = (user?.name || 'there').split(' ')[0];
  const hasCV = atsScore !== null && atsScore !== undefined;
  const celebrate = hasCV && atsScore >= 90;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-5">
      {/* Greeting */}
      <div>
        <h1 className="text-text-primary text-2xl font-bold">
          Welcome back, {firstName} 👋
        </h1>
        <p className="text-text-muted text-sm mt-0.5">
          Here's your career snapshot for today.
        </p>
      </div>

      {/* Celebration banner at 90%+ */}
      {celebrate && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5 border border-green-500/30 bg-green-500/5 flex items-center gap-4"
          data-testid="dashboard-celebration"
        >
          <div className="w-12 h-12 rounded-xl bg-green-500/15 flex items-center justify-center shrink-0">
            <Trophy className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <p className="text-text-primary font-bold">
              Amazing! Your ATS score is {atsScore}% — you're in the top tier of candidates.
            </p>
            <p className="text-text-secondary text-sm">Keep it up. Your CV is highly competitive.</p>
          </div>
        </motion.div>
      )}

      {/* Top stat row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Matched',    value: stats?.total_matched || 0,        icon: Briefcase,  color: 'text-brand-cyan' },
          { label: 'Excellent (90%+)', value: stats?.excellent || 0,            icon: Star,       color: 'text-green-400' },
          { label: 'Strong (70%+)',    value: stats?.strong || 0,               icon: TrendingUp, color: 'text-amber-400' },
          { label: 'Top Score',        value: `${stats?.top_score || 0}%`,      icon: Star,       color: 'text-purple-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-card p-4 flex items-center gap-3" data-testid={`dash-stat-${label}`}>
            <Icon className={`w-5 h-5 ${color} shrink-0`} />
            <div>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-text-muted text-xs">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ATS score */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-text-primary font-bold">Your ATS Score</h2>
            <button onClick={() => navigate('/cv')} className="text-brand-cyan text-xs hover:underline">
              View CV Studio
            </button>
          </div>
          {hasCV ? (
            <>
              <ATSGauge score={atsScore} />
              <p className="text-center text-text-muted text-xs mt-2">
                {primaryCV?.file_name || 'Primary CV'}
              </p>
            </>
          ) : (
            <EmptyWidget
              icon={Upload}
              title="No CV uploaded yet"
              sub="Upload your CV to get an instant ATS score and tailored job matches."
              ctaLabel="Upload CV"
              onCta={() => navigate('/cv')}
            />
          )}
        </Card>

        {/* Match breakdown */}
        <Card>
          <h2 className="text-text-primary font-bold mb-4">Match Breakdown</h2>
          {hasCV
            ? <BreakdownBars analysis={analysisData} />
            : <EmptyWidget icon={FileText} title="No analysis yet"
                sub="Your CV breakdown by skills, experience, and keywords shows here." />}
        </Card>

        {/* Daily goal — Phase 14 store */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-text-primary font-bold">Daily Goal</h2>
            <Target className="w-4 h-4 text-text-muted" />
          </div>
          <EmptyWidget
            icon={Target}
            title="No goals set for today"
            sub="Your daily action plan and goal ring activate soon."
          />
        </Card>
      </div>

      {/* Recommended jobs */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-cyan" />
            <h2 className="text-text-primary font-bold">Recommended Jobs</h2>
          </div>
          <button onClick={() => navigate('/jobs')}
                  className="text-brand-cyan text-xs hover:underline flex items-center gap-1">
            View All Jobs <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        {topJobs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topJobs.map((job) => (
              <JobCard key={job.id} job={job} onClick={() => navigate('/jobs')} />
            ))}
          </div>
        ) : (
          <EmptyWidget
            icon={Briefcase}
            title="No matches yet"
            sub="Jobs are being scraped and scored against your profile. Check back shortly."
            ctaLabel="Go to Jobs"
            onCta={() => navigate('/jobs')}
          />
        )}
      </Card>

      {/* Bottom row: next interview + market (future-phase stores) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-text-primary font-bold">Next Interview</h2>
            <CalendarClock className="w-4 h-4 text-text-muted" />
          </div>
          <EmptyWidget
            icon={CalendarClock}
            title="No interviews scheduled"
            sub="Scheduled interviews and countdowns appear here."
            ctaLabel="Interview Prep"
            onCta={() => navigate('/interview-prep')}
          />
        </Card>
        <Card>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-text-primary font-bold">Market Update</h2>
            <TrendingUp className="w-4 h-4 text-text-muted" />
          </div>
          <EmptyWidget
            icon={TrendingUp}
            title="Market data loading"
            sub="Trending skills and BDT salary benchmarks for your roles show here."
            ctaLabel="Market Trends"
            onCta={() => navigate('/market')}
          />
        </Card>
      </div>
    </div>
  );
}
