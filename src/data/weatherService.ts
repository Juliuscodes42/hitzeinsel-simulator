/**
 * Wetterdaten von Open-Meteo (kostenlos, ohne Schlüssel, Lizenz CC BY 4.0).
 * Vorhersage: Modelle der Wetterdienste, u. a. des Deutschen Wetterdienstes.
 * Archiv: Reanalyse-Daten (ERA5), also nachträglich berechnetes Wetter.
 */

import { typicalHeatDay, type DailySeries, type HeatDay } from '../model/heatDay.ts'
import {
  hottestDayIndex,
  observationForDay,
  type DayObservation,
  type OpenMeteoResponse,
} from '../model/observedWeather.ts'

export const WEATHER_ATTRIBUTION = 'Wetterdaten: Open-Meteo.com'

/** Standardort, wenn kein echter Ort geladen ist (erfundenes Beispielviertel). */
export const DEFAULT_LOCATION = { name: 'Elmshorn', lat: 53.7536, lon: 9.6526 }

const DAILY = 'temperature_2m_max,temperature_2m_min,shortwave_radiation_sum'
const HOURLY = 'temperature_2m,relative_humidity_2m,wind_speed_10m'

async function request(base: string, params: Record<string, string>): Promise<OpenMeteoResponse> {
  const url = new URL(base)
  for (const [key, value] of Object.entries({
    ...params,
    daily: DAILY,
    hourly: HOURLY,
    timezone: 'auto',
    wind_speed_unit: 'ms',
  })) {
    url.searchParams.set(key, value)
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`Wetterdienst antwortet mit Fehler ${response.status}.`)
  return (await response.json()) as OpenMeteoResponse
}

const coordinates = (lat: number, lon: number) => ({
  latitude: lat.toFixed(4),
  longitude: lon.toFixed(4),
})

/** Das Wetter von heute (Vorhersage für den ganzen Tag). */
export async function fetchToday(lat: number, lon: number): Promise<DayObservation> {
  const response = await request('https://api.open-meteo.com/v1/forecast', {
    ...coordinates(lat, lon),
    forecast_days: '1',
  })
  return observationForDay(response, 0)
}

/** Der Sommer, für den schon vollständige Daten vorliegen. */
export function lastCompleteSummer(today = new Date()): number {
  return today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1
}

/** Der heißeste Tag zwischen 1. Juni und 31. August eines Jahres an diesem Ort. */
export async function fetchHottestSummerDay(
  lat: number,
  lon: number,
  year: number,
): Promise<DayObservation> {
  const response = await request('https://archive-api.open-meteo.com/v1/archive', {
    ...coordinates(lat, lon),
    start_date: `${year}-06-01`,
    end_date: `${year}-08-31`,
  })
  return observationForDay(response, hottestDayIndex(response))
}

/* ---------- Typischer Hitzetag ---------- */

/** So viele Sommer fließen in den typischen Hitzetag ein. */
export const HEAT_DAY_YEARS = 10

const HEAT_DAY_DAILY = [
  'temperature_2m_max',
  'temperature_2m_min',
  'shortwave_radiation_sum',
  'wind_speed_10m_mean',
  'relative_humidity_2m_min',
].join(',')

/** Schlüssel für gespeicherte Hitzetage: Koordinaten auf etwa 100 m gerundet. */
export const heatDayKey = (lat: number, lon: number, lastSummer: number): string =>
  `${lat.toFixed(3)},${lon.toFixed(3)},${lastSummer}`

/**
 * Typischer Hitzetag aus den letzten zehn Sommern (Open-Meteo-Archiv, ERA5).
 * Das Ergebnis wird auf dem Gerät gespeichert, weil es sich nur einmal im Jahr ändert.
 */
export async function fetchTypicalHeatDay(
  lat: number,
  lon: number,
  lastSummer = lastCompleteSummer(),
): Promise<HeatDay> {
  const key = `hitzetag:${heatDayKey(lat, lon, lastSummer)}`
  try {
    const cached = globalThis.localStorage?.getItem(key)
    if (cached) return JSON.parse(cached) as HeatDay
  } catch {
    // Speicher nicht verfügbar: einfach neu laden.
  }

  const url = new URL('https://archive-api.open-meteo.com/v1/archive')
  for (const [name, value] of Object.entries({
    ...coordinates(lat, lon),
    start_date: `${lastSummer - HEAT_DAY_YEARS + 1}-06-01`,
    end_date: `${lastSummer}-08-31`,
    daily: HEAT_DAY_DAILY,
    timezone: 'auto',
    wind_speed_unit: 'ms',
  })) {
    url.searchParams.set(name, value)
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`Wetterdienst antwortet mit Fehler ${response.status}.`)
  const { daily } = (await response.json()) as { daily: DailySeries }
  const heatDay = typicalHeatDay(daily, lat)

  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(heatDay))
  } catch {
    // Speicher voll oder gesperrt: nicht schlimm.
  }
  return heatDay
}
