import React from 'react'
import { CHART_COLORS } from './chartTheme'

interface HeatmapGridProps {
  data: number[][] // 7 days x 24 hours
  height?: number
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getColor(value: number, max: number): string {
  if (value === 0) return 'rgba(255,255,255,0.03)'
  const intensity = Math.min(value / (max || 1), 1)
  const r = Math.round(0 + intensity * 0)
  const g = Math.round(50 + intensity * 156)
  const b = Math.round(50 + intensity * 159)
  return `rgb(${r}, ${g}, ${b})`
}

export function HeatmapGrid({ data, height = 200 }: HeatmapGridProps) {
  if (!data || data.length !== 7) {
    return <div className="flex items-center justify-center h-32 text-gray-500 text-sm">No timing data available</div>
  }

  const max = Math.max(...data.flat())
  const cellW = 20
  const cellH = 22
  const labelW = 32
  const headerH = 20
  const svgW = labelW + 24 * cellW
  const svgH = headerH + 7 * cellH

  return (
    <div className="overflow-x-auto">
      <svg width={svgW} height={svgH} className="font-mono text-[10px]">
        {/* Hour labels */}
        {[0, 3, 6, 9, 12, 15, 18, 21].map(h => (
          <text key={h} x={labelW + h * cellW + cellW / 2} y={14} fill="#666" textAnchor="middle">{h}</text>
        ))}
        {/* Day rows */}
        {data.map((row, day) => (
          <g key={day}>
            <text x={0} y={headerH + day * cellH + cellH / 2 + 4} fill="#888" fontSize={10}>{DAY_LABELS[day]}</text>
            {row.map((val, hour) => (
              <rect
                key={hour}
                x={labelW + hour * cellW}
                y={headerH + day * cellH}
                width={cellW - 2}
                height={cellH - 2}
                rx={3}
                fill={getColor(val, max)}
              >
                <title>{`${DAY_LABELS[day]} ${hour}:00 - ${(val * 100).toFixed(1)}%`}</title>
              </rect>
            ))}
          </g>
        ))}
      </svg>
    </div>
  )
}
