#!/usr/bin/env node
/**
 * Scan EVERY blob in git history for credentials. Never prints secret values:
 * only type, sha256 fingerprint (8 chars), files, first/last commit, and whether
 * the value is still present at HEAD.
 *   node scripts/scan-git-history-secrets.mjs [--json out.json]
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'

// Never put secret values in argv (process lists, error messages). Errors report the
// git subcommand only.
const git = (...a) => {
  const r = spawnSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 30 })
  if (r.status !== 0 && r.status !== 1) throw new Error(`git ${a[0]} failed with status ${r.status}`)
  return r.stdout ?? ''
}
const fp = (v) => createHash('sha256').update(v).digest('hex').slice(0, 8)

const PUBLIC_LOCAL_DEMO = new Set([
  'whsec_ZTJlLW9ubHktbm90LWEtcmVhbC1zZWNyZXQ', // .env.e2e fake Dodo webhook secret (test-only, full form)
  'ZTJlLW9ubHktbm90LWEtcmVhbC1zZWNyZXQ=', // .env.e2e fake Dodo webhook secret (test-only)
  'test_e2e_fake_key', // .env.e2e fake Dodo API key for the local mock (test-only)
  // supabase start's well-known demo keys (public, local only)
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  // synthetic fixtures in tests/unit/observability.test.ts (scrubber tests; not real credentials)
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c', // the public jwt.io sample
  'AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  'AIzaSyTESTKEYTESTKEYTESTKEYTESTKEY12345',
  'whsec_abcdefghijklmnopqrstuv',
])

function jwtRole(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).role ?? 'unknown'
  } catch {
    return 'unparseable'
  }
}

const RULES = [
  { type: 'Supabase access token (sbp_) — labelled SUPABASE_SERVICE_ROLE_KEY', re: /sbp_[A-Za-z0-9]{30,}/g },
  { type: 'Supabase secret key (sb_secret_)', re: /sb_secret_[A-Za-z0-9_-]{20,}/g },
  { type: 'Supabase JWT', re: /eyJhbGciOi[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, classify: (v) => `Supabase JWT (role=${jwtRole(v)})` },
  { type: 'Google API key', re: /AIza[0-9A-Za-z_-]{35}/g },
  { type: 'Resend API key', re: /\bre_[A-Za-z0-9]{8}_[A-Za-z0-9]{16,}/g },
  { type: 'Apify API token', re: /apify_api_[A-Za-z0-9]{30,}/g },
  { type: 'OpenAI API key', re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}/g },
  { type: 'Stripe secret', re: /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}|\bwhsec_[A-Za-z0-9]{20,}/g },
  { type: 'Postgres URL with password', re: /postgres(?:ql)?:\/\/[^\s:'"`]+:([^@\s'"`]{6,})@[^\s'"`]+/g, ignore: (v) => /:postgres@(127\.0\.0\.1|localhost)|REDACTED|password@|\[YOUR|PASSWORD\]|\$\{|<password>/i.test(v) },
  { type: 'Azure OpenAI API key', re: /AZURE_OPENAI_API_KEY[ \t]*[=:][ \t]*["']?([A-Za-z0-9]{32,90})/g, group: 1 },
  { type: 'Dodo Payments key/secret', re: /DODO_[A-Z_]*(?:KEY|SECRET)[ \t]*[=:][ \t]*["']?([A-Za-z0-9._-]{16,})/g, group: 1, ignore: (v) => /process\.env|ENABLE_|NEXT_PUBLIC/.test(v) },
]

// 1. every (blob, path) pair in history
const pairs = new Map()
for (const line of git('rev-list', '--all', '--objects').split('\n')) {
  const i = line.indexOf(' ')
  if (i < 0) continue
  const sha = line.slice(0, i)
  const path = line.slice(i + 1)
  if (!pairs.has(sha)) pairs.set(sha, new Set())
  pairs.get(sha).add(path)
}

// 2. read blobs through one cat-file --batch process
const shas = [...pairs.keys()]
const findings = new Map() // fingerprint → {type, blobs:Set, paths:Set}
await new Promise((resolve, reject) => {
  const p = spawn('git', ['cat-file', '--batch'])
  let buf = Buffer.alloc(0)
  let idx = 0
  const next = () => {
    if (idx < shas.length) p.stdin.write(shas[idx] + '\n')
    else p.stdin.end()
  }
  p.stdout.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk])
    for (;;) {
      const nl = buf.indexOf(10)
      if (nl < 0) return
      const header = buf.slice(0, nl).toString()
      const [sha, type, sizeStr] = header.split(' ')
      if (type === 'missing') {
        buf = buf.slice(nl + 1)
        idx++
        next()
        continue
      }
      const size = Number(sizeStr)
      if (buf.length < nl + 1 + size + 1) return
      const body = buf.slice(nl + 1, nl + 1 + size)
      buf = buf.slice(nl + 1 + size + 1)
      if (type === 'blob' && size < 8_000_000) {
        const text = body.toString('utf8')
        for (const r of RULES) {
          for (const m of text.matchAll(r.re)) {
            const value = r.group ? m[r.group] : m[0]
            if (!value || PUBLIC_LOCAL_DEMO.has(value) || /REDACTED|ROTATE_ME|your[-_]?|xxxx|example/i.test(m[0]) || r.ignore?.(m[0])) continue
            const kind = r.classify ? r.classify(value) : r.type
            if (/role=anon\)/.test(kind)) continue // anon JWTs are public by design
            const key = `${kind}|${fp(value)}`
            if (!findings.has(key)) findings.set(key, { type: kind, fingerprint: fp(value), value, blobs: new Set(), paths: new Set() })
            const f = findings.get(key)
            f.blobs.add(sha)
            for (const path of pairs.get(sha) ?? []) f.paths.add(path)
          }
        }
      }
      idx++
      next()
    }
  })
  p.on('error', reject)
  p.on('close', resolve)
  next()
})

// 3. commit range + presence at HEAD, derived from blob ids (secret values never leave memory)
const headBlobs = new Set(git('ls-tree', '-r', 'HEAD').split('\n').map((l) => l.split(/\s+/)[2]).filter(Boolean))
const out = []
for (const f of findings.values()) {
  const commits = new Map()
  for (const blob of f.blobs) {
    for (const line of git('log', '--all', '--format=%h %as %ct', `--find-object=${blob}`).trim().split('\n').filter(Boolean)) {
      const [h, d, t] = line.split(' ')
      commits.set(h, { h, d, t: Number(t) })
    }
  }
  const ordered = [...commits.values()].sort((a, b) => a.t - b.t)
  out.push({
    type: f.type,
    fingerprint: f.fingerprint,
    files: [...f.paths].filter((x) => !x.startsWith('.ideavo/')).sort(),
    ideavoFiles: [...f.paths].filter((x) => x.startsWith('.ideavo/')).length,
    blobs: f.blobs.size,
    firstCommit: ordered[0] ? `${ordered[0].h} (${ordered[0].d})` : '?',
    lastCommit: ordered.at(-1) ? `${ordered.at(-1).h} (${ordered.at(-1).d})` : '?',
    commitsTouching: ordered.length,
    presentAtHEAD: [...f.blobs].some((b) => headBlobs.has(b)),
  })
  delete f.value
}
out.sort((a, b) => a.type.localeCompare(b.type))
if (process.argv[2] === '--json') writeFileSync(process.argv[3], JSON.stringify(out, null, 2))
for (const o of out) {
  console.log(`${o.presentAtHEAD ? 'HEAD!' : 'hist '} | ${o.type} | fp=${o.fingerprint} | first=${o.firstCommit} last=${o.lastCommit} (${o.commitsTouching} commits) | ${o.files.slice(0, 6).join(', ')}${o.files.length > 6 ? ` +${o.files.length - 6}` : ''}${o.ideavoFiles ? ` | +${o.ideavoFiles} .ideavo files` : ''}`)
}
console.log(`\n${out.length} distinct secret values found; ${out.filter((o) => o.presentAtHEAD).length} still present at HEAD (branch ${git('branch', '--show-current').trim()}).`)
