import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SearchResult } from '../../store/clientContextTypes'

interface Props {
  clientId: string
  results: SearchResult[]
  onSearch: (clientId: string, query: string) => Promise<void>
}

export default function KnowledgeSearch({ clientId, results, onSearch }: Props) {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return
    setSearching(true)
    await onSearch(clientId, query.trim())
    setSearching(false)
  }, [clientId, query, onSearch])

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search knowledge vault..."
          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-chroma-teal/50"
        />
        <button
          onClick={handleSearch}
          disabled={!query.trim() || searching}
          className="px-4 py-2 bg-chroma-teal/20 border border-chroma-teal/40 rounded-lg text-chroma-teal text-sm font-medium disabled:opacity-30 hover:bg-chroma-teal/30 transition-colors"
        >
          {searching ? '...' : 'Search'}
        </button>
      </div>

      <AnimatePresence>
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <div className="text-[10px] uppercase tracking-wider text-white/30">{results.length} results</div>
            {results.map((result, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-chroma-teal/60 font-medium">{result.source}</span>
                  <span className="text-[10px] text-white/20">{(result.score * 100).toFixed(0)}% match</span>
                </div>
                <p className="text-xs text-white/60 line-clamp-3">{result.content}</p>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
