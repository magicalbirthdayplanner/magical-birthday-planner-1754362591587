import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { generateInvitationEmail } from '@/lib/email-templates/invitation'

const ROOT = path.resolve(__dirname, '../..')

/** Every internal page an email links to must exist as an app route (no 404s in guests' inboxes). */
function pageRoutes(dir = path.join(ROOT, 'app'), prefix = ''): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) out.push(...pageRoutes(p, prefix + (/^\(.*\)$/.test(name) ? '' : `/${name}`)))
    else if (/^page\.tsx?$/.test(name)) out.push(prefix || '/')
  }
  return out
}

describe('invitation email links', () => {
  const { html } = generateInvitationEmail({
    guestName: 'Patel family', hostName: 'Sam', childName: 'Mia', childAge: 7, partyTheme: 'space', partyDate: 'Saturday, November 7',
    partyTime: '2:00 PM', partyLocation: 'Clay Cafe, Troy', rsvpUrl: 'https://magicalbirthdayplanner.app/invite/abc', baseUrl: 'https://magicalbirthdayplanner.app',
  })
  it('links only to pages that exist (help center included)', () => {
    const internal = [...html.matchAll(/href="https:\/\/magicalbirthdayplanner\.app(\/[^"#?]*)"/g)].map((m) => m[1])
    expect(internal).toContain('/help')
    const routes = pageRoutes()
    for (const p of internal) {
      const ok = routes.includes(p) || routes.some((r) => r.includes('[') && new RegExp(`^${r.replace(/\[[^\]]+\]/g, '[^/]+')}$`).test(p))
      expect([p, ok]).toEqual([p, true])
    }
  })
})

describe('social preview', () => {
  it('ships a 1200×630 PNG Open Graph image in /public', () => {
    const file = path.join(ROOT, 'public/og-image.png')
    expect(existsSync(file)).toBe(true)
    const png = readFileSync(file)
    expect(png.subarray(1, 4).toString()).toBe('PNG')
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630])
  })
})
