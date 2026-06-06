/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: { DEFAULT: '#0f0f14', card: '#1a1a24', hover: '#252532' },
        accent: { DEFAULT: '#a855f7', light: '#c084fc' },
      },
    },
  },
  plugins: [],
};
