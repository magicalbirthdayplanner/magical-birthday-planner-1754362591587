/** Parent notice & consent shown before saving a child for Santa calls. Bump the version when the text changes:
 *  parents then confirm again (santa_consents.notice_version). Isomorphic. */
export const SANTA_NOTICE_VERSION = '2026-11-22.1'

export const SANTA_AFFIRMATIONS = [
  { id: 'parent_or_guardian', text: 'I’m this child’s parent or legal guardian.' },
  { id: 'ai_processing', text: 'I understand Santa is an AI character. During the call my child’s voice is sent to our AI voice partner (OpenAI) and the Santa video partner (Simli) to make Santa listen and talk back. Calls are not recorded by us and we don’t keep what was said.' },
  { id: 'supervise', text: 'I’ll stay nearby during the call and can end it at any time.' },
] as const

export type SantaAffirmation = (typeof SANTA_AFFIRMATIONS)[number]['id']
export const ALL_AFFIRMATIONS = SANTA_AFFIRMATIONS.map((a) => a.id)
