/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // JD+A Brand Kit 2026.02 — source of truth
        terracotta: {
          DEFAULT: '#BD6439',
          light:   '#d4895e',
          dark:    '#9a4f2c',
        },
        patina: {
          DEFAULT: '#736F4C',
          light:   '#918d6a',
          dark:    '#55512e',
        },
        // Keep 'olive' as alias so existing code doesn't break
        olive: {
          DEFAULT: '#736F4C',
          light:   '#918d6a',
          dark:    '#55512e',
        },
        graphite: {
          DEFAULT: '#3D3935',
          2:       '#4e4a45',
          3:       '#625e59',
          4:       '#8a8580',
        },
        // Keep 'dark' as alias so existing code doesn't break
        dark: {
          DEFAULT: '#3D3935',
          2:       '#4e4a45',
          3:       '#625e59',
        },
        vellum: {
          DEFAULT: '#F5F5F1',
          2:       '#ECEAE3',
          3:       '#dedad0',
        },
        // Keep 'sand' as alias so existing code doesn't break
        sand: {
          DEFAULT: '#F5F5F1',
          2:       '#ECEAE3',
          3:       '#dedad0',
        },
        moss:    '#1F2620',
        // flag/success/warning kept for utility states
        flag:    '#c0392b',
        success: '#2d7a3a',
        warning: '#b45309',
      },
      fontFamily: {
        // League Gothic: display headers, KPI numbers, tab labels, all-caps moments
        display: ['"League Gothic"', 'sans-serif'],
        // Nunito Sans: body, UI copy, table data (Century Gothic substitute)
        body:    ['"Nunito Sans"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      fontSize: {
        // Brand modular scale (~1.25x per step)
        '2xs':  ['10px', { lineHeight: '14px', letterSpacing: '0.18em' }],
        'xs':   ['12px', { lineHeight: '16px' }],
        'sm':   ['14px', { lineHeight: '20px' }],
        'base': ['16px', { lineHeight: '24px' }],
        'lg':   ['18px', { lineHeight: '26px' }],
        'xl':   ['22px', { lineHeight: '28px' }],
        '2xl':  ['28px', { lineHeight: '32px' }],
        '3xl':  ['36px', { lineHeight: '40px' }],
        '4xl':  ['48px', { lineHeight: '52px' }],
        '5xl':  ['64px', { lineHeight: '68px' }],
      },
      letterSpacing: {
        // Brand tracking tokens
        'display': '0.02em',   // League Gothic headlines
        'eyebrow': '0.18em',   // All-caps micro labels
        'ui':      '0.14em',   // League Gothic buttons
        'tight':   '-0.012em', // Newsreader (if used)
      },
      borderRadius: {
        DEFAULT: '4px',   // Brand: subtle corners
        'md':    '4px',
        'lg':    '6px',
        'xl':    '8px',
      },
      borderWidth: {
        DEFAULT: '1px',
        'hair':  '0.5px',
      },
    },
  },
  plugins: [],
}
