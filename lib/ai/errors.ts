/** Friendly, stable AI error responses. Same JSON shape as lib/server/http.ts so the client's friendlyError works. */
import 'server-only'
import { NextResponse } from 'next/server'
import type { AIErrorCode } from './types'

const MESSAGES: Record<AIErrorCode, [number, string]> = {
  unauthenticated: [401, 'Please sign in to use the planning assistant.'],
  invalid_input: [400, 'Something in that request didn’t look right. Please check it and try again.'],
  not_found: [404, 'We couldn’t find that party.'],
  ai_disabled: [503, 'The planning assistant isn’t available right now.'],
  forbidden_plan: [403, 'This assistant feature is included in a higher plan.'],
  limit_reached: [429, 'You’ve used all the AI suggestions for this party on your plan.'],
  high_demand: [503, 'The planning assistant is very busy right now. Please try again in a few minutes.'],
  timeout: [504, 'That took too long. Your party data is safe — please try again.'],
  provider_error: [502, 'We couldn’t generate your ideas right now. Your party data is safe. Try again.'],
  invalid_response: [502, 'We couldn’t generate your ideas right now. Your party data is safe. Try again.'],
}

export function aiError(code: AIErrorCode, extra: Record<string, unknown> = {}, message?: string) {
  const [status, msg] = MESSAGES[code]
  return NextResponse.json({ error: { code, message: message ?? msg, ...extra } }, { status, headers: { 'Cache-Control': 'no-store' } })
}
