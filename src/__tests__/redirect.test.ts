import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { Bindings } from '../types'
import { createMockKV } from './kv-mock'
import type { Member } from '../types'

const alice: Member = { slug: 'alice', name: 'Alice', url: 'https://alice.example.com', type: 'developer', active: true }
const bob: Member = { slug: 'bob', name: 'Bob', url: 'https://bob.example.com', type: 'designer', active: true }
const charlie: Member = { slug: 'charlie', name: 'Charlie', url: 'https://charlie.example.com', type: 'founder', active: true }

let kv: KVNamespace
let app: Hono<{ Bindings: Bindings }>

async function importRedirectApp() {
  const mod = await import('../routes/redirect')
  return mod.default
}

beforeEach(() => {
  kv = createMockKV({
    members: JSON.stringify([alice, bob, charlie]),
    'ring-order': JSON.stringify(['alice', 'bob', 'charlie']),
  })
})

async function makeApp() {
  const redirect = await importRedirectApp()
  const testApp = new Hono<{ Bindings: Bindings }>()
  testApp.route('/', redirect)
  return testApp
}

function request(app: Hono<{ Bindings: Bindings }>, path: string) {
  return app.request(path, {}, { WEBRING: kv })
}

describe('/next/:slug', () => {
  it('redirects to the next member in ring order', async () => {
    const app = await makeApp()
    const res = await request(app, '/next/alice')
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('https://bob.example.com')
  })

  it('wraps around the ring', async () => {
    const app = await makeApp()
    const res = await request(app, '/next/charlie')
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('https://alice.example.com')
  })

  it('redirects to / for unknown slug', async () => {
    const app = await makeApp()
    const res = await request(app, '/next/unknown')
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/')
  })

  it('redirects to / for invalid slug format', async () => {
    const app = await makeApp()
    const res = await request(app, '/next/INVALID_SLUG!')
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/')
  })

  it('redirects to / for overly long slug', async () => {
    const app = await makeApp()
    const longSlug = 'a'.repeat(101)
    const res = await request(app, `/next/${longSlug}`)
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/')
  })

  it('redirects to / when no active members', async () => {
    kv = createMockKV({
      members: JSON.stringify([]),
      'ring-order': JSON.stringify([]),
    })
    const app = await makeApp()
    const res = await request(app, '/next/alice')
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/')
  })
})

describe('/prev/:slug', () => {
  it('redirects to the previous member in ring order', async () => {
    const app = await makeApp()
    const res = await request(app, '/prev/charlie')
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('https://bob.example.com')
  })

  it('wraps around the ring backwards', async () => {
    const app = await makeApp()
    const res = await request(app, '/prev/alice')
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('https://charlie.example.com')
  })

  it('redirects to / for invalid slug format', async () => {
    const app = await makeApp()
    const res = await request(app, '/prev/BAD SLUG')
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/')
  })
})

describe('/random', () => {
  it('redirects to a random active member', async () => {
    const app = await makeApp()
    const res = await request(app, '/random')
    expect(res.status).toBe(302)
    const location = res.headers.get('Location')!
    expect(location).toMatch(/^https:\/\/(alice|bob|charlie)\.example\.com$/)
  })

  it('redirects to / when no active members', async () => {
    kv = createMockKV({
      members: JSON.stringify([{ ...alice, active: false }]),
      'ring-order': JSON.stringify([]),
    })
    const app = await makeApp()
    const res = await request(app, '/random')
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/')
  })
})
