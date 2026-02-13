import { useRef, useCallback } from 'react'

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime'
const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB
const MAX_FILES = 10

interface MediaUploadButtonProps {
  disabled?: boolean
  currentFileCount: number
  onFilesSelected: (files: File[]) => void
  onError: (message: string) => void
}

export function MediaUploadButton({ disabled, currentFileCount, onFilesSelected, onError }: MediaUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClick = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return

    const files = Array.from(fileList)
    const remaining = MAX_FILES - currentFileCount

    if (remaining <= 0) {
      onError(`Max ${MAX_FILES} files already attached`)
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    if (files.length > remaining) {
      onError(`Max ${MAX_FILES} files. You can add ${remaining} more.`)
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    const oversized = files.filter(f => f.size > MAX_FILE_SIZE)
    if (oversized.length > 0) {
      onError(`Files over 500MB: ${oversized.map(f => f.name).join(', ')}`)
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    onFilesSelected(files)
    if (inputRef.current) inputRef.current.value = ''
  }, [currentFileCount, onFilesSelected, onError])

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        multiple
        className="hidden"
        onChange={handleChange}
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || currentFileCount >= MAX_FILES}
        className="flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-lg text-chroma-muted hover:text-chroma-teal hover:bg-chroma-teal/10 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
        title={`Attach media (${currentFileCount}/${MAX_FILES})`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
      </button>
    </>
  )
}
