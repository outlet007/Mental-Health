/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./views/**/*.ejs', './public/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#ecfdf9',
          100: '#d0faf0',
          200: '#a0f3e1',
          300: '#61e8ce',
          400: '#2dd4b4',
          500: '#0fb89a',
          600: '#05967e',
          700: '#067866',
          800: '#085f52',
          900: '#094e44',
        },
        ocean: {
          50:  '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
        },
      },
      fontFamily: {
        sans: ['Sarabun', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
