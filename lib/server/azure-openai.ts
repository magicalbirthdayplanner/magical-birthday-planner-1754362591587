/** Azure OpenAI client (shared config with the legacy theme route). SERVER ONLY. */
import 'server-only'
import OpenAI from 'openai'

let client: OpenAI | null | undefined

export function aiConfigured(): boolean {
  return !!(process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_DEPLOYMENT_NAME && process.env.AZURE_OPENAI_API_VERSION)
}

export function getAzureOpenAI(): OpenAI | null {
  if (client !== undefined) return client
  if (!aiConfigured()) return (client = null)
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT!.replace(/\/?$/, '/')
  client = new OpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY!,
    baseURL: `${endpoint}openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}`,
    defaultQuery: { 'api-version': process.env.AZURE_OPENAI_API_VERSION },
    defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY! },
    timeout: 20_000,
    maxRetries: 1,
  })
  return client
}
