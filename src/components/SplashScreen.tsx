import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

export default function SplashScreen() {
  const [text, setText] = useState('')
  const fullText = 'INITIALIZING NEURAL LINK...'

  useEffect(() => {
    let index = 0
    const timer = setInterval(() => {
      setText(fullText.slice(0, index + 1))
      index++
      if (index >= fullText.length) {
        clearInterval(timer)
      }
    }, 80)

    return () => clearInterval(timer)
  }, [])

  return (
    <motion.div
      className="fixed inset-0 bg-chroma-black flex flex-col items-center justify-center z-50"
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Logo Animation */}
      <motion.div
        initial={{ scale: 1 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.3, x: -450, y: -320 }}
        transition={{ duration: 0.8, ease: 'easeInOut' }}
      >
        <AnimatedLogo />
      </motion.div>

      {/* Typewriter Text */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="mt-8 flex items-center"
      >
        <span className="font-mono text-chroma-teal text-sm tracking-widest">
          {text}
        </span>
        <span className="block-cursor" />
      </motion.div>

      {/* Loading bar */}
      <motion.div
        initial={{ opacity: 0, width: 0 }}
        animate={{ opacity: 1, width: 200 }}
        transition={{ delay: 2, duration: 1.5 }}
        className="mt-6 h-0.5 bg-chroma-teal/30 rounded-full overflow-hidden"
      >
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="h-full w-1/3 bg-chroma-teal"
        />
      </motion.div>
    </motion.div>
  )
}

function AnimatedLogo() {
  return (
    <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
      {/* Outer hexagon */}
      <motion.path
        d="M100 10L175 50V150L100 190L25 150V50L100 10Z"
        stroke="#00CED1"
        strokeWidth="2"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.5, ease: 'easeInOut' }}
      />

      {/* Inner circle */}
      <motion.circle
        cx="100"
        cy="100"
        r="50"
        stroke="#00CED1"
        strokeWidth="2"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1, delay: 0.5, ease: 'easeInOut' }}
      />

      {/* Neural nodes */}
      <motion.g
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
      >
        {/* Center node */}
        <circle cx="100" cy="100" r="8" fill="#00CED1">
          <animate
            attributeName="opacity"
            values="1;0.5;1"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>

        {/* Outer nodes */}
        {[0, 60, 120, 180, 240, 300].map((angle, i) => {
          const x = 100 + 35 * Math.cos((angle * Math.PI) / 180)
          const y = 100 + 35 * Math.sin((angle * Math.PI) / 180)
          return (
            <g key={i}>
              <line
                x1="100"
                y1="100"
                x2={x}
                y2={y}
                stroke="#8B5CF6"
                strokeWidth="1"
                opacity="0.6"
              />
              <circle cx={x} cy={y} r="4" fill="#8B5CF6">
                <animate
                  attributeName="opacity"
                  values="1;0.3;1"
                  dur="1.5s"
                  begin={`${i * 0.2}s`}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          )
        })}
      </motion.g>

      {/* CHROMADON text */}
      <motion.text
        x="100"
        y="175"
        textAnchor="middle"
        fill="#00CED1"
        fontFamily="Orbitron"
        fontSize="16"
        fontWeight="bold"
        letterSpacing="4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
      >
        CHROMADON
      </motion.text>
    </svg>
  )
}
