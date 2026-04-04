import { describe, expect, it } from 'vitest'
import { geoIdentity, geoPath } from 'd3-geo'
import { filterFeaturePolygons } from '../../scripts/build-map-assets'

describe('build-map-assets', () => {
  it('keeps the largest polygon and only additional polygons above the area threshold', () => {
    const path = geoPath(geoIdentity())
    const feature: Parameters<typeof filterFeaturePolygons>[0] = {
      type: 'Feature',
      properties: { name: 'Example', postal: 'EX', id: 'ex' },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]],
          [[[12, 0], [12, 1], [13, 1], [13, 0], [12, 0]]],
          [[[15, 0], [15, 4], [19, 4], [19, 0], [15, 0]]],
        ],
      },
    }

    const filtered = filterFeaturePolygons(feature, path, 5)

    expect(filtered.geometry.type).toBe('MultiPolygon')
    expect(filtered.geometry.coordinates).toHaveLength(2)
  })
})
