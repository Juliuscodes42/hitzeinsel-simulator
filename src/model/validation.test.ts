import { describe, expect, test } from 'vitest'
import { DEFAULT_WEATHER } from './atmosphere.ts'
import { createUniformGrid } from './grid.ts'
import { compareScene, summarizeComparisons, type LandsatScene } from './validation.ts'

const scene: LandsatScene = {
  sceneId: 'TEST',
  date: '2026-07-20',
  timeUtc: '10:15',
  solarHour: 11,
  landsatMeanC: 40,
  landsatQuadrantsC: [45, 38, 38, 39],
  pixelCount: 49,
  weather: DEFAULT_WEATHER,
}

// Asphalt im Nordwest-Viertel, sonst Rasen.
const grid = createUniformGrid('grass')
grid.cells.forEach((cell, index) => {
  if (index % 20 < 10 && Math.floor(index / 20) < 10) cell.surface = 'asphalt'
})

describe('Vergleich mit Landsat', () => {
  const comparison = compareScene(grid, scene)

  test('das Asphalt-Viertel ist im Modell das wärmste', () => {
    const [northWest, ...others] = comparison.modelQuadrantsC
    expect(northWest).toBeGreaterThan(Math.max(...others) + 5)
    expect(comparison.hottestQuadrantMatches).toBe(true)
  })

  test('der Mittelwert ist das Mittel der vier gleich großen Viertel', () => {
    const quadrantMean = comparison.modelQuadrantsC.reduce((a, b) => a + b, 0) / 4
    expect(comparison.modelMeanC).toBeCloseTo(quadrantMean, 8)
    expect(comparison.differenceK).toBeCloseTo(comparison.modelMeanC - 40, 8)
  })

  test('der Musterfehler hängt nicht davon ab, ob das Modell insgesamt zu warm ist', () => {
    const warmer = { ...scene, landsatMeanC: 30, landsatQuadrantsC: [35, 28, 28, 29] }
    expect(compareScene(grid, warmer).patternErrorK).toBeCloseTo(comparison.patternErrorK, 8)
    // Gleiches Muster wie im Modell ergibt den Fehler 0.
    const same = {
      ...scene,
      landsatMeanC: comparison.modelMeanC + 3,
      landsatQuadrantsC: comparison.modelQuadrantsC.map((value) => value + 3),
    }
    expect(compareScene(grid, same).patternErrorK).toBeCloseTo(0, 8)
  })

  test('die Zusammenfassung unterscheidet Betrag und Vorzeichen der Abweichung', () => {
    const tooWarm = { ...comparison, differenceK: 4 }
    const tooCold = { ...comparison, differenceK: -2, hottestQuadrantMatches: false }
    const summary = summarizeComparisons([tooWarm, tooCold])
    expect(summary.count).toBe(2)
    expect(summary.meanAbsErrorK).toBe(3)
    expect(summary.biasK).toBe(1)
    expect(summary.hottestQuadrantMatches).toBe(1)
  })
})
