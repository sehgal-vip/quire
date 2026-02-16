/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#4F46E5',
          hover: '#4338CA',
        },
      },
      maxWidth: {
        'app': '1200px',
        'tool': '900px',
      },
    },
  },
  plugins: [],
}
