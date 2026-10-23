import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * GlassInput — presentation-only styled input for auth pages.
 * Drop-in replacement for a raw <input>: pass the same value/onChange/etc.
 * No logic lives here. It only renders.
 *
 * Props:
 *  - icon:        optional lucide icon component (rendered left)
 *  - label:       optional floating label shown above when focused/filled
 *  - error:       optional error string (red ring + message)
 *  - showToggle:  if true and type==='password', renders eye toggle
 *  - everything else (value, onChange, placeholder, type, ...) is forwarded.
 */
const GlassInput = forwardRef(function GlassInput(
  { icon: Icon, label, error, showToggle = false, type = 'text', className = '', ...rest },
  ref
) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  const effectiveType = isPassword && show ? 'text' : type;

  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-semibold text-text-secondary mb-1.5 ml-1">
          {label}
        </label>
      )}
      <div
        className={`relative flex items-center rounded-xl border bg-white/5 backdrop-blur-sm
                    transition-colors duration-200
                    ${error
                      ? 'border-red-500/50 focus-within:border-red-500/70'
                      : 'border-white/10 focus-within:border-brand-cyan/50'}
                    focus-within:shadow-[0_0_0_3px_rgba(34,211,238,0.08)]`}
      >
        {Icon && (
          <span className="pl-3.5 text-text-muted shrink-0">
            <Icon className="w-[18px] h-[18px]" />
          </span>
        )}
        <input
          ref={ref}
          type={effectiveType}
          className={`flex-1 bg-transparent px-3.5 py-3 text-sm text-text-primary
                      placeholder-text-muted focus:outline-none ${className}`}
          {...rest}
        />
        {isPassword && showToggle && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            tabIndex={-1}
            aria-label={show ? 'Hide password' : 'Show password'}
            className="pr-3.5 text-text-muted hover:text-text-primary transition-colors shrink-0"
          >
            {show ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
          </button>
        )}
      </div>
      {error && <p className="text-red-400 text-xs mt-1.5 ml-1">{error}</p>}
    </div>
  );
});

export default GlassInput;
