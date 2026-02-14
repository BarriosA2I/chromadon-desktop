import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import chromadonLogo from '@/assets/chromadon-logo-200.png'

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
    <div className="relative w-[200px] h-[200px]">
      {/* Teal glow backdrop */}
      <motion.div
        className="absolute inset-0 rounded-full"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: [0, 0.6, 0.3], scale: [0.5, 1.2, 1] }}
        transition={{ duration: 2, times: [0, 0.6, 1], ease: 'easeOut' }}
        style={{
          background: 'radial-gradient(circle, rgba(0, 206, 209, 0.3) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }}
      />

      {/* Ring reveal effect */}
      <motion.div
        className="absolute inset-2 rounded-full border-2 border-chroma-teal/40"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: [0, 1, 0.3] }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
      />

      {/* The real dragon crest logo */}
      <motion.img
        src={chromadonLogo}
        alt="CHROMADON"
        width={200}
        height={200}
        className="relative z-10"
        initial={{ scale: 0.3, opacity: 0, filter: 'brightness(2) blur(10px)' }}
        animate={{ scale: 1, opacity: 1, filter: 'brightness(1) blur(0px)' }}
        transition={{ duration: 1.2, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      />

      {/* Breathing glow on the logo */}
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none z-20"
        initial={{ opacity: 0 }}
        animate={{
          boxShadow: [
            '0 0 20px rgba(0, 206, 209, 0)',
            '0 0 40px rgba(0, 206, 209, 0.4)',
            '0 0 20px rgba(0, 206, 209, 0)',
          ],
        }}
        transition={{ duration: 2, delay: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* CHROMADON text below */}
      <motion.div
        className="absolute -bottom-8 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.5 }}
      >
        <span className="heading-cyber text-lg tracking-[0.25em]">CHROMADON</span>
      </motion.div>
    </div>
  )
}
