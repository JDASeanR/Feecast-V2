/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // JD+A / Feecast design tokens
        terracotta: {
          DEFAULT: '#BD6439',
          light:   '#d4895e',
          dark:    '#9a4f2c',
        },
        olive: {
          DEFAULT: '#736F4C',
          light:   '#918d6a',
          dark:    '#55512e',
        },
        dark: {
          DEFAULT: '#3D3935',
          2:       '#4e4a45',
          3:       '#625e59',
        },
        sand: {
          DEFAULT: '#F5F5F1',
          2:       '#ECEAE3',
          3:       '#dedad0',
        },
        flag:    '#c0392b',
        success: '#2d7a3a',
        warning: '#b45309',
      },
      fontFamily: {
        display: ['"League Gothic"', '"Nunito Sans"', 'sans-serif'],
        body:    ['"Nunito Sans"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
      },
      borderRadius: {
        DEFAULT: '6px',
        lg:      '10px',
        xl:      '14px',
      },
    },
  },
  plugins: [],
}
