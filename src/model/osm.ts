/**
 * Wandelt Kartendaten aus OpenStreetMap (OSM) in ein Stadtraster um.
 *
 * Vorgehen: Jede Zelle wird an 5×5 Punkten abgetastet. Für jeden Punkt wird
 * bestimmt, was dort laut OSM liegt (Gebäude, Straße, Parkplatz, Grün …).
 * Die häufigste Oberfläche gewinnt die Zelle.
 *
 * Wo OSM nichts Genaues weiß, wird nach der Flächennutzung geschätzt
 * (Wohngebiet → Garten/Rasen, Gewerbe → Pflaster). Der Anteil geschätzter
 * Zellen wird zurückgegeben, damit man weiß, wie viel von Hand zu prüfen ist.
 */

import type { SurfaceType } from '../data/materials.ts'
import type { CityGrid, GridCell } from './grid.ts'

/** Geografischer Ausschnitt in Grad. */
export interface BBox {
  south: number
  west: number
  north: number
  east: number
}

interface LatLon {
  lat: number
  lon: number
}

/** Ein Element der Overpass-Antwort (Abfrage mit "out geom"). */
export interface OsmElement {
  type: 'node' | 'way' | 'relation'
  tags?: Record<string, string>
  lat?: number
  lon?: number
  geometry?: LatLon[]
  members?: { type: string; role: string; geometry?: LatLon[] }[]
}

export interface RasterResult {
  grid: CityGrid
  /** Anteil der Zellen, deren Oberfläche nur geschätzt ist (0–1). */
  guessedShare: number
}

/** Meter pro Breitengrad. */
const METRES_PER_DEGREE = 111_320

/** Quadratischer Ausschnitt mit der Kantenlänge sizeM um einen Mittelpunkt. */
export function squareAround(lat: number, lon: number, sizeM: number): BBox {
  const dLat = sizeM / 2 / METRES_PER_DEGREE
  const dLon = sizeM / 2 / (METRES_PER_DEGREE * Math.cos((lat * Math.PI) / 180))
  return { south: lat - dLat, north: lat + dLat, west: lon - dLon, east: lon + dLon }
}

/** Punkt in Metern. Ursprung ist die Nordwest-Ecke, x nach Osten, y nach Süden. */
type Point = readonly [number, number]

interface AreaFeature {
  ring: Point[]
  area: number
  surface: SurfaceType
  /** true = nur aus der Flächennutzung geschätzt. */
  guessed: boolean
}

interface LineFeature {
  points: Point[]
  halfWidth: number
  surface: SurfaceType
}

/** Abtastpunkte je Zellenkante. */
const SAMPLES = 5
/** Ab diesem Flächenanteil gilt eine Zelle als Straße, auch ohne Mehrheit. */
const STREET_SHARE = 0.4
/** Radius einer Baumkrone um einen einzeln kartierten Baum in Metern. */
const TREE_RADIUS = 4.5
/** Ab diesem Flächenanteil gilt eine Zelle als Baum, auch ohne Mehrheit. */
const TREE_SHARE = 0.3

/** OSM-Angabe "surface" → Oberflächentyp des Modells. */
function surfaceFromTag(surface: string | undefined): SurfaceType | undefined {
  if (!surface) return undefined
  if (['asphalt', 'chipseal'].includes(surface)) return 'asphalt'
  if (surface === 'grass') return 'grass'
  if (
    ['compacted', 'fine_gravel', 'gravel', 'pebblestone', 'ground', 'dirt', 'earth', 'sand',
      'unpaved', 'grass_paver', 'woodchips', 'mud'].includes(surface)
  ) {
    return 'permeable'
  }
  // Pflaster, Beton, Platten, Kunststoffbeläge und alles andere Befestigte.
  return 'concrete'
}

/** Halbe Breite und Standardbelag eines Wegs nach Straßenklasse. */
function roadProfile(highway: string): { halfWidth: number; surface: SurfaceType } {
  if (['motorway', 'trunk', 'primary'].includes(highway)) return { halfWidth: 6, surface: 'asphalt' }
  if (['secondary', 'tertiary'].includes(highway)) return { halfWidth: 4.5, surface: 'asphalt' }
  if (highway === 'track') return { halfWidth: 1.75, surface: 'permeable' }
  if (highway === 'path' || highway === 'bridleway') return { halfWidth: 1.25, surface: 'permeable' }
  if (['footway', 'cycleway', 'steps', 'platform'].includes(highway)) {
    return { halfWidth: 1.5, surface: 'concrete' }
  }
  return { halfWidth: 3, surface: 'asphalt' } // Wohnstraße, Zufahrt, Fußgängerzone …
}

