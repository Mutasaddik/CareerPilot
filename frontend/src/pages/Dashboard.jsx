import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Briefcase, TrendingUp, Sparkles, Send, CalendarClock, ArrowRight, Upload,
  Check, X as XIcon, Loader2, Building2, Lightbulb, KanbanSquare,
  CalendarX2, ListChecks, Award, Circle,
} from 'lucide-react';
import useAuthStore from '../store/authStore.js';
import useCVStore from '../store/cvStore.js';
import useJobStore from '../store/jobStore.js';
import { fetchJobStats, fetchJobs, fetchClosingSoon } from '../api/jobApi.js';
import { fetchMyCertifications } from '../api/certificationApi.js';
import { getMyRole } from '../api/userApi.js';
import CertificationCard from '../components/certifications/CertificationCard.jsx';
import { getAllCVs, createCVRewrite } from '../api/cvApi.js';
import { fetchApplications, fetchNextInterview } from '../api/applicationApi.js';
import { fetchMarketUpdate } from '../api/marketApi.js';
import JobCard from '../components/jobs/JobCard.jsx';
import JobDetailDrawer from '../components/jobs/JobDetailDrawer.jsx';
import { formatSalary } from '../components/jobs/SalaryTag.jsx';
import ProfessionCard from '../components/profile/ProfessionCard.jsx';

// ── Helpers ───────────────────────────────────────────────────────
const ACRONYMS = new Set(['qa', 'sqa', 'hr', 'ui', 'ux', 'it', 'devops']);
const roleName = (s) => (s || '').split(' ')
  .map((w) => (ACRONYMS.has(w) ? (w === 'devops' ? 'DevOps' : w.toUpperCase()) : w.charAt(0).toUpperCase() + w.slice(1)))
  .join(' ');
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const Card = ({ children, className = '' }) => (
  <div className={`glass-card p-5 ${className}`}>{children}</div>
);

const CardHeader = ({ icon: Icon, title, action }) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-brand-cyan" />
      <h2 className="text-text-primary font-bold">{title}</h2>
    </div>
    {action}
  </div>
);

const LinkButton = ({ onClick, children }) => (
  <button onClick={onClick} className="text-brand-cyan text-xs hover:underline flex items-center gap-1">
    {children} <ArrowRight className="w-3 h-3" />
  </button>
);

const EmptyWidget = ({ icon: Icon, title, sub, ctaLabel, onCta }) => (
  <div className="flex flex-col items-center text-center py-6">
    <div className="w-12 h-12 rounded-xl bg-fg/5 border border-fg/10 flex items-center justify-center mb-3">
      <Icon className="w-6 h-6 text-text-muted" />
    </div>
    <p className="text-text-primary text-sm font-semibold">{title}</p>
    <p className="text-text-muted text-xs mt-1 mb-3 max-w-[240px]">{sub}</p>
    {ctaLabel && <button onClick={onCta} className="btn-ghost text-xs px-3 py-1.5">{ctaLabel}</button>}
  </div>
);

const Spinner = () => (
  <div className="h-28 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-text-muted" /></div>
);

// ── ATS gauge ─────────────────────────────────────────────────────
const ATSGauge = ({ score }) => {
  const pct   = Math.max(0, Math.min(100, score || 0));
  const color = `rgb(var(--${pct >= 90 ? 'success' : pct >= 70 ? 'warning' : pct >= 50 ? 'brand-cyan' : 'danger'}))`;
  const R = 70, C = 2 * Math.PI * R;
  return (
    <div className="relative w-32 h-32 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
        <motion.circle
          cx="80" cy="80" r={R} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C - (pct / 100) * C }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black" style={{ color }}>{pct}%</span>
        <span className="text-text-muted text-[11px]">ATS score</span>
      </div>
    </div>
  );
};

