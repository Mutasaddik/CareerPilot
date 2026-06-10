import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, Zap, ArrowRight, ArrowLeft, Mail, Lock } from 'lucide-react';
import { loginUser } from '../api/authApi.js';
import useAuthStore from '../store/authStore.js';
import ParticleBackground from '../components/ParticleBackground.jsx';

const shakeVariant = {
  shake: {
    x: [-10, 10, -10, 10, -6, 6, -3, 3, 0],
    transition: { duration: 0.5 },
  },
};

const OAuthButton = ({ icon, label, href, disabled }) => (
  <a
    href={disabled ? '#' : href}
    onClick={disabled ? (e) => e.preventDefault() : undefined}
    className={[
      'flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-medium',
      disabled
        ? 'border-border/50 bg-bg-primary/20 text-text-muted cursor-not-allowed opacity-50'
        : 'border-border bg-bg-primary/40 hover:bg-bg-primary/70 hover:border-border-bright text-text-secondary hover:text-text-primary cursor-pointer',
    ].join(' ')}
  >
    <span className="text-lg">{icon}</span>
    <span>{label}</span>
    {disabled && <span className="ml-auto text-xs text-text-muted">Coming soon</span>}
  </a>
);
export default function Login() {
  const navigate   = useNavigate();
  const setUser    = useAuthStore((s) => s.setUser);
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');
  const [shaking,  setShaking]  = useState(false);
  const [remember, setRemember] = useState(false);
  const [form,     setForm]     = useState({ email: '', password: '' });

  const oauthConfigured = false; // Set to true when OAuth keys are added to .env

  const mutation = useMutation({
    mutationFn: loginUser,
    onSuccess: (data) => {
      if (data.needsOTP) {
        return navigate('/verify-otp', { state: { email: form.email, purpose: 'new_device' } });
      }
      if (data.needsVerification) {
        return navigate('/verify-otp', { state: { email: form.email, purpose: 'registration' } });
      }
      setUser(data.user);
      navigate(data.redirect || '/dashboard');
    },
    onError: (err) => {
      const responseData = err.response?.data;
      if (responseData?.needsVerification) {
        return navigate('/verify-otp', { state: { email: form.email, purpose: 'registration' } });
      }
      setError(responseData?.error || 'Invalid email or password.');
      setShaking(true);
      setTimeout(() => setShaking(false), 600);
    },
  });

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.email.trim())    return setError('Email is required.');
    if (!form.password.trim()) return setError('Password is required.');
    mutation.mutate({ email: form.email.trim().toLowerCase(), password: form.password });
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center relative overflow-hidden py-12 px-4">
      <ParticleBackground />
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-brand-purple/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-brand-cyan/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md">

        {/* Back button */}
        <div className="mb-6">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>

        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center shadow-glow-brand">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-text-primary">CareerPilot</span>
          </Link>
          <p className="mt-3 text-text-secondary text-sm">Welcome back</p>
        </div>

        <motion.div variants={shakeVariant} animate={shaking ? 'shake' : ''}
          className="glass-card p-8 space-y-6">

          <div>
            <h1 className="font-display font-bold text-2xl text-text-primary">Sign in to continue</h1>
            <p className="text-text-secondary text-sm mt-1">Your career co-pilot is waiting.</p>
          </div>

          <div className="space-y-2">
            <OAuthButton href="/api/v1/auth/google"   icon="G"  label="Continue with Google"   disabled={!oauthConfigured} />
            <OAuthButton href="/api/v1/auth/linkedin"  icon="in" label="Continue with LinkedIn"  disabled={!oauthConfigured} />
            <OAuthButton href="/api/v1/auth/github"    icon="⌥"  label="Continue with GitHub"    disabled={!oauthConfigured} />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-text-muted">or sign in with email</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="px-4 py-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm">
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input name="email" type="email" placeholder="Email"
                value={form.email} onChange={handleChange}
                className="input-field pl-10" required autoFocus />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input name="password" type={showPass ? 'text' : 'password'} placeholder="Password"
                value={form.password} onChange={handleChange}
                className="input-field pl-10 pr-10" required />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-border bg-bg-primary accent-brand-purple" />
                <span className="text-sm text-text-secondary">Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-sm text-brand-cyan hover:underline">
                Forgot password?
              </Link>
            </div>

            <button type="submit" disabled={mutation.isPending}
              className="btn-primary w-full py-3 text-base gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
              {mutation.isPending ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Signing in...
                </span>
              ) : (<>Sign In <ArrowRight className="w-4 h-4" /></>)}
            </button>
          </form>

          <p className="text-center text-sm text-text-secondary">
            Don't have an account?{' '}
            <Link to="/register" className="text-brand-cyan hover:underline font-medium">
              Get Started Free
            </Link>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
