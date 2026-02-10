import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TOOLTIP_STYLE, GRID_STYLE, AXIS_STYLE, CHART_SERIES_COLORS, formatDate } from './chartTheme'

interface TrendChartProps {
  data: Array<Record<string, any>>
  lines: Array<{ dataKey: string; name: string; color?: string }>
  xKey?: string
  height?: number
  formatY?: (val: number) => string
}

export function TrendChart({ data, lines, xKey = 'date', height = 250, formatY }: TrendChartProps) {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-48 text-gray-500 text-sm">No trend data available</div>
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey={xKey} {...AXIS_STYLE} tickFormatter={formatDate} />
        <YAxis {...AXIS_STYLE} tickFormatter={formatY} width={50} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#999' }} />
        {lines.map((line, i) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            name={line.name}
            stroke={line.color || CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
