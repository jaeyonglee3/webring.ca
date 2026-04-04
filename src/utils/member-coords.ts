import { getCityCoord } from '../lib/city-coords'
import type { Member } from '../types'

export interface Coordinates {
  lat: number
  lng: number
}

function isFiniteCoordinate(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function getMemberCoordinates(member: Pick<Member, 'city' | 'lat' | 'lng'>): Coordinates | null {
  if (isFiniteCoordinate(member.lat) && isFiniteCoordinate(member.lng)) {
    return { lat: member.lat, lng: member.lng }
  }

  if (!member.city) {
    return null
  }

  return getCityCoord(member.city)
}

export function hasResolvableMemberCoordinates(member: Pick<Member, 'city' | 'lat' | 'lng'>): boolean {
  return getMemberCoordinates(member) !== null
}
