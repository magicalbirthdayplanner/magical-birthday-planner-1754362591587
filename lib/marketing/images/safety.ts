/**
 * Image brief safety: what the visual may and may not contain. Applied to the model's scene description before any
 * provider sees it, and appended as hard constraints to provider prompts.
 */
import { scrubProtected } from '@/lib/ai/safety'

export const IMAGE_STYLE =
  'Premium, warm, modern editorial illustration for a family audience. Palette: warm cream background (#FEF9F1), deep purple (#5932B3), coral (#F47352), golden yellow (#F6B128), soft lavender. ' +
  'Soft light, gentle depth, tasteful confetti or paper-craft details, generous empty space. Visually distinctive, calm, not cluttered. Landscape 16:9.'

export const IMAGE_CONSTRAINTS =
  'Absolutely no text, letters, numbers, logos, watermarks or signage. No user interfaces, app screens, phones showing screens, charts or statistics. ' +
  'No copyrighted characters, mascots, celebrities or brands. No identifiable real people; children only from behind or as stylised figures without detailed faces. Nothing frightening.'

const BANNED: [RegExp, string][] = [
  [/\b(screenshot|screen ?shot|user interface|\bui\b|app screen|dashboard|interface|mock-?up|website)\b/i, 'shows a user interface'],
  [/\b(testimonial|review|rating|stars? rating|5 stars|five stars|quote from)\b/i, 'shows social proof'],
  [/\b(chart|graph|statistic|percent|%|infographic|numbers?)\b/i, 'shows statistics'],
  [/\b(logo|brand mark|trademark)\b/i, 'shows a logo'],
  [/\b(text that says|caption|headline|words?|letters?|typography|sign that says|banner reading)\b/i, 'asks for text in the image'],
]

export function imagePromptIssues(prompt: string): string[] {
  const issues = BANNED.filter(([re]) => re.test(prompt)).map(([, m]) => m)
  if (scrubProtected(prompt).changed) issues.push('mentions a protected character or brand')
  return issues
}

/** Strip anything risky from the model's scene so a provider never receives it. */
export function sanitizeImagePrompt(prompt: string): string {
  let p = scrubProtected(prompt).text
  for (const [re] of BANNED) p = p.replace(new RegExp(re.source, 'gi'), '')
  return p.replace(/\s{2,}/g, ' ').trim().slice(0, 600)
}

export function fullImagePrompt(scene: string): string {
  return `${sanitizeImagePrompt(scene)}\n\nStyle: ${IMAGE_STYLE}\n\nConstraints: ${IMAGE_CONSTRAINTS}`
}
