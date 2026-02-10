/**
 * Analytics Charts - Recharts Theme Constants
 *
 * Cyberpunk aesthetic matching CHROMADON's design language.
 *
 * @author Barrios A2I
 */

export const CHART_COLORS = {
  teal: '#00CED1',
  gold: '#D4AF37',
  purple: '#8B5CF6',
  pink: '#EC4899',
  green: '#10B981',
  red: '#EF4444',
  blue: '#3B82F6',
  orange: '#F59E0B',
} as const

export const PLATFORM_COLORS: Record<string, string> = {
  twitter: '#1DA1F2',
  linkedin: '#0A66C2',
  instagram: '#E4405F',
  facebook: '#1877F2',
  youtube: '#FF0000',
  tiktok: '#00F2EA',
}

export const CHART_SERIES_COLORS = [
  CHART_COLORS.teal,
  CHART_COLORS.gold,
  CHART_COLORS.purple,
  CHART_COLORS.pink,
  CHART_COLORS.green,
  CHART_COLORS.blue,
]

export const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(10, 10, 15, 0.95)',
  border: '1px solid rgba(0, 206, 209, 0.3)',
  borderRadius: '8px',
  fontSize: '12px',
  fontFamily: "'JetBrains Mono', monospace",
  color: '#e5e5e5',
}

export const GRID_STYLE = {
  stroke: 'rgba(255, 255, 255, 0.06)',
  strokeDasharray: '3 3',
}

export const AXIS_STYLE = {
  tick: { fill: '#666', fontSize: 11 },
  axisLine: { stroke: 'rgba(255,255,255,0.1)' },
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

export function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
