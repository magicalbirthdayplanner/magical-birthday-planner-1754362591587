/**
 * Deterministic mock provider. Used when AI_PROVIDER=mock (never implicitly) and by every automated test.
 * Output comes from lib/ai/fixtures.ts per feature; tests can script responses (malformed, timeout, 5xx, 429).
 */
import 'server-only'
import { FIXTURES } from '../fixtures'
import { ProviderError, type AIProvider, type CompletionRequest, type CompletionResult } from '../provider'

export type MockStep = string | ProviderError | ((req: CompletionRequest) => Promise<string> | string)
let script: MockStep[] = []
const calls: CompletionRequest[] = []

/** Tests: queue responses (consumed in order); falls back to the feature fixture when the queue is empty. */
export function scriptMock(...steps: MockStep[]) {
  script = [...steps]
}
export function mockCalls() {
  return calls
}
export function resetMock() {
  script = []
  calls.length = 0
}

export class MockProvider implements AIProvider {
  readonly name = 'mock'
  readonly model = 'mock-1'
  async complete(req: CompletionRequest): Promise<CompletionResult> {
    calls.push(req)
    if (req.signal.aborted) throw new ProviderError('aborted', 'aborted')
    const step = script.shift()
    let text: string
    if (step instanceof ProviderError) throw step
    else if (typeof step === 'function') text = await step(req)
    else if (typeof step === 'string') text = step
    else text = JSON.stringify(FIXTURES[req.feature as keyof typeof FIXTURES] ?? {})
    return { text, model: this.model, inputTokens: 100, outputTokens: Math.ceil(text.length / 4) }
  }
}
