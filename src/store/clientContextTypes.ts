/**
 * Client Context UI State Types
 *
 * @author Barrios A2I
 */

export type InterviewPhase =
  | 'greeting'
  | 'discovery'
  | 'products'
  | 'audience'
  | 'competitors'
  | 'voice_capture'
  | 'document_upload'
  | 'strategy_mapping'
  | 'complete'

export interface InterviewMessage {
  role: 'assistant' | 'user'
  content: string
  phase: InterviewPhase
  timestamp: string
}

export interface ClientInfo {
  id: string
  name: string
  createdAt: string
  lastActiveAt: string
  interviewComplete: boolean
  documentCount: number
  hasStrategy: boolean
}

export interface InterviewProgress {
  currentPhase: InterviewPhase
  completedPhases: InterviewPhase[]
  totalPhases: number
  percentComplete: number
  isComplete: boolean
}

export interface KnowledgeDocument {
  id: string
  clientId: string
  filename: string
  originalFilename: string
  mimeType: string
  fileSize: number
  chunkCount: number
  status: 'pending' | 'processing' | 'indexed' | 'failed'
  errorMessage?: string
  uploadedAt: string
  processedAt?: string
}

export interface SearchResult {
  content: string
  score: number
  source: string
}

export interface ChannelStrategy {
  platform: string
  priority: 'high' | 'medium' | 'low'
  objective: string
  tactics: string[]
  postingFrequency: string
  contentTypes: string[]
  targetAudience: string
  kpis: string[]
  estimatedReach: string
}

export interface ContentCalendarEntry {
  id: string
  week: number
  dayOfWeek: number
  platform: string
  contentType: string
  topic: string
  caption: string
  hashtags: string[]
  callToAction: string
  status: 'planned' | 'drafted' | 'posted' | 'skipped'
}

export interface SuccessMetric {
  name: string
  category: 'awareness' | 'engagement' | 'conversion' | 'retention' | 'revenue'
  currentValue: number
  targetValue: number
  unit: string
  timeframe: string
}

export interface GrowthStrategy {
  clientId: string
  overview: string
  targetMarketAnalysis: string
  competitiveAdvantages: string[]
  channels: ChannelStrategy[]
  contentCalendar: ContentCalendarEntry[]
  successMetrics: SuccessMetric[]
  shortTermGoals: Array<{ goal: string; timeline: string }>
  longTermGoals: Array<{ goal: string; timeline: string }>
  generatedAt: string
  updatedAt: string
  version: number
}
