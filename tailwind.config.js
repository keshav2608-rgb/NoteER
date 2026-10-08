/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./features/**/*.{js,jsx}",
    "./lib/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      // Stationery-desk palette. Every token flips in dark mode via CSS vars
      // (see app/globals.css), so components rarely need `dark:` variants.
      colors: {
        desk: token('desk'),
        paper: {
          DEFAULT: token('paper'),
          2: token('paper-2')
        },
        ink: token('ink'),
        pencil: token('pencil'),
        rule: token('rule'),
        ballpoint: {
          DEFAULT: token('ballpoint'),
          fg: token('on-ballpoint')
        },
        highlight: {
          DEFAULT: token('highlight'),
          fg: token('on-highlight')
        },
        correction: token('correction'),
        ok: token('ok')
      },
      borderRadius: {
        book: '3px',
        ctl: '8px',
        panel: '14px'
      },
      boxShadow: {
        lift: '0 1px 0 rgb(var(--rule)), 0 8px 18px -10px rgb(var(--shadow) / 0.45)',
        float: '0 1px 0 rgb(var(--rule)), 0 18px 40px -16px rgb(var(--shadow) / 0.5)',
        book: 'inset -1px 0 0 rgb(0 0 0 / 0.12), 0 1px 1px rgb(0 0 0 / 0.18), 0 10px 18px -10px rgb(var(--shadow) / 0.7)',
        canvas: '0 1px 0 rgb(var(--rule)), 0 8px 18px -10px rgb(var(--shadow) / 0.45)',
        sheet: '0 1px 0 rgb(var(--rule)), 0 8px 18px -10px rgb(var(--shadow) / 0.45)',
        subtle: '0 1px 0 rgb(var(--rule))'
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'sans-serif'],
        hand: ['var(--font-hand)', 'cursive'],
        handwriting: ['var(--font-hand)', 'Caveat', 'cursive'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace']
      }
    }
  },
  plugins: []
};
