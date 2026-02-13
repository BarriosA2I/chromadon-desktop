import { motion } from 'framer-motion'
import type { KnowledgeDocument } from '../../store/clientContextTypes'

const FILE_ICONS: Record<string, string> = {
  'application/pdf': '📕',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📘',
  'text/csv': '📊',
  'text/plain': '📝',
  'image/png': '🖼️',
  'image/jpeg': '🖼️',
  'image/webp': '🖼️',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-yellow-400 bg-yellow-400/10',
  processing: 'text-blue-400 bg-blue-400/10',
  indexed: 'text-green-400 bg-green-400/10',
  failed: 'text-red-400 bg-red-400/10',
}

interface Props {
  document: KnowledgeDocument
  onDelete: (docId: string) => void
}

export default function DocumentCard({ document: doc, onDelete }: Props) {
  const icon = FILE_ICONS[doc.mimeType] || '📄'
  const statusColor = STATUS_COLORS[doc.status] || ''
  const size = doc.fileSize > 1024 * 1024
    ? `${(doc.fileSize / (1024 * 1024)).toFixed(1)} MB`
    : `${(doc.fileSize / 1024).toFixed(0)} KB`

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-xl group hover:border-white/20 transition-colors"
    >
      <div className="text-2xl">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white/80 truncate">{doc.originalFilename}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-white/30">{size}</span>
          {doc.chunkCount > 0 && <span className="text-[10px] text-white/30">· {doc.chunkCount} chunks</span>}
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColor}`}>{doc.status}</span>
        </div>
      </div>
      <button
        onClick={() => onDelete(doc.id)}
        className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all p-1"
        title="Delete document"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </motion.div>
  )
}
