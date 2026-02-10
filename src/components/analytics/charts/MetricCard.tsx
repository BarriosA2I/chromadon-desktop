import React from 'react'
import { motion } from 'framer-motion'
import { formatNumber, formatPercent, CHART_COLORS } from './chartTheme'
import { LineChart, Line, ResponsiveContainer } from 'recharts'

interface MetricCardProps {
  label: string
  value: number
  change?: number
  format?: 'number' | 'percent'
  sparkData?: Array<{ value: number }>
  color?: string
  index?: number
}

export function MetricCard({ label, value, change, format = 'number', sparkData, color = CHART_COLORS.teal, index = 0 }: MetricCardProps) {
  const formatted = format === 'percent' ? formatPercent(value) : formatNumber(value)
  const changeFormatted = change != null
    ? `${change >= 0 ? '+' : ''}${format === 'percent' ? formatPercent(change) : formatNumber(change)}`
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08 }}
      className="relative group rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-4 overflow-hidden"
      style={{
        boxShadow: `0 0 20px ${color}05, inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}
    >
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-4 h-[1px] opacity-60" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
      <div className="absolute top-0 left-0 w-[1px] h-4 opacity-60" style={{ background: `linear-gradient(180deg, ${color}, transparent)` }} />
      <div className="absolute bottom-0 right-0 w-4 h-[1px] opacity-30" style={{ background: `linear-gradient(270deg, ${color}, transparent)` }} />
      <div className="absolute bottom-0 right-0 w-[1px] h-4 opacity-30" style={{ background: `linear-gradient(0deg, ${color}, transparent)` }} />

      {/* Hover glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at center, ${color}08 0%, transparent 70%)` }}
      />

      <div className="relative z-10">
        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1.5">{label}</div>
        <div className="text-2xl font-black text-white tabular-nums" style={{ color }}>{formatted}</div>
        {changeFormatted && (
          <div className={`text-[11px] font-mono mt-1 flex items-center gap-1 ${change! >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d={change! >= 0 ? 'M7 17l5-5 5 5' : 'M7 7l5 5 5-5'} />
            </svg>
            {changeFormatted}
          </div>
        )}
        {sparkData && sparkData.length > 1 && (
          <div className="h-8 mt-2 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData}>
                <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </motion.div>
  )
}
