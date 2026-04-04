import { describe, it, expect } from 'vitest'
import {
  getMembers,
  getMemberBySlug,
  getActiveMembers,
  getEffectiveRingOrder,
  setMembers,
  getRingOrder,
  setRingOrder,
  getHealthStatus,
  setHealthStatus,
} from '../data'
import { createMockKV } from './kv-mock'
import type { Member, HealthStatus } from '../types'

const alice: Member = {
  slug: 'alice',
  name: 'Alice',
  url: 'https://alice.example.com',
  type: 'developer',
  active: true,
}

const bob: Member = {
  slug: 'bob',
  name: 'Bob',
  url: 'https://bob.example.com',
  type: 'designer',
  active: false,
}

describe('getMembers', () => {
  it('returns members from KV', async () => {
    const kv = createMockKV({ members: JSON.stringify([alice, bob]) })
    const result = await getMembers(kv)
    expect(result).toEqual([alice, bob])
  })

  it('returns empty array when KV has no members key', async () => {
    const kv = createMockKV()
    const result = await getMembers(kv)
    expect(result).toEqual([])
  })

  it('returns empty array on corrupted JSON', async () => {
    const kv = createMockKV({ members: '{invalid json' })
    const result = await getMembers(kv)
    expect(result).toEqual([])
  })

  it('returns empty array when KV value is not an array', async () => {
    const kv = createMockKV({ members: '{"not": "array"}' })
    const result = await getMembers(kv)
    expect(result).toEqual([])
  })
})

describe('getMemberBySlug', () => {
  it('finds a member by slug', async () => {
    const kv = createMockKV({ members: JSON.stringify([alice, bob]) })
    const result = await getMemberBySlug(kv, 'bob')
    expect(result).toEqual(bob)
  })

  it('returns null for unknown slug', async () => {
    const kv = createMockKV({ members: JSON.stringify([alice]) })
    const result = await getMemberBySlug(kv, 'unknown')
    expect(result).toBeNull()
  })
})

describe('getActiveMembers', () => {
  it('returns only active members', async () => {
    const kv = createMockKV({ members: JSON.stringify([alice, bob]) })
    const result = await getActiveMembers(kv)
    expect(result).toEqual([alice])
  })

  it('returns empty array when no members are active', async () => {
    const kv = createMockKV({ members: JSON.stringify([bob]) })
    const result = await getActiveMembers(kv)
    expect(result).toEqual([])
  })
})

describe('setMembers', () => {
  it('writes members to KV', async () => {
    const kv = createMockKV()
    await setMembers(kv, [alice])
    const raw = await kv.get('members')
    expect(JSON.parse(raw!)).toEqual([alice])
  })
})

describe('getRingOrder', () => {
  it('returns ring order from KV', async () => {
    const kv = createMockKV({ 'ring-order': JSON.stringify(['alice', 'bob']) })
    const result = await getRingOrder(kv)
    expect(result).toEqual(['alice', 'bob'])
  })

  it('returns empty array when missing', async () => {
    const kv = createMockKV()
    const result = await getRingOrder(kv)
    expect(result).toEqual([])
  })

  it('returns empty array on corrupted JSON', async () => {
    const kv = createMockKV({ 'ring-order': 'not json' })
    const result = await getRingOrder(kv)
    expect(result).toEqual([])
  })

  it('returns empty array when value is not an array', async () => {
    const kv = createMockKV({ 'ring-order': '"just-a-string"' })
    const result = await getRingOrder(kv)
    expect(result).toEqual([])
  })
})

describe('getEffectiveRingOrder', () => {
  it('returns stored order when it matches active members', async () => {
    const kv = createMockKV({
      members: JSON.stringify([alice, { ...bob, active: true }]),
      'ring-order': JSON.stringify(['bob', 'alice']),
    })

    const result = await getEffectiveRingOrder(kv)
    expect(result).toEqual(['bob', 'alice'])
  })

  it('falls back to active member order when ring order is empty', async () => {
    const kv = createMockKV({
      members: JSON.stringify([alice, { ...bob, active: true }]),
      'ring-order': JSON.stringify([]),
    })

    const result = await getEffectiveRingOrder(kv)
    expect(result).toEqual(['alice', 'bob'])
  })

  it('filters inactive slugs and appends missing active members', async () => {
    const carol: Member = {
      slug: 'carol',
      name: 'Carol',
      url: 'https://carol.example.com',
      type: 'founder',
      active: true,
    }
    const kv = createMockKV({
      members: JSON.stringify([alice, bob, carol]),
      'ring-order': JSON.stringify(['bob', 'alice']),
    })

    const result = await getEffectiveRingOrder(kv)
    expect(result).toEqual(['alice', 'carol'])
  })
})

describe('setRingOrder', () => {
  it('writes ring order to KV', async () => {
    const kv = createMockKV()
    await setRingOrder(kv, ['bob', 'alice'])
    const raw = await kv.get('ring-order')
    expect(JSON.parse(raw!)).toEqual(['bob', 'alice'])
  })
})

describe('getHealthStatus', () => {
  it('returns health status for a slug', async () => {
    const status: HealthStatus = {
      status: 'ok',
      httpStatus: 200,
      lastChecked: '2025-01-01T00:00:00.000Z',
      consecutiveFails: 0,
    }
    const kv = createMockKV({ 'health:alice': JSON.stringify(status) })
    const result = await getHealthStatus(kv, 'alice')
    expect(result).toEqual(status)
  })

  it('returns null when no status exists', async () => {
    const kv = createMockKV()
    const result = await getHealthStatus(kv, 'unknown')
    expect(result).toBeNull()
  })

  it('returns null on corrupted JSON', async () => {
    const kv = createMockKV({ 'health:alice': 'broken' })
    const result = await getHealthStatus(kv, 'alice')
    expect(result).toBeNull()
  })
})

describe('setHealthStatus', () => {
  it('writes health status to KV', async () => {
    const kv = createMockKV()
    const status: HealthStatus = {
      status: 'ok',
      lastChecked: '2025-01-01T00:00:00.000Z',
      consecutiveFails: 0,
    }
    await setHealthStatus(kv, 'alice', status)
    const raw = await kv.get('health:alice')
    expect(JSON.parse(raw!)).toEqual(status)
  })
})
