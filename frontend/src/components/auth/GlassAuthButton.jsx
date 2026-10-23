import { Loader2 } from 'lucide-react';

/**
 * GlassAuthButton — presentation-only animated button for auth pages.
 * Drop-in replacement for a raw <button>: pass the same onClick/type/disabled.
 * No logic lives here.
 *
 * Props:
 *  - variant:  'primary' (cyan fill) | 'ghost' (outline) | 'social' (neutral)
 *  - loading:  shows spinner + disables
 *  - fullWidth: stretches to container width (default true)
 *  - everything else (onClick, type, disabled, ...) is forwarded.
 */
export default function GlassAuthButton({
  variant = 'primary',
  loading = false,
  fullWidth = true,
  className = '',
  children,
  disabled,
  ...rest
}) {
  const base =
    'relative inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 ' +
    'text-sm font-semibold transition-all duration-200 select-none ' +
    'disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ' +
    (fullWidth ? 'w-full ' : '');

  const variants = {
    primary:
      'bg-brand-cyan/90 text-bg-primary hover:bg-brand-cyan ' +
      'shadow-[0_4px_20px_-4px_rgba(34,211,238,0.4)] hover:shadow-[0_6px_28px_-4px_rgba(34,211,238,0.55)]',
    ghost:
      'bg-fg/5 border border-fg/10 text-text-primary ' +
      'hover:bg-fg/10 hover:border-fg/20',
    social:
      'bg-fg/5 border border-fg/10 text-text-primary ' +
      'hover:bg-fg/[0.08] hover:border-fg/20',
  };

  return (
    <button
      disabled={disabled || loading}
      className={`${base} ${variants[variant] || variants.primary} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
