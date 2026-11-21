/**
 * Typischer Hitzetag eines Orts.
 *
 * Aus jedem der letzten Sommer (Juni bis August) werden die heißesten Tage
 * genommen, standardmäßig drei pro Jahr. Der typische Hitzetag ist der
 * Mittelwert dieser Tage. Das ist weniger zufällig als ein einzelner
 * Rekordtag und lässt Orte fair miteinander vergleichen.
 */

import type { Weather } from './atmosphere.ts'
import { WEATHER_LIMITS, dayOfYear, extraterrestrialDailySumMJ } from './observedWeather.ts'

/** Tageswerte von Open-Meteo, wie sie für den Hitzetag abgefragt werden. */
export interface DailySeries {
  time: string[]
  temperature_2m_max: (number | null)[]
  temperature_2m_min: (number | null)[]
  shortwave_radiation_sum: (number | null)[]
  wind_speed_10m_mean: (number | null)[]
  /** Kleinste Luftfeuchte des Tages, ungefähr die Feuchte zur wärmsten Stunde. */
  relative_humidity_2m_min: (number | null)[]
}

export interface HeatDay {
  weather: Weather
  /** Erstes und letztes Jahr, aus denen Tage stammen. */
  firstYear: number
  lastYear: number
  /** Anzahl der gemittelten Tage. */
  dayCount: number
}

interface Day {
  date: string
  tMax: number
  tMin: number
  radiation: number
  wind: number
  humidity: number
}

const clamp = (value: number, { min, max }: { min: number; max: number }): number =>
  Math.min(max, Math.max(min, value))

const mean = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length

/** Mittelt die heißesten Tage jedes Sommers zu einem typischen Hitzetag. */
export function typicalHeatDay(daily: DailySeries, latitudeDeg: number, perYear = 3): HeatDay {
  const byYear = new Map<number, Day[]>()
  daily.time.forEach((date, i) => {
    const month = Number(date.slice(5, 7))
    if (month < 6 || month > 8) return
    const values = [
      daily.temperature_2m_max[i],
      daily.temperature_2m_min[i],
      daily.shortwave_radiation_sum[i],
      daily.wind_speed_10m_mean[i],
      daily.relative_humidity_2m_min[i],
    ]
    if (values.some((value) => value === null)) return
    const [tMax, tMin, radiation, wind, humidity] = values as number[]
    const year = Number(date.slice(0, 4))
    byYear.set(year, [...(byYear.get(year) ?? []), { date, tMax, tMin, radiation, wind, humidity }])
  })

  const selected = [...byYear.values()].flatMap((days) =>
    [...days].sort((a, b) => b.tMax - a.tMax).slice(0, perYear),
  )
  if (selected.length === 0) throw new Error('Für diesen Ort liegen keine Sommerdaten vor.')

  const years = [...byYear.keys()]
  const tMaxC = clamp(mean(selected.map((day) => day.tMax)), WEATHER_LIMITS.tMaxC)
  // Durchlässigkeit für jeden Tag einzeln, weil sich der Sonnenstand im Sommer ändert.
  const transmissivity = mean(
    selected.map(
      (day) => day.radiation / extraterrestrialDailySumMJ(latitudeDeg, dayOfYear(day.date)),
    ),
  )

  return {
    weather: {
      latitudeDeg,
      dayOfYear: Math.round(mean(selected.map((day) => dayOfYear(day.date)))),
      transmissivity: clamp(transmissivity, WEATHER_LIMITS.transmissivity),
      tMaxC: Math.round(tMaxC * 10) / 10,
      tMinC: Math.round(Math.min(mean(selected.map((day) => day.tMin)), tMaxC - 1) * 10) / 10,
      windSpeed: clamp(
        Math.round(mean(selected.map((day) => day.wind)) * 2) / 2,
        WEATHER_LIMITS.windSpeed,
      ),
      relHumidityAtMax: mean(selected.map((day) => day.humidity)) / 100,
    },
    firstYear: Math.min(...years),
    lastYear: Math.max(...years),
    dayCount: selected.length,
  }
}
