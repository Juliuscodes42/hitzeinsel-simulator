/**
 * Erzeugt die fest eingebauten Beispielorte (src/data/examplePlaces.json).
 *
 * Für jeden Ort werden einmalig geholt und gespeichert:
 *   1. das Raster aus OpenStreetMap,
 *   2. wolkenfreie Landsat-Aufnahmen heißer Sommertage mit der gemessenen
 *      Oberflächentemperatur (Landsat Collection 2 Level-2, Band ST_B10),
 *   3. das Wetter dieser Tage von Open-Meteo.
 *
 * Damit laufen die Beispielorte ohne Internet, und die App kann ihr Modell
 * mit echten Satellitenmessungen vergleichen.
 *
 * Aufruf:  node scripts/build-places.ts
 */

import { writeFileSync } from 'node:fs'
import { fromUrl } from 'geotiff'
import proj4 from 'proj4'
import {
  observationForDay,
  weatherFromObservation,
  type OpenMeteoResponse,
} from '../src/model/observedWeather.ts'
import { rasterizeOsm, squareAround, type BBox, type OsmElement } from '../src/model/osm.ts'

const PLACES = [
  { id: 'ebs-elmshorn', name: 'Elsa-Brändström-Schule, Elmshorn', query: 'Elsa-Brändström-Schule, Elmshorn' },
  { id: 'koeln-neumarkt', name: 'Neumarkt, Köln', query: 'Neumarkt, Köln' },
  { id: 'berlin-potsdamer-platz', name: 'Potsdamer Platz, Berlin', query: 'Potsdamer Platz, Berlin' },
  { id: 'freiburg-vauban', name: 'Vauban, Freiburg', query: 'Vaubanallee, Freiburg im Breisgau' },
]

const AREA_SIZE_M = 200
const SCENES_PER_PLACE = 3
const YEARS = [2026, 2025, 2024, 2023]
const HEADERS = { 'User-Agent': 'hitzeinsel-simulator-schulprojekt/1.0' }

async function getJson<T>(url: string | URL, init: RequestInit = {}): Promise<T> {
  let response: Response
  for (let attempt = 0; ; attempt++) {
    response = await fetch(url, {
      ...init,
      headers: { ...HEADERS, ...init.headers },
      signal: AbortSignal.timeout(120_000),
    })
    // Bei "zu viele Anfragen" kurz warten und es noch einmal versuchen.
    if (response.status !== 429 || attempt >= 4) break
    await new Promise((resolve) => setTimeout(resolve, 15_000 * (attempt + 1)))
  }
  if (!response.ok) throw new Error(`${response.status} bei ${String(url).slice(0, 80)}`)
  return (await response.json()) as T
}

/* ---------- 1. Ort und OpenStreetMap ---------- */

async function geocode(query: string): Promise<{ lat: number; lon: number }> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.search = new URLSearchParams({ format: 'jsonv2', countrycodes: 'de', limit: '1', q: query }).toString()
  const [hit] = await getJson<{ lat: string; lon: string }[]>(url)
  if (!hit) throw new Error(`Ort nicht gefunden: ${query}`)
  return { lat: Number(hit.lat), lon: Number(hit.lon) }
}

async function fetchOsm(bbox: BBox): Promise<OsmElement[]> {
  const box = [bbox.south, bbox.west, bbox.north, bbox.east].map((v) => v.toFixed(6)).join(',')
  const query = `[out:json][timeout:60];(way(${box});relation["type"="multipolygon"](${box});node["natural"="tree"](${box}););out geom;`
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ]
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const data = await getJson<{ elements: OsmElement[] }>(endpoints[attempt % endpoints.length], {
        method: 'POST',
        body: new URLSearchParams({ data: query }),
      })
      return data.elements
    } catch (error) {
      console.log(`   Overpass-Versuch ${attempt + 1} fehlgeschlagen: ${String(error).slice(0, 80)}`)
    }
  }
  throw new Error('OpenStreetMap-Daten nicht erreichbar')
}

/* ---------- 2. Landsat ---------- */

