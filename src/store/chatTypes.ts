export type ChatMessageRole = 'user' | 'assistant' | 'system'
export type ChatMessageType = 'text' | 'action-card' | 'thinking' | 'error' | 'status' | 'streaming'

export interface ChatMessage {
  id: string
  role: ChatMessageRole
  type: ChatMessageType
  content: string
  timestamp: Date
  // For streaming messages: interleaved text + tool calls
  streamingParts?: StreamingPart[]
  isStreaming?: boolean
  metadata?: {
    actions?: ActionResult[]
    confidence?: number
    cognitiveMode?: string
    duration?: number
    currentUrl?: string
    currentTitle?: string
  }
}

export interface StreamingPart {
  type: 'text' | 'tool-call'
  content?: string       // for text parts
  toolCall?: ToolCallInfo // for tool-call parts
}

export interface ToolCallInfo {
  id: string
  name: string
  input?: Record<string, any>
  status: 'calling' | 'executing' | 'done' | 'error'
  result?: string
  success?: boolean
  error?: string
  durationMs?: number
}

export interface ActionResult {
  action: string
  selector?: string
  description?: string
  success: boolean
  details?: string
  durationMs?: number
}
