import React from 'react'
import type { AnalyticsPlatform } from '../../../store/analyticsTypes'

interface PlatformFilterProps {
  available: AnalyticsPlatform[]
  selected: AnalyticsPlatform[]
  onChange: (platforms: AnalyticsPlatform[]) => void
}

const PLATFORM_LABELS: Record<string, string> = {
  twitter: 'Twitter',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
  tiktok: 'TikTok',
}

const PLATFORM_COLORS: Record<string, string> = {
  twitter: '#1DA1F2',
  linkedin: '#0A66C2',
  instagram: '#E4405F',
  facebook: '#1877F2',
  youtube: '#FF0000',
  tiktok: '#00F2EA',
}

export function PlatformFilter({ available, selected, onChange }: PlatformFilterProps) {
  if (available.length === 0) return null

  const toggle = (platform: AnalyticsPlatform) => {
    if (selected.includes(platform)) {
      onChange(selected.filter(p => p !== platform))
    } else {
      onChange([...selected, platform])
    }
  }

  return (
    <div className="flex gap-1.5 flex-wrap">
      {available.map(p => {
        const active = selected.length === 0 || selected.includes(p)
        const color = PLATFORM_COLORS[p] || '#888'
        return (
          <button
            key={p}
            onClick={() => toggle(p)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all border ${
              active
                ? 'border-opacity-40 text-white'
                : 'border-white/5 text-gray-500 opacity-50 hover:opacity-75'
            }`}
            style={active ? { borderColor: color, backgroundColor: `${color}15`, color } : undefined}
          >
            {PLATFORM_LABELS[p] || p}
          </button>
        )
      })}
    </div>
  )
}
