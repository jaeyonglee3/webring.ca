import { beforeEach, describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import type { Bindings, Member } from '../types'
import { createMockKV } from './kv-mock'

let kv: KVNamespace

const alice: Member = {
  slug: 'alice',
  name: 'Alice',
  url: 'https://alice.example.com',
  city: 'Toronto',
  type: 'developer',
  active: true,
  lat: 43.65,
  lng: -79.38,
}

const bob: Member = {
  slug: 'bob',
  name: 'Bob',
  url: 'https://bob.example.com',
  city: 'Vancouver',
  type: 'designer',
  active: true,
}

async function makeApp() {
  const mod = await import('../routes/landing')
  const app = new Hono<{ Bindings: Bindings }>()
  app.route('/', mod.default)
  return app
}

beforeEach(() => {
  kv = createMockKV({
    members: JSON.stringify([alice, bob]),
  })
})

describe('landing route', () => {
  it('renders province paths and dots for members with coordinates', async () => {
    const app = await makeApp()
    const res = await app.request('/', {}, { WEBRING: kv })

    expect(res.status).toBe(200)

    const html = await res.text()
    expect(html).toContain('class="canada-map"')
    expect(html).toContain('class="canada-silhouette"')
    expect(html).toContain('class="canada-region"')
    expect(html).toContain('data-region="bc"')
    expect(html).toContain('data-slug="alice"')
    expect(html).not.toContain('data-slug="bob"')
  })

  it('renders intro text without accordion wrapper', async () => {
    const app = await makeApp()
    const res = await app.request('/', {}, { WEBRING: kv })
    const html = await res.text()

    // Intro text is present
    expect(html).toContain('class="landing-intro"')
    // No About accordion header
    expect(html).not.toContain('aria-controls="accordion-about"')
  })

  it('renders member list without accordion wrapper', async () => {
    const app = await makeApp()
    const res = await app.request('/', {}, { WEBRING: kv })
    const html = await res.text()

    // Member list is rendered directly
    expect(html).toContain('class="member-list"')
    expect(html).toContain('data-member-slug="alice"')
    // No Members accordion header
    expect(html).not.toContain('aria-controls="accordion-members"')
  })

  it('renders join link in widget', async () => {
    const app = await makeApp()
    const res = await app.request('/', {}, { WEBRING: kv })
    const html = await res.text()

    expect(html).toContain('href="/join"')
    expect(html).toContain('class="landing-widget-inner"')
  })

  it('renders tab bar with Map and Discover tabs', async () => {
    const app = await makeApp()
    const res = await app.request('/', {}, { WEBRING: kv })
    const html = await res.text()

    expect(html).toContain('class="tab-bar"')
    expect(html).toContain('data-tab="map"')
    expect(html).toContain('data-tab="discover"')
  })

  it('renders Map tab panel with Canada map', async () => {
    const app = await makeApp()
    const res = await app.request('/', {}, { WEBRING: kv })
    const html = await res.text()

    expect(html).toContain('id="tab-panel-map"')
    expect(html).toContain('class="canada-map"')
  })

  it('renders Discover tab panel with member data script', async () => {
    const app = await makeApp()
    const res = await app.request('/', {}, { WEBRING: kv })
    const html = await res.text()

    expect(html).toContain('id="tab-panel-discover"')
    expect(html).toContain('__discoverMembers')
  })
})
