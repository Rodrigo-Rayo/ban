/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        // Direction C · "Cartel": gig-poster palette. Token names kept so every
        // existing class re-themes: primary = poster red, dark-* = paper surfaces.
        primary: {
          50:  '#fcf1ee',
          100: '#f8ddd6',
          200: '#f0b9ab',
          300: '#e08a74',
          400: '#d0603f',
          500: '#c23a1f',   // rojo cartel — 5.6:1 with white, 4.7:1 on paper
          600: '#a23019',
          700: '#832714',
          800: '#641e10',
          900: '#f6e2d9',   // tinted background for active states
        },
        dark: {
          900: '#f2ebdd',   // papel (page background)
          800: '#fbf7ee',   // cards
          750: '#ebe2d0',   // tinted surfaces
          700: '#e6dcc8',   // inputs / hover
          600: '#2b2620',   // rules & borders — near-ink, fanzine look
        },
        night: {
          DEFAULT: '#141210',
          2:       '#1f1c19',
          3:       '#2b2723',
          4:       '#3a352f',
        },
        ink: {
          DEFAULT: '#141210',   // tinta
          2:       '#2e2924',
          3:       '#4a433a',
          muted:   '#544d43',   // ≥6:1 on paper
          line:    '#2b2620',
        },
        poster: {
          yellow: '#e8b931',    // stamps: "SE BUSCA", highlights (ink text only)
          red:    '#c23a1f',
          paper:  '#f2ebdd',
          card:   '#fbf7ee',
        },
        signal: {
          green: '#1d6b3a',
          gBg:   '#e4f1e6',
          amber: '#7e5300',
          aBg:   '#fbf1d6',
          red:   '#b3261e',
          rBg:   '#fbe9e6',
        },
      },
      fontFamily: {
        sans:    ['"Instrument Sans"', 'system-ui', 'sans-serif'],
        display: ['Anton', 'Impact', '"Arial Narrow"', 'sans-serif'],
        serif:   ['Anton', 'Impact', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      // Poster look: square corners everywhere except true circles (dots, badges).
      borderRadius: {
        'sm': '0', DEFAULT: '0', 'md': '0', 'lg': '0', 'xl': '0', '2xl': '0', '3xl': '0', 'full': '0',
      },
      boxShadow: {
        'card':    '3px 3px 0 0 #141210',
        'card-md': '4px 4px 0 0 #141210',
        'card-lg': '6px 6px 0 0 #141210',
        'sm':      '2px 2px 0 0 rgba(20,18,16,0.9)',
        'md':      '4px 4px 0 0 #141210',
        'lg':      '6px 6px 0 0 #141210',
        'xl':      '8px 8px 0 0 #141210',
        '2xl':     '10px 10px 0 0 #141210',
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
