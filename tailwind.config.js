/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#fdf4ef',
          100: '#fde6d8',
          200: '#fac8ae',
          300: '#f49d76',
          400: '#ed6e3c',
          500: '#d94e1a',   // naranja óxido principal
          600: '#bf3d0f',
          700: '#9a2f0b',
          800: '#7a2508',
          900: '#fdf4ef',   // tinte claro para activos
        },
        dark: {
          900: '#edeae2',   // fondo página — crema cálida
          800: '#f7f4ee',   // cards/sidebar — crema más clara
          700: '#e8e3d8',   // inputs/hover
          600: '#cec6b5',   // bordes cálidos
        },
        night: {
          DEFAULT: '#17120c',  // tarjeta hero oscura
          2:       '#271e14',
          3:       '#3a2e20',
          4:       '#4f4232',
        },
        ink: {
          DEFAULT: '#1a150e',
          2:       '#4a3c30',
          3:       '#7a6658',
          muted:   '#a09080',
          line:    '#cec6b5',
        },
        signal: {
          green:  '#2d7a3a',
          gBg:    '#eef7ee',
          amber:  '#c4880e',
          aBg:    '#fef9ee',
          red:    '#b91c1c',
          rBg:    '#fef2f2',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        serif:   ['"Instrument Serif"', 'Georgia', 'serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        'xl':  '10px',
        '2xl': '14px',
      },
      boxShadow: {
        'card':    '0 1px 2px rgba(80,60,30,0.06), 0 1px 4px rgba(80,60,30,0.04)',
        'card-md': '0 3px 10px rgba(80,60,30,0.10)',
        'card-lg': '0 8px 24px rgba(80,60,30,0.14)',
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
