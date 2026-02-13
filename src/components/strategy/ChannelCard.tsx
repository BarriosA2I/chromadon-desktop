import { motion } from 'framer-motion'
import type { ChannelStrategy } from '../../store/clientContextTypes'

const PLATFORM_COLORS: Record<string, string> = {
  twitter: 'border-blue-400/40 bg-blue-400/10',
  linkedin: 'border-blue-600/40 bg-blue-600/10',
  instagram: 'border-pink-400/40 bg-pink-400/10',
  facebook: 'border-blue-500/40 bg-blue-500/10',
  tiktok: 'border-white/40 bg-white/10',
  pinterest: 'border-red-400/40 bg-red-400/10',
  youtube: 'border-red-500/40 bg-red-500/10',
  google: 'border-green-400/40 bg-green-400/10',
}

const PRIORITY_BADGES: Record<string, string> = {
  high: 'bg-chroma-gold/20 text-chroma-gold border-chroma-gold/30',
  medium: 'bg-chroma-teal/20 text-chroma-teal border-chroma-teal/30',
  low: 'bg-white/10 text-white/50 border-white/20',
}

interface Props {
  channel: ChannelStrategy
  index: number
}

export default function ChannelCard({ channel, index }: Props) {
  const platformColor = PLATFORM_COLORS[channel.platform] || 'border-white/20 bg-white/5'
  const priorityBadge = PRIORITY_BADGES[channel.priority] || ''

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`rounded-xl border p-4 ${platformColor}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white capitalize">{channel.platform}</h3>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${priorityBadge}`}>
          {channel.priority}
        </span>
      </div>

      <p className="text-xs text-white/60 mb-3">{channel.objective}</p>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/30 w-16">Frequency</span>
          <span className="text-xs text-white/60">{channel.postingFrequency}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/30 w-16">Reach</span>
          <span className="text-xs text-white/60">{channel.estimatedReach}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/30 w-16">Content</span>
          <span className="text-xs text-white/40">{channel.contentTypes.join(', ')}</span>
        </div>
      </div>

      {channel.tactics.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="text-[10px] text-white/20 mb-1">Tactics</div>
          <div className="flex flex-wrap gap-1">
            {channel.tactics.slice(0, 3).map((t, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 bg-white/5 rounded text-white/40">{t}</span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}
