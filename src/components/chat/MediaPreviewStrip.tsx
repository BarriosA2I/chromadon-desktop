import { AnimatePresence, motion } from 'framer-motion'
import type { MediaAttachment } from '../../store/chatTypes'

interface MediaPreviewStripProps {
  attachments: MediaAttachment[]
  onRemove: (id: string) => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`
}

export function MediaPreviewStrip({ attachments, onRemove }: MediaPreviewStripProps) {
  if (attachments.length === 0) return null

  return (
    <div className="border-b border-white/[0.06] px-2 py-1.5">
      <div className="flex gap-1.5 overflow-x-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-chroma-teal/20">
        <AnimatePresence initial={false}>
          {attachments.map((attachment) => (
            <motion.div
              key={attachment.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              className="relative flex-shrink-0 group"
            >
              {attachment.type === 'image' ? (
                <img
                  src={attachment.previewUrl}
                  alt={attachment.name}
                  className="w-14 h-14 rounded-lg object-cover border border-chroma-teal/20"
                />
              ) : (
                <div className="w-14 h-14 rounded-lg border border-chroma-purple/20 bg-black/40 flex flex-col items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" className="text-chroma-purple">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  <span className="text-[8px] text-chroma-muted font-mono mt-0.5 truncate max-w-[48px] px-0.5">
                    {attachment.name.split('.').pop()?.toUpperCase()}
                  </span>
                </div>
              )}

              {/* File size badge */}
              <span className="absolute bottom-0.5 left-0.5 text-[7px] text-chroma-muted font-mono bg-black/70 px-0.5 rounded">
                {formatFileSize(attachment.size)}
              </span>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => onRemove(attachment.id)}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 text-[10px] leading-none"
                title="Remove"
              >
                &times;
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between mt-1">
        <span className="text-[9px] text-chroma-muted/50 font-mono">
          {attachments.length} file{attachments.length !== 1 ? 's' : ''} attached
        </span>
        <span className="text-[9px] text-chroma-muted/30 font-mono">
          {formatFileSize(attachments.reduce((sum, a) => sum + a.size, 0))} total
        </span>
      </div>
    </div>
  )
}
