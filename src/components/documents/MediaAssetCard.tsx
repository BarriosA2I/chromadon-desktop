import { useState } from 'react'
import { motion } from 'framer-motion'
import type { BrandAsset } from '../../store/clientContextTypes'

const BRAIN_URL = 'http://127.0.0.1:3001'

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
  const [imgError, setImgError] = useState(false)
  const isImage = asset.assetType === 'image'
  const thumbUrl = `${BRAIN_URL}/api/client-context/media/file/${asset.id}?clientId=${asset.clientId}`

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`
        relative rounded-xl overflow-hidden transition-colors
        ${asset.isPrimaryLogo
          ? 'bg-amber-500/10 border border-amber-500/30'
          : 'bg-white/5 border border-white/10 hover:border-white/20'
        }
      `}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[4/3] bg-black/30 overflow-hidden">
        {isImage && !imgError ? (
          <img
            src={thumbUrl}
            alt={asset.originalFilename}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : !isImage && !imgError ? (
          <video
            src={thumbUrl}
            muted
            preload="metadata"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">
            {isImage ? '\u{1F5BC}\uFE0F' : '\u{1F3AC}'}
          </div>
        )}

        {/* Video play icon overlay */}
        {!isImage && !imgError && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
              <div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[8px] border-l-white ml-0.5" />
            </div>
          </div>
        )}

        {/* Primary Logo badge */}
        {asset.isPrimaryLogo && (
          <div className="absolute top-1.5 left-1.5">
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/80 text-white font-bold uppercase tracking-wider">
              Primary Logo
            </span>
          </div>
        )}

        {/* Hover actions overlay */}
        {hovered && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2">
            {isImage && !asset.isPrimaryLogo && (
              <button
                onClick={() => onSetPrimary(asset.id)}
                className="px-2 py-1 text-[10px] bg-amber-500/30 text-amber-300 rounded hover:bg-amber-500/50 transition-colors border border-amber-500/40"
              >
                Set Logo
              </button>
            )}
            <button
              onClick={() => onDelete(asset.id)}
              className="px-2 py-1 text-[10px] bg-red-500/30 text-red-300 rounded hover:bg-red-500/50 transition-colors border border-red-500/40"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Info bar */}
      <div className="px-2.5 py-2">
        <div className="text-[11px] text-white/80 truncate">{asset.originalFilename}</div>
        <div className="text-[9px] text-white/30 mt-0.5">
          {asset.assetType} &middot; {formatSize(asset.fileSize)}
        </div>
      </div>
    </motion.div>
  )
}
