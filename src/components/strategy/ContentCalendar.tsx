import { motion } from 'framer-motion'
import type { ContentCalendarEntry } from '../../store/clientContextTypes'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const PLATFORM_COLORS: Record<string, string> = {
  twitter: 'bg-blue-400/20 border-blue-400/30 text-blue-300',
  linkedin: 'bg-blue-600/20 border-blue-600/30 text-blue-300',
  instagram: 'bg-pink-400/20 border-pink-400/30 text-pink-300',
  facebook: 'bg-blue-500/20 border-blue-500/30 text-blue-300',
  tiktok: 'bg-white/10 border-white/20 text-white/60',
  youtube: 'bg-red-500/20 border-red-500/30 text-red-300',
}

interface Props {
  entries: ContentCalendarEntry[]
  weeks: number
}

export default function ContentCalendar({ entries, weeks }: Props) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-xs text-white/30">No content calendar generated yet</p>
      </div>
    )
  }

  const weekNumbers = Array.from(new Set(entries.map(e => e.week))).sort()

  return (
    <div className="space-y-4">
      {weekNumbers.map(week => {
        const weekEntries = entries.filter(e => e.week === week)

        return (
          <motion.div
            key={week}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (week - 1) * 0.1 }}
          >
            <div className="text-xs font-medium text-white/40 mb-2">Week {week}</div>
            <div className="grid grid-cols-7 gap-1">
              {DAYS.map((day, dayIdx) => {
                const dayEntries = weekEntries.filter(e => e.dayOfWeek === dayIdx + 1)
                return (
                  <div key={dayIdx} className="min-h-[60px]">
                    <div className="text-[9px] text-white/20 mb-1">{day}</div>
                    <div className="space-y-1">
                      {dayEntries.map((entry, i) => {
                        const color = PLATFORM_COLORS[entry.platform] || 'bg-white/5 border-white/10 text-white/40'
                        return (
                          <div
                            key={i}
                            className={`px-1.5 py-1 rounded border text-[9px] truncate cursor-default ${color}`}
                            title={`${entry.platform}: ${entry.topic}\n${entry.caption}`}
                          >
                            {entry.platform.slice(0, 3)}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
