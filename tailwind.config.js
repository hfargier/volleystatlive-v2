/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#FFD700',
        surface: '#222222',
        raised: '#2a2a2a',
      },
    },
  },
  plugins: [],
};