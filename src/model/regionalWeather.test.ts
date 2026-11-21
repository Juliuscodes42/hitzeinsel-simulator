import proj4 from 'proj4'
import { describe, expect, test } from 'vitest'
import kostra from '../data/kostra.json' with { type: 'json' }
import { typicalHeatDay, type DailySeries } from './heatDay.ts'
import { heavyRainMm, toLaea, type KostraGrid } from './heavyRain.ts'

const LAEA =
  '+proj=laea +lat_0=52 +lon_0=10 +x_0=4321000 +y_0=3210000 +ellps=GRS80 +units=m +no_defs'

describe('Umrechnung in ETRS89-LAEA', () => {
  test.each([
    [53.7579, 9.6736], // Elmshorn
    [47.98, 7.83], // Freiburg
    [54.8, 13.4], // Rügen
    [52, 10], // Ursprung der Projektion
  ])('stimmt bei %f° N, %f° O mit proj4 überein', (lat, lon) => {
    const [x, y] = proj4('WGS84', LAEA, [lon, lat])
    const own = toLaea(lat, lon)
    expect(own.x).toBeCloseTo(x, 2)
    expect(own.y).toBeCloseTo(y, 2)
  })
})

describe('Starkregen aus KOSTRA', () => {
  const grid = kostra as KostraGrid

  test('Elmshorn hat Werte, und seltenere Regen sind stärker', () => {
    const t5 = heavyRainMm(grid, 53.7579, 9.6736, 5)!
    const t30 = heavyRainMm(grid, 53.7579, 9.6736, 30)!
    const t100 = heavyRainMm(grid, 53.7579, 9.6736, 100)!
    expect(t5).toBeGreaterThan(15)
    expect(t30).toBeGreaterThan(t5)
    expect(t100).toBeGreaterThan(t30)
    expect(t100).toBeLessThan(70)
  })

  test('außerhalb Deutschlands gibt es keinen Wert', () => {
    expect(heavyRainMm(grid, 48.8566, 2.3522, 30)).toBeUndefined() // Paris
  })
})

/** Zwei Sommer mit gleichmäßig steigender Temperatur, Mai und September dazwischen. */
function series(): DailySeries {
  const daily: DailySeries = {
    time: [],
    temperature_2m_max: [],
    temperature_2m_min: [],
    shortwave_radiation_sum: [],
    wind_speed_10m_mean: [],
    relative_humidity_2m_min: [],
  }
  for (const year of [2024, 2025]) {
    for (const [month, days] of [[5, 31], [6, 30], [7, 31], [8, 31], [9, 30]] as const) {
      for (let day = 1; day <= days; day++) {
        daily.time.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
        // Im Mai und September absichtlich sehr heiß: darf nicht zählen.
        const hot = month === 5 || month === 9 ? 40 : 20 + day / 10 + (month === 7 ? 5 : 0)
        daily.temperature_2m_max.push(hot)
        daily.temperature_2m_min.push(hot - 12)
        daily.shortwave_radiation_sum.push(25)
        daily.wind_speed_10m_mean.push(3)
        daily.relative_humidity_2m_min.push(40)
      }
    }
  }
  return daily
}

describe('Typischer Hitzetag', () => {
  test('mittelt die drei heißesten Sommertage jedes Jahres', () => {
    const heatDay = typicalHeatDay(series(), 53.75)
    // Heißeste Tage: 31., 30. und 29. Juli → 28,1 / 28,0 / 27,9 °C
    expect(heatDay.weather.tMaxC).toBeCloseTo(28, 5)
    expect(heatDay.weather.tMinC).toBeCloseTo(16, 5)
    expect(heatDay.dayCount).toBe(6)
    expect(heatDay.firstYear).toBe(2024)
    expect(heatDay.lastYear).toBe(2025)
    // 29.–31. Juli: Tage 211–213 im Schaltjahr 2024, 210–212 in 2025 → Mittel 211,5
    expect(heatDay.weather.dayOfYear).toBe(212)
    expect(heatDay.weather.windSpeed).toBe(3)
    expect(heatDay.weather.relHumidityAtMax).toBeCloseTo(0.4, 5)
  })

  test('Tage ohne Daten werden übersprungen', () => {
    const daily = series()
    const index = daily.time.indexOf('2025-07-31')
    daily.temperature_2m_max[index] = null
    expect(typicalHeatDay(daily, 53.75).dayCount).toBe(6)
  })

  test('ohne Sommerdaten gibt es eine verständliche Meldung', () => {
    expect(() =>
      typicalHeatDay(
        {
          time: [],
          temperature_2m_max: [],
          temperature_2m_min: [],
          shortwave_radiation_sum: [],
          wind_speed_10m_mean: [],
          relative_humidity_2m_min: [],
        },
        53.75,
      ),
    ).toThrow(/keine Sommerdaten/)
  })
})
