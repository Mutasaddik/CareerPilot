import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import {
  Eye, EyeOff, Zap, ArrowRight, ArrowLeft,
  User, Mail, Lock, Phone, Briefcase, MapPin, CheckCircle, XCircle, ChevronDown
} from 'lucide-react';
import { registerUser } from '../api/authApi.js';
import ParticleBackground from '../components/ParticleBackground.jsx';

const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

const RESERVED_NAMES = ['admin', 'root', 'system', 'superadmin', 'moderator', 'support', 'careerpilot'];
const DISPOSABLE_DOMAINS = ['tempmail.com', 'throwaway.com', 'mailinator.com', 'guerrillamail.com', 'yopmail.com', '10minutemail.com', 'trashmail.com'];
const PROFANITY = ['fuck', 'shit', 'ass', 'dick', 'porn'];

const BD_LOCATIONS = [
  { flag: '🇧🇩', label: 'Dhaka, Bangladesh' },
  { flag: '🇧🇩', label: 'Chittagong, Bangladesh' },
  { flag: '🇧🇩', label: 'Sylhet, Bangladesh' },
  { flag: '🇧🇩', label: 'Rajshahi, Bangladesh' },
  { flag: '🇧🇩', label: 'Khulna, Bangladesh' },
  { flag: '🇧🇩', label: 'Barishal, Bangladesh' },
  { flag: '🇧🇩', label: 'Mymensingh, Bangladesh' },
  { flag: '🇧🇩', label: 'Rangpur, Bangladesh' },
  { flag: '🇧🇩', label: 'Comilla, Bangladesh' },
  { flag: '🇧🇩', label: 'Gazipur, Bangladesh' },
  { flag: '🇧🇩', label: 'Narayanganj, Bangladesh' },
  { flag: '🇧🇩', label: 'Remote — Bangladesh' },
];

const OTHER_LOCATIONS = [
  { flag: '🇮🇳', label: 'India' },
  { flag: '🇵🇰', label: 'Pakistan' },
  { flag: '🇱🇰', label: 'Sri Lanka' },
  { flag: '🇳🇵', label: 'Nepal' },
  { flag: '🇲🇾', label: 'Malaysia' },
  { flag: '🇸🇬', label: 'Singapore' },
  { flag: '🇦🇪', label: 'UAE' },
  { flag: '🇸🇦', label: 'Saudi Arabia' },
  { flag: '🇶🇦', label: 'Qatar' },
  { flag: '🇬🇧', label: 'United Kingdom' },
  { flag: '🇺🇸', label: 'United States' },
  { flag: '🇦🇺', label: 'Australia' },
  { flag: '🇨🇦', label: 'Canada' },
  { flag: '🌍', label: 'Other / Remote' },
];

const ALL_LOCATIONS = [...BD_LOCATIONS, ...OTHER_LOCATIONS];

const validators = {
  name: (v) => {
    const trimmed = v.trim();
    if (!trimmed) return 'Full name is required.';
    if (trimmed.length < 2) return 'Name must be at least 2 characters.';
    if (trimmed.length > 50) return 'Name cannot exceed 50 characters.';
    if (!/^[a-zA-Z\u0980-\u09FF\s.'-]+$/.test(trimmed)) return 'Name can only contain letters and spaces.';
    if (/\d/.test(trimmed)) return 'Name cannot contain numbers.';
    if (RESERVED_NAMES.some((r) => trimmed.toLowerCase().includes(r))) return 'This name is not allowed.';
    if (PROFANITY.some((p) => trimmed.toLowerCase().includes(p))) return 'Please use an appropriate name.';
    return null;
  },
  email: (v) => {
    const trimmed = v.trim().toLowerCase();
    if (!trimmed) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'Please enter a valid email address.';
    if (trimmed.length > 254) return 'Email is too long.';
    const domain = trimmed.split('@')[1];
    if (DISPOSABLE_DOMAINS.includes(domain)) return 'Disposable email addresses are not allowed.';
    return null;
  },
  password: (v) => {
    if (!v) return 'Password is required.';
    if (v.length < 8) return 'Password must be at least 8 characters.';
    if (v.length > 128) return 'Password is too long.';
    if (!/[A-Z]/.test(v)) return 'Password must contain at least one uppercase letter.';
    if (!/[a-z]/.test(v)) return 'Password must contain at least one lowercase letter.';
    if (!/[0-9]/.test(v)) return 'Password must contain at least one number.';
    if (!/[^A-Za-z0-9]/.test(v)) return 'Password must contain at least one special character.';
    return null;
  },
  confirmPassword: (v, password) => {
    if (!v) return 'Please confirm your password.';
    if (v !== password) return 'Passwords do not match.';
    return null;
  },
  phone: (v) => {
    if (!v) return null;
    const digits = v.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) return 'Please enter a valid phone number.';
    return null;
  },
  experienceYears: (v) => {
    if (!v) return null;
    const num = parseInt(v);
    if (isNaN(num) || num < 0) return 'Experience must be a positive number.';
    if (num > 50) return 'Experience cannot exceed 50 years.';
    return null;
  },
};

const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 8)          score++;
  if (password.length >= 12)         score++;
  if (/[A-Z]/.test(password))        score++;
  if (/[0-9]/.test(password))        score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const levels = [
    { score: 1, label: 'Weak',        color: '#ef4444' },
    { score: 2, label: 'Fair',        color: '#f59e0b' },
    { score: 3, label: 'Good',        color: '#3b82f6' },
    { score: 4, label: 'Strong',      color: '#22c55e' },
    { score: 5, label: 'Very Strong', color: '#22c55e' },
  ];
  return levels.find((l) => l.score === score) || { score: 0, label: '', color: '' };
};

