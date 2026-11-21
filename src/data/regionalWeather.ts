/**
 * Wetter, das zur Region passt: typischer Hitzetag und Starkregen (KOSTRA).
 *
 * Für die Beispielorte und den Standardort liegen die Hitzetage fest in der
 * App (exampleHeatDays.json), für alle anderen Orte werden sie bei Open-Meteo
 * abgefragt. Die KOSTRA-Daten werden erst bei Bedarf nachgeladen.
 */

import type { HeatDay } from '../model/heatDay.ts'
import { RETURN_PERIODS, heavyRainMm, type KostraGrid, type ReturnPeriod } from '../model/heavyRain.ts'
import bundled from './exampleHeatDays.json'
import { fetchTypicalHeatDay, heatDayKey, lastCompleteSummer } from './weatherService.ts'

export const KOSTRA_ATTRIBUTION = 'Starkregen: KOSTRA-DWD-2020, Deutscher Wetterdienst (CC BY 4.0)'

export interface RegionalWeather {
  heatDay: HeatDay
  /** Regenhöhe in mm für 60 Minuten je Wiederkehrzeit; leer außerhalb Deutschlands. */
  rainMm: Partial<Record<ReturnPeriod, number>>
}

let kostra: Promise<KostraGrid> | null = null

/** Lädt die KOSTRA-Daten nur einmal und erst, wenn sie gebraucht werden. */
function loadKostra(): Promise<KostraGrid> {
  kostra ??= import('./kostra.json').then((module) => module.default as KostraGrid)
  return kostra
}

/** Typischer Hitzetag: fest eingebaut, falls vorhanden, sonst aus dem Internet. */
async function heatDayFor(lat: number, lon: number): Promise<HeatDay> {
  const summer = lastCompleteSummer()
  // Fest eingebaute Werte gelten auch, wenn sie ein Jahr älter sind.
  for (const year of [summer, summer - 1]) {
    const stored = (bundled.days as Record<string, HeatDay>)[heatDayKey(lat, lon, year)]
    if (stored) return stored
  }
  return fetchTypicalHeatDay(lat, lon, summer)
}

/** Typischer Hitzetag und Starkregen für einen Ort. */
export async function loadRegionalWeather(lat: number, lon: number): Promise<RegionalWeather> {
  const [heatDay, grid] = await Promise.all([heatDayFor(lat, lon), loadKostra()])
  const rainMm: Partial<Record<ReturnPeriod, number>> = {}
  for (const period of RETURN_PERIODS) {
    const mm = heavyRainMm(grid, lat, lon, period)
    if (mm !== undefined) rainMm[period] = mm
  }
  return { heatDay, rainMm }
}
