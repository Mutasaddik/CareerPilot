import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import { Zap, Mail, RefreshCw, CheckCircle } from 'lucide-react';
import { verifyOTP, resendOTP } from '../api/authApi.js';
import useAuthStore from '../store/authStore.js';
import ParticleBackground from '../components/ParticleBackground.jsx';

const OTP_LENGTH = 6;

export default function OTPVerify() {
  const location   = useLocation();
  const navigate   = useNavigate();
  const setUser    = useAuthStore((s) => s.setUser);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { email, purpose } = location.state || {};

  const [digits,    setDigits]    = useState(Array(OTP_LENGTH).fill(''));
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState(false);
  const [timeLeft,  setTimeLeft]  = useState(120);
  const [cooldown,  setCooldown]  = useState(0);
  const [resendMsg, setResendMsg] = useState('');
  const inputRefs = useRef([]);

  // If already authenticated redirect away
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  // If no email in state redirect to login
  useEffect(() => {
    if (!email) navigate('/login', { replace: true });
  }, [email, navigate]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((v) => v - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const formatTime = (s) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const verifyMutation = useMutation({
    mutationFn: verifyOTP,
    onSuccess: (data) => {
      setSuccess(true);
      setTimeout(() => {
        if (purpose === 'forgot_password') {
          return navigate('/reset-password', {
            state: { email },
            replace: true,
          });
        }
        if (data.user) setUser(data.user);
        navigate(data.redirect || '/dashboard', { replace: true });
      }, 1500);
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Invalid OTP. Please try again.');
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    },
  });

  const resendMutation = useMutation({
    mutationFn: resendOTP,
    onSuccess: () => {
      setResendMsg('New code sent to your email.');
      setCooldown(60);
      setTimeLeft(120);
      setDigits(Array(OTP_LENGTH).fill(''));
      setError('');
      inputRefs.current[0]?.focus();
      setTimeout(() => setResendMsg(''), 4000);
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to resend.'),
  });

  const submitOTP = (otp) => {
    if (timeLeft <= 0) return setError('OTP has expired. Please request a new one.');
    verifyMutation.mutate({ email, otp, purpose });
  };

  const handleDigitChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);
    setError('');
    if (value && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    if (newDigits.every((d) => d !== '')) submitOTP(newDigits.join(''));
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0)
      inputRefs.current[index - 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (pasted.length === OTP_LENGTH) {
      setDigits(pasted.split(''));
      submitOTP(pasted);
    }
  };

  if (!email) return null;

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
                  <p className="font-display font-bold text-xl text-text-primary">Verified!</p>
                  <p className="text-text-secondary text-sm">Redirecting...</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-brand-purple/15 border border-brand-purple/20 flex items-center justify-center mx-auto">
              <Mail className="w-7 h-7 text-brand-purple" />
            </div>
            <h1 className="font-display font-bold text-2xl text-text-primary">Verify your email</h1>
            <p className="text-text-secondary text-sm">
              We sent a 6-digit code to{' '}
              <span className="text-text-primary font-medium">{email}</span>
            </p>
          </div>

          <div className="text-center">
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono font-bold ${
              timeLeft <= 30
                ? 'bg-danger/10 text-danger border border-danger/20'
                : 'bg-bg-primary/60 text-text-secondary'
            }`}>
              <div className={`w-2 h-2 rounded-full ${timeLeft > 0 ? 'animate-pulse bg-current' : 'bg-danger'}`} />
              {timeLeft > 0 ? `Expires in ${formatTime(timeLeft)}` : 'Code expired'}
            </span>
          </div>

          <div className="flex gap-3 justify-center" onPaste={handlePaste}>
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text" inputMode="numeric" maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className={`w-12 h-14 text-center text-xl font-bold rounded-xl border transition-all outline-none bg-bg-primary/60
                  ${digit ? 'border-brand-purple text-text-primary' : 'border-border text-text-primary'}
                  focus:border-brand-purple`}
                autoFocus={index === 0}
              />
            ))}
          </div>

          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-center text-danger text-sm">{error}</motion.p>
            )}
            {resendMsg && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-center text-success text-sm">{resendMsg}</motion.p>
            )}
          </AnimatePresence>

          <button
            onClick={() => submitOTP(digits.join(''))}
            disabled={digits.join('').length !== OTP_LENGTH || verifyMutation.isPending || success}
            className="btn-primary w-full py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed">
            {verifyMutation.isPending ? 'Verifying...' : 'Verify Code'}
          </button>

          <div className="text-center">
            <p className="text-sm text-text-secondary">
              Didn't receive the code?{' '}
              <button
                onClick={() => resendMutation.mutate({ email, purpose })}
                disabled={cooldown > 0 || resendMutation.isPending}
                className="text-brand-cyan hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                {resendMutation.isPending ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
              </button>
            </p>
          </div>

          <p className="text-center text-xs text-text-muted">
            <Link to="/login" className="hover:text-text-secondary">← Back to Sign In</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
