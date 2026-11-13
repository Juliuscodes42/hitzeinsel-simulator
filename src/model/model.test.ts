/**
 * Tests des Physik-Modells.
 *
 * Sie prüfen drei Dinge:
 *  1. Die Grundformeln liefern bekannte Werte.
 *  2. Die Rechnung ist in sich stimmig (Energie geht nicht verloren).
 *  3. Das Modell verhält sich so, wie man es aus Messungen kennt.
 */

import { describe, expect, test } from 'vitest'
import type { SurfaceType } from '../data/materials.ts'
import {
  DEFAULT_WEATHER,
  airTemperatureC,
  longwaveDown,
  saturationVapourPressure,
  shortwaveDown,
  sinSolarElevation,
  type Weather,
} from './atmosphere.ts'
import {
  OPEN_CONDITIONS,
  computeFluxes,
  heatStorageOf,
  simulateDay,
  surfaceTempAt,
  type CellConditions,
} from './energyBalance.ts'
import { MATERIALS } from '../data/materials.ts'
import {
  createUniformGrid,
  localBuildingDensity,
  simulateGrid,
  summarize,
} from './grid.ts'
import { rainBalance } from './water.ts'

const open = (surface: SurfaceType): CellConditions => ({ ...OPEN_CONDITIONS, surface })
const day = (surface: SurfaceType, weather: Weather = DEFAULT_WEATHER) =>
  simulateDay(open(surface), weather)

describe('Grundformeln', () => {
  test('Sonne steht am Äquator zur Tagundnachtgleiche mittags im Zenit', () => {
    expect(sinSolarElevation(0, 80, 12)).toBeCloseTo(1, 2)
  })

  test('nachts gibt es keine Sonnenstrahlung', () => {
    expect(shortwaveDown(DEFAULT_WEATHER, 0)).toBe(0)
    expect(shortwaveDown(DEFAULT_WEATHER, 12)).toBeGreaterThan(700)
  })

  test('Lufttemperatur erreicht Minimum und Maximum', () => {
    expect(airTemperatureC(DEFAULT_WEATHER, 15)).toBeCloseTo(DEFAULT_WEATHER.tMaxC, 5)
    expect(airTemperatureC(DEFAULT_WEATHER, 3)).toBeCloseTo(DEFAULT_WEATHER.tMinC, 5)
  })

  test('Sättigungsdampfdruck bei 20 °C beträgt etwa 2340 Pa', () => {
    expect(saturationVapourPressure(20)).toBeGreaterThan(2300)
    expect(saturationVapourPressure(20)).toBeLessThan(2380)
  })

  test('Gegenstrahlung der Atmosphäre liegt im Sommer bei 300–450 W/m²', () => {
    expect(longwaveDown(20)).toBeGreaterThan(300)
    expect(longwaveDown(30)).toBeLessThan(450)
  })

  test('Stefan-Boltzmann: Abstrahlung wächst mit der vierten Potenz', () => {
    // Zwei gleich warme Zeitpunkte unterscheiden sich nur in der Oberflächentemperatur.
    const cold = computeFluxes(open('asphalt'), DEFAULT_WEATHER, 0, 20, 20)
    const hot = computeFluxes(open('asphalt'), DEFAULT_WEATHER, 0, 60, 20)
    const expected = 0.95 * 5.670374e-8 * (333.15 ** 4 - 293.15 ** 4)
    expect(cold.longwaveNet - hot.longwaveNet).toBeCloseTo(expected, 3)
  })

  test('Eindringtiefe der Tageswelle in Asphalt beträgt rund 10 cm', () => {
    const storage = MATERIALS.asphalt.storage
    if (storage.kind !== 'ground') throw new Error('Asphalt muss massiver Untergrund sein')
    const depth = heatStorageOf(MATERIALS.asphalt).capacity / storage.volumetricHeatCapacity
    expect(depth).toBeGreaterThan(0.08)
    expect(depth).toBeLessThan(0.13)
  })
})

describe('Stimmigkeit der Rechnung', () => {
  test('der Tagesgang ist eingeschwungen: Ende des Tages passt zum Anfang', () => {
    for (const surface of ['asphalt', 'grass', 'roof', 'tree'] as const) {
      const { samples } = day(surface)
      const last = samples[samples.length - 1].surfaceC
      const first = samples[0].surfaceC
      // Zwischen 23:50 und 0:00 Uhr ändert sich die Temperatur nur noch wenig.
      expect(Math.abs(last - first)).toBeLessThan(0.6)
    }
  })

  test('über 24 Stunden gleichen sich Gewinne und Verluste aus', () => {
    const { samples } = day('asphalt')
    const surplus = samples.map(
      ({ fluxes }) => fluxes.netRadiation - fluxes.sensible - fluxes.latent - fluxes.ground,
    )
    const meanSurplus = surplus.reduce((sum, value) => sum + value, 0) / surplus.length
    expect(Math.abs(meanSurplus)).toBeLessThan(2) // W/m²
  })

  test('trockene Flächen verdunsten nichts', () => {
    expect(day('asphalt').samples.every((sample) => sample.fluxes.latent === 0)).toBe(true)
  })
})

