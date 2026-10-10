/**
 * Founder Marketing Agent configuration. Read from the environment on every call (cheap; tests pass their own env).
 * SERVER ONLY. Safe defaults: dry-run ON, autonomous publishing OFF. Cadence target 8 posts/day (hard cap 8), always
 * inside the monthly X/AI budgets (lib/marketing/budget.ts). Credentials are reported only as "present / missing" —
 * their values never leave lib/marketing/providers.
 */
import 'server-only'

export type ImageProviderName = 'brand' | 'openai' | 'none'

export interface MarketingConfig {
  /** MARKETING_DRY_RUN: anything but the exact string "false" keeps dry-run on — nothing reaches a real account. */
  dryRun: boolean
  /** AUTONOMOUS_PUBLISHING: the environment's permission for the scheduler to publish. The admin switch must also be on. */
  autonomousAllowed: boolean
  /** Scheduler drafts one post a day for review while autonomous publishing is off (MARKETING_AUTO_DRAFT, default on). */
  autoDraft: boolean
  /** Posts per day per platform: 1–8 (default 8). Never more, whatever the env says; the budget may allow fewer. */
  postsPerDay: number
  timezone: string
  /** Local "HH:MM" slots; the first `postsPerDay` are used. */
  postTimes: string[]
  /** Minimum minutes between two posts on the same platform. */
  minGapMinutes: number
  /** A scheduled post may go out up to this many minutes before its slot (Vercel Hobby cron runs once in the hour). */
  publishEarlyMinutes: number
  /** Target share of posts that carry the product link. */
  urlShare: number
  /** X weighted-character limit for this account (280 unless the account has long posts). */
  xMaxChars: number
  /** Most posts aim for this many characters. */
  targetMinChars: number
  targetMaxChars: number
  imageProvider: ImageProviderName
  imageModel: string
  /** Learning loop cadence. */
  learningIntervalDays: number
  learningWindowDays: number
  /** Daily brief recipient (optional). */
  briefEmail: string | null
  launchDate: string
  /** Optional model override for marketing copy (same provider and key as the app's AI). */
  aiModel: string | null
  xUsername: string | null
  /** UTM campaign for X links (default mbp_x_growth). */
  utmCampaign: string
  /** Monthly hard budgets in USD. X = API credits; AI = text + image + video generation. */
  xBudgetUsd: number
  aiBudgetUsd: number
  /** Kept back from the X budget as a safety margin (never spent). */
  xReserveUsd: number
  /** Estimated AI cost per 1M tokens (input + output) for the copy model. */
  aiUsdPer1MTokens: number
  /** Alt text costs an extra X call per image: 'auto' = only while the budget is GREEN, 'on', 'off'. */
  altText: 'auto' | 'on' | 'off'
  /** Hours-ago windows whose posts get one metrics read per day, e.g. [[24,48],[168,192]]. */
  metricsWindows: [number, number][]
  /** Business-score weights (configurable; see scoring.ts). */
  scoreWeights: Record<string, number>
}

export const MAX_POSTS_PER_DAY = 8
export const DEFAULT_POST_TIMES = ['08:00', '10:30', '12:30', '14:30', '16:30', '18:00', '19:30', '21:00']

