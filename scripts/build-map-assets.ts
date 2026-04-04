import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { geoConicConformal, geoPath } from 'd3-geo'

type Position = [number, number]
type PolygonCoordinates = Position[][]

interface FeatureProperties {
  readonly id?: string
  readonly name?: string
  readonly postal?: string
  readonly ADM0_A3?: string
  readonly adm0_a3?: string
}

interface PolygonGeometry {
  type: 'Polygon'
  coordinates: PolygonCoordinates
}

interface MultiPolygonGeometry {
  type: 'MultiPolygon'
  coordinates: PolygonCoordinates[]
}

type Geometry = PolygonGeometry | MultiPolygonGeometry

interface Feature {
  type: 'Feature'
  properties: FeatureProperties
  geometry: Geometry
}

interface FeatureCollection {
  type: 'FeatureCollection'
  features: Feature[]
}

const OUTLINE_SOURCE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson'
const REGIONS_SOURCE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson'

const SVG_WIDTH = 800
const SVG_HEIGHT = 520
const MAP_PADDING = 24
const REGION_ISLAND_AREA_THRESHOLD = 12
const OUTLINE_ISLAND_AREA_THRESHOLD = 20

function isPolygonGeometry(geometry: Geometry): geometry is PolygonGeometry {
  return geometry.type === 'Polygon'
}

function toPolygonList(geometry: Geometry): PolygonCoordinates[] {
  return isPolygonGeometry(geometry) ? [geometry.coordinates] : geometry.coordinates
}

function fromPolygonList(polygons: PolygonCoordinates[]): Geometry {
  if (polygons.length === 1) {
    return { type: 'Polygon', coordinates: polygons[0] }
  }

  return { type: 'MultiPolygon', coordinates: polygons }
}

function featureArea(
  polygon: PolygonCoordinates,
  path: ReturnType<typeof geoPath>
): number {
  return path({
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: polygon },
  })
    ? path.area({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: polygon },
      })
    : 0
}

export function filterFeaturePolygons(
  feature: Feature,
  path: ReturnType<typeof geoPath>,
  minArea: number
): Feature {
  const polygonsWithArea = toPolygonList(feature.geometry)
    .map((polygon) => ({
      polygon,
      area: featureArea(polygon, path),
    }))
    .sort((a, b) => b.area - a.area)

  const [largest, ...rest] = polygonsWithArea
  const keptPolygons = [
    largest.polygon,
    ...rest.filter((entry) => entry.area >= minArea).map((entry) => entry.polygon),
  ]

  return {
    type: 'Feature',
    properties: feature.properties,
    geometry: fromPolygonList(keptPolygons),
  }
}

async function fetchGeoJson(url: string): Promise<FeatureCollection> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'webring.ca map asset builder' },
    signal: AbortSignal.timeout(20000),
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`)
  }

  return await res.json() as FeatureCollection
}

function createProjection(outline: FeatureCollection) {
  return geoConicConformal()
    .parallels([49, 77])
    .rotate([96, 0])
    .center([0, 62])
    .fitExtent(
      [
        [MAP_PADDING, MAP_PADDING],
        [SVG_WIDTH - MAP_PADDING, SVG_HEIGHT - MAP_PADDING],
      ],
      outline as any
    )
}

export async function buildCanadaMapAssets(): Promise<{
  outline: FeatureCollection
  regions: FeatureCollection
}> {
  const [outlineSource, regionsSource] = await Promise.all([
    fetchGeoJson(OUTLINE_SOURCE_URL),
    fetchGeoJson(REGIONS_SOURCE_URL),
  ])

  const canadaOutlineSource: Feature = outlineSource.features.find(
    (feature) => feature.properties.ADM0_A3 === 'CAN' || feature.properties.adm0_a3 === 'CAN'
  )!

  const canadaRegionsSource = regionsSource.features
    .filter((feature) => feature.properties.adm0_a3 === 'CAN')
    .sort((a, b) => String(a.properties.name).localeCompare(String(b.properties.name)))

  const outlineCollection: FeatureCollection = {
    type: 'FeatureCollection',
    features: [canadaOutlineSource],
  }

  const path = geoPath(createProjection(outlineCollection))

  const filteredOutline: FeatureCollection = {
    type: 'FeatureCollection',
    features: [filterFeaturePolygons(canadaOutlineSource, path, OUTLINE_ISLAND_AREA_THRESHOLD)],
  }

  const filteredRegions: FeatureCollection = {
    type: 'FeatureCollection',
    features: canadaRegionsSource.map((feature) =>
      filterFeaturePolygons(
        {
          type: 'Feature',
          properties: {
            id: String(feature.properties.postal ?? feature.properties.name).toLowerCase(),
            name: feature.properties.name,
            postal: feature.properties.postal,
          },
          geometry: feature.geometry,
        },
        path,
        REGION_ISLAND_AREA_THRESHOLD
      )
    ),
  }

  return {
    outline: filteredOutline,
    regions: filteredRegions,
  }
}

async function main(): Promise<void> {
  const { outline, regions } = await buildCanadaMapAssets()

  writeFileSync(
    resolve(import.meta.dirname, '..', 'src', 'lib', 'canada-outline.json'),
    `${JSON.stringify(outline, null, 2)}\n`
  )

  writeFileSync(
    resolve(import.meta.dirname, '..', 'src', 'lib', 'canada-regions.json'),
    `${JSON.stringify(regions, null, 2)}\n`
  )

  // Pre-compute SVG paths + projection params so the Worker never imports raw GeoJSON
  const projection = createProjection(outline)
  const path = geoPath(projection)

  const outlinePath = path(outline.features[0]) ?? ''
  const regionPaths = (regions.features as Array<Feature>)
    .map((feature) => ({
      id: String(feature.properties.id),
      name: String(feature.properties.name),
      postal: String(feature.properties.postal),
      d: path(feature) ?? '',
    }))
    .filter((r) => r.d.length > 0)

  const precomputed = {
    viewBox: `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`,
    outlinePath,
    regionPaths,
    projection: {
      parallels: [49, 77],
      rotate: [96, 0],
      center: [0, 62],
      scale: projection.scale(),
      translate: projection.translate(),
    },
  }

  writeFileSync(
    resolve(import.meta.dirname, '..', 'src', 'lib', 'canada-map-data.json'),
    `${JSON.stringify(precomputed)}\n`
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
}
