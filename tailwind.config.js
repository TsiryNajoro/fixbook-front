/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#EFEAE1',
        paperDark: '#E2DACB',
        ink: '#232323',
        inkSoft: '#4B4740',
        navy: '#2B3A55',
        rust: '#B23A2E',
        moss: '#4B6B4A',
        muted: '#8B8378',
        line: '#C9C0AE',
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
