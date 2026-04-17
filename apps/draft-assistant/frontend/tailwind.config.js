/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  corePlugins: {
    // Disable Tailwind's CSS reset (Preflight) to avoid conflicts with Angular Material
    preflight: false,
  },
  theme: {
    extend: {},
  },
  plugins: [],
};
