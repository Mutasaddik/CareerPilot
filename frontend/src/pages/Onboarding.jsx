import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import {
  Zap, ArrowRight, ArrowLeft, CheckCircle,
  Briefcase, MapPin, Target, DollarSign,
  FileText, Sparkles, ChevronRight
} from 'lucide-react';
import { completeOnboarding } from '../api/userApi.js';
import useAuthStore from '../store/authStore.js';
import useUserStore from '../store/userStore.js';
import ParticleBackground from '../components/ParticleBackground.jsx';

const TEMPLATES = [
  {
    id: 'modern',
    name: 'Modern',
    desc: 'Clean minimal single column',
    preview: (
      <div className="w-full h-full bg-white p-2 space-y-1.5">
        <div className="h-2 bg-violet-500 rounded w-3/4" />
        <div className="h-1 bg-gray-300 rounded w-1/2" />
        <div className="border-t border-gray-200 pt-1 space-y-1">
          <div className="h-1 bg-gray-400 rounded w-full" />
          <div className="h-1 bg-gray-300 rounded w-5/6" />
          <div className="h-1 bg-gray-300 rounded w-4/6" />
        </div>
        <div className="space-y-1">
          <div className="h-1 bg-gray-400 rounded w-2/3" />
          <div className="h-1 bg-gray-300 rounded w-full" />
          <div className="h-1 bg-gray-300 rounded w-5/6" />
        </div>
      </div>
    ),
  },
  {
    id: 'classic',
    name: 'Classic',
    desc: 'Traditional two column',
    preview: (
      <div className="w-full h-full bg-white p-2 flex gap-1.5">
        <div className="w-1/3 space-y-1.5 border-r border-gray-200 pr-1.5">
          <div className="h-1.5 bg-gray-800 rounded w-full" />
          <div className="h-1 bg-gray-300 rounded w-4/5" />
          <div className="h-1 bg-gray-300 rounded w-3/4" />
          <div className="h-1 bg-gray-300 rounded w-full" />
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="h-1.5 bg-gray-600 rounded w-3/4" />
          <div className="h-1 bg-gray-300 rounded w-full" />
          <div className="h-1 bg-gray-300 rounded w-5/6" />
          <div className="h-1 bg-gray-300 rounded w-4/5" />
        </div>
      </div>
    ),
  },
  {
    id: 'ats_pure',
    name: 'ATS Pure',
    desc: 'Zero formatting, maximum ATS score',
    preview: (
      <div className="w-full h-full bg-white p-2 space-y-1.5">
        <div className="text-center space-y-0.5">
          <div className="h-1.5 bg-gray-800 rounded w-1/2 mx-auto" />
          <div className="h-1 bg-gray-400 rounded w-2/3 mx-auto" />
        </div>
        <div className="space-y-1">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-1 bg-gray-300 rounded" style={{ width: `${85 + Math.random() * 15}%` }} />
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'match_own',
    name: 'Match My Own',
    desc: 'Follows your uploaded CV structure',
    preview: (
      <div className="w-full h-full bg-white p-2 space-y-1.5 flex flex-col items-center justify-center">
        <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
          <FileText className="w-4 h-4 text-violet-600" />
        </div>
        <div className="h-1 bg-gray-300 rounded w-3/4" />
        <div className="h-1 bg-gray-200 rounded w-1/2" />
      </div>
    ),
  },
];

const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship'];
const REMOTE_OPTIONS = [
  { value: 'onsite',  label: 'On-site only' },
  { value: 'hybrid',  label: 'Hybrid' },
  { value: 'remote',  label: 'Remote only' },
  { value: 'any',     label: 'Open to all' },
];

const POPULAR_ROLES = ['Software Engineer', 'Frontend Developer', 'Backend Developer', 'Full Stack Developer', 'Data Scientist', 'Product Manager', 'UI/UX Designer', 'DevOps Engineer', 'QA Engineer', 'Business Analyst'];
const POPULAR_SKILLS = ['React', 'Node.js', 'Python', 'Java', 'TypeScript', 'SQL', 'AWS', 'Docker', 'Git', 'REST API', 'PostgreSQL', 'MongoDB'];
const BD_LOCATIONS = ['Dhaka', 'Chittagong', 'Sylhet', 'Rajshahi', 'Khulna', 'Remote', 'Anywhere in Bangladesh'];

const stepVariants = {
  enter:  { opacity: 0, x: 40 },
  center: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
  exit:   { opacity: 0, x: -40, transition: { duration: 0.3 } },
};

export default function Onboarding() {
  const navigate = useNavigate();
  const user     = useAuthStore((s) => s.user);
  const setProfile = useUserStore((s) => s.setProfile);

  const [step, setStep]   = useState(0);
  const [direction, setDirection] = useState(1);
  const [form, setForm]   = useState({
    template:         'modern',
    targetRoles:      [],
    targetLocations:  [],
    skills:           [],
    jobType:          'full-time',
    salaryMinBdt:     '',
    salaryMaxBdt:     '',
    remotePreference: 'any',
  });

  const mutation = useMutation({
    mutationFn: () => completeOnboarding({
      preferences: {
        targetRoles:      form.targetRoles,
        targetLocations:  form.targetLocations,
        skills:           form.skills,
        jobType:          form.jobType.toLowerCase(),
        salaryMinBdt:     form.salaryMinBdt ? parseInt(form.salaryMinBdt) : null,
        salaryMaxBdt:     form.salaryMaxBdt ? parseInt(form.salaryMaxBdt) : null,
        remotePreference: form.remotePreference,
        cvTemplatePreference: form.template,
      },
    }),
    onSuccess: () => {
      navigate('/dashboard-home', { replace: true }); queryClient?.invalidateQueries?.({ queryKey: ['user-profile'] });
    },
  });

  const STEPS = [
    { title: 'Welcome to CareerPilot! 🎉', subtitle: `Great to have you, ${user?.name?.split(' ')[0]}. Let's set up your profile in 3 quick steps.` },
    { title: 'Choose your CV template', subtitle: 'Pick a style for your AI-generated CVs. You can change this anytime.' },
    { title: 'What are you looking for?', subtitle: 'This helps us match you with the right jobs.' },
    { title: 'Salary & work style', subtitle: 'Set your expectations so we show relevant opportunities.' },
  ];

  const goNext = () => {
    if (step < STEPS.length - 1) {
      setDirection(1);
      setStep((s) => s + 1);
    } else {
      mutation.mutate();
    }
  };

  const goBack = () => {
    if (step > 0) {
      setDirection(-1);
      setStep((s) => s - 1);
    }
  };

  const toggleItem = (field, value) => {
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(value)
        ? f[field].filter((v) => v !== value)
        : [...f[field], value],
    }));
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center relative overflow-hidden py-12 px-4">
      <ParticleBackground />
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-brand-purple/15 rounded-full blur-3xl pointer-events-none" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-2xl">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center shadow-glow-brand">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-text-primary">CareerPilot</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-8 space-y-2">
          <div className="flex justify-between text-xs text-text-muted">
            <span>Step {step + 1} of {STEPS.length}</span>
            <span>{Math.round(((step + 1) / STEPS.length) * 100)}% complete</span>
          </div>
          <div className="h-1.5 bg-bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-brand-gradient rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>

        <div className="glass-card p-8 min-h-96 flex flex-col">
          {/* Step header */}
          <div className="mb-6">
            <h1 className="font-display font-bold text-2xl text-text-primary">{STEPS[step].title}</h1>
            <p className="text-text-secondary text-sm mt-1">{STEPS[step].subtitle}</p>
          </div>

          {/* Step content */}
          <div className="flex-1">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div key={step} custom={direction}
                variants={stepVariants} initial="enter" animate="center" exit="exit">

                {/* Step 0 — Welcome */}
                {step === 0 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { icon: Target,     color: '#7c3aed', title: 'Smart Job Matching',   desc: 'Jobs matched to your skills from LinkedIn, Indeed & Bdjobs' },
                        { icon: FileText,   color: '#06b6d4', title: 'AI CV Analysis',        desc: 'Get your ATS score and daily improvement tips' },
                        { icon: Briefcase,  color: '#22c55e', title: 'Application Tracker',  desc: 'Track every application in Kanban, Timeline & Table views' },
                        { icon: Sparkles,   color: '#f59e0b', title: 'Daily Action Plan',    desc: 'Personalized career coaching every morning' },
                      ].map(({ icon: Icon, color, title, desc }) => (
                        <div key={title} className="p-4 rounded-xl bg-bg-primary/60 border border-border space-y-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + '22' }}>
                            <Icon className="w-4 h-4" style={{ color }} />
                          </div>
                          <p className="text-sm font-semibold text-text-primary">{title}</p>
                          <p className="text-xs text-text-secondary leading-relaxed">{desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 1 — Template picker */}
                {step === 1 && (
                  <div className="grid grid-cols-2 gap-4">
                    {TEMPLATES.map((t) => (
                      <button key={t.id} onClick={() => setForm((f) => ({ ...f, template: t.id }))}
                        className={`p-3 rounded-xl border-2 transition-all text-left space-y-2 ${
                          form.template === t.id
                            ? 'border-brand-purple bg-brand-purple/10'
                            : 'border-border hover:border-border-bright bg-bg-primary/40'
                        }`}>
                        <div className="h-28 rounded-lg overflow-hidden border border-border">
                          {t.preview}
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-text-primary">{t.name}</p>
                            {form.template === t.id && <CheckCircle className="w-4 h-4 text-brand-purple" />}
                          </div>
                          <p className="text-xs text-text-secondary">{t.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Step 2 — Job preferences */}
                {step === 2 && (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-text-secondary">Target Roles <span className="text-text-muted">(select all that apply)</span></label>
                      <div className="flex flex-wrap gap-2">
                        {POPULAR_ROLES.map((role) => (
                          <button key={role} onClick={() => toggleItem('targetRoles', role)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                              form.targetRoles.includes(role)
                                ? 'bg-brand-purple/15 border-brand-purple/40 text-brand-purple'
                                : 'bg-bg-primary/40 border-border text-text-secondary hover:border-border-bright'
                            }`}>{role}</button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-text-secondary">Preferred Locations</label>
                      <div className="flex flex-wrap gap-2">
                        {BD_LOCATIONS.map((loc) => (
                          <button key={loc} onClick={() => toggleItem('targetLocations', loc)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                              form.targetLocations.includes(loc)
                                ? 'bg-brand-cyan/15 border-brand-cyan/40 text-brand-cyan'
                                : 'bg-bg-primary/40 border-border text-text-secondary hover:border-border-bright'
                            }`}>{loc}</button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-text-secondary">Your Skills</label>
                      <div className="flex flex-wrap gap-2">
                        {POPULAR_SKILLS.map((skill) => (
                          <button key={skill} onClick={() => toggleItem('skills', skill)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                              form.skills.includes(skill)
                                ? 'bg-success/15 border-success/40 text-success'
                                : 'bg-bg-primary/40 border-border text-text-secondary hover:border-border-bright'
                            }`}>{skill}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3 — Salary & work style */}
                {step === 3 && (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-text-secondary">Job Type</label>
                      <div className="flex flex-wrap gap-2">
                        {JOB_TYPES.map((type) => (
                          <button key={type} onClick={() => setForm((f) => ({ ...f, jobType: type }))}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                              form.jobType === type
                                ? 'bg-brand-purple/15 border-brand-purple/40 text-brand-purple'
                                : 'bg-bg-primary/40 border-border text-text-secondary hover:border-border-bright'
                            }`}>{type}</button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-text-secondary">Work Style</label>
                      <div className="grid grid-cols-2 gap-2">
                        {REMOTE_OPTIONS.map((opt) => (
                          <button key={opt.value} onClick={() => setForm((f) => ({ ...f, remotePreference: opt.value }))}
                            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all border text-left ${
                              form.remotePreference === opt.value
                                ? 'bg-brand-cyan/15 border-brand-cyan/40 text-brand-cyan'
                                : 'bg-bg-primary/40 border-border text-text-secondary hover:border-border-bright'
                            }`}>{opt.label}</button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                        <DollarSign className="w-4 h-4" /> Expected Salary Range (BDT/month)
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">৳</span>
                          <input type="number" placeholder="Min (e.g. 50000)"
                            value={form.salaryMinBdt}
                            onChange={(e) => setForm((f) => ({ ...f, salaryMinBdt: e.target.value }))}
                            className="input-field pl-7" />
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">৳</span>
                          <input type="number" placeholder="Max (e.g. 100000)"
                            value={form.salaryMaxBdt}
                            onChange={(e) => setForm((f) => ({ ...f, salaryMaxBdt: e.target.value }))}
                            className="input-field pl-7" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between pt-6 mt-6 border-t border-border">
            <button onClick={goBack} disabled={step === 0}
              className="btn-ghost gap-2 disabled:opacity-0 disabled:pointer-events-none">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <button onClick={step === STEPS.length - 1 ? goNext : goNext}
              disabled={mutation.isPending}
              className="btn-primary gap-2">
              {mutation.isPending ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Saving...
                </span>
              ) : step === STEPS.length - 1 ? (
                <><CheckCircle className="w-4 h-4" /> Get Started</>
              ) : (
                <>Next <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </div>

          {/* Skip link */}
          {step < STEPS.length - 1 && (
            <button onClick={() => { setDirection(1); setStep(STEPS.length - 1); }}
              className="text-center text-xs text-text-muted hover:text-text-secondary mt-3 transition-colors w-full">
              Skip setup — I'll do this later
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
