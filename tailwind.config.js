/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'media',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Montserrat',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        navy: {
          950: '#020814',
          900: '#050D1F',
          800: '#0B1437',
          700: '#12204F',
          600: '#1A2D6E',
        },
        brand: {
          50:  '#F0F3FA',
          100: '#E5EAF5',
          200: '#BAC9E8',
          300: '#7B99D3',
          400: '#4C6FBF',
          500: '#2B4DA4',
          600: '#233994',
          700: '#1E2E7D',
          800: '#172260',
          900: '#0F1645',
        },
        cream: '#F8F7F3',
      },
      animation: {
        'fade-in':  'fadeIn 0.3s ease-out',
        'fade-up':  'fadeUp 0.5s ease-out',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          from: { transform: 'translateY(100%)' },
          to:   { transform: 'translateY(0)' },
        },
      },
      letterSpacing: {
        widest2: '0.2em',
      },
    },
  },
  plugins: [],
};
