import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthedRequest } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rate-limit'
import { aiConfigured, getAzureOpenAI } from '@/lib/server/azure-openai'
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin'
import { aiThemePrompt, parseAiThemes, type AiTheme } from '@/lib/planning/ai-themes'
import { sanitizeInterests, settingFromVenueType } from '@/lib/discovery/party-context'
import { trackServer } from '@/lib/analytics/server'
import type { Json } from '@/lib/db/database.types'

// Never cache upstream fetches (Supabase, Google, Dodo) in this handler.
export const fetchCache = "force-no-store";

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const CACHE_DAYS = 30

/**
 * POST /api/themes/ai { partyId } → { themes, cached }
 * Optional AI theme ideas. Authenticated, rate-limited, cached by party profile.
 */
export async function POST(req: Request) {
  const auth = await getAuthedRequest(req)
  if (!auth) return apiError(401, 'unauthorized', 'Please sign in.')
  if (!aiConfigured()) return apiError(503, 'not_configured', 'AI theme ideas aren’t available right now — browse our themes instead.')

  let partyId: string
  try {
    partyId = z.object({ partyId: z.string().uuid() }).parse(await req.json()).partyId
  } catch {
    return apiError(400, 'invalid_request', 'Invalid request.')
  }
  const { data: party } = await auth.supabase.from('parties').select('child_age, interests, venue_type, guest_count').eq('id', partyId).maybeSingle()
  if (!party) return apiError(404, 'not_found', 'Party not found.')

  const input = {
    age: party.child_age,
    interests: sanitizeInterests(party.interests).sort(),
    setting: settingFromVenueType(party.venue_type),
    guestCount: party.guest_count ? Math.round(party.guest_count / 10) * 10 : null,
  }
  const cacheKey = `themes:v1:${createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 32)}`

  if (hasServiceRole()) {
    const { data: hit } = await getSupabaseAdmin().from('ai_cache').select('payload, expires_at').eq('cache_key', cacheKey).maybeSingle()
    if (hit && new Date(hit.expires_at) > new Date()) {
      return NextResponse.json({ themes: hit.payload as unknown as AiTheme[], cached: true })
    }
  }

  if (!rateLimit(`ai-themes:${auth.user.id}`, 6, 3_600_000).ok) {
    return apiError(429, 'rate_limited', 'You’ve generated lots of ideas — try again in a little while.')
  }

  try {
    const t0 = Date.now()
    const completion = await getAzureOpenAI()!.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME!,
      messages: [{ role: 'user', content: aiThemePrompt(input) }],
      temperature: 0.8,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
    })
    const themes = parseAiThemes(completion.choices[0]?.message?.content ?? '')
    trackServer('ai_themes_generated', { count: themes.length, latencyMs: Date.now() - t0 }, { userId: auth.user.id, partyId })
    if (!themes.length) return apiError(503, 'server_error', 'We couldn’t come up with ideas this time. Please try again.')
    if (hasServiceRole()) {
      await getSupabaseAdmin()
        .from('ai_cache')
        .upsert({ cache_key: cacheKey, kind: 'themes', payload: themes as unknown as NonNullable<Json>, expires_at: new Date(Date.now() + CACHE_DAYS * 86_400_000).toISOString() })
    }
    return NextResponse.json({ themes, cached: false })
  } catch (err) {
    console.error('ai themes failed', (err as Error)?.message)
    return apiError(503, 'server_error', 'AI ideas are taking a break. Browse our themes instead.')
  }
}
