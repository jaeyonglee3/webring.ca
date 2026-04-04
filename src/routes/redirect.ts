import { Hono } from 'hono'
import type { Bindings } from '../types'
import { getEffectiveRingOrder, getActiveMembers } from '../data'

const SLUG_PATTERN = /^[a-z0-9-]+$/

function isValidSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= 100 && SLUG_PATTERN.test(slug)
}

function isSafeRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/next/:slug', async (c) => {
  c.header('Cache-Control', 'no-store')
  const slug = c.req.param('slug')
  if (!isValidSlug(slug)) {
    return c.redirect('/', 302)
  }
  const [order, activeMembers] = await Promise.all([
    getEffectiveRingOrder(c.env.WEBRING),
    getActiveMembers(c.env.WEBRING),
  ])

  const membersBySlug = new Map(activeMembers.map((m) => [m.slug, m]))
  const idx = order.indexOf(slug)

  if (idx === -1 || activeMembers.length <= 1) {
    return c.redirect('/', 302)
  }

  for (let i = 1; i < order.length; i++) {
    const nextSlug = order[(idx + i) % order.length]
    const member = membersBySlug.get(nextSlug)
    if (member && nextSlug !== slug && isSafeRedirectUrl(member.url)) {
      return c.redirect(member.url, 302)
    }
  }

  return c.redirect('/', 302)
})

app.get('/prev/:slug', async (c) => {
  c.header('Cache-Control', 'no-store')
  const slug = c.req.param('slug')
  if (!isValidSlug(slug)) {
    return c.redirect('/', 302)
  }
  const [order, activeMembers] = await Promise.all([
    getEffectiveRingOrder(c.env.WEBRING),
    getActiveMembers(c.env.WEBRING),
  ])

  const membersBySlug = new Map(activeMembers.map((m) => [m.slug, m]))
  const idx = order.indexOf(slug)

  if (idx === -1 || activeMembers.length <= 1) {
    return c.redirect('/', 302)
  }

  for (let i = 1; i < order.length; i++) {
    const prevSlug = order[(idx - i + order.length) % order.length]
    const member = membersBySlug.get(prevSlug)
    if (member && prevSlug !== slug && isSafeRedirectUrl(member.url)) {
      return c.redirect(member.url, 302)
    }
  }

  return c.redirect('/', 302)
})

app.get('/random', async (c) => {
  c.header('Cache-Control', 'no-store')
  const members = await getActiveMembers(c.env.WEBRING)

  if (members.length === 0) {
    return c.redirect('/', 302)
  }

  const member = members[Math.floor(Math.random() * members.length)]
  if (!isSafeRedirectUrl(member.url)) {
    return c.redirect('/', 302)
  }
  return c.redirect(member.url, 302)
})

export default app
