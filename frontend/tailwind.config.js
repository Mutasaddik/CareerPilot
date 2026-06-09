/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary:   '#0a0a12',
          secondary: '#0f0f1a',
          tertiary:  '#141428',
          elevated:  '#1a1a2e',
          glass:     'rgba(255, 255, 255, 0.04)',
        },
        brand: {
          from:   '#7c3aed',
          via:    '#6366f1',
          to:     '#06b6d4',
          purple: '#7c3aed',
          indigo: '#6366f1',
          cyan:   '#06b6d4',
        },
        match: {
          high: '#22c55e',
          mid:  '#f59e0b',
          low:  '#ef4444',
        },
        success:    '#22c55e',
        warning:    '#f59e0b',
        danger:     '#ef4444',
        info:       '#3b82f6',
        superadmin: '#dc2626',
        admin:      '#ea580c',
        moderator:  '#7c3aed',
        border: {
          DEFAULT: 'rgba(255, 255, 255, 0.08)',
          bright:  'rgba(255, 255, 255, 0.15)',
        },
        text: {
          primary:   '#f1f5f9',
          secondary: '#94a3b8',
          muted:     '#475569',
        },
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        body:    ['"Inter"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #7c3aed 0%, #6366f1 50%, #06b6d4 100%)',
        'card-gradient':  'linear-gradient(135deg, rgba(124,58,237,0.1) 0%, rgba(6,182,212,0.05) 100%)',
        'glow-purple':    'radial-gradient(ellipse at center, rgba(124,58,237,0.3) 0%, transparent 70%)',
        'glow-cyan':      'radial-gradient(ellipse at center, rgba(6,182,212,0.3) 0%, transparent 70%)',
      },
      boxShadow: {
        'glass':       '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
        'glass-hover': '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
        'glow-brand':  '0 0 30px rgba(124,58,237,0.4)',
        'glow-green':  '0 0 20px rgba(34,197,94,0.4)',
        'glow-amber':  '0 0 20px rgba(245,158,11,0.4)',
        'glow-red':    '0 0 20px rgba(239,68,68,0.4)',
        'card':        '0 2px 16px rgba(0,0,0,0.6)',
      },
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