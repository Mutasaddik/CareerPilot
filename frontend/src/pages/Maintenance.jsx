import { motion } from 'framer-motion';
import { Wrench, Clock, Mail, Zap } from 'lucide-react';
import ParticleBackground from '../components/ParticleBackground.jsx';

export default function MaintenancePage({ message }) {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center relative overflow-hidden">
      <ParticleBackground />
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-warning/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative z-10 max-w-lg w-full mx-auto px-6 text-center">
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card p-10 space-y-8">
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center shadow-glow-brand">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-text-primary">CareerPilot</span>
          </div>
          <motion.div
            animate={{ rotate: [0, -10, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            className="w-20 h-20 rounded-3xl bg-warning/10 border border-warning/20 flex items-center justify-center mx-auto">
            <Wrench className="w-10 h-10 text-warning" />
          </motion.div>
          <div className="space-y-3">
            <h1 className="font-display font-bold text-2xl text-text-primary">Under Maintenance</h1>
            <p className="text-text-secondary leading-relaxed text-sm">
              {message || "CareerPilot is temporarily down for scheduled maintenance. We'll be back shortly."}
            </p>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Job matching engine',  status: 'Updating' },
              { label: 'CV analysis service',  status: 'Online' },
              { label: 'Database migrations',  status: 'In progress' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-bg-primary/60 border border-border">
                <span className="text-sm text-text-secondary">{item.label}</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${
                    item.status === 'Online' ? 'bg-success' :
                    item.status === 'In progress' ? 'bg-warning' : 'bg-brand-cyan'
                  }`} />
                  <span className="text-xs font-medium text-text-muted">{item.status}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-6 text-xs text-text-muted pt-2 border-t border-border">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /><span>Usually back within 1 hour</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              <a href="mailto:hello@careerpilot.app" className="hover:text-text-secondary transition-colors">Contact us</a>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}