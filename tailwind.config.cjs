/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans:    ['Syne', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      colors: {
        gold: {
          50:  '#fdf8ee',
          100: '#f9edcc',
          200: '#f3d98a',
          300: '#ecc048',
          400: '#C9973A',
          500: '#8C5E0A',
          600: '#6b4507',
          700: '#4a2f05',
        },
        teal: {
          50:  '#f0fdfb',
          100: '#ccfbf4',
          300: '#5ee0cc',
          400: '#2BB5A0',
          500: '#0D7A64',
          600: '#0a5c4a',
          900: '#052e25',
        },
        sand: {
          50:  '#F5EFE6',
          100: '#FBF7F2',
          200: '#EDE5D8',
          300: '#E3D8C8',
          400: '#C8B99A',
          500: '#9E8B72',
          800: '#2C2318',
          900: '#1C1610',
        },
        night: {
          50:  '#EDE8E0',
          100: '#A89E90',
          300: '#7A7268',
          400: '#5C5650',
          500: '#45403B',
          600: '#332E29',
          700: '#251F1A',
          800: '#1A1510',
          900: '#0C0A08',
        },
      },
      opacity: {
        '6':  '0.06',
        '8':  '0.08',
        '12': '0.12',
        '55': '0.55',
      },
      animation: {
        'fade-in':  'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