const GRASS_LANDUSE = ['grass', 'meadow', 'village_green', 'recreation_ground', 'cemetery',
  'allotments', 'farmland', 'orchard', 'vineyard', 'greenfield', 'flowerbed', 'plant_nursery']
const GRASS_LEISURE = ['park', 'garden', 'pitch', 'golf_course', 'dog_park']
const SEALED_LANDUSE = ['commercial', 'retail', 'industrial', 'construction', 'education',
  'garages', 'depot']

/** Welche Oberfläche hat eine in OSM kartierte Fläche? undefined = nicht relevant. */
function classifyArea(
  tags: Record<string, string>,
): { surface: SurfaceType; guessed: boolean } | undefined {
  const explicit = (surface: SurfaceType) => ({ surface, guessed: false })
  const guess = (surface: SurfaceType) => ({ surface, guessed: true })

  if (tags.building && tags.building !== 'no') return explicit('roof')
  if (tags.location === 'underground' || tags.parking === 'underground') return undefined

  if (
    tags.natural === 'water' ||
    ['riverbank', 'dock'].includes(tags.waterway) ||
    ['basin', 'reservoir'].includes(tags.landuse) ||
    tags.leisure === 'swimming_pool'
  ) {
    return explicit('water')
  }
  if (tags.natural === 'wood' || tags.landuse === 'forest' || tags.natural === 'scrub') {
    return explicit('tree')
  }

  const tagged = surfaceFromTag(tags.surface)
  if (tags.amenity === 'parking' && tags.parking !== 'multi-storey') {
    return explicit(tagged ?? 'asphalt')
  }
  if (tags.highway && (tags.area === 'yes' || tags.highway === 'pedestrian')) {
    return explicit(tagged ?? 'concrete')
  }
  if (tags.leisure === 'playground') return explicit(tagged ?? 'permeable')
  if (
    GRASS_LANDUSE.includes(tags.landuse) ||
    GRASS_LEISURE.includes(tags.leisure) ||
    ['grassland', 'heath'].includes(tags.natural)
  ) {
    return explicit(tagged ?? 'grass')
  }
  if (tags.landuse === 'railway') return explicit('permeable')

  // Ab hier nur noch Schätzungen aus der Flächennutzung.
  if (tags.landuse === 'residential') return guess('grass')
  if (SEALED_LANDUSE.includes(tags.landuse)) return guess('concrete')
  if (['school', 'university', 'college', 'kindergarten', 'hospital'].includes(tags.amenity)) {
    return guess('concrete')
  }
  return undefined
}

function ringArea(ring: Point[]): number {
  let sum = 0
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
  }
  return Math.abs(sum) / 2
}

