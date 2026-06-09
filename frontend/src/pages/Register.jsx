import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, Zap, ArrowRight, User, Mail, Lock, Phone, Briefcase, MapPin } from 'lucide-react';
import { registerUser } from '../api/authApi.js';
import useAuthStore from '../store/authStore.js';
import ParticleBackground from '../components/ParticleBackground.jsx';

const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 8)  score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { score, label: 'Weak',   color: '#ef4444' };
  if (score <= 2) return { score, label: 'Fair',   color: '#f59e0b' };
  if (score <= 3) return { score, label: 'Good',   color: '#3b82f6' };
  if (score <= 4) return { score, label: 'Strong', color: '#22c55e' };
  return { score, label: 'Very Strong', color: '#22c55e' };
};

const getProfileCompletion = (form) => {
  const fields = ['name', 'email', 'password', 'phone', 'currentTitle', 'experienceYears', 'location'];
  const filled = fields.filter((f) => form[f] && form[f].toString().trim() !== '').length;
  return Math.round((filled / fields.length) * 100);
};

const OAuthButton = ({ icon, label, href }) => (
  <a href={href}
    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-border bg-bg-primary/40 hover:bg-bg-primary/70 hover:border-border-bright transition-all duration-200 text-sm font-medium text-text-secondary hover:text-text-primary">
    <span className="text-lg">{icon}</span>
    <span>{label}</span>
  </a>
);

export default function Register() {
  const navigate  = useNavigate();
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');
  const [form,     setForm]     = useState({
    name: '', email: '', password: '', phone: '',
    currentTitle: '', experienceYears: '', location: '',
  });

  const completion  = getProfileCompletion(form);
  const pwStrength  = getPasswordStrength(form.password);

  const mutation = useMutation({
    mutationFn: registerUser,
    onSuccess: (data) => {
      navigate('/verify-otp', {
        state: { email: form.email, purpose: 'registration', name: form.name },
      });
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    },
  });

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim())     return setError('Full name is required.');
    if (!form.email.trim())    return setError('Email is required.');
    if (form.password.length < 8) return setError('Password must be at least 8 characters.');
    mutation.mutate({
      name:            form.name.trim(),
      email:           form.email.trim().toLowerCase(),
      password:        form.password,
      phone:           form.phone || undefined,
      currentTitle:    form.currentTitle || undefined,
      experienceYears: form.experienceYears ? parseInt(form.experienceYears) : undefined,
      location:        form.location || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center relative overflow-hidden py-12 px-4">
      <ParticleBackground />
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-brand-purple/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-brand-cyan/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div initial="hidden" animate="visible" variants={fadeUp}
        className="relative z-10 w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center shadow-glow-brand">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-text-primary">CareerPilot</span>
          </Link>
          <p className="mt-3 text-text-secondary text-sm">Join thousands of job seekers in Bangladesh</p>
        </div>

        <div className="glass-card p-8 space-y-6">
          <div>
            <h1 className="font-display font-bold text-2xl text-text-primary">Create your account</h1>
            <p className="text-text-secondary text-sm mt-1">Free forever. No credit card required.</p>
          </div>

          {/* Profile completion bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">💡 More info = better job matches!</span>
              <span className="font-semibold" style={{ color: completion >= 70 ? '#22c55e' : '#f59e0b' }}>
                {completion}% complete
              </span>
            </div>
            <div className="h-1.5 bg-bg-primary rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${completion}%` }}
                transition={{ duration: 0.4 }}
                className="h-full rounded-full"
                style={{ background: completion >= 70 ? '#22c55e' : 'linear-gradient(90deg,#7c3aed,#06b6d4)' }}
              />
            </div>
          </div>

          {/* OAuth buttons */}
          <div className="space-y-2">
            <OAuthButton href="/api/v1/auth/google"   icon="G" label="Continue with Google" />
            <OAuthButton href="/api/v1/auth/linkedin"  icon="in" label="Continue with LinkedIn — Auto-imports profile" />
            <OAuthButton href="/api/v1/auth/github"    icon="⌥" label="Continue with GitHub" />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-text-muted">or register with email</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="px-4 py-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm">
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input name="name" type="text" placeholder="Full Name *"
                value={form.name} onChange={handleChange}
                className="input-field pl-10" required />
            </div>

            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input name="email" type="email" placeholder="Email *"
                value={form.email} onChange={handleChange}
                className="input-field pl-10" required />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input name="password" type={showPass ? 'text' : 'password'} placeholder="Password *"
                  value={form.password} onChange={handleChange}
                  className="input-field pl-10 pr-10" required />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.password && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map((i) => (
                      <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
                        style={{ background: i <= pwStrength.score ? pwStrength.color : 'rgba(255,255,255,0.08)' }} />
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: pwStrength.color }}>{pwStrength.label}</p>
                </div>
              )}
            </div>

            {/* Optional fields */}
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input name="phone" type="tel" placeholder="Phone (Optional)"
                value={form.phone} onChange={handleChange}
                className="input-field pl-10" />
            </div>

            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input name="currentTitle" type="text" placeholder="Current Job Title (Optional)"
                value={form.currentTitle} onChange={handleChange}
                className="input-field pl-10" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input name="experienceYears" type="number" placeholder="Years of Exp." min="0" max="50"
                value={form.experienceYears} onChange={handleChange}
                className="input-field" />
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input name="location" type="text" placeholder="Location"
                  value={form.location} onChange={handleChange}
                  className="input-field pl-10" />
              </div>
            </div>

            <button type="submit" disabled={mutation.isPending}
              className="btn-primary w-full py-3 text-base gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
              {mutation.isPending ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Creating account...
                </span>
              ) : (
                <>Create Account <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-text-secondary">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-cyan hover:underline font-medium">Sign In</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
