import React from 'react'
import type { AnalyticsPeriod } from '../../../store/analyticsTypes'

interface DateRangePickerProps {
  selected: AnalyticsPeriod
  onChange: (period: AnalyticsPeriod) => void
}

const PERIODS: Array<{ value: AnalyticsPeriod; label: string }> = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
]

export function DateRangePicker({ selected, onChange }: DateRangePickerProps) {
  return (
    <div className="flex gap-1">
      {PERIODS.map(p => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
            selected === p.value
              ? 'bg-[#00CED1]/20 text-[#00CED1] border border-[#00CED1]/30'
              : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10 hover:text-gray-300'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
