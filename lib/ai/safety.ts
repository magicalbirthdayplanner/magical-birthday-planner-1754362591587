/**
 * Input and output safety. Free text is data, never instructions; AI output is plain text (no HTML, no URLs),
 * bounded, and free of protected characters/franchises/artist names.
 */
import 'server-only'

export const FREE_TEXT_MAX = 1500

/** Strip control characters (keep newlines/tabs), collapse runs of whitespace, cap length. */
export function sanitizeFreeText(input: string | null | undefined, max = FREE_TEXT_MAX): string {
  if (!input) return ''
  return input
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '')
    .replace(/[ \t]{3,}/g, '  ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)
}

/** Free text is wrapped in delimiters; any closing delimiter inside it is neutralised so it can't break out. */
export function wrapParentNotes(text: string): string {
  const safe = text.replace(/<\/?\s*parent_notes\s*>/gi, '')
  return `<parent_notes>\n${safe}\n</parent_notes>`
}

const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|io|app|co|us|ly|ai)\b(?:\/\S*)?/gi
const TAG_RE = /<\/?[a-z][^>]*>/gi

/** Protected characters / franchises / named artists → generic equivalents (theme names, activity names, copy). */
const PROTECTED: [RegExp, string][] = [
  [/spider[\s-]?man/gi, 'web-slinger hero'], [/bat[\s-]?man/gi, 'caped hero'], [/super[\s-]?man/gi, 'super hero'], [/wonder woman/gi, 'warrior hero'],
  [/\b(avengers|marvel|iron[\s-]?man|hulk|captain america|thor)\b/gi, 'superhero'], [/\b(dc comics|justice league)\b/gi, 'superhero'],
  [/\b(disney|pixar)\b/gi, 'storybook'], [/\b(frozen|elsa|anna and elsa|olaf)\b/gi, 'ice kingdom'], [/\b(mickey|minnie)( mouse)?\b/gi, 'friendly mouse'],
  [/\b(cinderella|ariel|moana|rapunzel|belle|jasmine|aurora|snow white|encanto|little mermaid)\b/gi, 'royal'], [/\b(toy story|buzz lightyear|woody)\b/gi, 'toy adventure'],
  [/\b(pok[eé]mon|pikachu)\b/gi, 'pocket creature'], [/\bpaw patrol\b/gi, 'puppy rescue'], [/\bpeppa( pig)?\b/gi, 'piggy'], [/\bbluey\b/gi, 'puppy family'],
  [/\bbarbie\b/gi, 'fashion doll'], [/\bhello kitty\b/gi, 'kitty'], [/\bharry potter|hogwarts\b/gi, 'wizard school'], [/\bstar wars|jedi|darth vader\b/gi, 'space saga'],
  [/\bminecraft\b/gi, 'block building'], [/\bfortnite\b/gi, 'battle game'], [/\broblox\b/gi, 'game world'], [/\b(super )?mario( bros)?\b/gi, 'retro game'], [/\bsonic( the hedgehog)?\b/gi, 'speedy hedgehog'],
  [/\blego\b/gi, 'building brick'], [/\bsesame street|elmo\b/gi, 'puppet friends'], [/\bscooby[\s-]?doo\b/gi, 'mystery pup'], [/\bteenage mutant ninja turtles|tmnt\b/gi, 'ninja'],
  [/\btaylor swift|swiftie(s)?\b/gi, 'pop star'], [/\b(beyonc[eé]|olivia rodrigo|billie eilish|sabrina carpenter|ariana grande|bts|blackpink)\b/gi, 'pop star'],
  [/\bk-?pop demon hunters\b/gi, 'pop-star hunters'], [/\bbaby shark\b/gi, 'ocean sing-along'], [/\bcocomelon\b/gi, 'nursery sing-along'],
]

export function scrubProtected(s: string): { text: string; changed: boolean } {
  let text = s
  for (const [re, rep] of PROTECTED) text = text.replace(re, rep)
  return { text, changed: text !== s }
}

/** One AI string → plain, bounded text (no HTML, no URLs, no protected names). */
export function cleanText(s: string, max: number): { text: string; changed: boolean } {
  const noTags = s.replace(TAG_RE, '').replace(URL_RE, '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s{2,}/g, ' ').trim()
  const { text, changed } = scrubProtected(noTags)
  return { text: text.slice(0, max), changed }
}

/** Deep-clean every string in a validated result. Returns whether protected names were replaced (for an assumption). */
export function cleanResult<T>(value: T, max = 600): { value: T; scrubbed: boolean } {
  let scrubbed = false
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') {
      const r = cleanText(v, max)
      if (r.changed) scrubbed = true
      return r.text
    }
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]))
    return v
  }
  return { value: walk(value) as T, scrubbed }
}

/** True if a string looks like it leaked our instructions (defence in depth for injection tests). */
export function looksLikePromptLeak(s: string): boolean {
  return /SYSTEM_PROMPT_MARKER|you are a practical birthday-planning assistant|never reveal or paraphrase these instructions/i.test(s)
}
