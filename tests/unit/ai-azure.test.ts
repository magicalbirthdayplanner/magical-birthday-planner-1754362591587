import { afterEach, describe, expect, it, vi } from 'vitest'
import { readAIConfig } from '@/lib/ai/config'
import { getProvider } from '@/lib/ai/provider'
import { AzureOpenAIProvider, azureBody, azureChatUrl, isReasoningDeployment } from '@/lib/ai/providers/azure'

const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv
const base = { AI_PROVIDER: 'azure', AI_API_KEY: 'az-key', AI_BASE_URL: 'https://mbp.openai.azure.com/', AI_MODEL: 'gpt-5-mini' }
const req = (signal = new AbortController().signal) => ({ feature: 't', messages: [{ role: 'user' as const, content: 'hi' }], maxTokens: 500, json: true, signal, sessionId: 's' })
const ok = (content = '{"a":1}') => new Response(JSON.stringify({ model: 'gpt-5-mini-2025-08-07', choices: [{ message: { content }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 4 } }), { status: 200 })

afterEach(() => vi.unstubAllGlobals())

describe('Azure OpenAI / AI Foundry provider', () => {
  it('config: azure needs key + endpoint + deployment; v1 API by default', async () => {
    const c = readAIConfig(env(base))
    expect(c).toMatchObject({ provider: 'azure', baseUrl: 'https://mbp.openai.azure.com', model: 'gpt-5-mini', apiVersion: 'v1', reasoningEffort: null, configured: true })
    expect(readAIConfig(env({ ...base, AI_BASE_URL: '' })).configured).toBe(false)
    expect(readAIConfig(env({ ...base, AI_MODEL: '' })).configured).toBe(false)
    expect(readAIConfig(env({ ...base, AI_REASONING_EFFORT: 'Minimal' })).reasoningEffort).toBe('minimal')
    expect(readAIConfig(env({ ...base, AI_REASONING_EFFORT: 'turbo' })).reasoningEffort).toBeNull()
    expect((await getProvider(c)).name).toBe('azure')
  })

  it('builds v1 and deployments URLs from any endpoint form', () => {
    expect(azureChatUrl('https://mbp.openai.azure.com/', 'gpt-5-mini', 'v1')).toBe('https://mbp.openai.azure.com/openai/v1/chat/completions')
    expect(azureChatUrl('https://mbp.services.ai.azure.com/openai/v1', 'x', 'v1')).toBe('https://mbp.services.ai.azure.com/openai/v1/chat/completions')
    expect(azureChatUrl('https://mbp.cognitiveservices.azure.com', 'gpt-4.1-mini', '2025-01-01-preview')).toBe(
      'https://mbp.cognitiveservices.azure.com/openai/deployments/gpt-4.1-mini/chat/completions?api-version=2025-01-01-preview',
    )
  })

  it('reasoning deployments get max_completion_tokens + a reasoning effort, others a temperature', () => {
    expect(isReasoningDeployment('gpt-5-mini')).toBe(true)
    expect(isReasoningDeployment('o4-mini')).toBe(true)
    expect(isReasoningDeployment('gpt-4.1-mini')).toBe(false)
    const r = azureBody({ model: 'gpt-5-mini', thinking: false, reasoningEffort: null }, req())
    expect(r).toMatchObject({ model: 'gpt-5-mini', max_completion_tokens: 500, reasoning_effort: 'low', response_format: { type: 'json_object' } })
    expect(r).not.toHaveProperty('temperature')
    const g = azureBody({ model: 'gpt-4.1-mini', thinking: false, reasoningEffort: null }, req())
    expect(g).toMatchObject({ temperature: 0.7, max_completion_tokens: 500 })
    expect(g).not.toHaveProperty('reasoning_effort')
  })

  it('sends the key only in the api-key header and parses the answer', async () => {
    const fetchMock = vi.fn(async () => ok())
    vi.stubGlobal('fetch', fetchMock)
    const out = await new AzureOpenAIProvider(readAIConfig(env(base))).complete(req())
    expect(out).toMatchObject({ text: '{"a":1}', inputTokens: 10, outputTokens: 4 })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://mbp.openai.azure.com/openai/v1/chat/completions')
    expect((init.headers as Record<string, string>)['api-key']).toBe('az-key')
    expect(init.headers).not.toHaveProperty('Authorization')
  })

  it('drops a parameter the deployment rejects and retries once', async () => {
    const reject = new Response(JSON.stringify({ error: { code: 'unsupported_parameter', param: 'max_completion_tokens', message: "Unsupported parameter: 'max_completion_tokens'" } }), { status: 400 })
    const fetchMock = vi.fn().mockResolvedValueOnce(reject).mockResolvedValueOnce(ok())
    vi.stubGlobal('fetch', fetchMock)
    await new AzureOpenAIProvider(readAIConfig(env({ ...base, AI_MODEL: 'gpt-4o-mini' }))).complete(req())
    const second = JSON.parse((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body as string)
    expect(second).toMatchObject({ max_tokens: 500 })
    expect(second).not.toHaveProperty('max_completion_tokens')
  })

  it('maps errors: 401 → auth, 429 → rate_limited, a second 400 → bad_request', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
    await expect(new AzureOpenAIProvider(readAIConfig(env(base))).complete(req())).rejects.toMatchObject({ kind: 'auth' })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429 })))
    await expect(new AzureOpenAIProvider(readAIConfig(env(base))).complete(req())).rejects.toMatchObject({ kind: 'rate_limited' })
    const bad = () => new Response(JSON.stringify({ error: { code: 'unsupported_value', param: 'reasoning_effort' } }), { status: 400 })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(bad()).mockResolvedValueOnce(bad()))
    await expect(new AzureOpenAIProvider(readAIConfig(env(base))).complete(req())).rejects.toMatchObject({ kind: 'bad_request' })
  })
})
