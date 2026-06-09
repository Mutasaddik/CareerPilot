import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import { Zap, Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import { forgotPassword } from '../api/authApi.js';
import ParticleBackground from '../components/ParticleBackground.jsx';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent,  setSent]  = useState(false);

  const mutation = useMutation({
    mutationFn: forgotPassword,
    onSuccess: () => {
      setSent(true);
      setTimeout(() => {
        navigate('/verify-otp', { state: { email: email.trim().toLowerCase(), purpose: 'forgot_password' } });
      }, 2000);
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to send reset code.'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim()) return setError('Email is required.');
    setError('');
    mutation.mutate({ email: email.trim().toLowerCase() });
  };

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

        <div className="glass-card p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-brand-purple/15 border border-brand-purple/20 flex items-center justify-center mx-auto">
              <Mail className="w-7 h-7 text-brand-purple" />
            </div>
            <h1 className="font-display font-bold text-2xl text-text-primary">Forgot your password?</h1>
            <p className="text-text-secondary text-sm">Enter your email and we'll send you a reset code.</p>
          </div>

          <AnimatePresence mode="wait">
            {sent ? (
              <motion.div key="sent" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center space-y-3 py-4">
                <div className="w-12 h-12 rounded-full bg-success/15 border border-success/20 flex items-center justify-center mx-auto">
                  <Mail className="w-6 h-6 text-success" />
                </div>
                <p className="text-text-primary font-semibold">Code sent!</p>
                <p className="text-text-secondary text-sm">Redirecting to verification...</p>
              </motion.div>
            ) : (
              <motion.form key="form" onSubmit={handleSubmit} className="space-y-4">
                <AnimatePresence>
                  {error && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="px-4 py-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm">
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input type="email" placeholder="Your email address"
                    value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    className="input-field pl-10" required autoFocus />
                </div>
                <button type="submit" disabled={mutation.isPending}
                  className="btn-primary w-full py-3 text-base gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                  {mutation.isPending ? 'Sending...' : <> Send Reset Code <ArrowRight className="w-4 h-4" /></>}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <p className="text-center text-sm">
            <Link to="/login" className="text-brand-cyan hover:underline inline-flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Back to Sign In
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
