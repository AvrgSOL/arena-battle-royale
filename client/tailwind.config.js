/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:      '#050810',
        surface: '#0b1120',
        border:  '#1a2840',
        cyan:    '#00e5ff',
        purple:  '#9c6bff',
        green:   '#00ff88',
        gold:    '#ffd54f',
        red:     '#ff4d6a',
        pink:    '#f472b6',
      },
      fontFamily: {
        mono:  ['"Space Mono"', 'monospace'],
        syne:  ['Syne', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
