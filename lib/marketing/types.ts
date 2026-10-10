/** Founder Marketing Agent: shared types. Safe to import from client code (no secrets, no server modules). */

export const PLATFORMS = ['x', 'instagram', 'facebook', 'reddit', 'linkedin'] as const
export type Platform = (typeof PLATFORMS)[number]

export const PILLARS = ['founder_journey', 'parent_pain', 'useful_tips', 'product_education', 'ai_thinking', 'community_question', 'launch_invitation'] as const
export type Pillar = (typeof PILLARS)[number]
export const isPillar = (v: unknown): v is Pillar => typeof v === 'string' && (PILLARS as readonly string[]).includes(v)

export const PILLAR_LABEL: Record<Pillar, string> = {
  founder_journey: 'Founder journey',
  parent_pain: 'Parent pain',
  useful_tips: 'Useful tips',
  product_education: 'Product education',
  ai_thinking: 'Building AI for parents',
  community_question: 'Community question',
  launch_invitation: 'Launch / invitation',
}

export const POST_STATUSES = ['draft', 'approved', 'scheduled', 'publishing', 'published', 'failed', 'cancelled', 'dry_run'] as const
export type PostStatus = (typeof POST_STATUSES)[number]

export const POST_FORMATS = ['text', 'image', 'carousel', 'poll', 'video', 'thread'] as const
export type PostFormat = (typeof POST_FORMATS)[number]
export interface PollSpec { options: string[]; durationMinutes: number }

/** The eight daily slot roles (one of each per day by default). */
export const SLOT_ROLES = ['founder_story', 'parent_tip', 'conversation', 'visual', 'educational', 'product', 'poll', 'soft_conversion'] as const
export type SlotRole = (typeof SLOT_ROLES)[number]
export const SLOT_ROLE_LABEL: Record<SlotRole, string> = {
  founder_story: 'Founder story', parent_tip: 'Parent tip', conversation: 'Conversation', visual: 'Visual', educational: 'Educational',
  product: 'Product feature', poll: 'Poll / opinion', soft_conversion: 'Soft conversion',
}

/** Library categories (content bank). */
export const CONTENT_CATEGORIES = ['founder_stories', 'parent_pain', 'planning_tips', 'venue_content', 'ai_content', 'product_features', 'polls', 'questions', 'carousels', 'videos', 'visuals', 'ctas'] as const
export type ContentCategory = (typeof CONTENT_CATEGORIES)[number]

export type ImageStatus = 'none' | 'generated' | 'failed' | 'skipped' | 'upload_failed'

/** One post as stored (camelCase view of public.marketing_posts). */
export interface MarketingPost {
  id: string
  platform: Platform
  contentType: 'text' | 'text_image'
  pillar: Pillar
  topicKey: string | null
  topic: string
  hook: string | null
  cta: string | null
  text: string
  linkUrl: string | null
  imagePath: string | null
  imagePrompt: string | null
  imageAlt: string | null
  imageProvider: string | null
  imageStatus: ImageStatus
  status: PostStatus
  origin: 'agent' | 'manual'
  autonomous: boolean
  scheduledAt: string | null
  publishedAt: string | null
  externalPostId: string | null
  externalPostUrl: string | null
  externalMediaId: string | null
  metrics: PlatformMetrics
  metricsUpdatedAt: string | null
  attribution: Attribution
  attributionUpdatedAt: string | null
  similarityScore: number | null
  similarPostId: string | null
  validation: ValidationReport | Record<string, never>
  generation: Record<string, unknown>
  approvedAt: string | null
  publishingStartedAt: string | null
  publishAttempts: number
  publishErrorCode: string | null
  publishError: string | null
  format: PostFormat
  slotRole: string | null
  category: string | null
  planId: string | null
  slotIndex: number | null
  mediaIds: string[]
  poll: PollSpec | null
  threadParts: string[] | null
  externalThreadIds: string[]
  businessScore: number | null
  estCostUsd: number | null
  source: 'ai' | 'library' | 'imported' | 'manual'
  dryRunAt: string | null
  dryRunPayload: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

/** null = the platform/API access did not return this metric (never a guessed 0). */
export interface PlatformMetrics {
  impressions: number | null
  likes: number | null
  reposts: number | null
  replies: number | null
  quotes: number | null
  bookmarks: number | null
  profileVisits: number | null
  linkClicks: number | null
}

export interface Attribution {
  landingVisits: number
  signups: number
  partiesCreated: number
  checkouts: number
  purchases: number
  revenueMinor: number
  currency: string | null
}

export interface ValidationIssue { code: string; message: string }
export interface ValidationReport { ok: boolean; errors: ValidationIssue[]; warnings: ValidationIssue[]; weightedLength: number; maxLength: number }
