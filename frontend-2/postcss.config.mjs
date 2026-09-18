/**
 * Tailwind v4 runs as a PostCSS plugin (`@tailwindcss/postcss`); the old
 * `tailwindcss` + `autoprefixer` pair is gone, and there is no
 * tailwind.config.js — the token system lives in `src/app/globals.css`.
 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
