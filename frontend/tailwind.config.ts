import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/modules/**/*.{js,ts,jsx,tsx,mdx}',
    './src/core/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // TetherStream Cyberpunk Design Tokens
        'ts-void':    '#070B12',   // deepest background
        'ts-base':    '#0A0E17',   // main background
        'ts-surface': '#0F1623',   // card/panel surfaces
        'ts-overlay': '#152031',   // raised overlays
        'ts-border':  '#1E2D40',   // default border
        'ts-border-bright': '#2A3F5A', // highlighted border
        'ts-cyan':    '#00F5D4',   // primary accent (electric cyan)
        'ts-cyan-dim':'#00B09C',   // dimmed cyan
        'ts-purple':  '#7B61FF',   // secondary accent (stellar purple)
        'ts-purple-dim': '#5A45CC',
        'ts-text':    '#E2E8F0',   // primary text
        'ts-text-dim':'#A0C4D8',   // secondary/mono text
        'ts-text-muted': '#4A6080', // muted annotations
        'ts-error':   '#FF4D6A',   // error state
        'ts-warn':    '#FFB830',   // warning state
        'ts-success': '#00C896',   // success state
        'ts-pending': '#7B61FF',   // pending/loading state
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'ts-glow-cyan':   '0 0 12px 2px rgba(0,245,212,0.25)',
        'ts-glow-purple': '0 0 12px 2px rgba(123,97,255,0.25)',
        'ts-glow-error':  '0 0 8px 1px rgba(255,77,106,0.3)',
        'ts-card':        '0 1px 0 0 rgba(30,45,64,1), inset 0 1px 0 0 rgba(42,63,90,0.3)',
      },
      animation: {
        'ts-pulse-cyan': 'ts-pulse-cyan 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'ts-scan': 'ts-scan 3s linear infinite',
        'ts-flicker': 'ts-flicker 0.15s ease-in-out infinite alternate',
      },
      keyframes: {
        'ts-pulse-cyan': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        'ts-scan': {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '0 100px' },
        },
        'ts-flicker': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0.85' },
        },
      },
      backgroundImage: {
        'ts-grid': `linear-gradient(rgba(0,245,212,0.03) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(0,245,212,0.03) 1px, transparent 1px)`,
      },
      backgroundSize: {
        'ts-grid': '40px 40px',
      },
    },
  },
  plugins: [],
};

export default config;
