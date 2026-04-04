import { getCityCoord } from '../src/lib/city-coords'

interface GeoResult {
  lat: number
  lng: number
}

async function nominatimGeocode(city: string): Promise<GeoResult | null> {
  const query = encodeURIComponent(`${city}, Canada`)
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=ca`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'webring.ca seed script (https://webring.ca)' },
  })
  if (!res.ok) return null
  const data = await res.json() as Array<{ lat: string; lon: string }>
  if (data.length === 0) return null
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
}

export async function geocodeCity(city: string): Promise<GeoResult | null> {
  const result = await nominatimGeocode(city)
  if (result) return result
  return getCityCoord(city)
}
