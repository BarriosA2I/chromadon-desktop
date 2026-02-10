import React from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TOOLTIP_STYLE, GRID_STYLE, AXIS_STYLE, CHART_COLORS, formatNumber, formatDate } from './chartTheme'

interface GrowthChartProps {
  data: Array<{ date: string; followers: number }>
  height?: number
  color?: string
}

export function GrowthChart({ data, height = 220, color = CHART_COLORS.teal }: GrowthChartProps) {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-48 text-gray-500 text-sm">No growth data available</div>
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="date" {...AXIS_STYLE} tickFormatter={formatDate} />
        <YAxis {...AXIS_STYLE} tickFormatter={formatNumber} width={50} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={formatDate} />
        <Area type="monotone" dataKey="followers" stroke={color} fill="url(#growthGradient)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
