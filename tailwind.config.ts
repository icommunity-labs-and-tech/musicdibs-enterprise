import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Syne', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        gold: {
          50: '#fdf8ee',
          100: '#f9edcc',
          200: '#f3d98a',
          300: '#ecc048',
          400: '#C9973A',
          500: '#8C5E0A',
          600: '#6b4507',
          700: '#4a2f05',
        },
        teal: {
          400: '#2BB5A0',
          500: '#0D7A64',
          600: '#0a5c4a',
        },
        sand: {
          50: '#F5EFE6',
          100: '#FBF7F2',
          200: '#EDE5D8',
          300: '#E3D8C8',
          800: '#2C2318',
          900: '#1C1610',
        },
        night: {
          50: '#EDE8E0',
          100: '#A89E90',
          800: '#1A1510',
          900: '#0C0A08',
        },
      },
      animation: {
        'waveform': 'waveform 1.2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        waveform: {
          '0%, 100%': { transform: 'scaleY(0.3)' },
          '50%': { transform: 'scaleY(1)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
