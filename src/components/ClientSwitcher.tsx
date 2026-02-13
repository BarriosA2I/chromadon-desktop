import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ClientInfo } from '../store/clientContextTypes'
import { useClientContext } from '../hooks/useClientContext'

interface Props {
  onNewClient: () => void
}

export default function ClientSwitcher({ onNewClient }: Props) {
  const { clients, activeClient, fetchClients, switchClient, deleteClient } = useClientContext()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSwitch = async (clientId: string) => {
    await switchClient(clientId)
    setIsOpen(false)
  }

  const handleDelete = async (e: React.MouseEvent, clientId: string) => {
    e.stopPropagation()
    if (confirm('Delete this client and all their data?')) {
      await deleteClient(clientId)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-chroma-obsidian/60 border border-white/[0.08] rounded-lg hover:border-chroma-teal/30 hover:shadow-crystal transition-all no-drag"
      >
        <div className="w-4 h-4 rounded bg-chroma-teal/30 flex items-center justify-center text-[8px] text-chroma-teal font-bold">
          {activeClient?.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <span className="text-xs text-white/70 max-w-[120px] truncate">
          {activeClient?.name || 'No Client'}
        </span>
        <svg className={`w-3 h-3 text-white/30 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="absolute right-0 top-full mt-1.5 w-64 bg-chroma-obsidian/95 backdrop-blur-2xl border border-chroma-teal/15 rounded-xl shadow-crystal-active overflow-hidden z-50"
          >
            <div className="p-2 border-b border-chroma-teal/10">
              <span className="text-[10px] font-display uppercase tracking-[0.3em] text-chroma-teal/50 px-2">Clients</span>
            </div>

            <div className="max-h-48 overflow-y-auto p-1">
              {clients.map(client => (
                <button
                  key={client.id}
                  onClick={() => handleSwitch(client.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors group ${
                    activeClient?.id === client.id ? 'bg-chroma-teal/10 border border-chroma-teal/20 shadow-[inset_0_0_30px_rgba(0,206,209,0.06)]' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${
                      activeClient?.id === client.id ? 'bg-chroma-teal/30 text-chroma-teal' : 'bg-white/10 text-white/40'
                    }`}>
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs text-white/80 truncate">{client.name}</div>
                      <div className="text-[10px] text-white/30">
                        {client.interviewComplete ? '✓ Onboarded' : '○ In Progress'} · {client.documentCount} docs
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, client.id)}
                    className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all p-1"
                    title="Delete client"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </button>
              ))}
            </div>

            <div className="p-1 border-t border-white/5">
              <button
                onClick={() => { setIsOpen(false); onNewClient() }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-chroma-teal border border-dashed border-chroma-teal/20 hover:border-solid hover:border-chroma-teal/40 hover:bg-chroma-teal/10 hover:shadow-crystal transition-all"
              >
                <span className="text-lg">+</span>
                New Client
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
