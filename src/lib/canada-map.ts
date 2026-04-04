import { geoConicConformal } from 'd3-geo'
import mapData from './canada-map-data.json'

export const CANADA_VIEWBOX = mapData.viewBox
export const CANADA_OUTLINE_PATH = mapData.outlinePath
export const CANADA_REGION_PATHS = mapData.regionPaths

const projection = geoConicConformal()
  .parallels(mapData.projection.parallels as [number, number])
  .rotate(mapData.projection.rotate as [number, number])
  .center(mapData.projection.center as [number, number])
  .scale(mapData.projection.scale)
  .translate(mapData.projection.translate as [number, number])

export function projectToSvg(lat: number, lng: number): { x: number; y: number } {
  const point = projection([lng, lat])

  if (!point) {
    return { x: 400, y: 260 }
  }

  return { x: point[0], y: point[1] }
}
