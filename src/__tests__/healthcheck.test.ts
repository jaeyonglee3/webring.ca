import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runHealthCheck } from '../cron/healthcheck'
import { detectWidget } from '../utils/widget'
import { createMockKV } from './kv-mock'
import type { Member, HealthStatus } from '../types'

const VALID_WIDGET = '<div data-webring="ca" data-member="alice"></div><a href="https://webring.ca/prev/alice">prev</a><a href="https://webring.ca/next/alice">next</a><script src="https://webring.ca/embed.js"></script>'

const alice: Member = { slug: 'alice', name: 'Alice', url: 'https://alice.example.com', type: 'developer', active: true }
const bob: Member = { slug: 'bob', name: 'Bob', url: 'https://bob.example.com', type: 'designer', active: true }

let originalFetch: typeof globalThis.fetch

beforeEach(() => {
  originalFetch = globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

function mockFetch(responses: Record<string, { ok: boolean; status: number; body: string } | 'error'>) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    const response = responses[url]
    if (response === 'error') {
      throw new Error('Network error')
    }
    if (response) {
      return new Response(response.body, { status: response.status })
    }
    throw new Error(`Unexpected fetch: ${url}`)
  }) as typeof fetch
}

describe('detectWidget', () => {
  it('detects valid widget with marker and links', () => {
    expect(detectWidget(VALID_WIDGET)).toBe(true)
  })

  it('detects widget with embed script and links', () => {
    const html = '<script src="https://webring.ca/embed.js"></script><a href="https://webring.ca/prev/alice">prev</a><a href="https://webring.ca/next/alice">next</a>'
    expect(detectWidget(html)).toBe(true)
  })

  it('rejects marker hidden in HTML comment', () => {
    const html = '<!-- <div data-webring="ca"></div> --><a href="https://webring.ca/prev/alice">prev</a><a href="https://webring.ca/next/alice">next</a>'
    expect(detectWidget(html)).toBe(false)
  })

  it('rejects marker without prev/next links', () => {
    const html = '<div data-webring="ca"></div><script src="https://webring.ca/embed.js"></script>'
    expect(detectWidget(html)).toBe(false)
  })

  it('rejects prev/next links without marker', () => {
    const html = '<a href="https://webring.ca/prev/alice">prev</a><a href="https://webring.ca/next/alice">next</a>'
    expect(detectWidget(html)).toBe(false)
  })

  it('rejects when only prev link is present', () => {
    const html = '<div data-webring="ca"></div><a href="https://webring.ca/prev/alice">prev</a>'
    expect(detectWidget(html)).toBe(false)
  })

  it('rejects when only next link is present', () => {
    const html = '<div data-webring="ca"></div><a href="https://webring.ca/next/alice">next</a>'
    expect(detectWidget(html)).toBe(false)
  })

  it('rejects empty page', () => {
    expect(detectWidget('<html></html>')).toBe(false)
  })

  it('rejects widget links for a different slug when slug is provided', () => {
    const html = '<div data-webring="ca" data-member="bob"></div><a href="https://webring.ca/prev/bob">prev</a><a href="https://webring.ca/next/bob">next</a>'
    expect(detectWidget(html, 'alice')).toBe(false)
  })
})