const getProfileCompletion = (form) => {
  const fields = ['name', 'email', 'password', 'phone', 'currentTitle', 'experienceYears', 'location'];
  const filled = fields.filter((f) => form[f] && form[f].toString().trim() !== '').length;
  return Math.round((filled / fields.length) * 100);
};

const OAuthButton = ({ icon, label }) => (
  <button type="button" disabled
    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-border/50 bg-bg-primary/20 text-text-muted cursor-not-allowed opacity-50 text-sm font-medium">
    <span className="text-lg">{icon}</span>
    <span>{label}</span>
    <span className="ml-auto text-xs">Coming soon</span>
  </button>
);

function FieldError({ error }) {
  if (!error) return null;
  return (
    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
      className="text-xs text-danger flex items-center gap-1 mt-1">
      <XCircle className="w-3 h-3 shrink-0" />{error}
    </motion.p>
  );
}

function FieldSuccess({ show }) {
  if (!show) return null;
  return <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-success" />;
}

export default function Register() {
  const navigate = useNavigate();
  const [showPass,    setShowPass]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [touched,     setTouched]     = useState({});
  const [serverError, setServerError] = useState('');
  const [agreed,      setAgreed]      = useState(false);
  const [locOpen,     setLocOpen]     = useState(false);

  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    phone: '', currentTitle: '', experienceYears: '', location: '',
  });

  const [errors, setErrors] = useState({});

  const completion = getProfileCompletion(form);
  const pwStrength = getPasswordStrength(form.password);

  const validateAll = () => {
    const newErrors = {};
    Object.keys(validators).forEach((field) => {
      const err = field === 'confirmPassword'
        ? validators.confirmPassword(form.confirmPassword, form.password)
        : validators[field](form[field] || '');
      if (err) newErrors[field] = err;
    });
    if (!agreed) newErrors.agreed = 'You must accept the Terms & Conditions.';
    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let sanitized = value;
    if (name === 'name') sanitized = value.replace(/[<>{}[\]\\\/0-9]/g, '');
    if (name === 'experienceYears') sanitized = value.replace(/[^0-9]/g, '').slice(0, 2);
    if (name === 'phone') sanitized = value.replace(/[^0-9+\-() ]/g, '').slice(0, 15);

    setForm((f) => ({ ...f, [name]: sanitized }));
    setServerError('');

    if (touched[name]) {
      const err = name === 'confirmPassword'
        ? validators.confirmPassword(sanitized, form.password)
        : validators[name] ? validators[name](sanitized) : null;
      setErrors((e) => ({ ...e, [name]: err }));
    }
    if (name === 'password' && touched.confirmPassword) {
      setErrors((e) => ({ ...e, confirmPassword: validators.confirmPassword(form.confirmPassword, sanitized) }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((t) => ({ ...t, [name]: true }));
    const err = name === 'confirmPassword'
      ? validators.confirmPassword(value, form.password)
      : validators[name] ? validators[name](value) : null;
    setErrors((e) => ({ ...e, [name]: err }));
  };

  const mutation = useMutation({
    mutationFn: registerUser,
    onSuccess: () => {
      navigate('/verify-otp', {
        state: { email: form.email.trim().toLowerCase(), purpose: 'registration', name: form.name.trim() },
      });
    },
    onError: (err) => {
      const status = err.response?.status;
      const msg    = err.response?.data?.error || 'Registration failed. Please try again.';
      if (status === 409) {
        setErrors((e) => ({ ...e, email: 'This email is already registered. Try signing in.' }));
        setTouched((t) => ({ ...t, email: true }));
      }
      setServerError(status !== 409 ? msg : '');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const allTouched = Object.keys(form).reduce((acc, k) => ({ ...acc, [k]: true }), {});
    setTouched({ ...allTouched, agreed: true });
    const newErrors = validateAll();
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    mutation.mutate({
      name:            form.name.trim(),
      email:           form.email.trim().toLowerCase(),
      password:        form.password,
      phone:           form.phone.trim() || undefined,
      currentTitle:    form.currentTitle.trim() || undefined,
      experienceYears: form.experienceYears ? parseInt(form.experienceYears) : undefined,
      location:        form.location || undefined,
    });
  };

  const isFieldValid = (name) => touched[name] && !errors[name] && form[name];

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center relative overflow-hidden py-12 px-4">
      <ParticleBackground />
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-brand-purple/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-brand-cyan/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div initial="hidden" animate="visible" variants={fadeUp}
        className="relative z-10 w-full max-w-md">

        <div className="mb-6">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
        </div>

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

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">💡 More info = better job matches!</span>
              <span className="font-semibold" style={{ color: completion >= 70 ? '#22c55e' : '#f59e0b' }}>
                {completion}% complete
              </span>
            </div>
            <div className="h-1.5 bg-bg-primary rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${completion}%` }}
                transition={{ duration: 0.4 }} className="h-full rounded-full"
                style={{ background: completion >= 70 ? '#22c55e' : 'linear-gradient(90deg,#7c3aed,#06b6d4)' }} />
            </div>
          </div>

          <div className="space-y-2">
            <OAuthButton icon="G"  label="Continue with Google" />
            <OAuthButton icon="in" label="Continue with LinkedIn — Auto-imports profile" />
            <OAuthButton icon="⌥"  label="Continue with GitHub" />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-text-muted">or register with email</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <AnimatePresence>
            {serverError && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="px-4 py-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0" />{serverError}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>

            {/* Full Name */}
            <div>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input name="name" type="text" placeholder="Full Name *"
                  value={form.name} onChange={handleChange} onBlur={handleBlur}
                  maxLength={50}
                  className={`input-field pl-10 pr-10 ${errors.name && touched.name ? 'border-danger' : isFieldValid('name') ? 'border-success' : ''}`} />
                <FieldSuccess show={isFieldValid('name')} />
              </div>
              <FieldError error={touched.name && errors.name} />
            </div>

            {/* Email */}
            <div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input name="email" type="email" placeholder="Email Address *"
                  value={form.email} onChange={handleChange} onBlur={handleBlur}
                  maxLength={254}
                  className={`input-field pl-10 pr-10 ${errors.email && touched.email ? 'border-danger' : isFieldValid('email') ? 'border-success' : ''}`} />
                <FieldSuccess show={isFieldValid('email')} />
              </div>
              <FieldError error={touched.email && errors.email} />
            </div>

            {/* Password */}
            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input name="password" type={showPass ? 'text' : 'password'} placeholder="Password *"
                  value={form.password} onChange={handleChange} onBlur={handleBlur}
                  maxLength={128}
                  className={`input-field pl-10 pr-10 ${errors.password && touched.password ? 'border-danger' : isFieldValid('password') ? 'border-success' : ''}`} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.password && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map((i) => (
                      <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
                        style={{ background: i <= pwStrength.score ? pwStrength.color : 'rgba(255,255,255,0.08)' }} />
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: pwStrength.color }}>{pwStrength.label}</p>
                  <div className="grid grid-cols-2 gap-1 mt-1">
                    {[
                      { check: form.password.length >= 8,          label: '8+ characters' },
                      { check: /[A-Z]/.test(form.password),        label: 'Uppercase letter' },
                      { check: /[a-z]/.test(form.password),        label: 'Lowercase letter' },
                      { check: /[0-9]/.test(form.password),        label: 'Number' },
                      { check: /[^A-Za-z0-9]/.test(form.password), label: 'Special character' },
                    ].map(({ check, label }) => (
                      <div key={label} className={`flex items-center gap-1 text-xs ${check ? 'text-success' : 'text-text-muted'}`}>
                        {check ? <CheckCircle className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-text-muted" />}
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <FieldError error={touched.password && errors.password} />
            </div>

            {/* Confirm Password */}
            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input name="confirmPassword" type={showConfirm ? 'text' : 'password'} placeholder="Confirm Password *"
                  value={form.confirmPassword} onChange={handleChange} onBlur={handleBlur}
                  maxLength={128}
                  className={`input-field pl-10 pr-10 ${errors.confirmPassword && touched.confirmPassword ? 'border-danger' : isFieldValid('confirmPassword') ? 'border-success' : ''}`} />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <FieldError error={touched.confirmPassword && errors.confirmPassword} />
            </div>

            {/* Phone */}
            <div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input name="phone" type="tel" placeholder="Phone (Optional)"
                  value={form.phone} onChange={handleChange} onBlur={handleBlur}
                  maxLength={15}
                  className={`input-field pl-10 pr-10 ${errors.phone && touched.phone ? 'border-danger' : isFieldValid('phone') ? 'border-success' : ''}`} />
                <FieldSuccess show={isFieldValid('phone')} />
              </div>
              <FieldError error={touched.phone && errors.phone} />
            </div>

            {/* Job Title */}
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input name="currentTitle" type="text" placeholder="Current Job Title (Optional)"
                value={form.currentTitle} onChange={handleChange} onBlur={handleBlur}
                maxLength={100} className="input-field pl-10" />
            </div>

            {/* Experience + Location */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input name="experienceYears" type="number" placeholder="Years of Exp." min="0" max="50"
                  value={form.experienceYears} onChange={handleChange} onBlur={handleBlur}
                  onKeyDown={(e) => { if (['-', '+', 'e', 'E', '.'].includes(e.key)) e.preventDefault(); }}
                  className={`input-field ${errors.experienceYears && touched.experienceYears ? 'border-danger' : ''}`} />
                <FieldError error={touched.experienceYears && errors.experienceYears} />
              </div>

              {/* Location dropdown */}
              <div className="relative">
                <button type="button" onClick={() => setLocOpen(!locOpen)}
                  className={`input-field flex items-center justify-between gap-2 cursor-pointer ${form.location ? 'text-text-primary' : 'text-text-muted'}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="w-4 h-4 text-text-muted shrink-0" />
                    <span className="truncate text-sm">
                      {form.location
                        ? ALL_LOCATIONS.find((l) => l.label === form.location)?.flag + ' ' + form.location
                        : 'Location'}
                    </span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-text-muted shrink-0 transition-transform ${locOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {locOpen && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-border bg-bg-elevated shadow-lg z-50 max-h-48 overflow-y-auto">
                      {/* BD Locations group */}
                      <div className="px-3 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider border-b border-border">
                        Bangladesh
                      </div>
                      {BD_LOCATIONS.map((loc) => (
                        <button key={loc.label} type="button"
                          onClick={() => { setForm((f) => ({ ...f, location: loc.label })); setLocOpen(false); }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-bg-primary/60 transition-colors text-left ${form.location === loc.label ? 'text-brand-purple' : 'text-text-secondary'}`}>
                          <span>{loc.flag}</span><span>{loc.label}</span>
                          {form.location === loc.label && <CheckCircle className="w-3.5 h-3.5 ml-auto text-brand-purple" />}
                        </button>
                      ))}
                      {/* Other locations group */}
                      <div className="px-3 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider border-y border-border">
                        Other Countries
                      </div>
                      {OTHER_LOCATIONS.map((loc) => (
                        <button key={loc.label} type="button"
                          onClick={() => { setForm((f) => ({ ...f, location: loc.label })); setLocOpen(false); }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-bg-primary/60 transition-colors text-left ${form.location === loc.label ? 'text-brand-purple' : 'text-text-secondary'}`}>
                          <span>{loc.flag}</span><span>{loc.label}</span>
                          {form.location === loc.label && <CheckCircle className="w-3.5 h-3.5 ml-auto text-brand-purple" />}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Terms */}
            <div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={agreed}
                  onChange={(e) => { setAgreed(e.target.checked); setErrors((err) => ({ ...err, agreed: null })); }}
                  className="mt-0.5 w-4 h-4 rounded border-border bg-bg-primary accent-brand-purple shrink-0" />
                <span className="text-xs text-text-secondary leading-relaxed">
                  I agree to the{' '}
                  <Link to="/terms" target="_blank" className="text-brand-cyan hover:underline">Terms of Service</Link>
                  {' '}and{' '}
                  <Link to="/privacy" target="_blank" className="text-brand-cyan hover:underline">Privacy Policy</Link>.
                  I confirm I am at least 18 years old.
                </span>
              </label>
              <FieldError error={touched.agreed && errors.agreed} />
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
              ) : (<>Create Account <ArrowRight className="w-4 h-4" /></>)}
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
