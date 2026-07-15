/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#7c3aed',   // violeta eléctrico
          600: '#6d28d9',
          700: '#5b21b6',
          800: '#4c1d95',
          900: '#f0ebff',   // fondo tintado activos
        },
        dark: {
          900: '#f4efe6',   // fondo — crema portada de disco
          800: '#fffef9',   // cards — blanco cálido
          750: '#f0e8d8',   // surfaces tintadas
          700: '#ede3d0',   // inputs / hover
          600: '#d8ccb8',   // bordes
        },
        night: {
          DEFAULT: '#111111',   // negro vinilo
          2:       '#1c1c1c',
          3:       '#282828',
          4:       '#363636',
        },
        ink: {
          DEFAULT: '#111111',   // negro editorial
          2:       '#3a3530',
          3:       '#6b6358',
          muted:   '#9c9088',
          line:    '#d8ccb8',
        },
        signal: {
          green: '#1a7a3a',
          gBg:   '#edf7ee',
          amber: '#b87800',
          aBg:   '#fef8e6',
          red:   '#b91c1c',
          rBg:   '#fef2f2',
        },
      },
      fontFamily: {
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono:  ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        'xl':  '10px',
        '2xl': '14px',
      },
      boxShadow: {
        'card':    '0 1px 2px rgba(30,20,10,0.07), 0 1px 4px rgba(30,20,10,0.05)',
        'card-md': '0 3px 12px rgba(30,20,10,0.11)',
        'card-lg': '0 8px 28px rgba(30,20,10,0.16)',
      },
      keyframes: {
        'slide-in': {
          '0%':   { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.18s ease-out',
      },
    },
  },
  plugins: [],
}
