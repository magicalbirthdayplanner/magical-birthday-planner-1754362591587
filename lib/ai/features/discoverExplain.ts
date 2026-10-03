/**
 * Stretch: Discover "why it fits" (Plus+, own flag). Ranks only venues the app already fetched (read from the
 * venues catalogue by place_id — no new Places API calls). The server keeps only supplied ids and strips prices.
 */
import 'server-only'
import { z } from 'zod'
import { BaseBody, type FeatureSpec } from '../handler'
import { contextForPrompt } from '../context'
import { SYSTEM_PROMPT } from '../prompts/system'
import { list, str } from '../schemas/shared'

export const DiscoverBody = BaseBody.extend({ placeIds: z.array(z.string().regex(/^[A-Za-z0-9_-]{6,300}$/)).min(1).max(10) }).strict()
const Schema = z.object({ picks: list(z.object({ placeId: str(300), reason: str(160) }), 10, 1) })
type Out = z.infer<typeof Schema>
export type { DiscoverExplainResult } from "./discoverExplain.types"
import type { DiscoverExplainResult } from "./discoverExplain.types"
interface Cand { placeId: string; name: string; type: string | null; rating: number | null; reviews: number | null; price: number | null; goodForChildren: boolean | null; tags: string[] }

export const discoverExplainSpec: FeatureSpec<typeof DiscoverBody, DiscoverExplainResult> = {
  feature: 'discover_explain',
  body: DiscoverBody,
  result: Schema as unknown as z.ZodType<DiscoverExplainResult>,
  maxTokens: 900,
  load: async (db, _partyId, _ctx, body) => {
    const { data } = await db.from('venues').select('place_id, name, primary_type_label, rating, reviews_count, price_level, good_for_children, tags').in('place_id', body.placeIds).limit(10)
    return (data ?? []).map((v): Cand => ({ placeId: v.place_id, name: v.name, type: v.primary_type_label, rating: v.rating, reviews: v.reviews_count, price: v.price_level, goodForChildren: v.good_for_children, tags: (v.tags ?? []).slice(0, 6) }))
  },
  prompt: ({ ctx, extra }) => ({
    system: SYSTEM_PROMPT,
    user: `Rank these candidate venues for this party (best first) and give one short line each on why it fits the child's age, interests and budget. Use ONLY the candidates and fields given; do not invent prices, facts, names or other places.
Return JSON exactly: {"picks":[{"placeId":"","reason":""}]}
Party facts: ${contextForPrompt(ctx)}
Candidates: ${JSON.stringify(extra)}`,
  }),
  post: ({ result, extra }) => {
    const cands = new Map((extra as Cand[]).map((c) => [c.placeId, c]))
    const seen = new Set<string>()
    const picks = (result as unknown as Out).picks
      .filter((p) => cands.has(p.placeId) && !seen.has(p.placeId) && seen.add(p.placeId))
      .map((p, i) => ({ id: `pick-${i + 1}`, placeId: p.placeId, name: cands.get(p.placeId)!.name, reason: p.reason.replace(/\$\s?\d[\d,.]*/g, '').replace(/\s{2,}/g, ' ').trim() }))
    return { picks }
  },
  summary: (body) => ({ candidates: body.placeIds.length }),
}
