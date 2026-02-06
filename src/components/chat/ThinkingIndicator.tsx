import { motion } from 'framer-motion'

export function ThinkingIndicator() {
  return (
    <div className="flex items-start gap-3 px-3 py-2">
      <div className="w-7 h-7 rounded-lg bg-chroma-purple/20 border border-chroma-purple/30 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-display text-chroma-purple">AI</span>
      </div>
      <div className="flex items-center gap-1.5 py-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-chroma-teal"
            animate={{
              scale: [1, 1.4, 1],
              opacity: [0.4, 1, 0.4],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.2,
              ease: 'easeInOut',
            }}
          />
        ))}
        <span className="text-xs text-chroma-muted font-mono ml-2">thinking...</span>
      </div>
    </div>
  )
}
