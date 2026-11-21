/**
 * Rechnet gemessene bzw. vorhergesagte Wetterdaten eines Tages in die
 * Größen um, mit denen das Modell arbeitet.
 */

import { sinSolarElevation, type Weather } from './atmosphere.ts'
import { SOLAR_CONSTANT } from './constants.ts'

/** Wetterdaten eines Tages an einem Ort. */
export interface DayObservation {
  /** Datum als JJJJ-MM-TT. */
  date: string
  tMaxC: number
  tMinC: number
  /** Sonnenstrahlung auf waagerechter Fläche, Tagessumme in MJ/m². */
  radiationSumMJ: number
  /** 24 Stundenwerte. */
  hourlyTempC: number[]
  /** Relative Luftfeuchte in Prozent. */
  hourlyHumidity: number[]
  /** Windgeschwindigkeit in 10 m Höhe in m/s. */
  hourlyWindMs: number[]
}

/** Grenzen, innerhalb derer das Modell sinnvoll rechnet (entsprechen den Reglern). */
export const WEATHER_LIMITS = {
  transmissivity: { min: 0.1, max: 0.8 },
  windSpeed: { min: 0, max: 10 },
  tMaxC: { min: -5, max: 42 },
} as const

const clamp = (value: number, { min, max }: { min: number; max: number }): number =>
  Math.min(max, Math.max(min, value))

/** Tag im Jahr (1 = 1. Januar) aus einem Datum JJJJ-MM-TT. */
export function dayOfYear(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / 86_400_000)
}

/**
 * Tagessumme der Sonnenstrahlung in MJ/m², die ohne Atmosphäre am Boden
 * ankäme (Durchlässigkeit τ = 1). Numerisch in 10-Minuten-Schritten summiert.
 */
export function extraterrestrialDailySumMJ(latitudeDeg: number, day: number): number {
  const stepHours = 1 / 6
  let sum = 0
  for (let hour = 0; hour < 24; hour += stepHours) {
    sum += SOLAR_CONSTANT * Math.max(0, sinSolarElevation(latitudeDeg, day, hour)) * stepHours * 3600
  }
  return sum / 1e6
}

/**
 * Leitet die Modellgrößen aus den Wetterdaten ab.
 *
 *  - Durchlässigkeit τ = gemessene Tagessumme / Tagessumme ohne Atmosphäre.
 *    Bewölkung steckt damit automatisch in τ.
 *  - Wind: Tagesmittel der Stundenwerte.
 *  - Luftfeuchte: Wert zur wärmsten Stunde.
 */
export function weatherFromObservation(observation: DayObservation, latitudeDeg: number): Weather {
  const day = dayOfYear(observation.date)
  const meanWind =
    observation.hourlyWindMs.reduce((sum, value) => sum + value, 0) /
    observation.hourlyWindMs.length
  const warmestHour = observation.hourlyTempC.indexOf(Math.max(...observation.hourlyTempC))
  const tMaxC = clamp(observation.tMaxC, WEATHER_LIMITS.tMaxC)

  return {
    latitudeDeg,
    dayOfYear: day,
    transmissivity: clamp(
      observation.radiationSumMJ / extraterrestrialDailySumMJ(latitudeDeg, day),
      WEATHER_LIMITS.transmissivity,
    ),
    tMaxC,
    tMinC: Math.min(observation.tMinC, tMaxC - 1),
    windSpeed: clamp(Math.round(meanWind * 2) / 2, WEATHER_LIMITS.windSpeed),
    relHumidityAtMax: observation.hourlyHumidity[warmestHour] / 100,
  }
}

/** Antwort von Open-Meteo (nur die Felder, die wir abfragen). */
export interface OpenMeteoResponse {
  daily: {
    time: string[]
    temperature_2m_max: (number | null)[]
    temperature_2m_min: (number | null)[]
    shortwave_radiation_sum: (number | null)[]
  }
  hourly: {
    temperature_2m: (number | null)[]
    relative_humidity_2m: (number | null)[]
    wind_speed_10m: (number | null)[]
  }
}

/** Index des Tages mit der höchsten Temperatur. Tage ohne Daten werden übergangen. */
export function hottestDayIndex(response: OpenMeteoResponse): number {
  let best = -1
  response.daily.temperature_2m_max.forEach((tMax, index) => {
    if (tMax === null) return
    if (best === -1 || tMax > (response.daily.temperature_2m_max[best] ?? -Infinity)) best = index
  })
  if (best === -1) throw new Error('Für diesen Zeitraum liegen keine Wetterdaten vor.')
  return best
}

/** Schneidet einen Tag aus der Antwort heraus. */
export function observationForDay(response: OpenMeteoResponse, index: number): DayObservation {
  const hours = <T>(values: (T | null)[]): T[] => {
    const slice = values.slice(index * 24, index * 24 + 24)
    if (slice.length !== 24 || slice.some((value) => value === null)) {
      throw new Error('Die Wetterdaten für diesen Tag sind unvollständig.')
    }
    return slice as T[]
  }
  const tMaxC = response.daily.temperature_2m_max[index]
  const tMinC = response.daily.temperature_2m_min[index]
  const radiationSumMJ = response.daily.shortwave_radiation_sum[index]
  if (tMaxC === null || tMinC === null || radiationSumMJ === null) {
    throw new Error('Die Wetterdaten für diesen Tag sind unvollständig.')
  }
  return {
    date: response.daily.time[index],
    tMaxC,
    tMinC,
    radiationSumMJ,
    hourlyTempC: hours(response.hourly.temperature_2m),
    hourlyHumidity: hours(response.hourly.relative_humidity_2m),
    hourlyWindMs: hours(response.hourly.wind_speed_10m),
  }
}

/**
 * Durchlässigkeit τ aus der Sonnenstrahlung der Morgenstunden bis zu einem
 * Zeitpunkt (z. B. dem Überflug eines Satelliten).
 *
 * Die Oberflächentemperatur am Vormittag hängt von der Sonne am Morgen ab,
 * nicht von Wolken am Nachmittag. Ein Tag, der morgens klar und nachmittags
 * bewölkt ist, hat im Tagesmittel ein zu kleines τ.
 *
 * @param hourlyRadiationUtc 24 Stundenwerte in W/m², Wert i = Mittel der Stunde i−1 bis i (UTC), wie bei Open-Meteo
 * @param untilUtcHour Zeitpunkt in Dezimalstunden UTC
 * @param lonDeg Längengrad, um UTC in wahre Sonnenzeit umzurechnen
 */
export function morningTransmissivity(
  hourlyRadiationUtc: number[],
  untilUtcHour: number,
  latitudeDeg: number,
  day: number,
  lonDeg: number,
): number {
  let measured = 0
  let withoutAtmosphere = 0
  for (let i = 1; i < hourlyRadiationUtc.length; i++) {
    const start = i - 1
    if (start >= untilUtcHour) break
    const share = Math.min(1, untilUtcHour - start)
    measured += hourlyRadiationUtc[i] * share
    // Strahlung ohne Atmosphäre im selben Zeitraum, in 10-Minuten-Schritten gemittelt
    for (let k = 0; k < 6; k++) {
      const solarHour = start + ((k + 0.5) / 6) * share + lonDeg / 15
      withoutAtmosphere +=
        (SOLAR_CONSTANT * Math.max(0, sinSolarElevation(latitudeDeg, day, solarHour)) * share) / 6
    }
  }
  return clamp(withoutAtmosphere > 0 ? measured / withoutAtmosphere : 0, WEATHER_LIMITS.transmissivity)
}
