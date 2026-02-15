import { useState } from 'react'
import { motion } from 'framer-motion'
import type { BrandAsset } from '../../store/clientContextTypes'

interface Props {
  asset: BrandAsset
  onDelete: (assetId: string) => void
  onSetPrimary: (assetId: string) => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function MediaAssetCard({ asset, onDelete, onSetPrimary }: Props) {
  const [hovered, setHovered] = useState(false)
  const isImage = asset.assetType === 'image'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`
        relative rounded-xl p-3 transition-colors
        ${asset.isPrimaryLogo
          ? 'bg-amber-500/10 border border-amber-500/30'
          : 'bg-white/5 border border-white/10 hover:border-white/20'
        }
      `}
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="text-xl flex-shrink-0">
          {isImage ? '\u{1F5BC}\uFE0F' : '\u{1F3AC}'}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/80 truncate">{asset.originalFilename}</span>
            {asset.isPrimaryLogo && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold uppercase tracking-wider flex-shrink-0">
                Primary Logo
              </span>
            )}
          </div>
          <div className="text-[10px] text-white/30 mt-0.5">
            {asset.assetType} &middot; {formatSize(asset.fileSize)}
          </div>
        </div>

        {/* Actions (on hover) */}
        {hovered && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {isImage && !asset.isPrimaryLogo && (
              <button
                onClick={() => onSetPrimary(asset.id)}
                className="px-2 py-1 text-[10px] bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30 transition-colors"
                title="Set as primary logo"
              >
                Set Logo
              </button>
            )}
            <button
              onClick={() => onDelete(asset.id)}
              className="px-2 py-1 text-[10px] bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
              title="Delete asset"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
