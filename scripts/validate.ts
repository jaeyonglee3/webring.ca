import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { detectWidget } from '../src/utils/widget'
import { hasResolvableMemberCoordinates } from '../src/utils/member-coords'

interface MemberInput {
  slug: string
  name: string
  url: string
  city?: string
  active?: boolean
}

const ALLOWED_KEYS = new Set(['slug', 'name', 'url', 'city', 'active', 'lat', 'lng'])

function sanitize(text: string): string {
  return text.replace(/[[\](){}*_~`#>!|\\]/g, '\\$&')
}

function write(text: string): void {
  process.stdout.write(text + '\n')
}

// ── Load current members ──
const membersPath = resolve(import.meta.dirname!, '..', 'members.json')

let members: MemberInput[]
try {
  members = JSON.parse(readFileSync(membersPath, 'utf-8'))
} catch {
  write('## Webring Validation\n')
  write('members.json is not valid JSON')
  process.exit(1)
}

// ── Load base members ──
let baseMembers: MemberInput[] = []
try {
  const ref = process.env.PR_BASE_SHA
    || (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'main')
  const base = execFileSync('git', ['show', `${ref}:members.json`], {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  baseMembers = JSON.parse(base)
} catch {
  // No base — first time, all members are new
}

// ── Diff: new, removed, edited ──
const baseSlugs = new Set(baseMembers.map((m) => m.slug))
const currentSlugs = new Set(members.map((m) => m.slug))
const baseBySlug = new Map(baseMembers.map((m) => [m.slug, m]))

const newMembers = members.filter((m) => !baseSlugs.has(m.slug))
const removedMembers = baseMembers.filter((m) => !currentSlugs.has(m.slug))

const editedMembers: Array<{ current: MemberInput; base: MemberInput; changedFields: string[] }> = []
for (const member of members) {
  const prev = baseBySlug.get(member.slug)
  if (!prev) continue
  const changed: string[] = []
  for (const key of ['name', 'url', 'city', 'active'] as const) {
    if (member[key] !== prev[key]) changed.push(key)
  }
  if (changed.length > 0) {
    editedMembers.push({ current: member, base: prev, changedFields: changed })
  }
}

// ── Nothing changed ──
if (newMembers.length === 0 && removedMembers.length === 0 && editedMembers.length === 0) {
  write('## Webring Validation\n')
  write('No member changes found in this PR.')
  process.exit(0)
}

// ── Validate ──
const survivingBaseCount = members.filter((m) => baseSlugs.has(m.slug)).length
const appendedCorrectly = newMembers.every((nm) => {
  const idx = members.findIndex((m) => m.slug === nm.slug)
  return idx >= survivingBaseCount
})

let hasFailure = false
const allSlugs = new Set<string>()
const allUrls = new Set<string>()
for (const m of baseMembers) {
  allSlugs.add(m.slug)
  allUrls.add(m.url)
}

write('## Webring Validation\n')

// ── Removed members (warn only) ──
if (removedMembers.length > 0) {
  write('### Removed Members\n')
  for (const m of removedMembers) {
    write(`- WARNING: **${sanitize(m.name)}** (${sanitize(m.url)}) was removed`)
  }
  write('')
}

// ── Edited members ──
for (const { current, base, changedFields } of editedMembers) {
  const safeName = sanitize(current.name)
  const safeUrl = sanitize(current.url)
  let memberFailed = false

  write(`### ${safeName} (edited)\n`)

  for (const field of changedFields) {
    const oldVal = sanitize(String(base[field as keyof MemberInput] ?? ''))
    const newVal = sanitize(String(current[field as keyof MemberInput] ?? ''))
    write(`- INFO: \`${field}\` changed: "${oldVal}" → "${newVal}"`)
  }

  // Re-validate changed fields
  if (changedFields.includes('name') && !current.name) {
    write('- FAIL: name cannot be empty')
    memberFailed = true
  }

  if (changedFields.includes('slug') && !/^[a-z0-9-]+$/.test(current.slug)) {
    write(`- FAIL: slug "${sanitize(current.slug)}" must be lowercase alphanumeric and hyphens only`)
    memberFailed = true
  }

  // Re-validate URL if it changed
  if (changedFields.includes('url')) {
    write('\n**Site check** (URL changed)')

    if (!current.url.startsWith('https://')) {
      write(`- FAIL: URL must use HTTPS. Got "${safeUrl}"`)
      memberFailed = true
    } else {
      try {
        const res = await fetch(current.url, {
          signal: AbortSignal.timeout(10000),
          headers: { 'User-Agent': 'webring.ca validator' },
        })
        if (res.ok) {
          write(`- PASS: ${safeUrl} responded with HTTP ${res.status}`)

          const body = await res.text()
          if (detectWidget(body, current.slug)) {
            write('- PASS: Webring widget detected')
          } else {
            write('- FAIL: Widget not detected on new URL. Install the widget before merging — see https://github.com/stanleypangg/webring.ca#add-the-widget')
            memberFailed = true
          }
        } else {
          write(`- FAIL: ${safeUrl} returned HTTP ${res.status}. The site must return a 2xx status code.`)
          memberFailed = true
        }
      } catch {
        write(`- FAIL: ${safeUrl} is unreachable (timed out after 10s or connection refused).`)
        memberFailed = true
      }
    }
  }

  if (memberFailed) {
    write('\n**Result: Not ready to merge.** Fix the issues marked FAIL above and push again.')
    hasFailure = true
  } else {
    write('')
  }
}

// ── New members ──
for (const member of newMembers) {
  let memberFailed = false

  const safeName = sanitize(member.name ?? '')
  const safeUrl = sanitize(member.url ?? '')

  write(`### ${safeName} (${safeUrl})\n`)

  write('**Schema**')

  if (!member.slug || !member.name || !member.url || member.active === undefined) {
    write('- FAIL: Missing required fields. Every entry needs slug, name, url, and active.')
    memberFailed = true
  } else {
    write('- PASS: All required fields present (slug, name, url, active)')
  }

  const unknownKeys = Object.keys(member).filter((k) => !ALLOWED_KEYS.has(k))
  if (unknownKeys.length > 0) {
    write(`- FAIL: Unknown fields: ${unknownKeys.map((k) => `"${sanitize(k)}"`).join(', ')}. Allowed fields: ${[...ALLOWED_KEYS].join(', ')}`)
    memberFailed = true
  }

  if (member.slug && !/^[a-z0-9-]+$/.test(member.slug)) {
    write(`- FAIL: slug "${sanitize(member.slug)}" must be lowercase alphanumeric and hyphens only (e.g. "jane-doe")`)
    memberFailed = true
  } else if (member.slug) {
    write(`- PASS: slug "${sanitize(member.slug)}" is valid`)
  }

  if (member.url && !member.url.startsWith('https://')) {
    write(`- FAIL: URL must use HTTPS. Got "${safeUrl}"`)
    memberFailed = true
  } else if (member.url) {
    write('- PASS: URL uses HTTPS')
  }

  if (member.slug && allSlugs.has(member.slug)) {
    write(`- FAIL: slug "${sanitize(member.slug)}" is already taken by another member`)
    memberFailed = true
  }

  if (member.url && allUrls.has(member.url)) {
    write(`- FAIL: URL "${safeUrl}" is already registered to another member`)
    memberFailed = true
  }

  if (!appendedCorrectly) {
    write('- FAIL: New entries must be appended to the bottom of the members array, not inserted in the middle')
    memberFailed = true
  }

  if (!hasResolvableMemberCoordinates(member)) {
    write('- FAIL: Coordinates are not resolvable from committed repo data. Add lat/lng or use a supported city before merge.')
    memberFailed = true
  } else {
    write('- PASS: Coordinates are resolvable from committed repo data')
  }

  write('\n**Site check**')

  try {
    const res = await fetch(member.url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'webring.ca validator' },
    })
    if (res.ok) {
      write(`- PASS: ${safeUrl} responded with HTTP ${res.status}`)

      const body = await res.text()
      if (detectWidget(body, member.slug)) {
        write('- PASS: Webring widget detected')
      } else {
        write('- FAIL: Widget not detected. Install the widget before merging — see https://github.com/stanleypangg/webring.ca#add-the-widget')
        memberFailed = true
      }
    } else {
      write(`- FAIL: ${safeUrl} returned HTTP ${res.status}. The site must return a 2xx status code.`)
      memberFailed = true
    }
  } catch {
    write(`- FAIL: ${safeUrl} is unreachable (timed out after 10s or connection refused). Make sure your site is live and publicly accessible.`)
    memberFailed = true
  }

  if (memberFailed) {
    write('\n**Result: Not ready to merge.** Fix the issues marked FAIL above and push again.')
    hasFailure = true
  } else {
    write('\n**Result: Ready to merge.**')
  }

  allSlugs.add(member.slug)
  allUrls.add(member.url)
}

process.exit(hasFailure ? 1 : 0)