describe('Verhalten wie in der Wirklichkeit', () => {
  test('Asphalt wird an einem heißen Tag 45–65 °C warm', () => {
    const { maxC } = day('asphalt')
    expect(maxC).toBeGreaterThan(45)
    expect(maxC).toBeLessThan(65)
  })

  test('Rasen bleibt mittags mindestens 10 K kühler als Asphalt', () => {
    expect(day('asphalt').maxC - day('grass').maxC).toBeGreaterThan(10)
  })

  test('nächtlicher Hitzestau: Asphalt und Beton sind um 4 Uhr wärmer als Rasen', () => {
    const grassNight = surfaceTempAt(day('grass'), 4)
    expect(surfaceTempAt(day('asphalt'), 4) - grassNight).toBeGreaterThan(2)
    expect(surfaceTempAt(day('concrete'), 4) - grassNight).toBeGreaterThan(2)
  })

  test('ein Blätterdach bleibt nahe an der Lufttemperatur', () => {
    const tree = day('tree')
    expect(tree.maxC).toBeLessThan(DEFAULT_WEATHER.tMaxC + 5)
    expect(tree.minC).toBeGreaterThan(DEFAULT_WEATHER.tMinC - 3)
  })

  test('Cool Roof und Gründach sind deutlich kühler als ein dunkles Dach', () => {
    const dark = day('roof').maxC
    expect(dark - day('coolRoof').maxC).toBeGreaterThan(15)
    expect(dark - day('greenRoof').maxC).toBeGreaterThan(15)
  })

  test('Entsiegelung kühlt gegenüber Asphalt', () => {
    expect(day('asphalt').maxC - day('permeable').maxC).toBeGreaterThan(5)
  })

  test('Wasser schwankt über den Tag am wenigsten', () => {
    const water = day('water')
    const asphalt = day('asphalt')
    expect(water.maxC - water.minC).toBeLessThan((asphalt.maxC - asphalt.minC) / 4)
  })

  test('mehr Wind kühlt heiße Flächen', () => {
    const windy = day('asphalt', { ...DEFAULT_WEATHER, windSpeed: 6 })
    expect(windy.maxC).toBeLessThan(day('asphalt').maxC - 5)
  })

  test('Wolken senken die Höchsttemperatur', () => {
    const cloudy = day('asphalt', { ...DEFAULT_WEATHER, transmissivity: 0.3 })
    expect(cloudy.maxC).toBeLessThan(day('asphalt').maxC - 8)
  })

  test('enge Bebauung hält die Wärme nachts fest', () => {
    const canyon = simulateDay(
      { surface: 'asphalt', skyViewFactor: 0.5, shade: 0, windFactor: 0.6, mist: false },
      DEFAULT_WEATHER,
    )
    expect(surfaceTempAt(canyon, 4)).toBeGreaterThan(surfaceTempAt(day('asphalt'), 4) + 1)
  })

  test('Sprühnebel kühlt tagsüber, aber nicht nachts', () => {
    const misted = simulateDay({ ...open('asphalt'), mist: true }, DEFAULT_WEATHER)
    expect(misted.maxC).toBeLessThan(day('asphalt').maxC - 8)
    expect(misted.samples[4 * 6].fluxes.latent).toBe(0)
  })
})

describe('Raster', () => {
  test('Bebauungsdichte: frei = 0, von Gebäuden umgeben = 1', () => {
    expect(localBuildingDensity(createUniformGrid('grass'), 10, 10)).toBe(0)
    const city = createUniformGrid('roof')
    city.cells[10 * city.width + 10] = { surface: 'asphalt', mist: false }
    expect(localBuildingDensity(city, 10, 10)).toBe(1)
  })

  test('ein begrüntes Raster ist tags und nachts kühler als ein versiegeltes', () => {
    const sealed = createUniformGrid('asphalt')
    const green = createUniformGrid('grass')
    const sealedSummary = summarize(sealed, simulateGrid(sealed, DEFAULT_WEATHER))
    const greenSummary = summarize(green, simulateGrid(green, DEFAULT_WEATHER))
    expect(greenSummary.meanAfternoonC).toBeLessThan(sealedSummary.meanAfternoonC - 10)
    expect(greenSummary.meanNightC).toBeLessThan(sealedSummary.meanNightC - 2)
    expect(sealedSummary.meanAlbedo).toBeCloseTo(0.1, 5)
    expect(greenSummary.meanAlbedo).toBeCloseTo(0.23, 5)
  })

  test('ein gemischtes 20×20-Raster rechnet schnell genug für Echtzeit', () => {
    const grid = createUniformGrid('asphalt')
    const types: SurfaceType[] = ['asphalt', 'roof', 'grass', 'tree', 'concrete']
    grid.cells.forEach((cell, index) => {
      cell.surface = types[(index * 7 + Math.floor(index / 20) * 3) % types.length]
    })
    const start = performance.now()
    const result = simulateGrid(grid, DEFAULT_WEATHER)
    expect(result.cells).toHaveLength(400)
    expect(performance.now() - start).toBeLessThan(500)
  })
})

describe('Regenrückhalt', () => {
  test('Asphalt hält nichts zurück, Rasen 80 %', () => {
    // 20×20 Zellen à 100 m² = 40 000 m²; 40 mm Starkregen = 1,6 Mio. Liter.
    const sealed = rainBalance(createUniformGrid('asphalt'), 40)
    expect(sealed.rainfallL).toBe(1_600_000)
    expect(sealed.retainedL).toBe(0)

    const green = rainBalance(createUniformGrid('grass'), 40)
    expect(green.retainedL).toBeCloseTo(1_280_000, 0)
    expect(green.runoffL).toBeCloseTo(320_000, 0)
  })
})
