/**
 * Wetterdaten von Open-Meteo (kostenlos, ohne Schlüssel, Lizenz CC BY 4.0).
 * Vorhersage: Modelle der Wetterdienste, u. a. des Deutschen Wetterdienstes.
 * Archiv: Reanalyse-Daten (ERA5), also nachträglich berechnetes Wetter.
 */

import {
  hottestDayIndex,
  observationForDay,
  type DayObservation,
  type OpenMeteoResponse,
} from '../model/observedWeather.ts'

export const WEATHER_ATTRIBUTION = 'Wetterdaten: Open-Meteo.com'

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
