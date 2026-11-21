/**
 * Anbindung an freie Kartendienste: Ortssuche, OpenStreetMap-Daten, Luftbilder.
 *
 * Alle drei Dienste sind kostenlos und brauchen keinen Schlüssel. Sie haben
 * aber Nutzungsregeln: Wir fragen nur auf Knopfdruck an, nie automatisch.
 */

import type { CityGrid } from '../model/grid.ts'
import type { BBox, CellSource, OsmElement } from '../model/osm.ts'

/** Ein aus echten Daten geladener Ausschnitt. */
export interface Place {
  /** Kennung der fest eingebauten Beispielorte. */
  id?: string
  name: string
  bbox: BBox
  grid: CityGrid
  /** Anteil der Zellen, deren Oberfläche nur geschätzt ist (0–1). */
  guessedShare: number
  /** Adresse des Luftbilds für genau diesen Ausschnitt. */
  imageUrl: string
  /** Quellenvermerk des Luftbilds. */
  imageAttribution: string
  /** Grundlagen der Bilderkennung; fehlt, wenn kein auswertbares Luftbild geladen wurde. */
  recognition?: RecognitionInput
  /** Hinweis, falls etwas nicht geklappt hat (z. B. Luftbild nicht erreichbar). */
  notice?: string
}

/** Was die Bilderkennung braucht, um mit Beispielpunkten neu zu rechnen. */
export interface RecognitionInput {
  /** Raster aus OpenStreetMap in derselben Auflösung. */
  prior: CityGrid
  sources: CellSource[]
  /** Merkmale je Zelle aus dem Luftbild. */
  features: Float32Array
}

/* ---------- Ortssuche (Nominatim, OpenStreetMap) ---------- */

export interface PlaceHit {
  name: string
  lat: number
  lon: number
}

/** Sucht Orte und Adressen in Deutschland. */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceHit[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('countrycodes', 'de')
  url.searchParams.set('limit', '5')
  url.searchParams.set('q', query)
  const response = await fetch(url, { signal, headers: { 'Accept-Language': 'de' } })
  if (!response.ok) throw new Error(`Ortssuche antwortet mit Fehler ${response.status}.`)
  const hits = (await response.json()) as { display_name: string; lat: string; lon: string }[]
  return hits.map((hit) => ({
    name: hit.display_name,
    lat: Number(hit.lat),
    lon: Number(hit.lon),
  }))
}

/* ---------- Kartendaten (Overpass, OpenStreetMap) ---------- */

/** Mehrere Server: Antwortet einer nicht, springt der nächste ein. */
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]
/** Die öffentlichen Server sind oft ausgelastet. So lange warten wir je Server. */
const OVERPASS_TIMEOUT_MS = 60_000
/** Nach dieser Zeit ohne Antwort wird zusätzlich der nächste Server gefragt. */
const OVERPASS_STAGGER_MS = 8_000
const CACHE_PREFIX = 'osm:'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function queryEndpoint(endpoint: string, query: string, signal: AbortSignal) {
  const response = await fetch(endpoint, {
    method: 'POST',
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(OVERPASS_TIMEOUT_MS)]),
  })
  if (!response.ok) throw new Error(`Fehler ${response.status}`)
  const data = (await response.json()) as { elements: OsmElement[] }
  return data.elements
}

/**
 * Lädt alle Wege, Flächen und Bäume im Ausschnitt samt Geometrie.
 *
 * Einmal geladene Ausschnitte werden im Browser gespeichert. Derselbe Ort
 * ist danach sofort da, auch ohne Internet.
 */
export async function fetchOsm(bbox: BBox): Promise<OsmElement[]> {
  const box = [bbox.south, bbox.west, bbox.north, bbox.east].map((v) => v.toFixed(6)).join(',')
  const cacheKey = CACHE_PREFIX + box
  try {
    const cached = localStorage.getItem(cacheKey)
    if (cached) return JSON.parse(cached) as OsmElement[]
  } catch {
    // Speicher nicht verfügbar oder Eintrag beschädigt: einfach neu laden.
  }

  const query = `[out:json][timeout:25];
(
  way(${box});
  relation["type"="multipolygon"](${box});
  node["natural"="tree"](${box});
);
out geom;`

  // Die Server werden zeitversetzt gefragt; die erste gültige Antwort gewinnt.
  const abort = new AbortController()
  try {
    const elements = await Promise.any(
      OVERPASS_ENDPOINTS.map(async (endpoint, index) => {
        await wait(index * OVERPASS_STAGGER_MS)
        if (abort.signal.aborted) throw new Error('nicht mehr nötig')
        return queryEndpoint(endpoint, query, abort.signal)
      }),
    )
    try {
      localStorage.setItem(cacheKey, JSON.stringify(elements))
    } catch {
      // Speicher voll: Der Ausschnitt funktioniert trotzdem, nur ohne Zwischenspeicher.
    }
    return elements
  } catch {
    throw new Error(
      'Die OpenStreetMap-Server antworten gerade nicht. Bitte in einer Minute noch einmal versuchen.',
    )
  } finally {
    abort.abort()
  }
}

/* ---------- Luftbilder (Esri World Imagery) ---------- */

const IMAGERY_SERVICE =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'

export const IMAGERY_TILE_URL = `${IMAGERY_SERVICE}/tile/{z}/{y}/{x}`
export const IMAGERY_ATTRIBUTION = 'Luftbild: Esri, Maxar, Earthstar Geographics'
export const OSM_ATTRIBUTION = 'Kartendaten: © OpenStreetMap-Mitwirkende'

const EARTH_RADIUS = 6_378_137

/** Grad → Web-Mercator-Meter (Projektion der Kartenkacheln). */
function toMercator(lat: number, lon: number): [number, number] {
  const x = (EARTH_RADIUS * lon * Math.PI) / 180
  const y = EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
  return [x, y]
}

/** Adresse eines Luftbilds, das genau den Ausschnitt zeigt. */
/** Der Dienst liefert höchstens 1024 Bildpunkte Kantenlänge. Das entspricht etwa 20 cm je Bildpunkt. */
export function aerialImageUrl(bbox: BBox, sizePx = 1024): string {
  const [xMin, yMin] = toMercator(bbox.south, bbox.west)
  const [xMax, yMax] = toMercator(bbox.north, bbox.east)
  const params = new URLSearchParams({
    bbox: `${xMin},${yMin},${xMax},${yMax}`,
    bboxSR: '3857',
    imageSR: '3857',
    size: `${sizePx},${sizePx}`,
    format: 'jpg',
    f: 'image',
  })
  return `${IMAGERY_SERVICE}/export?${params}`
}
