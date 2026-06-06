/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: { DEFAULT: '#0b1020', card: '#121a2e', hover: '#1a2540' },
        accent: { DEFAULT: '#5b8def', light: '#7eb3ff', muted: '#3d5a80' },
        brand: { DEFAULT: '#38bdf8', light: '#7dd3fc' },
      },
    },
  },
  plugins: [],
};