describe('runHealthCheck', () => {
  it('marks members as ok when site is reachable with widget', async () => {
    const kv = createMockKV({ members: JSON.stringify([alice]) })
    mockFetch({
      'https://alice.example.com': { ok: true, status: 200, body: VALID_WIDGET },
    })

    await runHealthCheck(kv)

    const raw = await kv.get('health:alice')
    const status: HealthStatus = JSON.parse(raw!)
    expect(status.status).toBe('ok')
    expect(status.consecutiveFails).toBe(0)
    expect(status.httpStatus).toBe(200)
  })

  it('marks members as widget_missing when site ok but no widget', async () => {
    const kv = createMockKV({ members: JSON.stringify([alice]) })
    mockFetch({
      'https://alice.example.com': { ok: true, status: 200, body: '<html>no widget here</html>' },
    })

    await runHealthCheck(kv)

    const raw = await kv.get('health:alice')
    const status: HealthStatus = JSON.parse(raw!)
    expect(status.status).toBe('widget_missing')
    expect(status.consecutiveFails).toBe(1)
  })

  it('marks as widget_missing when marker is in a comment', async () => {
    const kv = createMockKV({ members: JSON.stringify([alice]) })
    mockFetch({
      'https://alice.example.com': { ok: true, status: 200, body: '<!-- <div data-webring="ca"></div> --><a href="https://webring.ca/prev/alice">prev</a><a href="https://webring.ca/next/alice">next</a>' },
    })

    await runHealthCheck(kv)

    const raw = await kv.get('health:alice')
    const status: HealthStatus = JSON.parse(raw!)
    expect(status.status).toBe('widget_missing')
  })

  it('marks as widget_missing when marker present but no links', async () => {
    const kv = createMockKV({ members: JSON.stringify([alice]) })
    mockFetch({
      'https://alice.example.com': { ok: true, status: 200, body: '<div data-webring="ca"></div>' },
    })

    await runHealthCheck(kv)

    const raw = await kv.get('health:alice')
    const status: HealthStatus = JSON.parse(raw!)
    expect(status.status).toBe('widget_missing')
  })

  it('marks as widget_missing when the widget links belong to another slug', async () => {
    const kv = createMockKV({ members: JSON.stringify([alice]) })
    mockFetch({
      'https://alice.example.com': { ok: true, status: 200, body: '<div data-webring="ca" data-member="bob"></div><a href="https://webring.ca/prev/bob">prev</a><a href="https://webring.ca/next/bob">next</a>' },
    })

    await runHealthCheck(kv)

    const raw = await kv.get('health:alice')
    const status: HealthStatus = JSON.parse(raw!)
    expect(status.status).toBe('widget_missing')
  })

  it('sends a browser User-Agent', async () => {
    const kv = createMockKV({ members: JSON.stringify([alice]) })
    mockFetch({
      'https://alice.example.com': { ok: true, status: 200, body: VALID_WIDGET },
    })

    await runHealthCheck(kv)

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const headers = call[1]?.headers as Record<string, string>
    expect(headers['User-Agent']).toMatch(/^Mozilla\/5\.0/)
  })

  it('marks members as unreachable on network error', async () => {
    const kv = createMockKV({ members: JSON.stringify([alice]) })
    mockFetch({ 'https://alice.example.com': 'error' })

    await runHealthCheck(kv)

    const raw = await kv.get('health:alice')
    const status: HealthStatus = JSON.parse(raw!)
    expect(status.status).toBe('unreachable')
    expect(status.consecutiveFails).toBe(1)
  })

  it('increments consecutive fails from previous status', async () => {
    const prevStatus: HealthStatus = {
      status: 'unreachable',
      lastChecked: '2025-01-01T00:00:00.000Z',
      consecutiveFails: 3,
    }
    const kv = createMockKV({
      members: JSON.stringify([alice]),
      'health:alice': JSON.stringify(prevStatus),
    })
    mockFetch({ 'https://alice.example.com': 'error' })

    await runHealthCheck(kv)

    const raw = await kv.get('health:alice')
    const status: HealthStatus = JSON.parse(raw!)
    expect(status.consecutiveFails).toBe(4)
  })

  it('deactivates member after 7 consecutive fails', async () => {
    const prevStatus: HealthStatus = {
      status: 'unreachable',
      lastChecked: '2025-01-01T00:00:00.000Z',
      consecutiveFails: 6,
    }
    const kv = createMockKV({
      members: JSON.stringify([alice]),
      'health:alice': JSON.stringify(prevStatus),
    })
    mockFetch({ 'https://alice.example.com': 'error' })

    await runHealthCheck(kv)

    const membersRaw = await kv.get('members')
    const members: Member[] = JSON.parse(membersRaw!)
    expect(members[0].active).toBe(false)
  })

  it('reactivates inactive member when site becomes ok', async () => {
    const inactiveAlice = { ...alice, active: false }
    const kv = createMockKV({ members: JSON.stringify([inactiveAlice]) })
    mockFetch({
      'https://alice.example.com': { ok: true, status: 200, body: VALID_WIDGET },
    })

    await runHealthCheck(kv)

    const membersRaw = await kv.get('members')
    const members: Member[] = JSON.parse(membersRaw!)
    expect(members[0].active).toBe(true)
  })

  it('does not update members if no status changes', async () => {
    const kv = createMockKV({ members: JSON.stringify([alice]) })
    mockFetch({
      'https://alice.example.com': { ok: true, status: 200, body: VALID_WIDGET },
    })
    const putSpy = vi.spyOn(kv, 'put')

    await runHealthCheck(kv)

    const memberPuts = putSpy.mock.calls.filter(([key]) => key === 'members')
    expect(memberPuts).toHaveLength(0)
  })

  it('handles multiple members in parallel', async () => {
    const kv = createMockKV({ members: JSON.stringify([alice, bob]) })
    const bobWidget = '<div data-webring="ca"></div><a href="https://webring.ca/prev/bob">prev</a><a href="https://webring.ca/next/bob">next</a>'
    mockFetch({
      'https://alice.example.com': { ok: true, status: 200, body: VALID_WIDGET },
      'https://bob.example.com': { ok: true, status: 200, body: bobWidget },
    })

    await runHealthCheck(kv)

    const aliceRaw = await kv.get('health:alice')
    const bobRaw = await kv.get('health:bob')
    expect(JSON.parse(aliceRaw!).status).toBe('ok')
    expect(JSON.parse(bobRaw!).status).toBe('ok')
  })
})
