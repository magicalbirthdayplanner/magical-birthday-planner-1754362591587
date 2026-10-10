#!/usr/bin/env node
/**
 * Upload the curated media library (data/marketing/media-library.json) to the private `marketing-media` bucket and
 * upsert marketing_media rows (by library_key). Idempotent. Values of keys are never printed.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/marketing-seed-media.mjs [--dry]
 *   MARKETING_MEDIA_SOURCE_DIR overrides where the files are (default ~/magical-birthday-planner-film/videos/post-launch-30-day)
 */
import { readFileSync, existsSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const dry = process.argv.includes('--dry')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const src = process.env.MARKETING_MEDIA_SOURCE_DIR || join(homedir(), 'magical-birthday-planner-film/videos/post-launch-30-day')
if (!dry && (!url || !key)) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(2)
}
const manifest = JSON.parse(readFileSync(new URL('../data/marketing/media-library.json', import.meta.url), 'utf8'))
const db = dry ? null : createClient(url, key, { auth: { persistSession: false } })
const mime = (f) => (f.endsWith('.mp4') ? 'video/mp4' : f.endsWith('.jpg') || f.endsWith('.jpeg') ? 'image/jpeg' : 'image/png')

let uploaded = 0
let rows = 0
for (const it of manifest.items) {
  const file = join(src, it.file)
  if (!existsSync(file)) {
    console.error(`missing: ${it.file}`)
    process.exitCode = 1
    continue
  }
  const bytes = statSync(file).size
  const ext = it.file.split('.').pop()
  // Rejected media is recorded (so nobody re-adds it) but never uploaded.
  const path = it.privacy === 'approved' ? `library/${it.key}.${ext}` : null
  if (dry) {
    console.log(`${it.privacy.padEnd(8)} ${it.kind.padEnd(5)} ${String(Math.round(bytes / 1024)).padStart(6)} KB  ${it.key}`)
    continue
  }
  if (path) {
    const { error } = await db.storage.from('marketing-media').upload(path, readFileSync(file), { contentType: mime(it.file), upsert: true })
    if (error) throw new Error(`upload ${it.key}: ${error.message}`)
    uploaded++
  }
  const row = {
    library_key: it.key, kind: it.kind, source: 'library', set_key: it.set ?? null, position: it.position ?? 1, title: it.title, description: it.description ?? null,
    category: it.category ?? null, tags: it.tags ?? [], storage_path: path, mime_type: mime(it.file), bytes, width: it.width ?? null, height: it.height ?? null,
    duration_s: it.durationS ?? null, alt_text: it.alt ?? it.title, privacy_status: it.privacy, privacy_notes: it.privacyNotes ?? null,
  }
  const { error } = await db.from('marketing_media').upsert(row, { onConflict: 'library_key' })
  if (error) throw new Error(`row ${it.key}: ${error.message}`)
  rows++
}
console.log(dry ? `${manifest.items.length} items checked` : `uploaded ${uploaded} files, upserted ${rows} rows`)
