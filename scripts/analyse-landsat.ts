/**
 * Analyse der Landsat-Aufnahmen der Beispielorte: Wie warm sind grüne und
 * versiegelte Flächen laut Satellit wirklich?
 *
 * Für jede Aufnahme in src/data/examplePlaces.json wird gelesen:
 *  - Oberflächentemperatur (Band ST_B10) und Vegetationsindex NDVI aus den
 *    Reflexionsbändern Rot und Nahinfrarot, für den Ausschnitt (200 m) und
 *    eine Umgebung von 1 km × 1 km
 *  - die Sonnenstrahlung zur Überflugstunde (Open-Meteo, stündlich), um zu
 *    prüfen, ob der Tag zur Überflugzeit klarer war als im Tagesmittel
 *
 * NDVI = (NIR − Rot) / (NIR + Rot): über 0,5 dichte, grüne Pflanzen;
 * 0,2 bis 0,4 trockene oder lichte Vegetation; unter 0,2 versiegelt oder kahl.
 *
 * Aufruf (im Projektordner):  node scripts/analyse-landsat.ts
 */

import { fromUrl } from 'geotiff'
import proj4 from 'proj4'
import raw from '../src/data/examplePlaces.json' with { type: 'json' }
import { airTemperatureC, shortwaveDown } from '../src/model/atmosphere.ts'
import { squareAround, type BBox } from '../src/model/osm.ts'

const STAC = 'https://planetarycomputer.microsoft.com/api'
const HEADERS = { 'User-Agent': 'hitzeinsel-simulator-schulprojekt/1.0' }

async function getJson<T>(url: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(120_000) })
    if (response.status === 429 && attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, 15_000 * (attempt + 1)))
      continue
    }
    if (!response.ok) throw new Error(`${response.status} bei ${url.slice(0, 80)}`)
    return (await response.json()) as T
  }
}

let token: string | undefined
const sign = async (href: string) => {
  token ??= (await getJson<{ token: string }>(`${STAC}/sas/v1/token/landsat-c2-l2`)).token
  return `${href}?${token}`
}

/** Bildpunkte eines Bands im Ausschnitt (Pixelmitten innerhalb der bbox). */
async function readBand(href: string, bbox: BBox, epsg: number): Promise<number[]> {
  const toUtm = proj4('EPSG:4326', `+proj=utm +zone=${epsg - 32600} +datum=WGS84 +units=m +no_defs`)
  const [xMin, yMin] = toUtm.forward([bbox.west, bbox.south])
  const [xMax, yMax] = toUtm.forward([bbox.east, bbox.north])
  const image = await (await fromUrl(await sign(href))).getImage()
  const [originX, originY] = image.getOrigin()
  const [resX, resY] = image.getResolution()
  const window = [
    Math.ceil((xMin - originX) / resX - 0.5),
    Math.ceil((yMax - originY) / resY - 0.5),
    Math.floor((xMax - originX) / resX - 0.5) + 1,
    Math.floor((yMin - originY) / resY - 0.5) + 1,
  ]
  const [values] = (await image.readRasters({ window })) as unknown as [ArrayLike<number>]
  return Array.from(values)
}

const celsius = (value: number) => value * 0.00341802 + 149 - 273.15
const reflectance = (value: number) => value * 0.0000275 - 0.2
const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length
const f1 = (value: number) => (Number.isFinite(value) ? value.toFixed(1) : '–')
const f2 = (value: number) => (Number.isFinite(value) ? value.toFixed(2) : '–')

interface StacItem {
  properties: Record<string, unknown> & { 'proj:epsg'?: number; 'proj:code'?: string }
  assets: Record<string, { href: string }>
}

/** Temperatur und NDVI je Bildpunkt in einem Ausschnitt. */
async function pixels(item: StacItem, bbox: BBox) {
  const epsg = item.properties['proj:epsg'] ?? Number(item.properties['proj:code']?.split(':')[1])
  const [lst, red, nir] = await Promise.all([
    readBand(item.assets.lwir11.href, bbox, epsg),
    readBand(item.assets.red.href, bbox, epsg),
    readBand(item.assets.nir08.href, bbox, epsg),
  ])
  return lst
    .map((value, i) => {
      const r = reflectance(red[i])
      const n = reflectance(nir[i])
      return { lstC: celsius(value), ndvi: (n - r) / (n + r), valid: value > 0 && red[i] > 0 && nir[i] > 0 }
    })
    .filter((pixel) => pixel.valid)
}

/** Stündliche Strahlung am Tag der Aufnahme (Open-Meteo, Archiv). */
async function hourlyRadiation(lat: number, lon: number, date: string) {
  const url = new URL('https://archive-api.open-meteo.com/v1/archive')
  url.search = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    start_date: date,
    end_date: date,
    hourly: 'shortwave_radiation,cloud_cover,temperature_2m',
    timezone: 'GMT',
  }).toString()
  return (await getJson<{ hourly: { shortwave_radiation: number[]; cloud_cover: number[]; temperature_2m: number[] } }>(url.toString())).hourly
}

console.log('Ort | Datum | Landsat 200 m | NDVI 200 m | Umgebung 1 km: grün (NDVI>0,5) / mittel / versiegelt (NDVI<0,2) | Luft gemessen / Modell | Sonne W/m² gemessen / Modell | Wolken %')
for (const place of raw.places) {
  for (const scene of place.scenes) {
    const item = await getJson<StacItem>(`${STAC}/stac/v1/collections/landsat-c2-l2/items/${scene.sceneId}`)
    const local = await pixels(item, place.bbox)
    const context = await pixels(item, squareAround(place.lat, place.lon, 1000))
    const group = (filter: (p: { ndvi: number }) => boolean) => {
      const chosen = context.filter(filter)
      return `${f1(mean(chosen.map((p) => p.lstC)))} (${chosen.length})`
    }
    // Überflugstunde (UTC) und Modellwerte zur wahren Sonnenzeit
    const hour = Number(scene.timeUtc.slice(0, 2))
    const weather = await hourlyRadiation(place.lat, place.lon, scene.date)
    // Open-Meteo-Stundenwerte sind Mittel der vorangehenden Stunde, deshalb hour+1.
    const measuredSun = weather.shortwave_radiation[hour + 1]
    const modelSun = shortwaveDown(scene.weather, scene.solarHour)
    console.log(
      [
        place.id,
        scene.date,
        `${f1(mean(local.map((p) => p.lstC)))} °C`,
        f2(mean(local.map((p) => p.ndvi))),
        `${group((p) => p.ndvi > 0.5)} / ${group((p) => p.ndvi >= 0.2 && p.ndvi <= 0.5)} / ${group((p) => p.ndvi < 0.2)}`,
        `${f1(weather.temperature_2m[hour])} / ${f1(airTemperatureC(scene.weather, scene.solarHour))} °C`,
        `${Math.round(measuredSun)} / ${Math.round(modelSun)}`,
        `${weather.cloud_cover[hour]}`,
      ].join(' | '),
    )
  }
}
