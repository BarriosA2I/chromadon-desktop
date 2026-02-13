import { motion } from 'framer-motion'
import type { SuccessMetric } from '../../store/clientContextTypes'

const CATEGORY_COLORS: Record<string, string> = {
  awareness: 'text-purple-400 bg-purple-400',
  engagement: 'text-blue-400 bg-blue-400',
  conversion: 'text-green-400 bg-green-400',
  retention: 'text-yellow-400 bg-yellow-400',
  revenue: 'text-chroma-gold bg-chroma-gold',
}

interface Props {
  metrics: SuccessMetric[]
}

export default function MetricsPanel({ metrics }: Props) {
  if (metrics.length === 0) return null

  return (
    <div className="space-y-3">
      {metrics.map((metric, i) => {
        const progress = metric.targetValue > 0
          ? Math.min((metric.currentValue / metric.targetValue) * 100, 100)
          : 0
        const colors = CATEGORY_COLORS[metric.category] || 'text-white/40 bg-white'

        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="px-3 py-2 bg-white/5 rounded-lg"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-white/70">{metric.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors.split(' ')[0]} bg-opacity-10`}>
                {metric.category}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${colors.split(' ')[1]}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.8, delay: i * 0.1 }}
                  style={{ opacity: 0.6 }}
                />
              </div>
              <span className="text-[10px] text-white/30 w-20 text-right">
                {metric.currentValue}/{metric.targetValue} {metric.unit}
              </span>
            </div>
            <div className="text-[9px] text-white/20 mt-0.5">{metric.timeframe}</div>
          </motion.div>
        )
      })}
    </div>
  )
}
