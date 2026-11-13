import { describe, expect, test } from 'vitest'
import {
  dayOfYear,
  extraterrestrialDailySumMJ,
  hottestDayIndex,
  observationForDay,
  weatherFromObservation,
  type DayObservation,
  type OpenMeteoResponse,
} from './observedWeather.ts'

const hotDay: DayObservation = {
  date: '2026-07-20',
  tMaxC: 33.4,
  tMinC: 18.2,
  radiationSumMJ: 27,
  hourlyTempC: Array.from({ length: 24 }, (_, h) => 26 - 7 * Math.cos(((h - 3) * Math.PI) / 12)),
  hourlyHumidity: Array.from({ length: 24 }, (_, h) => (h === 15 ? 35 : 60)),
  hourlyWindMs: Array.from({ length: 24 }, () => 3.2),
}

describe('Datum und Sonne', () => {
  test('Tag im Jahr', () => {
    expect(dayOfYear('2026-01-01')).toBe(1)
    expect(dayOfYear('2026-07-20')).toBe(201)
    expect(dayOfYear('2026-12-31')).toBe(365)
  })

  test('im Sommer kommt in Norddeutschland viel mehr Sonnenenergie an als im Winter', () => {
    const summer = extraterrestrialDailySumMJ(53.75, 172)
    const winter = extraterrestrialDailySumMJ(53.75, 355)
    // Literaturwerte für 54° N: etwa 41 MJ/m² im Juni und 6 MJ/m² im Dezember.
    expect(summer).toBeGreaterThan(38)
    expect(summer).toBeLessThan(44)
    expect(winter).toBeGreaterThan(4)
    expect(winter).toBeLessThan(8)
  })
})

describe('Wetterdaten → Modellgrößen', () => {
  const weather = weatherFromObservation(hotDay, 53.75)

  test('Temperaturen, Datum und Breite werden übernommen', () => {
    expect(weather.tMaxC).toBe(33.4)
    expect(weather.tMinC).toBe(18.2)
    expect(weather.dayOfYear).toBe(201)
    expect(weather.latitudeDeg).toBe(53.75)
  })

  test('ein klarer Sommertag ergibt eine Durchlässigkeit um 0,7', () => {
    expect(weather.transmissivity).toBeGreaterThan(0.6)
    expect(weather.transmissivity).toBeLessThan(0.8)
  })

  test('ein trüber Tag ergibt eine niedrige Durchlässigkeit', () => {
    const dull = weatherFromObservation({ ...hotDay, radiationSumMJ: 6 }, 53.75)
    expect(dull.transmissivity).toBeLessThan(0.2)
  })

  test('Wind wird gemittelt, Luftfeuchte zur wärmsten Stunde abgelesen', () => {
    expect(weather.windSpeed).toBe(3)
    expect(weather.relHumidityAtMax).toBeCloseTo(0.35, 5)
  })

  test('Werte außerhalb der Regler werden begrenzt', () => {
    const storm = weatherFromObservation(
      { ...hotDay, hourlyWindMs: hotDay.hourlyWindMs.map(() => 25), radiationSumMJ: 60 },
      53.75,
    )
    expect(storm.windSpeed).toBe(10)
    expect(storm.transmissivity).toBe(0.8)
  })
})

describe('Antwort von Open-Meteo', () => {
  const response: OpenMeteoResponse = {
    daily: {
      time: ['2026-07-19', '2026-07-20', '2026-07-21'],
      temperature_2m_max: [25, 33.4, null],
      temperature_2m_min: [14, 18.2, null],
      shortwave_radiation_sum: [20, 27, null],
    },
    hourly: {
      temperature_2m: [...Array(24).fill(20), ...hotDay.hourlyTempC, ...Array(24).fill(null)],
      relative_humidity_2m: [...Array(24).fill(50), ...hotDay.hourlyHumidity, ...Array(24).fill(null)],
      wind_speed_10m: [...Array(24).fill(2), ...hotDay.hourlyWindMs, ...Array(24).fill(null)],
    },
  }

  test('der heißeste Tag wird gefunden und herausgeschnitten', () => {
    const index = hottestDayIndex(response)
    expect(index).toBe(1)
    expect(observationForDay(response, index)).toEqual(hotDay)
  })

  test('ein Tag mit fehlenden Werten wird abgelehnt', () => {
    expect(() => observationForDay(response, 2)).toThrow()
  })
})
