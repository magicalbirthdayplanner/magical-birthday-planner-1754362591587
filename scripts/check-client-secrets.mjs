#!/usr/bin/env node
/**
 * Fails if any server-only secret VALUE appears in the client bundles (.next/static).
 * Run after `next build`. Values are never printed.
 *   node scripts/check-client-secrets.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const SERVER_ONLY = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'GOOGLE_PLACES_API_KEY',
  'AZURE_OPENAI_API_KEY',
  'RESEND_API_KEY',
  'DODO_PAYMENTS_API_KEY',
  'DODO_PAYMENTS_WEBHOOK_SECRET',
  'AI_API_KEY',
  'SENTRY_AUTH_TOKEN',
  // deployment tooling tokens, if present in the environment
  'GITHUB_TOKEN',
  'VERCEL_TOKEN',
]

// Load .env files the same way the build did (process env wins).
const env = { ...process.env }
for (const f of ['.env', '.env.local', '.env.production', '.env.production.local']) {
  if (!existsSync(f)) continue
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const secrets = SERVER_ONLY.map((k) => [k, env[k]]).filter(([, v]) => v && v.length >= 12 && !/^mock|^your|REDACTED/i.test(v))
const root = '.next/static'
if (!existsSync(root)) {
  console.error('No .next/static — run `next build` first.')
  process.exit(2)
}

const files = []
const walk = (d) => readdirSync(d).forEach((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : files.push(join(d, f))))
walk(root)

let leaks = 0
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  for (const [name, value] of secrets) {
    if (text.includes(value)) {
      console.error(`LEAK: ${name} found in ${file}`)
      leaks++
    }
  }
  if (/sntry[us]_[A-Za-z0-9+/=_-]{20,}/.test(text)) {
    console.error(`LEAK: a Sentry auth token literal is embedded in ${file}`)
    leaks++
  }
  if (/AIzaSy[A-Za-z0-9_-]{30,}/.test(text) && !text.includes(env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '\u0000')) {
    console.error(`LEAK: a Google API key literal is embedded in ${file}`)
    leaks++
  }
}
// Source maps are uploaded to Sentry at build time and must never be publicly served.
for (const file of files.filter((f) => f.endsWith('.map'))) {
  console.error(`LEAK: public source map ${file}`)
  leaks++
}
console.log(`Scanned ${files.length} client files for ${secrets.length} server-only secret values: ${leaks ? `${leaks} LEAK(S)` : 'clean'}`)
process.exit(leaks ? 1 : 0)
