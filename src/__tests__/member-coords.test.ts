import { describe, expect, it } from 'vitest'
import { getMemberCoordinates, hasResolvableMemberCoordinates } from '../utils/member-coords'

describe('member coordinates', () => {
  it('prefers explicit member coordinates', () => {
    expect(getMemberCoordinates({
      city: 'Toronto',
      lat: 10,
      lng: 20,
    })).toEqual({ lat: 10, lng: 20 })
  })

  it('falls back to committed city coordinates', () => {
    expect(getMemberCoordinates({
      city: 'Toronto',
    })).toEqual({ lat: 43.65, lng: -79.38 })
  })

  it('returns null for unknown cities without explicit coordinates', () => {
    expect(getMemberCoordinates({
      city: 'Unknown City',
    })).toBeNull()
  })

  it('reports whether coordinates are resolvable', () => {
    expect(hasResolvableMemberCoordinates({ city: 'Toronto' })).toBe(true)
    expect(hasResolvableMemberCoordinates({ city: 'Unknown City' })).toBe(false)
  })
})
