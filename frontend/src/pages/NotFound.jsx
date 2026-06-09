import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, ArrowLeft, Zap } from 'lucide-react';
import ParticleBackground from '../components/ParticleBackground.jsx';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center relative overflow-hidden">
      <ParticleBackground />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-48 bg-brand-purple/15 rounded-full blur-3xl pointer-events-none" />
      <div className="relative z-10 max-w-lg w-full mx-auto px-6 text-center">
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="space-y-8">
          <div className="flex items-center justify-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-gradient flex items-center justify-center shadow-glow-brand">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-lg text-text-primary">CareerPilot</span>
          </div>
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}>
            <h1 className="font-display font-extrabold gradient-text"
              style={{ fontSize: 'clamp(6rem, 20vw, 9rem)', lineHeight: 1 }}>404</h1>
          </motion.div>
          <div className="space-y-3">
            <p className="font-display font-bold text-2xl text-text-primary">Page not found</p>
            <p className="text-text-secondary text-sm leading-relaxed">
              This page doesn't exist or was moved. Check the URL or head back to safety.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/" className="btn-primary gap-2"><Home className="w-4 h-4" />Back to Home</Link>
            <button onClick={() => window.history.back()} className="btn-ghost gap-2">
              <ArrowLeft className="w-4 h-4" />Go Back
            </button>
          </div>
          <div className="glass-card p-5 space-y-3">
            <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">Quick links</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { to: '/register', label: 'Create Account' },
                { to: '/login',    label: 'Sign In' },
                { to: '/privacy',  label: 'Privacy Policy' },
                { to: '/terms',    label: 'Terms of Service' },
              ].map((link) => (
                <Link key={link.to} to={link.to}
                  className="text-sm text-text-secondary hover:text-text-primary transition-colors">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}