interface StacItem {
  id: string
  properties: { datetime: string; 'proj:epsg'?: number; 'proj:code'?: string }
  assets: Record<string, { href: string }>
}

const STAC = 'https://planetarycomputer.microsoft.com/api'

async function searchScenes(lat: number, lon: number, year: number): Promise<StacItem[]> {
  const result = await getJson<{ features: StacItem[] }>(`${STAC}/stac/v1/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      collections: ['landsat-c2-l2'],
      intersects: { type: 'Point', coordinates: [lon, lat] },
      datetime: `${year}-06-01/${year}-08-31`,
      query: { 'eo:cloud_cover': { lt: 20 }, platform: { in: ['landsat-8', 'landsat-9'] } },
      limit: 50,
    }),
  })
  return result.features
}

// Ein Zugriffsschlüssel für die ganze Landsat-Sammlung, einmal geholt und wiederverwendet.
let sasToken: string | undefined
const sign = async (href: string): Promise<string> => {
  sasToken ??= (await getJson<{ token: string }>(`${STAC}/sas/v1/token/landsat-c2-l2`)).token
  return `${href}?${sasToken}`
}

/** Liest die Bildpunkte einer Landsat-Datei im Ausschnitt, mit der Lage jedes Punkts (0–1). */
async function readWindow(href: string, bbox: BBox, epsg: number) {
  const zone = epsg - 32600
  const toUtm = proj4('EPSG:4326', `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs`)
  const [xMin, yMin] = toUtm.forward([bbox.west, bbox.south])
  const [xMax, yMax] = toUtm.forward([bbox.east, bbox.north])

  const image = await (await fromUrl(await sign(href))).getImage()
  const [originX, originY] = image.getOrigin()
  const [resX, resY] = image.getResolution() // resY ist negativ: Zeilen laufen nach Süden
  const window = [
    Math.floor((xMin - originX) / resX),
    Math.floor((yMax - originY) / resY),
    Math.ceil((xMax - originX) / resX),
    Math.ceil((yMin - originY) / resY),
  ]
  const [values] = (await image.readRasters({ window })) as unknown as [ArrayLike<number>]
  const columns = window[2] - window[0]
  return Array.from(values, (value, i) => ({
    value,
    // Lage der Pixelmitte im Ausschnitt: x nach Osten, y nach Süden
    x: (originX + (window[0] + (i % columns) + 0.5) * resX - xMin) / (xMax - xMin),
    y: (yMax - (originY + (window[1] + Math.floor(i / columns) + 0.5) * resY)) / (yMax - yMin),
  }))
}

const mean = (values: number[]): number => values.reduce((sum, v) => sum + v, 0) / values.length
const round = (value: number, digits = 2): number => Number(value.toFixed(digits))

/** Gemessene Oberflächentemperatur im Ausschnitt, oder null bei Wolken bzw. Datenlücken. */
async function landsatTemperature(item: StacItem, bbox: BBox) {
  const epsg = item.properties['proj:epsg'] ?? Number(item.properties['proj:code']?.split(':')[1])
  const quality = await readWindow(item.assets.qa_pixel.href, bbox, epsg)
  // QA_PIXEL: Bit 1 = erweiterte Wolke, 2 = Zirrus, 3 = Wolke, 4 = Wolkenschatten
  if (quality.some((pixel) => (pixel.value & 0b11110) !== 0)) return null

  const pixels = (await readWindow(item.assets.lwir11.href, bbox, epsg)).filter(
    (pixel) => pixel.x >= 0 && pixel.x <= 1 && pixel.y >= 0 && pixel.y <= 1,
  )
  if (pixels.length === 0 || pixels.some((pixel) => pixel.value === 0)) return null
  // Umrechnung laut USGS: Kelvin = Zahlenwert · 0,00341802 + 149
  const celsius = (value: number) => value * 0.00341802 + 149 - 273.15
  const quadrant = (east: boolean, south: boolean) =>
    round(mean(pixels.filter((p) => p.x >= 0.5 === east && p.y >= 0.5 === south).map((p) => celsius(p.value))))

  return {
    meanC: round(mean(pixels.map((pixel) => celsius(pixel.value)))),
    // Reihenfolge: Nordwest, Nordost, Südwest, Südost
    quadrantsC: [quadrant(false, false), quadrant(true, false), quadrant(false, true), quadrant(true, true)],
    pixelCount: pixels.length,
  }
}

/* ---------- 3. Wetter ---------- */

async function summerWeather(lat: number, lon: number, year: number): Promise<OpenMeteoResponse> {
  const url = new URL('https://archive-api.open-meteo.com/v1/archive')
  url.search = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    start_date: `${year}-06-01`,
    end_date: `${year}-08-31`,
    daily: 'temperature_2m_max,temperature_2m_min,shortwave_radiation_sum',
    hourly: 'temperature_2m,relative_humidity_2m,wind_speed_10m',
    timezone: 'auto',
    wind_speed_unit: 'ms',
  }).toString()
  return getJson<OpenMeteoResponse>(url)
}

/* ---------- Ablauf ---------- */

const output = []
for (const place of PLACES) {
  console.log(`\n${place.name}`)
  const { lat, lon } = await geocode(place.query)
  const bbox = squareAround(lat, lon, AREA_SIZE_M)
  console.log(`   Mittelpunkt ${lat.toFixed(5)}, ${lon.toFixed(5)}`)

  const { grid, guessedShare } = rasterizeOsm(await fetchOsm(bbox), bbox)
  console.log(`   Raster: ${Math.round(guessedShare * 100)} % geschätzt`)

  // Kandidaten: wolkenarme Sommer-Aufnahmen, die heißesten Tage zuerst.
  const candidates = []
  for (const year of YEARS) {
    const items = await searchScenes(lat, lon, year)
    if (items.length === 0) continue
    const weather = await summerWeather(lat, lon, year)
    for (const item of items) {
      const date = item.properties.datetime.slice(0, 10)
      const dayIndex = weather.daily.time.indexOf(date)
      if (dayIndex === -1) continue
      try {
        candidates.push({ item, observation: observationForDay(weather, dayIndex) })
      } catch {
        // Wetterdaten für diesen Tag unvollständig
      }
    }
  }
  candidates.sort((a, b) => b.observation.tMaxC - a.observation.tMaxC)

  const scenes = []
  const usedDates = new Set<string>()
  for (const { item, observation } of candidates) {
    if (scenes.length >= SCENES_PER_PLACE) break
    if (usedDates.has(observation.date)) continue
    const measured = await landsatTemperature(item, bbox)
    if (!measured) {
      console.log(`   ${observation.date}: Wolken oder Lücke, übersprungen`)
      continue
    }
    usedDates.add(observation.date)
    const time = new Date(item.properties.datetime)
    const utcHour = time.getUTCHours() + time.getUTCMinutes() / 60
    scenes.push({
      sceneId: item.id,
      date: observation.date,
      timeUtc: item.properties.datetime.slice(11, 16),
      // Wahre Sonnenzeit am Ort: 15 Längengrade = 1 Stunde
      solarHour: round(utcHour + lon / 15),
      landsatMeanC: measured.meanC,
      landsatQuadrantsC: measured.quadrantsC,
      pixelCount: measured.pixelCount,
      weather: weatherFromObservation(observation, lat),
    })
    console.log(`   ${observation.date}: Landsat ${measured.meanC} °C, Luft max. ${observation.tMaxC} °C`)
  }

  output.push({
    id: place.id,
    name: place.name,
    lat: round(lat, 6),
    lon: round(lon, 6),
    bbox,
    guessedShare: round(guessedShare, 3),
    surfaces: grid.cells.map((cell) => cell.surface),
    streets: grid.cells.flatMap((cell, index) => (cell.street ? [index] : [])),
    scenes,
  })
}

writeFileSync(
  new URL('../src/data/examplePlaces.json', import.meta.url),
  JSON.stringify({ generated: new Date().toISOString().slice(0, 10), places: output }, null, 1) + '\n',
)
console.log('\nGeschrieben: src/data/examplePlaces.json')
