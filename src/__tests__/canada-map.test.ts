import { describe, expect, it } from 'vitest'
import {
  CANADA_OUTLINE_PATH,
  CANADA_REGION_PATHS,
  CANADA_VIEWBOX,
  projectToSvg,
} from '../lib/canada-map'

describe('canada-map', () => {
  it('exports a non-empty outline path and the expected region count', () => {
    expect(CANADA_VIEWBOX).toBe('0 0 800 520')
    expect(CANADA_OUTLINE_PATH.length).toBeGreaterThan(0)
    expect(CANADA_REGION_PATHS).toHaveLength(13)
  })

  it('includes representative province and territory entries', () => {
    const regionNames = CANADA_REGION_PATHS.map((region) => region.name)
    expect(regionNames).toContain('British Columbia')
    expect(regionNames).toContain('Nunavut')
    expect(regionNames).toContain('Québec')
  })

  it('projects representative cities into the configured viewBox', () => {
    const points = [
      projectToSvg(43.65, -79.38),
      projectToSvg(49.28, -123.12),
      projectToSvg(63.75, -68.52),
    ]

    for (const point of points) {
      expect(Number.isFinite(point.x)).toBe(true)
      expect(Number.isFinite(point.y)).toBe(true)
      expect(point.x).toBeGreaterThanOrEqual(0)
      expect(point.x).toBeLessThanOrEqual(800)
      expect(point.y).toBeGreaterThanOrEqual(0)
      expect(point.y).toBeLessThanOrEqual(520)
    }
  })
})
