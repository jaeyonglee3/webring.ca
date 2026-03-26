import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runHealthCheck } from '../cron/healthcheck'
import { createMockKV } from './kv-mock'
import type { Member, HealthStatus } from '../types'

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

describe('runHealthCheck', () => {
  it('marks members as ok when site is reachable with widget', async () => {
    const kv = createMockKV({ members: JSON.stringify([alice]) })
    mockFetch({
      'https://alice.example.com': { ok: true, status: 200, body: '<a href="https://webring.ca">webring</a>' },
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
      'https://alice.example.com': { ok: true, status: 200, body: 'webring.ca widget' },
    })

    await runHealthCheck(kv)

    const membersRaw = await kv.get('members')
    const members: Member[] = JSON.parse(membersRaw!)
    expect(members[0].active).toBe(true)
  })

  it('does not update members if no status changes', async () => {
    const kv = createMockKV({ members: JSON.stringify([alice]) })
    mockFetch({
      'https://alice.example.com': { ok: true, status: 200, body: 'webring.ca' },
    })
    const putSpy = vi.spyOn(kv, 'put')

    await runHealthCheck(kv)

    const memberPuts = putSpy.mock.calls.filter(([key]) => key === 'members')
    expect(memberPuts).toHaveLength(0)
  })

  it('handles multiple members in parallel', async () => {
    const kv = createMockKV({ members: JSON.stringify([alice, bob]) })
    mockFetch({
      'https://alice.example.com': { ok: true, status: 200, body: 'webring.ca' },
      'https://bob.example.com': { ok: true, status: 200, body: 'webring.ca' },
    })

    await runHealthCheck(kv)

    const aliceRaw = await kv.get('health:alice')
    const bobRaw = await kv.get('health:bob')
    expect(JSON.parse(aliceRaw!).status).toBe('ok')
    expect(JSON.parse(bobRaw!).status).toBe('ok')
  })
})
