/**
 * Berechnet den typischen Hitzetag für die Beispielorte und den Standardort
 * Elmshorn vorab, damit sie auch ohne Internet funktionieren.
 *
 * Aufruf (im Projektordner):  node scripts/build-heat-days.ts
 * Ergebnis: src/data/exampleHeatDays.json
 */

import { writeFileSync } from 'node:fs'
import raw from '../src/data/examplePlaces.json' with { type: 'json' }
import {
  DEFAULT_LOCATION,
  fetchTypicalHeatDay,
  heatDayKey,
  lastCompleteSummer,
} from '../src/data/weatherService.ts'

const lastSummer = lastCompleteSummer()
const locations = [
  { name: DEFAULT_LOCATION.name, lat: DEFAULT_LOCATION.lat, lon: DEFAULT_LOCATION.lon },
  ...raw.places.map((place) => ({ name: place.name, lat: place.lat, lon: place.lon })),
]

const days: Record<string, unknown> = {}
for (const location of locations) {
  const heatDay = await fetchTypicalHeatDay(location.lat, location.lon, lastSummer)
  days[heatDayKey(location.lat, location.lon, lastSummer)] = heatDay
  console.log(
    `${location.name}: ${heatDay.weather.tMaxC} °C / ${heatDay.weather.tMinC} °C, ` +
      `Wind ${heatDay.weather.windSpeed} m/s, τ ${heatDay.weather.transmissivity.toFixed(2)}`,
  )
  await new Promise((resolve) => setTimeout(resolve, 1500)) // Dienst nicht überlasten
}

writeFileSync(
  new URL('../src/data/exampleHeatDays.json', import.meta.url),
  JSON.stringify({ generated: new Date().toISOString().slice(0, 10), days }, null, 1) + '\n',
)
console.log('Gespeichert: src/data/exampleHeatDays.json')
