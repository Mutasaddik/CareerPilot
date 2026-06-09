import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RefreshCw, Home, AlertTriangle, Zap } from 'lucide-react';
import ParticleBackground from '../components/ParticleBackground.jsx';

export default function ServerError() {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center relative overflow-hidden">
      <ParticleBackground />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-48 bg-danger/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative z-10 max-w-lg w-full mx-auto px-6 text-center">
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }} className="space-y-8">
          <div className="flex items-center justify-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-gradient flex items-center justify-center shadow-glow-brand">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-lg text-text-primary">CareerPilot</span>
          </div>
          <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}
            className="w-20 h-20 rounded-3xl bg-danger/10 border border-danger/20 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-10 h-10 text-danger" />
          </motion.div>
          <div className="space-y-3">
            <h1 className="font-display font-bold text-5xl text-danger/80">500</h1>
            <p className="font-display font-bold text-2xl text-text-primary">Something went wrong</p>
            <p className="text-text-secondary text-sm leading-relaxed">
              Our servers hit an unexpected snag. This has been logged and our team is on it.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button onClick={() => window.location.reload()} className="btn-primary gap-2">
              <RefreshCw className="w-4 h-4" />Try Again
            </button>
            <Link to="/" className="btn-ghost gap-2"><Home className="w-4 h-4" />Back to Home</Link>
          </div>
          <p className="text-xs text-text-muted">
            Still having trouble?{' '}
            <a href="mailto:hello@careerpilot.app" className="text-brand-cyan hover:underline">Contact support</a>
          </p>
        </motion.div>
      </div>
    </div>
  );
}