module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          DEFAULT: '#4f46e5',
        },
        accent: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          DEFAULT: '#ea580c',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f8fafc',
          subtle: '#f1f5f9',
          inverse: '#0f172a',
        },
        ink: {
          DEFAULT: '#0f172a',
          soft: '#334155',
          muted: '#64748b',
          faint: '#94a3b8',
        },
        line: {
          DEFAULT: '#e2e8f0',
          strong: '#cbd5e1',
          soft: '#f1f5f9',
        },
        success: {
          50: '#ecfdf5',
          100: '#d1fae5',
          600: '#059669',
          700: '#047857',
          DEFAULT: '#059669',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          600: '#d97706',
          700: '#b45309',
          DEFAULT: '#d97706',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          600: '#dc2626',
          700: '#b91c1c',
          DEFAULT: '#dc2626',
        },
        // Legacy aliases kept for gradual migration
        brown_primary: {
          light: '#A0673A',
          middle: '#A0673A',
          dark: '#884517',
        },
        green_primary: {
          light: '#A0673A',
          middle: '#38700B',
          dark: '#884517',
        },
      },
      borderRadius: {
        'sg-sm': '0.5rem',
        'sg': '0.75rem',
        'sg-lg': '1rem',
      },
      boxShadow: {
        'sg-sm': '0 1px 2px 0 rgb(15 23 42 / 0.04)',
        'sg': '0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.06)',
        'sg-md': '0 4px 12px -2px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.04)',
        'sg-lg': '0 12px 24px -8px rgb(15 23 42 / 0.12)',
      },
      fontSize: {
        'sg-display': ['2.25rem', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '700' }],
        'sg-title': ['1.5rem', { lineHeight: '1.25', letterSpacing: '-0.015em', fontWeight: '700' }],
        'sg-subtitle': ['1.125rem', { lineHeight: '1.4', fontWeight: '600' }],
        'sg-body': ['0.9375rem', { lineHeight: '1.55' }],
        'sg-caption': ['0.8125rem', { lineHeight: '1.4' }],
      },
      maxWidth: {
        'sg-content': '80rem',
        'sg-readable': '42rem',
        'sg-narrow': '56rem',
      },
      width: {
        640: '640px',
      },
      height: {
        600: '600px',
      },
      ringColor: {
        brand: '#4f46e5',
      },
    },
  },
  plugins: [],
};
