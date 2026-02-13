import { motion } from 'framer-motion'
import type { InterviewPhase } from '../../store/clientContextTypes'

const PHASES: { key: InterviewPhase; label: string; icon: string }[] = [
  { key: 'greeting', label: 'Welcome', icon: '👋' },
  { key: 'discovery', label: 'Discovery', icon: '🔍' },
  { key: 'products', label: 'Products', icon: '📦' },
  { key: 'audience', label: 'Audience', icon: '👥' },
  { key: 'competitors', label: 'Competitors', icon: '⚔️' },
  { key: 'voice_capture', label: 'Brand Voice', icon: '🎙️' },
  { key: 'document_upload', label: 'Documents', icon: '📄' },
  { key: 'strategy_mapping', label: 'Strategy', icon: '🎯' },
  { key: 'complete', label: 'Complete', icon: '✅' },
]

interface Props {
  currentPhase: InterviewPhase
  completedPhases: InterviewPhase[]
  percentComplete: number
}

export default function InterviewPhaseIndicator({ currentPhase, completedPhases, percentComplete }: Props) {
  return (
    <div className="px-6 py-4">
      {/* Progress bar */}
      <div className="relative h-1.5 bg-white/5 rounded-full mb-4 overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-chroma-teal to-chroma-gold rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${percentComplete}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>

      {/* Phase steps */}
      <div className="flex items-center justify-between gap-1">
        {PHASES.map((phase, i) => {
          const isCompleted = completedPhases.includes(phase.key)
          const isCurrent = currentPhase === phase.key
          const isPending = !isCompleted && !isCurrent

          return (
            <div key={phase.key} className="flex flex-col items-center flex-1 min-w-0">
              <motion.div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                  transition-all duration-300 border
                  ${isCompleted ? 'bg-chroma-gold/20 border-chroma-gold/60 text-chroma-gold' : ''}
                  ${isCurrent ? 'bg-chroma-teal/20 border-chroma-teal/80 text-chroma-teal ring-2 ring-chroma-teal/30' : ''}
                  ${isPending ? 'bg-white/5 border-white/10 text-white/30' : ''}
                `}
                animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                {isCompleted ? '✓' : i + 1}
              </motion.div>
              <span className={`text-[10px] mt-1 truncate w-full text-center ${isCurrent ? 'text-chroma-teal font-medium' : isCompleted ? 'text-chroma-gold/60' : 'text-white/20'}`}>
                {phase.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
