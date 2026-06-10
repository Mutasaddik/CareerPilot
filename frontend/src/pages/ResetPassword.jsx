import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, Zap, ArrowRight, Lock, CheckCircle } from 'lucide-react';
import { resetPassword } from '../api/authApi.js';
import ParticleBackground from '../components/ParticleBackground.jsx';

const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 8)        score++;
  if (password.length >= 12)       score++;
  if (/[A-Z]/.test(password))      score++;
  if (/[0-9]/.test(password))      score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { score, label: 'Weak',        color: '#ef4444' };
  if (score <= 2) return { score, label: 'Fair',        color: '#f59e0b' };
  if (score <= 3) return { score, label: 'Good',        color: '#3b82f6' };
  if (score <= 4) return { score, label: 'Strong',      color: '#22c55e' };
  return             { score, label: 'Very Strong',  color: '#22c55e' };
};

export default function ResetPassword() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { email, otp } = location.state || {};

  const [form,     setForm]     = useState({ newPassword: '', confirmPassword: '' });
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState(false);
  const pwStrength = getPasswordStrength(form.newPassword);

  const mutation = useMutation({
    mutationFn: resetPassword,
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2500);
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Password reset failed. Please try again.');
    },
  });

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.newPassword.length < 8)               return setError('Password must be at least 8 characters.');
    if (form.newPassword !== form.confirmPassword)  return setError('Passwords do not match.');
    mutation.mutate({ email, newPassword: form.newPassword });
  };

  if (!email || !otp) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
        <div className="glass-card p-8 text-center space-y-4 max-w-sm w-full">
          <p className="text-text-secondary">Invalid reset session. Please start over.</p>
          <Link to="/forgot-password" className="btn-primary w-full justify-center">
            Start Over
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center relative overflow-hidden py-12 px-4">
      <ParticleBackground />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-48 bg-brand-purple/20 rounded-full blur-3xl pointer-events-none" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }} className="relative z-10 w-full max-w-md">

        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center shadow-glow-brand">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-text-primary">CareerPilot</span>
          </Link>
        </div>

        <div className="glass-card p-8 space-y-6 relative">
          <AnimatePresence>
            {success && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="absolute inset-0 flex items-center justify-center bg-bg-elevated/95 rounded-2xl z-10">
                <div className="text-center space-y-3">
                  <CheckCircle className="w-16 h-16 text-success mx-auto" />
                  <p className="font-display font-bold text-xl text-text-primary">Password Reset!</p>
                  <p className="text-text-secondary text-sm">Redirecting to login...</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-brand-purple/15 border border-brand-purple/20 flex items-center justify-center mx-auto">
              <Lock className="w-7 h-7 text-brand-purple" />
            </div>
            <h1 className="font-display font-bold text-2xl text-text-primary">Set new password</h1>
            <p className="text-text-secondary text-sm">
              Resetting password for <span className="text-text-primary font-medium">{email}</span>
            </p>
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
            {/* New password */}
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input name="newPassword" type={showPass ? 'text' : 'password'}
                  placeholder="New password (min 8 characters)"
                  value={form.newPassword} onChange={handleChange}
                  className="input-field pl-10 pr-10" required autoFocus />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.newPassword && (
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

            {/* Confirm password */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input name="confirmPassword" type={showConf ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={form.confirmPassword} onChange={handleChange}
                className="input-field pl-10 pr-10" required />
              <button type="button" onClick={() => setShowConf(!showConf)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
                {showConf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {form.confirmPassword && form.newPassword !== form.confirmPassword && (
              <p className="text-xs text-danger">Passwords do not match.</p>
            )}
            {form.confirmPassword && form.newPassword === form.confirmPassword && form.confirmPassword.length >= 8 && (
              <p className="text-xs text-success flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Passwords match
              </p>
            )}

            <button type="submit" disabled={mutation.isPending}
              className="btn-primary w-full py-3 text-base gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
              {mutation.isPending ? 'Resetting...' : <>Reset Password <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="text-center text-sm">
            <Link to="/login" className="text-brand-cyan hover:underline">← Back to Sign In</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
