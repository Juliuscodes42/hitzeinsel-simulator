/**
 * Setzt für jede Landsat-Aufnahme der Beispielorte die Durchlässigkeit τ
 * aus der Sonne der Morgenstunden bis zum Überflug (statt aus dem Tagesmittel).
 *
 * Grund: Landsat misst nur bei klarem Himmel am Vormittag. Zieht es am
 * Nachmittag zu, ist das Tagesmittel zu niedrig und das Modell rechnet den
 * Vormittag zu kalt (Beispiel: Köln, 09.07.2023, τ 0,46 statt 0,61).
 *
 * Der Tageswert bleibt als dailyTransmissivity erhalten, damit der Vergleich
 * nachvollziehbar ist.
 *
 * Aufruf (im Projektordner, nach scripts/build-places.ts):  node scripts/update-scene-sun.ts
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { morningTransmissivity } from '../src/model/observedWeather.ts'

const path = new URL('../src/data/examplePlaces.json', import.meta.url)
const data = JSON.parse(readFileSync(path, 'utf8'))

for (const place of data.places) {
  for (const scene of place.scenes) {
    const url = new URL('https://archive-api.open-meteo.com/v1/archive')
    url.search = new URLSearchParams({
      latitude: place.lat.toFixed(4),
      longitude: place.lon.toFixed(4),
      start_date: scene.date,
      end_date: scene.date,
      hourly: 'shortwave_radiation',
      timezone: 'GMT',
    }).toString()
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) })
    if (!response.ok) throw new Error(`Open-Meteo: ${response.status}`)
    const hourly = ((await response.json()) as { hourly: { shortwave_radiation: number[] } }).hourly
      .shortwave_radiation
    const [hh, mm] = scene.timeUtc.split(':').map(Number)
    const daily = scene.dailyTransmissivity ?? scene.weather.transmissivity
    const morning = morningTransmissivity(
      hourly,
      hh + mm / 60,
      scene.weather.latitudeDeg,
      scene.weather.dayOfYear,
      place.lon,
    )
    scene.dailyTransmissivity = daily
    scene.weather.transmissivity = Number(morning.toFixed(3))
    console.log(`${place.name}, ${scene.date}: Tag ${daily.toFixed(2)} → Morgen ${morning.toFixed(2)}`)
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
}

writeFileSync(path, JSON.stringify(data, null, 1) + '\n')
console.log('Gespeichert: src/data/examplePlaces.json')
