import { useEffect, useCallback, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import MediaAssetCard from './MediaAssetCard'
import { useClientContext } from '../../hooks/useClientContext'

interface Props {
  clientId: string
}

const MEDIA_ACCEPT = '.png,.jpg,.jpeg,.webp,.gif,.jfif,.mp4,.mov,.avi,.webm'

export default function BrandAssets({ clientId }: Props) {
  const { mediaAssets, fetchMediaAssets, uploadMediaAsset, deleteMediaAsset, setPrimaryLogo } = useClientContext()
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchMediaAssets(clientId)
  }, [clientId, fetchMediaAssets])

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setUploading(true)
    for (const file of Array.from(files)) {
      await uploadMediaAsset(clientId, file)
    }
    setUploading(false)
  }, [clientId, uploadMediaAsset])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }, [handleFiles])

  const handleDelete = useCallback(async (assetId: string) => {
    await deleteMediaAsset(clientId, assetId)
  }, [clientId, deleteMediaAsset])

  const handleSetPrimary = useCallback(async (assetId: string) => {
    await setPrimaryLogo(clientId, assetId)
  }, [clientId, setPrimaryLogo])

  const imageAssets = mediaAssets.filter(a => a.assetType === 'image')
  const videoAssets = mediaAssets.filter(a => a.assetType === 'video')

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
        <div>
          <h2 className="text-sm font-black uppercase tracking-tight text-white">Brand Assets</h2>
          <p className="text-[10px] text-white/30">{mediaAssets.length} asset{mediaAssets.length !== 1 ? 's' : ''} uploaded</p>
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
          accept={MEDIA_ACCEPT}
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
          <div className="text-2xl mb-2">{isDragging ? '\u{1F4E5}' : '\u{1F3A8}'}</div>
          <p className="text-xs text-white/40">
            {isDragging ? 'Drop media here' : 'Drag & drop logos, images, or videos'}
          </p>
          <p className="text-[10px] text-white/20 mt-1">PNG, JPG, WEBP, GIF, JFIF, MP4, MOV, AVI, WEBM</p>
        </motion.div>

        {/* Images */}
        {imageAssets.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/30 mb-2">Images ({imageAssets.length})</div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
              {imageAssets.map(asset => (
                <MediaAssetCard
                  key={asset.id}
                  asset={asset}
                  onDelete={handleDelete}
                  onSetPrimary={handleSetPrimary}
                />
              ))}
            </div>
          </div>
        )}

        {/* Videos */}
        {videoAssets.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/30 mb-2">Videos ({videoAssets.length})</div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
              {videoAssets.map(asset => (
                <MediaAssetCard
                  key={asset.id}
                  asset={asset}
                  onDelete={handleDelete}
                  onSetPrimary={handleSetPrimary}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {mediaAssets.length === 0 && !uploading && (
          <div className="text-center py-6">
            <p className="text-xs text-white/30">No brand assets yet</p>
            <p className="text-[10px] text-white/20 mt-1">Upload your logo and media for AI to use in social posts</p>
          </div>
        )}
      </div>
    </div>
  )
}