// ── Your CV: score + the two most useful fixes ────────────────────
const CVCard = ({ navigate, atsScore, analysis }) => {
  const hasCV = atsScore !== null && atsScore !== undefined;
  const fixes = (Array.isArray(analysis?.improvements) ? analysis.improvements : []).slice(0, 2);
  return (
    <Card>
      <CardHeader icon={Lightbulb} title="Your CV" action={hasCV && <LinkButton onClick={() => navigate('/cv')}>CV Studio</LinkButton>} />
      {!hasCV ? (
        <EmptyWidget icon={Upload} title="No CV uploaded yet"
          sub="Upload your CV to get your ATS score and jobs matched to you."
          ctaLabel="Upload CV" onCta={() => navigate('/cv')} />
      ) : (
        <div className="space-y-4">
          <div className="flex justify-center"><ATSGauge score={atsScore} /></div>
          {fixes.length > 0 ? (
            <div className="space-y-2">
              <p className="text-text-secondary text-xs">Top fixes</p>
              {fixes.map((fix, i) => (
                <p key={i} className="text-text-primary text-xs leading-relaxed p-2.5 rounded-lg bg-fg/3 border border-fg/8">{fix}</p>
              ))}
            </div>
          ) : (
            <p className="text-text-muted text-xs text-center">No fixes suggested — your CV covers the basics.</p>
          )}
          <button onClick={() => navigate('/cv')}
            className="w-full text-xs py-2 rounded-xl border border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Rewrite my CV with AI
          </button>
        </div>
      )}
    </Card>
  );
};

// ── Market update for the user's role (real job ads only) ─────────
const MAX_SKILLS = 6;

