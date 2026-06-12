import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import {
  Briefcase, FileText, BarChart3, Brain, TrendingUp,
  Target, Star, CheckCircle, ChevronRight, Zap,
  Shield, ArrowRight, Menu, X, LayoutDashboard, LogOut
} from 'lucide-react';
import ParticleBackground from '../components/ParticleBackground.jsx';
import useAuthStore from '../store/authStore.js';
import { logoutUser } from '../api/authApi.js';

const fadeUp = {
  hidden:  { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};
const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const NAV_LINKS = ['Features', 'How It Works', 'Testimonials'];

const FEATURES = [
  { icon: Brain,     color: '#7c3aed', label: 'AI ATS Score',    desc: 'Know exactly how your CV ranks and what to fix.' },
  { icon: FileText,  color: '#06b6d4', label: 'Resume Review',   desc: 'Instant AI feedback that gets you callbacks.' },
  { icon: Briefcase, color: '#22c55e', label: 'Job Tracker',     desc: 'Kanban, timeline, table — track every application.' },
  { icon: Target,    color: '#f59e0b', label: 'Interview Prep',  desc: 'Real questions from real candidates at your target companies.' },
  { icon: BarChart3, color: '#3b82f6', label: 'Salary Insights', desc: 'BDT salary benchmarks so you never undersell yourself.' },
  { icon: TrendingUp,color: '#ec4899', label: 'Career Insights', desc: 'Market trends, skill gaps, personalized daily action plans.' },
];

const STATS = [
  { value: '94%',  label: 'Average ATS Score Improvement' },
  { value: '3.2×', label: 'More Interview Callbacks' },
  { value: '500+', label: 'Jobs Matched Daily' },
  { value: 'Free', label: 'Forever Core Features' },
];

const TESTIMONIALS = [
  {
    name: 'Tanvir Ahmed', role: 'Software Engineer', company: 'Grameenphone',
    avatar: 'TA', color: '#7c3aed',
    text: 'CareerPilot increased my ATS score from 62 to 92%. Got calls from top companies within a week.',
    stars: 5,
  },
  {
    name: 'Nusrat Jahan', role: 'Product Manager', company: 'bKash',
    avatar: 'NJ', color: '#06b6d4',
    text: 'The AI resume review is incredibly accurate. It caught keyword gaps I never noticed.',
    stars: 5,
  },
  {
    name: 'Mahfuzur Rahman', role: 'Data Scientist', company: 'Daraz',
    avatar: 'MR', color: '#22c55e',
    text: 'Best platform for job tracking and interview prep. The BDT salary insights are a game changer.',
    stars: 5,
  },
];

const TRUSTED_BY = ['Google', 'Microsoft', 'Daraz', 'bKash', 'Grameenphone', 'Robi'];

const HOW_IT_WORKS = [
  { step: '01', title: 'Upload Your CV',     desc: 'Paste a link or upload PDF/DOCX. We parse it in seconds.' },
  { step: '02', title: 'Get Your ATS Score', desc: 'See exactly where you stand and what recruiters see.' },
  { step: '03', title: 'Match to Real Jobs', desc: 'Jobs from LinkedIn, Indeed, Bdjobs — matched to your profile.' },
  { step: '04', title: 'Land the Interview', desc: 'Tailored prep, cover letters, and daily coaching.' },
];

function Navbar({ scrolled }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const getRedirectPath = useAuthStore((s) => s.getRedirectPath);
  const clearUser       = useAuthStore((s) => s.clearUser);

  const logoutMutation = useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      clearUser();
      setMobileOpen(false);
    },
  });

  const dashboardPath = isAuthenticated ? getRedirectPath() : '/dashboard';

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'py-3 bg-bg-secondary/90 backdrop-blur-md border-b border-border' : 'py-5'
    }`}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-gradient flex items-center justify-center shadow-glow-brand">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold text-lg text-text-primary">CareerPilot</span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a key={link} href={`#${link.toLowerCase().replace(' ', '-')}`}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors font-medium">
              {link}
            </a>
          ))}
        </div>

        {/* Desktop nav buttons */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <Link to={dashboardPath}
                className="btn-ghost text-sm py-2 px-4 flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </Link>
              <button
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                className="btn-primary text-sm py-2 px-5 flex items-center gap-2">
                <LogOut className="w-4 h-4" />
                {logoutMutation.isPending ? 'Signing out...' : 'Sign Out'}
              </button>
            </>
          ) : (
            <>
              <Link to="/login"    className="btn-ghost text-sm py-2 px-4">Sign In</Link>
              <Link to="/register" className="btn-primary text-sm py-2 px-5">Get Started Free</Link>
            </>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button className="md:hidden text-text-secondary hover:text-text-primary"
          onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="md:hidden mt-2 mx-4 rounded-2xl glass-card p-4 space-y-3">
          {NAV_LINKS.map((link) => (
            <a key={link} href={`#${link.toLowerCase().replace(' ', '-')}`}
              className="block text-sm text-text-secondary hover:text-text-primary py-2 font-medium"
              onClick={() => setMobileOpen(false)}>{link}</a>
          ))}
          <div className="pt-2 space-y-2 border-t border-border">
            {isAuthenticated ? (
              <>
                <Link to={dashboardPath} onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 btn-ghost text-sm text-center justify-center">
                  <LayoutDashboard className="w-4 h-4" /> Dashboard
                </Link>
                <button onClick={() => logoutMutation.mutate()}
                  className="w-full btn-primary text-sm flex items-center gap-2 justify-center">
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/login"    onClick={() => setMobileOpen(false)} className="block btn-ghost text-sm text-center">Sign In</Link>
                <Link to="/register" onClick={() => setMobileOpen(false)} className="block btn-primary text-sm text-center">Get Started Free</Link>
              </>
            )}
          </div>
        </motion.div>
      )}
    </nav>
  );
}

function DashboardPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-full max-w-2xl mx-auto"
    >
      <div className="absolute -inset-4 bg-glow-purple opacity-40 blur-3xl rounded-3xl" />
      <div className="relative glass-card p-1 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-danger/70" />
            <div className="w-3 h-3 rounded-full bg-warning/70" />
            <div className="w-3 h-3 rounded-full bg-success/70" />
          </div>
          <div className="flex-1 h-5 rounded-md bg-bg-primary/60 mx-4 text-xs text-text-muted flex items-center justify-center">
            careerpilot.app/dashboard
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="rounded-xl p-3 bg-brand-purple/10 border border-brand-purple/30 flex items-center gap-3">
            <span className="text-xl">🎉</span>
            <div>
              <p className="text-sm font-semibold text-text-primary">Your ATS Score is <span className="text-brand-cyan">94%</span> — Top 10%!</p>
              <p className="text-xs text-text-secondary">Keep it up! You're doing great.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-card p-3 space-y-2">
              <p className="text-xs text-text-secondary font-medium">ATS Score</p>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold text-success">94</span>
                <span className="text-success text-sm mb-1">%</span>
              </div>
              <div className="h-1.5 bg-bg-primary rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: '94%' }}
                  transition={{ delay: 0.8, duration: 1 }}
                  className="h-full bg-success rounded-full" />
              </div>
              <p className="text-xs text-success font-medium">Excellent Match 🚀</p>
            </div>
            <div className="space-y-2">
              {[{ label: 'Applications', value: '24', up: '+18%' }, { label: 'Interviews', value: '5', up: '+25%' }].map((s) => (
                <div key={s.label} className="glass-card p-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-text-secondary">{s.label}</p>
                    <p className="text-lg font-bold text-text-primary">{s.value}</p>
                  </div>
                  <span className="text-xs text-success font-semibold">{s.up}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-text-secondary font-semibold uppercase tracking-wider">Recommended Jobs</p>
            {[
              { title: 'Frontend Developer', company: 'Google',    match: 96, color: '#22c55e', tags: ['React', 'TypeScript'] },
              { title: 'Software Engineer',  company: 'Microsoft', match: 88, color: '#f59e0b', tags: ['C#', '.NET'] },
            ].map((job) => (
              <div key={job.company} className="glass-card p-2.5 flex items-center gap-3"
                style={{ borderLeft: `3px solid ${job.color}` }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: job.color + '33' }}>{job.company[0]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-text-primary truncate">{job.title}</p>
                  <p className="text-xs text-text-secondary">{job.company}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs font-bold" style={{ color: job.color }}>{job.match}%</span>
                  <div className="flex gap-1">
                    {job.tags.map((t) => (
                      <span key={t} className="px-1.5 py-0.5 rounded text-xs bg-bg-primary text-text-secondary">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary overflow-x-hidden">
      <Navbar scrolled={scrolled} />

      {/* Hero */}
      <section className="relative min-h-screen flex items-center pt-24 pb-16 overflow-hidden">
        <ParticleBackground />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-purple/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-cyan/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-8">
              <motion.div variants={fadeUp}>
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-brand-purple/30 bg-brand-purple/10 text-xs font-semibold text-brand-purple">
                  <Zap className="w-3 h-3" /> AI-Powered Career Intelligence Platform
                </span>
              </motion.div>
              <motion.div variants={fadeUp} className="space-y-2">
                <h1 className="font-display font-extrabold leading-tight" style={{ fontSize: 'clamp(2.2rem, 5vw, 3.5rem)' }}>
                  Land Better Jobs,
                </h1>
                <h1 className="font-display font-extrabold leading-tight gradient-text" style={{ fontSize: 'clamp(2.2rem, 5vw, 3.5rem)' }}>
                  Faster with AI
                </h1>
              </motion.div>
              <motion.p variants={fadeUp} className="text-lg text-text-secondary leading-relaxed max-w-lg">
                ATS scoring, smart job matching from LinkedIn, Indeed & Bdjobs, interview prep, and daily coaching — your 24/7 career co-pilot, all for free.
              </motion.p>
              <motion.div variants={fadeUp} className="flex flex-wrap gap-4">
                <Link to="/register" className="btn-primary text-base py-3 px-8 gap-2">
                  Get Started Free <ArrowRight className="w-4 h-4" />
                </Link>
                <Link to="/login" className="btn-ghost text-base py-3 px-8">Sign In</Link>
              </motion.div>
              <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-6">
                {[{ icon: Shield, text: 'Free Forever' }, { icon: CheckCircle, text: 'No Credit Card' }, { icon: Zap, text: 'Cancel Anytime' }].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2 text-sm text-text-secondary">
                    <Icon className="w-4 h-4 text-success" /><span>{text}</span>
                  </div>
                ))}
              </motion.div>
            </motion.div>
            <div className="hidden lg:block"><DashboardPreview /></div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 border-y border-border">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={stagger} className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((s) => (
              <motion.div key={s.label} variants={fadeUp} className="text-center space-y-2">
                <p className="font-display font-extrabold text-4xl gradient-text">{s.value}</p>
                <p className="text-sm text-text-secondary">{s.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }}
            variants={stagger} className="space-y-16">
            <motion.div variants={fadeUp} className="text-center space-y-4 max-w-2xl mx-auto">
              <span className="section-label">Powerful Features</span>
              <h2 className="font-display font-bold text-3xl text-text-primary">Everything you need to win your dream job</h2>
              <p className="text-text-secondary leading-relaxed">One platform. All the tools. Built specifically for the Bangladesh job market.</p>
            </motion.div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map((f) => (
                <motion.div key={f.label} variants={fadeUp} className="glass-card p-6 group cursor-default space-y-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                    style={{ background: f.color + '22', border: `1px solid ${f.color}33` }}>
                    <f.icon className="w-6 h-6" style={{ color: f.color }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-text-primary mb-2">{f.label}</h3>
                    <p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: f.color }}>
                    Learn more <ChevronRight className="w-3 h-3" />
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 bg-bg-secondary/50">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }}
            variants={stagger} className="space-y-16">
            <motion.div variants={fadeUp} className="text-center space-y-4">
              <span className="section-label">How It Works</span>
              <h2 className="font-display font-bold text-3xl">From upload to offer in 4 steps</h2>
            </motion.div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {HOW_IT_WORKS.map((item) => (
                <motion.div key={item.step} variants={fadeUp} className="glass-card p-6 space-y-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center text-white font-mono font-bold text-sm shadow-glow-brand">
                    {item.step}
                  </div>
                  <div>
                    <h3 className="font-semibold text-text-primary mb-2">{item.title}</h3>
                    <p className="text-sm text-text-secondary leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }}
            variants={stagger} className="space-y-16">
            <motion.div variants={fadeUp} className="text-center space-y-4">
              <span className="section-label">Loved by Job Seekers</span>
              <h2 className="font-display font-bold text-3xl">Real results, real people</h2>
            </motion.div>
            <div className="grid md:grid-cols-3 gap-6">
              {TESTIMONIALS.map((t) => (
                <motion.div key={t.name} variants={fadeUp} className="glass-card p-6 space-y-4">
                  <div className="flex gap-0.5">
                    {Array.from({ length: t.stars }).map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-warning text-warning" />
                    ))}
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed italic">"{t.text}"</p>
                  <div className="flex items-center gap-3 pt-2 border-t border-border">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: t.color }}>{t.avatar}</div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{t.name}</p>
                      <p className="text-xs text-text-secondary">{t.role} · {t.company}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Trusted By */}
      <section className="py-16 border-t border-border">
        <div className="max-w-7xl mx-auto px-6 space-y-8">
          <p className="text-center section-label">Trusted by employees at</p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
            {TRUSTED_BY.map((brand) => (
              <span key={brand} className="text-text-muted font-semibold text-lg hover:text-text-secondary transition-colors cursor-default">
                {brand}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-brand-purple/10 via-brand-indigo/5 to-brand-cyan/10 pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="space-y-8">
            <motion.h2 variants={fadeUp} className="font-display font-extrabold text-4xl">
              Your next job is waiting.<br /><span className="gradient-text">Start free today.</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-text-secondary text-lg">
              Join thousands of job seekers in Bangladesh using CareerPilot.
            </motion.p>
            <motion.div variants={fadeUp}>
              <Link to="/register" className="btn-primary text-base py-3.5 px-10 gap-2">
                Get Started Free <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-brand-gradient flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-display font-bold text-text-primary">CareerPilot</span>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-sm text-text-secondary">
            <Link to="/privacy" className="hover:text-text-primary transition-colors">Privacy Policy</Link>
            <Link to="/terms"   className="hover:text-text-primary transition-colors">Terms of Service</Link>
            <a href="mailto:hello@careerpilot.app" className="hover:text-text-primary transition-colors">Contact</a>
          </div>
          <p className="text-xs text-text-muted">© {new Date().getFullYear()} CareerPilot. Built in Bangladesh 🇧🇩</p>
        </div>
      </footer>
    </div>
  );
}
