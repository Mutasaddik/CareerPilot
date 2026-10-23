import defaultColors from 'tailwindcss/colors';

// Every app colour is a CSS variable holding "R G B" channels (defined for
// dark and light in src/index.css), so one class works in both themes and
// opacity modifiers like bg-fg/5 or text-success/80 keep working.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

// Status text shades used on tinted chips (text-green-300, text-red-400…):
// the bright 300/400 shades read well on dark, but vanish on white, so the
// light theme swaps them for the 700 shade. Other shades stay as Tailwind's.
const THEMED_HUES = ['green', 'emerald', 'amber', 'yellow', 'orange', 'red', 'rose', 'blue',
  'sky', 'cyan', 'teal', 'purple', 'violet', 'indigo', 'pink', 'slate'];
const themedHues = Object.fromEntries(THEMED_HUES.map((h) => [h, {
  ...defaultColors[h],
  300: v(`${h}-300`),
  400: v(`${h}-400`),
}]));

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ...themedHues,
        // Surfaces, lowest to highest: page → card → inset/hover → raised
        bg: {
          primary:   v('page'),
          secondary: v('surface'),
          tertiary:  v('surface-2'),
          elevated:  v('raised'),
        },
        // "Ink" for subtle overlays and hairlines: white on dark, slate on light.
        // Use bg-fg/5, border-fg/10 instead of bg-white/5, border-white/10.
        fg: v('fg'),
        text: {
          primary:   v('text-primary'),
          secondary: v('text-secondary'),
          muted:     v('text-muted'),
        },
        brand: {
          from:   '#7c3aed',
          via:    '#6366f1',
          to:     '#06b6d4',
          purple: v('brand-purple'),
          indigo: v('brand-indigo'),
          cyan:   v('brand-cyan'),
        },
        match: {
          high: v('success'),
          mid:  v('warning'),
          low:  v('danger'),
        },
        success:    v('success'),
        warning:    v('warning'),
        danger:     v('danger'),
        info:       v('info'),
        superadmin: '#dc2626',
        admin:      '#ea580c',
        moderator:  '#7c3aed',
        border: {
          DEFAULT: 'rgb(var(--fg) / 0.08)',
          bright:  'rgb(var(--fg) / 0.16)',
        },
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        body:    ['"Inter"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #7c3aed 0%, #6366f1 50%, #06b6d4 100%)',
        'card-gradient':  'linear-gradient(135deg, rgb(124 58 237 / 0.1) 0%, rgb(6 182 212 / 0.05) 100%)',
        'glow-purple':    'radial-gradient(ellipse at center, rgb(124 58 237 / 0.3) 0%, transparent 70%)',
        'glow-cyan':      'radial-gradient(ellipse at center, rgb(6 182 212 / 0.3) 0%, transparent 70%)',
      },
      // Depth: elevation levels defined per theme in index.css
      boxShadow: {
        'e1':          'var(--shadow-1)',
        'e2':          'var(--shadow-2)',
        'e3':          'var(--shadow-3)',
        'inset':       'var(--shadow-inset)',
        'glass':       'var(--shadow-1)',
        'glass-hover': 'var(--shadow-2)',
        'card':        'var(--shadow-1)',
        'glow-brand':  '0 0 30px rgb(124 58 237 / 0.4)',
        'glow-green':  '0 0 20px rgb(34 197 94 / 0.4)',
        'glow-amber':  '0 0 20px rgb(245 158 11 / 0.4)',
        'glow-red':    '0 0 20px rgb(239 68 68 / 0.4)',
      },
      // Every whole-number opacity (bg-fg/3, border-fg/8, …) — the default
      // scale only has steps of 5, and the app uses finer hairlines.
      opacity: Object.fromEntries(Array.from({ length: 101 }, (_, i) => [i, String(i / 100)])),
      borderRadius: {
        'xl':  '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      animation: {
        'fade-in':    'fadeIn 0.3s ease-out',
        'slide-up':   'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'float':      'float 6s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'shimmer':    'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp:   { from: { opacity: '0', transform: 'translateY(20px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        float:     { '0%,100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-10px)' } },
        pulseGlow: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.6' } },
        shimmer:   { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
};