const MarketCard = ({ navigate }) => {
  const { data, isLoading, isError } = useQuery({ queryKey: ['market'], queryFn: fetchMarketUpdate, staleTime: 10 * 60 * 1000 });
  const m = data?.market;

  const body = (() => {
    if (isLoading) return <Spinner />;
    if (isError)   return <p className="text-text-muted text-sm py-6 text-center">Market data couldn't load. Try again later.</p>;
    if (!m?.role) {
      return (
        <EmptyWidget icon={TrendingUp} title="We don't know your role yet"
          sub="Upload your CV or set a target role in Settings to see the market for your role."
          ctaLabel="Upload CV" onCta={() => navigate('/cv')} />
      );
    }
    // Missing skills first — they're the useful part
    const skills = [...m.top_skills].sort((a, b) => (a.has - b.has) || (b.percent - a.percent)).slice(0, MAX_SKILLS);
    const showCompanies = m.top_companies.some((c) => c.jobs > 1);
    return (
      <div className="space-y-4">
        <p className="text-text-secondary text-xs">{roleName(m.role)} · {m.level}-level</p>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-fg/3 border border-fg/8 p-3">
            <p className="text-text-primary font-bold text-lg">{m.active_jobs}</p>
            <p className="text-text-muted text-[11px]">open jobs for your role</p>
          </div>
          <div className="rounded-xl bg-fg/3 border border-fg/8 p-3"
            title={m.salary ? `Typical pay posted in ${m.salary.sample_size} job ads` : 'Fewer than 5 job ads for your role list a salary'}>
            {m.salary ? (
              <>
                <p className="text-text-primary font-bold text-lg">{formatSalary(m.salary)}</p>
                <p className="text-text-muted text-[11px]">typical pay · {plural(m.salary.sample_size, 'job ad')}</p>
              </>
            ) : (
              <>
                <p className="text-text-muted font-medium text-sm leading-7">Not enough data yet</p>
                <p className="text-text-muted text-[11px]">typical pay</p>
              </>
            )}
          </div>
        </div>

        {skills.length > 0 && (
          <div className="space-y-2">
            <p className="text-text-secondary text-xs">Skills employers ask for most</p>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((sk) => (
                <span key={sk.name} title={`In ${sk.jobs} of ${m.active_jobs} job ads`}
                  className={`text-[11px] px-2 py-1 rounded-full border inline-flex items-center gap-1
                    ${sk.has ? 'text-green-300 bg-green-500/10 border-green-500/20' : 'text-amber-300 bg-amber-500/10 border-amber-500/20'}`}>
                  {sk.has ? <Check className="w-3 h-3" /> : <XIcon className="w-3 h-3" />}{sk.name} · {sk.percent}%
                </span>
              ))}
            </div>
            {m.missing_skills.length > 0 && (
              <p className="text-xs"><span className="text-amber-300">Skills to improve:</span>{' '}
                <span className="text-text-secondary">{m.missing_skills.slice(0, 4).join(', ')}</span></p>
            )}
          </div>
        )}

        {showCompanies && (
          <div className="space-y-1.5">
            <p className="text-text-secondary text-xs">Hiring most right now</p>
            {m.top_companies.filter((c) => c.jobs > 1).slice(0, 3).map((c) => (
              <div key={c.name} className="flex items-center justify-between text-xs">
                <span className="text-text-primary flex items-center gap-1.5 truncate"><Building2 className="w-3 h-3 text-text-muted shrink-0" />{c.name}</span>
                <span className="text-text-muted shrink-0">{plural(c.jobs, 'job')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  })();

  return (
    <Card className="lg:col-span-2">
      <CardHeader icon={TrendingUp} title="Market Update" action={m?.role && <LinkButton onClick={() => navigate('/jobs')}>Matching jobs</LinkButton>} />
      {body}
    </Card>
  );
};

// ── Pipeline: tracker summary + next interview ────────────────────
const ROUND_LABELS = { phone: 'Phone screen', technical: 'Technical', assessment: 'Assessment', hr: 'HR', final: 'Final', other: 'Interview' };

const countdown = (iso) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'Happening now';
  const hours = ms / 3600000;
  if (hours < 1)  return `In ${Math.max(1, Math.round(ms / 60000))} min`;
  if (hours < 24) return `In ${plural(Math.round(hours), 'hour')}`;
  return `In ${plural(Math.round(hours / 24), 'day')}`;
};

const PipelineCard = ({ navigate, appStats }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['next-interview'],
    queryFn:  fetchNextInterview,
    refetchInterval: 60 * 1000, // keep the countdown fresh
  });
  const iv = data?.interview;

  const tailorMut = useMutation({
    mutationFn: () => createCVRewrite({ jobId: iv.job_id }),
    onSuccess:  (res) => navigate(`/cv?rewrite=${res.rewrite.id}`),
  });

  const s = appStats || { applied: 0, responses: 0, follow_ups_due: 0, offers: 0 };
  const numbers = [
    { label: 'Applied',        value: s.applied },
    { label: 'Replies',        value: s.responses },
    { label: 'Follow-ups due', value: s.follow_ups_due, warn: s.follow_ups_due > 0 },
    { label: 'Offers',         value: s.offers },
  ];

  return (
    <Card>
      <CardHeader icon={KanbanSquare} title="Your Pipeline" action={<LinkButton onClick={() => navigate('/tracker')}>Open Tracker</LinkButton>} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="grid grid-cols-4 gap-2">
          {numbers.map(({ label, value, warn }) => (
            <div key={label} className="text-center">
              <p className={`text-xl font-bold ${warn ? 'text-amber-300' : 'text-text-primary'}`}>{value}</p>
              <p className="text-text-muted text-[11px] leading-tight">{label}</p>
            </div>
          ))}
        </div>

        <div className="md:border-l md:border-fg/8 md:pl-5">
          {isLoading ? <Spinner /> : !iv ? (
            <div className="flex items-center gap-3 text-xs">
              <CalendarClock className="w-5 h-5 text-text-muted shrink-0" />
              <p className="text-text-muted">No interviews scheduled. Add one from the Tracker when you get the call.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-amber-300 text-lg font-black">{countdown(iv.scheduled_at)}</span>
                <span className="text-text-secondary text-xs text-right">
                  {new Date(iv.scheduled_at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-text-primary text-sm font-semibold leading-snug">{iv.job_title}</p>
              <p className="text-text-secondary text-xs">{iv.company} · {ROUND_LABELS[iv.round_type] || 'Interview'}
                {iv.upcoming_count > 1 && <span className="text-text-muted"> · +{iv.upcoming_count - 1} more upcoming</span>}</p>
              {iv.job_id && (
                <button onClick={() => tailorMut.mutate()} disabled={tailorMut.isPending}
                  className="text-xs text-brand-cyan flex items-center gap-1 hover:underline disabled:opacity-60">
                  {tailorMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Tailor my CV for this interview
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

// ── Dates ('YYYY-MM-DD' from the API) ────────────────────────────
const localDate = (ymd) => { const [y, m, d] = ymd.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const daysUntil = (ymd) => { const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((localDate(ymd) - t) / 86400000); };
const closesLabel = (ymd) => {
  const d = daysUntil(ymd);
  const day = localDate(ymd).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return d === 0 ? 'closes today' : d === 1 ? 'closes tomorrow' : `closes ${day}`;
};

// ── Closing soon: strong matches with a deadline in the next 7 days ──
const ClosingSoonCard = ({ onOpen }) => {
  const { data, isLoading } = useQuery({ queryKey: ['closing-soon'], queryFn: fetchClosingSoon, staleTime: 5 * 60 * 1000 });
  const jobs = data?.jobs || [];
  return (
    <Card>
      <CardHeader icon={CalendarX2} title="Closing soon" />
      {isLoading ? <Spinner /> : jobs.length === 0 ? (
        <p className="text-text-muted text-sm">None of your strong matches close in the next 7 days.</p>
      ) : (
        <div className="space-y-2">
          {jobs.map((j) => {
            const urgent = daysUntil(j.deadline) <= 2;
            return (
              <button key={j.id} onClick={() => onOpen(j)}
                className="w-full text-left p-2.5 rounded-lg border border-fg/8 hover:border-fg/20 transition-colors">
                <p className="text-text-primary text-sm font-medium leading-snug">{j.title}</p>
                <p className="text-text-secondary text-xs">{j.company}</p>
                <p className={`text-xs mt-0.5 font-semibold ${urgent ? 'text-danger' : 'text-warning'}`}>
                  {closesLabel(j.deadline)} · {j.relevance_score}% match
                </p>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
};

// ── Certifications for the user's field (top 3) ───────────────────
const CertificationsMiniCard = ({ navigate }) => {
  const { data, isLoading } = useQuery({ queryKey: ['certifications'], queryFn: fetchMyCertifications, staleTime: 10 * 60 * 1000 });
  const top = (data?.certifications || []).filter((c) => !c.has).slice(0, 3);
  return (
    <Card>
      <CardHeader icon={Award} title="Certifications" action={data?.role && <LinkButton onClick={() => navigate('/certifications')}>See all</LinkButton>} />
      {isLoading ? <Spinner /> : !data?.role ? (
        <p className="text-text-muted text-sm">Upload your CV to see certifications for your field.</p>
      ) : top.length === 0 ? (
        <p className="text-text-muted text-sm">No certifications to suggest for {data.role} yet.</p>
      ) : (
        <div className="space-y-2">{top.map((c) => <CertificationCard key={c.id} cert={c} role={data.role} compact />)}</div>
      )}
    </Card>
  );
};

// ── This week's to-do, built only from real state ─────────────────
// Each item disappears by itself once the underlying thing is done
// (applied, follow-up date moved, profession confirmed…).
const WeekTodoCard = ({ navigate, hasCV, onOpenJob }) => {
  const { data: roleData }  = useQuery({ queryKey: ['user-role'], queryFn: getMyRole });
  const { data: appsData }  = useQuery({ queryKey: ['applications'], queryFn: fetchApplications });
  const { data: ivData }    = useQuery({ queryKey: ['next-interview'], queryFn: fetchNextInterview, refetchInterval: 60 * 1000 });
  const { data: closing }   = useQuery({ queryKey: ['closing-soon'], queryFn: fetchClosingSoon, staleTime: 5 * 60 * 1000 });
  const { data: certs }     = useQuery({ queryKey: ['certifications'], queryFn: fetchMyCertifications, staleTime: 10 * 60 * 1000 });

  const items = [];
  if (!hasCV) items.push({ key: 'cv', text: 'Upload your CV so we can match jobs to you', act: () => navigate('/cv') });
  else if (roleData?.success && !roleData.confirmed) {
    items.push({ key: 'role', text: `Confirm your profession${roleData.matched ? ` (we read "${roleData.matched}")` : ''}`, act: () => window.scrollTo({ top: 0, behavior: 'smooth' }) });
  }
  const iv = ivData?.interview;
  if (iv && new Date(iv.scheduled_at) - Date.now() < 7 * 86400000) {
    const when = new Date(iv.scheduled_at).toLocaleString('en-GB', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    items.push({ key: 'iv', text: `Prepare for your interview at ${iv.company} — ${when}`, act: () => navigate('/tracker') });
  }
  const today = new Date().toISOString().slice(0, 10);
  for (const a of (appsData?.applications || [])) {
    if (a.follow_up_date && a.follow_up_date.slice(0, 10) <= today && !['offer', 'rejected', 'withdrawn'].includes(a.status)) {
      const late = -daysUntil(a.follow_up_date);
      items.push({ key: `fu-${a.id}`, text: `Follow up with ${a.company}${late > 0 ? ` (${late} day${late === 1 ? '' : 's'} overdue)` : ' (today)'}`, act: () => navigate('/tracker') });
    }
  }
  for (const j of (closing?.jobs || []).slice(0, 2)) {
    items.push({ key: `ap-${j.id}`, text: `Apply to ${j.title} at ${j.company} — ${closesLabel(j.deadline)}`, act: () => onOpenJob(j) });
  }
  const cert = (certs?.certifications || []).find((c) => c.kind === 'ads' && !c.has && c.evidence.ads >= 2);
  if (cert) items.push({ key: 'cert', text: `Look into ${cert.name.split(' (')[0]} — asked in ${cert.evidence.percent}% of ${certs.role} ads`, act: () => navigate('/certifications') });

  return (
    <Card>
      <CardHeader icon={ListChecks} title="This week" />
      {items.length === 0 ? (
        <p className="text-text-muted text-sm">You're all caught up. New tasks appear here as jobs, deadlines and interviews come in.</p>
      ) : (
        <ul className="space-y-1">
          {items.slice(0, 6).map((it) => (
            <li key={it.key}>
              <button onClick={it.act} className="w-full text-left flex items-start gap-2 p-2 rounded-lg hover:bg-fg/5 transition-colors">
                <Circle className="w-4 h-4 text-brand-purple shrink-0 mt-0.5" />
                <span className="text-text-primary text-sm leading-snug">{it.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

// ── Page ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { atsScore, analysisData, setCVs } = useCVStore();
  const { drawerOpen, drawerJob, openDrawer, closeDrawer } = useJobStore();

  const { data: cvData } = useQuery({ queryKey: ['dashboard-cvs'], queryFn: getAllCVs, staleTime: 5 * 60 * 1000 });
  useEffect(() => { if (cvData?.cvs) setCVs(cvData.cvs); }, [cvData]);

  const { data: statsData } = useQuery({ queryKey: ['dashboard-job-stats'], queryFn: fetchJobStats, staleTime: 5 * 60 * 1000 });
  const { data: appsData }  = useQuery({ queryKey: ['applications'], queryFn: fetchApplications });
  const { data: nextIv }    = useQuery({ queryKey: ['next-interview'], queryFn: fetchNextInterview, refetchInterval: 60 * 1000 });

  // Fetch a few extra so jobs already applied to can be skipped
  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ['jobs', 'dashboard-top'],
    queryFn:  () => fetchJobs({ limit: 10, offset: 0, minScore: 70, search: '' }),
    staleTime: 5 * 60 * 1000,
  });
  const topJobs = useMemo(
    () => (jobsData?.jobs || []).filter((j) => !j.application_status || j.application_status === 'saved').slice(0, 3),
    [jobsData]
  );

  // The job panel is shared with the Jobs page through the store — close it when leaving
  useEffect(() => () => closeDrawer(), []);

  const stats    = statsData?.stats;
  const appStats = appsData?.stats;
  const strong   = parseInt(stats?.strong_matches) || 0;
  const newWeek  = parseInt(stats?.new_this_week) || 0;
  const hasCV    = atsScore !== null && atsScore !== undefined;
  const firstName = (user?.name || 'there').split(' ')[0];

  const summary = !hasCV
    ? 'Upload your CV to get jobs matched to you.'
    : [
        plural(strong, 'strong match', 'strong matches'),
        `${newWeek} new this week`,
        appStats?.follow_ups_due ? plural(appStats.follow_ups_due, 'follow-up') + ' due' : null,
      ].filter(Boolean).join(' · ');

  const tiles = [
    { label: 'Strong matches', value: strong,                         icon: Briefcase,     color: 'text-brand-cyan', to: '/jobs' },
    { label: 'New this week',  value: newWeek,                        icon: Sparkles,      color: 'text-green-400',  to: '/jobs' },
    { label: 'Applied',        value: appStats?.applied || 0,         icon: Send,          color: 'text-amber-400',  to: '/tracker' },
    { label: 'Interviews',     value: nextIv?.interview?.upcoming_count || 0, icon: CalendarClock, color: 'text-purple-400', to: '/tracker', sub: 'upcoming' },
  ];

  return (
    <div className="max-w-7xl 2xl:max-w-[1680px] mx-auto px-4 md:px-6 py-6">
     <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_23rem] items-start">
     <div className="space-y-5 min-w-0">
      {/* Greeting + what needs attention */}
      <div>
        <h1 className="text-text-primary text-2xl font-bold">Welcome back, {firstName} 👋</h1>
        <p className="text-text-secondary text-sm mt-0.5">{summary}</p>
      </div>

      {/* "We read your CV as X — is that right?" until the user confirms */}
      <ProfessionCard />

      {/* Numbers that lead somewhere */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map(({ label, value, icon: Icon, color, to, sub }) => (
          <button key={label} onClick={() => navigate(to)} data-testid={`dash-stat-${label}`}
            className="glass-card p-4 flex items-center gap-3 text-left hover:border-fg/20 transition-colors">
            <Icon className={`w-5 h-5 ${color} shrink-0`} />
            <div>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-text-muted text-xs">{label}{sub ? ` · ${sub}` : ''}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Recommended jobs — what people come for */}
      <Card>
        <CardHeader icon={Sparkles} title="Recommended for you" action={<LinkButton onClick={() => navigate('/jobs')}>All jobs</LinkButton>} />
        {jobsLoading ? <Spinner /> : topJobs.length > 0 ? (
          <div className="grid job-grid gap-4">
            {topJobs.map((job) => <JobCard key={job.id} job={job} onClick={() => openDrawer(job)} />)}
          </div>
        ) : (
          <EmptyWidget icon={Briefcase}
            title={hasCV ? 'No new strong matches right now' : 'Upload your CV to see matches'}
            sub={hasCV ? 'New jobs arrive every few hours. Lower the match filter on the Jobs page to see more.' : 'We match every job against your CV.'}
            ctaLabel={hasCV ? 'Go to Jobs' : 'Upload CV'} onCta={() => navigate(hasCV ? '/jobs' : '/cv')} />
        )}
      </Card>

      {/* CV + market */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <CVCard navigate={navigate} atsScore={atsScore} analysis={analysisData} />
        <MarketCard navigate={navigate} />
      </div>

      <PipelineCard navigate={navigate} appStats={appStats} />
     </div>

      {/* Right column on wide screens (stacks below on smaller ones) */}
      <aside className="space-y-5 min-w-0">
        <WeekTodoCard navigate={navigate} hasCV={hasCV} onOpenJob={openDrawer} />
        <ClosingSoonCard onOpen={openDrawer} />
        <CertificationsMiniCard navigate={navigate} />
      </aside>
     </div>

      {/* Job details panel */}
      <AnimatePresence>
        {drawerOpen && drawerJob && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeDrawer}
              className="fixed inset-0 bg-black/40 z-30"
            />
            <JobDetailDrawer job={drawerJob} onClose={closeDrawer} />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