/** Liegt der Punkt im Vieleck? (Strahl-Verfahren) */
function insideRing(x: number, y: number, ring: Point[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Quadrat des Abstands eines Punkts zu einer Strecke. */
function distanceSqToSegment(x: number, y: number, a: Point, b: Point): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const lengthSq = dx * dx + dy * dy
  const t = lengthSq === 0 ? 0 : Math.min(1, Math.max(0, ((x - a[0]) * dx + (y - a[1]) * dy) / lengthSq))
  return (x - a[0] - t * dx) ** 2 + (y - a[1] - t * dy) ** 2
}

function nearLine(x: number, y: number, line: LineFeature, distance: number): boolean {
  const limit = distance * distance
  for (let i = 0; i < line.points.length - 1; i++) {
    if (distanceSqToSegment(x, y, line.points[i], line.points[i + 1]) <= limit) return true
  }
  return false
}

const isClosed = (points: LatLon[]): boolean =>
  points.length >= 4 &&
  points[0].lat === points[points.length - 1].lat &&
  points[0].lon === points[points.length - 1].lon

/**
 * Rastert OSM-Elemente auf ein Gitter. Zeile 0 liegt im Norden.
 */
export function rasterizeOsm(
  elements: OsmElement[],
  bbox: BBox,
  width = 20,
  height = 20,
  cellSizeM = 10,
): RasterResult {
  const toPoint = ({ lat, lon }: LatLon): Point => [
    ((lon - bbox.west) / (bbox.east - bbox.west)) * width * cellSizeM,
    ((bbox.north - lat) / (bbox.north - bbox.south)) * height * cellSizeM,
  ]

  const buildings: AreaFeature[] = []
  const areas: AreaFeature[] = []
  const roads: LineFeature[] = []
  const treeRows: LineFeature[] = []
  const trees: Point[] = []

  const addArea = (tags: Record<string, string>, geometry: LatLon[]) => {
    const kind = classifyArea(tags)
    if (!kind) return
    const ring = geometry.map(toPoint)
    const feature = { ring, area: ringArea(ring), ...kind }
    if (kind.surface === 'roof') buildings.push(feature)
    else areas.push(feature)
  }

  for (const element of elements) {
    const tags = element.tags ?? {}
    if (element.type === 'node') {
      if (tags.natural === 'tree' && element.lat !== undefined && element.lon !== undefined) {
        trees.push(toPoint({ lat: element.lat, lon: element.lon }))
      }
    } else if (element.type === 'way' && element.geometry) {
      const isRoadLine =
        tags.highway && tags.area !== 'yes' && !(tags.highway === 'pedestrian' && isClosed(element.geometry))
      if (isRoadLine) {
        const skip =
          tags.tunnel === 'yes' || ['proposed', 'construction', 'corridor'].includes(tags.highway)
        if (!skip) {
          const profile = roadProfile(tags.highway)
          roads.push({
            points: element.geometry.map(toPoint),
            halfWidth: profile.halfWidth,
            surface: surfaceFromTag(tags.surface) ?? profile.surface,
          })
        }
      } else if (tags.natural === 'tree_row') {
        treeRows.push({ points: element.geometry.map(toPoint), halfWidth: TREE_RADIUS, surface: 'tree' })
      } else if (isClosed(element.geometry)) {
        addArea(tags, element.geometry)
      }
    } else if (element.type === 'relation' && tags.type === 'multipolygon') {
      // Vereinfachung: nur geschlossene Außenringe, Löcher (inner) werden ignoriert.
      for (const member of element.members ?? []) {
        if (member.role === 'outer' && member.geometry && isClosed(member.geometry)) {
          addArea(tags, member.geometry)
        }
      }
    }
  }

  // Kleine Flächen sind genauer als große, deshalb werden sie zuerst geprüft.
  // Ein Schulgelände in einem großen Park zählt also als Schulgelände.
  areas.sort((a, b) => a.area - b.area)

  /** Was liegt an einem Punkt? Reihenfolge = Vorrang. */
  const classifyPoint = (x: number, y: number): string => {
    if (buildings.some((building) => insideRing(x, y, building.ring))) return 'roof'
    if (trees.some(([tx, ty]) => (x - tx) ** 2 + (y - ty) ** 2 <= TREE_RADIUS ** 2)) return 'tree'
    if (treeRows.some((row) => nearLine(x, y, row, row.halfWidth))) return 'tree'
    const road = roads.find((line) => nearLine(x, y, line, line.halfWidth))
    if (road) return `${road.surface}|street`
    const area = areas.find((candidate) => insideRing(x, y, candidate.ring))
    if (area) return area.guessed ? `${area.surface}|guessed` : area.surface
    return 'grass|guessed'
  }

  let guessedCells = 0
  const cells: GridCell[] = []
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const counts = new Map<string, number>()
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const key = classifyPoint(
            (column + (sx + 0.5) / SAMPLES) * cellSizeM,
            (row + (sy + 0.5) / SAMPLES) * cellSizeM,
          )
          counts.set(key, (counts.get(key) ?? 0) + 1)
        }
      }

      const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1])
      const total = SAMPLES * SAMPLES
      // Schmale Straßen und einzelne Bäume sollen nicht verschwinden, nur weil sie
      // keine Mehrheit haben. Gebäude behalten trotzdem Vorrang.
      const street = ranked.find(([key, count]) => key.endsWith('|street') && count / total >= STREET_SHARE)
      const tree = ranked.find(([key, count]) => key === 'tree' && count / total >= TREE_SHARE)
      const [winner] = ranked[0][0] === 'roof' ? ranked[0] : (street ?? tree ?? ranked[0])
      const [surface, flag] = winner.split('|') as [SurfaceType, string | undefined]

      if (flag === 'guessed') guessedCells++
      cells.push(flag === 'street' ? { surface, mist: false, street: true } : { surface, mist: false })
    }
  }

  return {
    grid: { width, height, cellSizeM, cells },
    guessedShare: guessedCells / cells.length,
  }
}
