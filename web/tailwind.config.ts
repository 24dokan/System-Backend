import type { Config } from 'tailwindcss';

// Change the brand colour in app/globals.css (--brand). Nothing else needs to change.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: 'rgb(var(--brand) / <alpha-value>)', dark: 'rgb(var(--brand-dark) / <alpha-value>)', soft: 'rgb(var(--brand-soft) / <alpha-value>)' },
      },
    },
  },
  plugins: [],
};
export default config;
