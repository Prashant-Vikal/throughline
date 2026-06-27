/** @type {import('tailwindcss').Config} */
// Color tokens are CSS variables (space-separated RGB channels) so a single
// `.dark` class swap re-themes the whole app while preserving Tailwind's
// `/opacity` modifiers. Light + dark values live in src/index.css.
const token = (v) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // "Ledger" identity — cool paper, ink navy, a single brass thread accent.
        paper: token('--c-paper'),
        panel: token('--c-panel'),
        ink: {
          DEFAULT: token('--c-ink'),
          soft: token('--c-ink-soft'),
          faint: token('--c-ink-faint'),
        },
        line: token('--c-line'),
        thread: {
          DEFAULT: token('--c-thread'), // brass — the throughline
          soft: token('--c-thread-soft'),
          wash: token('--c-thread-wash'),
        },
        // Recommendation signals — desaturated, legible, never stoplight.
        strong: { DEFAULT: token('--c-strong'), wash: token('--c-strong-wash') },
        mixed: { DEFAULT: token('--c-mixed'), wash: token('--c-mixed-wash') },
        concern: { DEFAULT: token('--c-concern'), wash: token('--c-concern-wash') },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(27,34,48,0.04), 0 1px 12px rgba(27,34,48,0.04)',
        lift: '0 4px 24px rgba(27,34,48,0.10)',
      },
      borderRadius: {
        xl2: '14px',
      },
    },
  },
  plugins: [],
}
