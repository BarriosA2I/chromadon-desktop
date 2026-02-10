import React from 'react'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { CHART_SERIES_COLORS, TOOLTIP_STYLE } from './chartTheme'

interface RadarCompareProps {
  data: Array<Record<string, any>>
  subjects: string[]
  height?: number
}

export function RadarCompare({ data, subjects, height = 280 }: RadarCompareProps) {
  if (!data || data.length === 0 || subjects.length === 0) {
    return <div className="flex items-center justify-center h-48 text-gray-500 text-sm">No competitor data available</div>
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data}>
        <PolarGrid stroke="rgba(255,255,255,0.1)" />
        <PolarAngleAxis dataKey="metric" tick={{ fill: '#888', fontSize: 11 }} />
        <PolarRadiusAxis tick={{ fill: '#666', fontSize: 10 }} />
        {subjects.map((name, i) => (
          <Radar
            key={name}
            name={name}
            dataKey={name}
            stroke={CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length]}
            fill={CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length]}
            fillOpacity={0.15}
          />
        ))}
        <Legend wrapperStyle={{ fontSize: 11, color: '#999' }} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
      </RadarChart>
    </ResponsiveContainer>
  )
}
