/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'chroma-black': '#0a0a0f',
        'chroma-dark': '#0B1220',
        'chroma-panel': '#111116',
        'chroma-obsidian': '#060810',
        'chroma-surface': '#0F1520',
        'chroma-teal': '#00CED1',
        'chroma-cyan': '#00FFFF',
        'chroma-purple': '#8B5CF6',
        'chroma-gold': '#D4AF37',
        'chroma-gold-light': '#FFD700',
        'chroma-success': '#10B981',
        'chroma-warning': '#F97316',
        'chroma-error': '#EF4444',
        'chroma-muted': '#64748B',
      },
      fontFamily: {
        'display': ['Orbitron', 'sans-serif'],
        'ui': ['Rajdhani', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
        'body': ['Rajdhani', 'sans-serif'],
      },
      boxShadow: {
        'neon-teal': '0 0 5px #00CED1, 0 0 20px rgba(0, 206, 209, 0.3)',
        'neon-purple': '0 0 5px #8B5CF6, 0 0 20px rgba(139, 92, 246, 0.3)',
        'neon-cyan': '0 0 10px rgba(0, 206, 209, 0.4)',
        'neon-gold': '0 0 5px #D4AF37, 0 0 20px rgba(212, 175, 55, 0.3)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.3)',
        'glass-premium': '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        'inner-glow-teal': 'inset 0 0 30px rgba(0, 206, 209, 0.1)',
        'glow-lg': '0 0 40px rgba(0, 206, 209, 0.4)',
        'crystal': '0 0 15px rgba(0, 206, 209, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        'crystal-hover': '0 0 30px rgba(0, 206, 209, 0.2), 0 0 60px rgba(0, 206, 209, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        'crystal-active': '0 0 40px rgba(0, 206, 209, 0.3), 0 4px 20px rgba(0, 0, 0, 0.5)',
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
        'spin-fast': 'spin 0.5s linear infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'scanline': 'scanline 2s linear infinite',
        'typewriter': 'typewriter 2s steps(30) forwards',
        'blink': 'blink 1s step-end infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.5s ease-out',
        'draw-stroke': 'drawStroke 2s ease-out forwards',
        'aurora-shift': 'auroraShift 20s ease-in-out infinite',
        'led-ring-pulse': 'ledRingPulse 2s ease-out infinite',
        'shine-sweep': 'shineSweep 3s ease-in-out infinite',
        'float-up': 'floatUp 3s ease-in-out infinite',
        'breathe': 'breathe 3s ease-in-out infinite',
        'gradient-shift': 'gradientShift 8s ease infinite',
      },
      keyframes: {
        glow: {
          '0%': { opacity: '0.5' },
          '100%': { opacity: '1' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        typewriter: {
          'from': { width: '0' },
          'to': { width: '100%' },
        },
        blink: {
          '50%': { opacity: '0' },
        },
        slideUp: {
          'from': { transform: 'translateY(20px)', opacity: '0' },
          'to': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          'from': { opacity: '0' },
          'to': { opacity: '1' },
        },
        drawStroke: {
          'to': { strokeDashoffset: '0' },
        },
        auroraShift: {
          '0%, 100%': { transform: 'translateX(-5%) translateY(-5%)', opacity: '0.5' },
          '50%': { transform: 'translateX(5%) translateY(5%)', opacity: '1' },
        },
        ledRingPulse: {
          '0%': { transform: 'scale(1)', opacity: '0.8' },
          '100%': { transform: 'scale(2.5)', opacity: '0' },
        },
        shineSweep: {
          '0%': { transform: 'translateX(-100%)' },
          '50%, 100%': { transform: 'translateX(200%)' },
        },
        floatUp: {
          '0%, 100%': { transform: 'translateY(0)', opacity: '0.3' },
          '50%': { transform: 'translateY(-20px)', opacity: '0.8' },
        },
        breathe: {
          '0%, 100%': { filter: 'drop-shadow(0 0 3px #00CED1)' },
          '50%': { filter: 'drop-shadow(0 0 10px #00CED1) drop-shadow(0 0 20px #00CED1)' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      backgroundImage: {
        'hex-pattern': `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%2300CED1' fill-opacity='0.02'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      },
      clipPath: {
        'chamfer': 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
      },
    },
  },
  plugins: [],
}
