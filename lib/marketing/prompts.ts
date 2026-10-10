/**
 * Founder-voice prompts and the model's output schema. Facts come from facts.ts only; history and learning are passed
 * in as data. Parent/user free text never reaches these prompts.
 */
import { z } from 'zod'
import { factSheet, HOUSE_RULES } from './facts'
import { PILLAR_SPECS, type Topic } from './pillars'
import { PILLAR_LABEL, type Pillar } from './types'
import type { Objective } from './strategy'
import { daysBetween, weekday } from './time'

export const MarketingDraftSchema = z.object({
  paragraphs: z.array(z.string().min(1).max(400)).min(1).max(4),
  hook: z.string().min(1).max(200),
  topic: z.string().min(2).max(100),
  cta: z.string().max(120).nullable().optional().transform((v) => v || null),
  imageHeadline: z.string().max(60).optional().default(''),
  imagePrompt: z.string().max(700).optional().default(''),
  altText: z.string().max(400).optional().default(''),
  factsUsed: z.array(z.string().max(24)).max(8).optional().default([]),
  angle: z.string().max(300).optional().default(''),
})
export type MarketingDraft = z.infer<typeof MarketingDraftSchema>

export const BANNED_PHRASES = ['revolutionize', 'game-changing', 'transform the industry', 'unlock unprecedented', 'next-generation', 'seamlessly', 'redefine', 'cutting-edge', 'empower', 'elevate', 'unleash', 'supercharge']

export function voiceRules(): string[] {
  return [
    'You write posts for X as the founder of Magical Birthday Planner, a web app that helps parents plan their kids’ birthday parties (venues, guest list, invitations, RSVPs, checklist, themes, AI planning help).',
    'The founder is a parent and a builder. Voice: human, curious, honest, builder-minded, parent-aware, conversational, slightly witty, practical. Not corporate, not polished ad copy, not "AI marketing speak". Short sentences, plain words, first person ("I"). It should read like a real founder typing on their phone.',
    `Never use: ${BANNED_PHRASES.join(', ')}.`,
    'Accuracy beats engagement. Every factual statement about the founder or the product must come from the FACT SHEET. If you need a fact that is not there, write an opinion, a lesson, a question or general advice instead. Never invent anecdotes ("a parent told me…"), numbers about users, customers, sign-ups, revenue, ratings, reviews, press, awards, partnerships, or anything happening "this week" that is not in the fact sheet.',
    'Founder anecdotes: only the events in the fact sheet, retold without invented specifics — no made-up counts ("11 tabs"), objects, places, dates, quotes or conversations. Relatable, general phrasing ("a lot of tabs") is fine; so are opinions and lessons.',
    'House rules:',
    ...HOUSE_RULES.map((r) => `- ${r}`),
    'Never include a URL or a web address; the system adds the link when one is wanted. No @mentions. Hashtags: none (at most one). Emojis: none (at most one).',
    'Write the product name exactly as “Magical Birthday Planner”.',
  ]
}

export function systemPrompt(): string {
  return [
    ...voiceRules(),
    'Return ONLY a JSON object with these keys:',
    '{"paragraphs": string[1-4] (the post, one entry per paragraph/line, no URLs),',
    ' "hook": string (the first line, exactly as written),',
    ' "topic": string (a short label for the idea),',
    ' "cta": string | null (the call-to-action sentence if the post has one, else null),',
    ' "imageHeadline": string (2–7 words for the image, no numbers, no claims; "" when no image),',
    ' "imagePrompt": string (a scene for an illustrator: objects, setting, mood — no text, no UI, no logos, no characters, no faces; "" when no image),',
    ' "altText": string (plain description of that image for screen readers; "" when no image),',
    ' "factsUsed": string[] (ids from the fact sheet you relied on, e.g. ["F-launch"]),',
    ' "angle": string (one sentence: why this angle works for the objective)}',
  ].join('\n')
}

export interface PromptInput {
  objective: Objective
  pillar: Pillar
  topic: Topic
  includeLink: boolean
  includeImage: boolean
  /** Weighted characters available for the paragraphs (the link is added separately). */
  maxChars: number
  targetChars: number
  recent: { pillar: string; hook: string | null; cta: string | null; topic: string }[]
  learnings: string[]
  feedback?: string[]
  today: string
  launchDate: string
}

export function userPrompt(p: PromptInput): string {
  const spec = PILLAR_SPECS[p.pillar]
  const avoid = p.recent.slice(0, 14).map((r) => `- [${r.pillar}] topic: ${r.topic}${r.hook ? ` | hook: ${r.hook}` : ''}${r.cta ? ` | cta: ${r.cta}` : ''}`)
  return [
    `TODAY: ${weekday(p.today)}, ${p.today} (US Eastern).`,
    `PUBLIC LAUNCH: ${weekday(p.launchDate)}, ${p.launchDate}${launchRelative(p.today, p.launchDate)}. If you mention when it launches, use exactly this — never guess a weekday.`,
    `OBJECTIVE: ${p.objective.goal}`,
    `PILLAR: ${PILLAR_LABEL[p.pillar]} — ${spec.brief}`,
    `ANGLE TO EXPLORE: ${p.topic.angle} (write your own take; do not copy this wording)`,
    p.includeLink
      ? 'LINK: the system appends the product link on its own line after your text. End with one short, low-pressure line that leads into it. Do not write the URL.'
      : 'LINK: none. Do not ask people to visit, click or sign up.',
    p.includeImage ? 'IMAGE: yes — fill imageHeadline, imagePrompt and altText.' : 'IMAGE: none — return "" for imageHeadline, imagePrompt and altText.',
    `LENGTH: at most ${p.maxChars} characters in total across the paragraphs; aim for ${Math.min(100, p.targetChars)}–${p.targetChars}. Shorter is better.`,
    '',
    'RECENT POSTS — do not repeat their ideas, hooks, opening words or calls to action:',
    ...(avoid.length ? avoid : ['- (none yet)']),
    '',
    'WHAT THE DATA SAYS SO FAR (real metrics only):',
    ...(p.learnings.length ? p.learnings.map((l) => `- ${l}`) : ['- Not enough data yet. Follow the pillar brief.']),
    '',
    factSheet(),
    ...(p.feedback?.length ? ['', 'YOUR PREVIOUS DRAFT WAS REJECTED:', ...p.feedback.map((f) => `- ${f}`), 'Write a clearly different post that fixes every point.'] : []),
  ].join('\n')
}

function launchRelative(today: string, launch: string): string {
  const d = daysBetween(today, launch)
  return d > 1 ? ` (in ${d} days)` : d === 1 ? ' (tomorrow)' : d === 0 ? ' (today)' : ` (${-d} days ago — it is live now)`
}