const int = (v: string | undefined, d: number, min: number, max: number) => {
  const n = Number.parseInt(v ?? '', 10)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d
}
const num = (v: string | undefined, d: number, min: number, max: number) => {
  const n = Number.parseFloat(v ?? '')
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export function readMarketingConfig(env: Record<string, string | undefined> = process.env): MarketingConfig {
  const tz = env.MARKETING_TIMEZONE?.trim() || 'America/New_York'
  const times = (env.MARKETING_POST_TIMES ?? DEFAULT_POST_TIMES.join(','))
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s))
  const provider = env.MARKETING_IMAGE_PROVIDER?.trim().toLowerCase()
  const brief = env.MARKETING_BRIEF_EMAIL?.trim() ?? ''
  return {
    dryRun: env.MARKETING_DRY_RUN?.trim().toLowerCase() !== 'false',
    autonomousAllowed: env.AUTONOMOUS_PUBLISHING?.trim().toLowerCase() === 'true',
    autoDraft: env.MARKETING_AUTO_DRAFT?.trim().toLowerCase() !== 'false',
    postsPerDay: int(env.MARKETING_POSTS_PER_DAY, MAX_POSTS_PER_DAY, 1, MAX_POSTS_PER_DAY),
    timezone: isValidTimeZone(tz) ? tz : 'America/New_York',
    postTimes: (times.length ? times : DEFAULT_POST_TIMES).sort(),
    minGapMinutes: int(env.MARKETING_MIN_GAP_MINUTES, 60, 30, 1440),
    publishEarlyMinutes: int(env.MARKETING_PUBLISH_EARLY_MINUTES, 90, 0, 120),
    urlShare: num(env.MARKETING_URL_SHARE, 0.1, 0, 0.4),
    xMaxChars: int(env.MARKETING_X_MAX_CHARS, 280, 140, 25_000),
    targetMinChars: 100,
    targetMaxChars: 250,
    imageProvider: provider === 'openai' || provider === 'none' ? provider : 'brand',
    imageModel: env.MARKETING_IMAGE_MODEL?.trim() || 'gpt-image-1',
    learningIntervalDays: int(env.MARKETING_LEARNING_INTERVAL_DAYS, 1, 1, 30),
    learningWindowDays: int(env.MARKETING_LEARNING_WINDOW_DAYS, 30, 7, 180),
    briefEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(brief) ? brief : null,
    launchDate: /^\d{4}-\d{2}-\d{2}$/.test(env.MARKETING_LAUNCH_DATE ?? '') ? env.MARKETING_LAUNCH_DATE! : '2026-10-13',
    aiModel: env.MARKETING_AI_MODEL?.trim() || null,
    xUsername: env.MARKETING_X_USERNAME?.trim().replace(/^@/, '') || null,
    utmCampaign: /^[a-z0-9_]{1,40}$/.test(env.MARKETING_UTM_CAMPAIGN ?? '') ? env.MARKETING_UTM_CAMPAIGN! : 'mbp_x_growth',
    xBudgetUsd: num(env.MONTHLY_X_BUDGET_USD, 5, 0, 10_000),
    aiBudgetUsd: num(env.MONTHLY_AI_BUDGET_USD, 2, 0, 10_000),
    xReserveUsd: num(env.MARKETING_X_RESERVE_USD, 0.25, 0, 100),
    aiUsdPer1MTokens: num(env.MARKETING_AI_USD_PER_1M_TOKENS, 2, 0, 1000),
    altText: env.MARKETING_X_ALT_TEXT === 'on' || env.MARKETING_X_ALT_TEXT === 'off' ? env.MARKETING_X_ALT_TEXT : 'auto',
    metricsWindows: parseWindows(env.MARKETING_METRICS_WINDOWS) ?? [[24, 48], [168, 192]],
    scoreWeights: parseWeights(env.MARKETING_SCORE_WEIGHTS),
  }
}

function parseWindows(v: string | undefined): [number, number][] | null {
  if (!v) return null
  const out = v.split(',').map((w) => w.split('-').map(Number)).filter((w): w is [number, number] => w.length === 2 && w.every(Number.isFinite) && w[0] >= 0 && w[1] > w[0] && w[1] <= 24 * 30)
  return out.length ? out.slice(0, 4) : null
}

/** Funnel-value defaults: a sign-up is worth far more than an impression (see scoring.ts). */
export const DEFAULT_SCORE_WEIGHTS: Record<string, number> = { impressions: 0.001, engagements: 0.02, profileVisits: 0.2, linkClicks: 0.5, landingVisits: 0.5, signups: 10, partiesCreated: 20, purchases: 50 }

function parseWeights(v: string | undefined): Record<string, number> {
  if (!v) return { ...DEFAULT_SCORE_WEIGHTS }
  try {
    const o = JSON.parse(v) as Record<string, unknown>
    const out: Record<string, number> = {}
    for (const k of Object.keys(DEFAULT_SCORE_WEIGHTS)) out[k] = typeof o[k] === 'number' && Number.isFinite(o[k]) && (o[k] as number) >= 0 ? (o[k] as number) : 0
    return out
  } catch {
    return { ...DEFAULT_SCORE_WEIGHTS }
  }
}

/** The X user id is the numeric prefix of an OAuth 1.0a access token ("<id>-<random>") — no API call needed. */
export function xUserIdFromEnv(env: Record<string, string | undefined> = process.env): string | null {
  return env.X_ACCESS_TOKEN?.trim().match(/^(\d{1,25})-/)?.[1] ?? null
}

/** All four X OAuth 1.0a user-context credentials are present (values are never returned). */
export function hasXCredentials(env: Record<string, string | undefined> = process.env): boolean {
  return ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET'].every((k) => !!env[k]?.trim())
}

export function hasOpenAIImageKey(env: Record<string, string | undefined> = process.env): boolean {
  return !!env.OPENAI_API_KEY?.trim()
}

/** The scheduler may publish only when the env allows it AND the admin switch is on. Dry-run still applies on top. */
export function autonomousEffective(cfg: MarketingConfig, adminSwitch: boolean): boolean {
  return cfg.autonomousAllowed && adminSwitch
}

/** Manual "Publish now" ceiling per platform per local day, whatever the schedule says. */
export const MANUAL_DAILY_CEILING = 3
export const MANUAL_MIN_GAP_MINUTES = 15
