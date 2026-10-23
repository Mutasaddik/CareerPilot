import { motion } from 'framer-motion';

/**
 * AuthCard — the glass card shell + animated entrance for auth pages.
 * Wrap your existing auth form contents in this. Presentation only.
 *
 * Props:
 *  - title:    big heading (e.g. "Welcome back")
 *  - subtitle: small line under the heading
 *  - children: the form (inputs, buttons) — your existing logic goes here
 *  - footer:   optional node rendered under the card (e.g. "Don't have an account?")
 */
export default function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-bg-primary px-4 py-10 relative overflow-hidden">
      {/* Soft ambient glow accents — match platform, no external deps */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-brand-cyan/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-purple-500/10 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <div className="w-10 h-10 rounded-xl bg-brand-cyan/15 flex items-center justify-center">
            <span className="font-black text-xl text-brand-cyan">C</span>
          </div>
          <span className="text-text-primary font-bold text-lg">CareerPilot</span>
        </div>

        {/* Card */}
        <div className="glass-card p-7 md:p-8">
          {(title || subtitle) && (
            <div className="text-center mb-6">
              {title && <h1 className="text-text-primary text-2xl font-bold">{title}</h1>}
              {subtitle && <p className="text-text-muted text-sm mt-1.5">{subtitle}</p>}
            </div>
          )}
          {children}
        </div>

        {footer && <div className="text-center mt-5 text-sm text-text-muted">{footer}</div>}
      </motion.div>
    </div>
  );
}
