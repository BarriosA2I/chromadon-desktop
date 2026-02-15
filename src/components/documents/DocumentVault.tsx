import { useEffect, useCallback, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import DocumentCard from './DocumentCard'
import KnowledgeSearch from './KnowledgeSearch'
import BrandAssets from './BrandAssets'
import { useClientContext } from '../../hooks/useClientContext'

interface Props {
  clientId: string
}

type VaultTab = 'documents' | 'brand-assets'

export default function DocumentVault({ clientId }: Props) {
  const { documents, searchResults, fetchDocuments, uploadDocument, deleteDocument, searchKnowledge } = useClientContext()
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState<VaultTab>('documents')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchDocuments(clientId)
  }, [clientId, fetchDocuments])

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setUploading(true)
    for (const file of Array.from(files)) {
      await uploadDocument(clientId, file)
    }
    setUploading(false)
  }, [clientId, uploadDocument])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }, [handleFiles])

  const handleDelete = useCallback(async (docId: string) => {
    await deleteDocument(clientId, docId)
  }, [clientId, deleteDocument])

  return (
    <div className="flex flex-col h-full">
      {/* Tab Switcher */}
      <div className="flex items-center gap-1 px-5 pt-3 pb-2">
        <div className="flex rounded-lg bg-white/5 p-0.5">
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'documents'
                ? 'bg-chroma-teal/20 text-chroma-teal'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            Documents
          </button>
          <button
            onClick={() => setActiveTab('brand-assets')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'brand-assets'
                ? 'bg-chroma-teal/20 text-chroma-teal'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            Brand Assets
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'brand-assets' ? (
        <BrandAssets clientId={clientId} />
      ) : (
        <>
          {/* Documents Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
            <div>
              <h2 className="text-sm font-black uppercase tracking-tight text-white">Knowledge Vault</h2>
              <p className="text-[10px] text-white/30">{documents.length} documents indexed</p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-3 py-1.5 bg-chroma-teal/20 border border-chroma-teal/40 rounded-lg text-chroma-teal text-xs font-medium hover:bg-chroma-teal/30 transition-colors disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : '+ Upload'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.csv,.txt,.png,.jpg,.jpeg,.webp"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              className="hidden"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Drop zone */}
            <motion.div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-xl p-6 text-center transition-colors
                ${isDragging ? 'border-chroma-teal/60 bg-chroma-teal/5' : 'border-white/10 hover:border-white/20'}
              `}
            >
              <div className="text-2xl mb-2">{isDragging ? '\u{1F4E5}' : '\u{1F4C4}'}</div>
              <p className="text-xs text-white/40">
                {isDragging ? 'Drop files here' : 'Drag & drop PDF, DOCX, CSV, TXT, or images'}
              </p>
              <p className="text-[10px] text-white/20 mt-1">or click Upload button above</p>
            </motion.div>

            {/* Search */}
            <KnowledgeSearch
              clientId={clientId}
              results={searchResults}
              onSearch={searchKnowledge}
            />

            {/* Document list */}
            {documents.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-white/30">Documents</div>
                {documents.map(doc => (
                  <DocumentCard key={doc.id} document={doc} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
