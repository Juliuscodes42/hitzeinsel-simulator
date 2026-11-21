/**
 * Überprüfung des Modells: Vergleich mit Oberflächentemperaturen, die der
 * Satellit Landsat gemessen hat.
 *
 * Für jede Aufnahme wird das Raster des Orts mit dem Wetter des Aufnahmetags
 * simuliert und zur Überflugzeit abgelesen. Verglichen wird der Mittelwert
 * des ganzen Ausschnitts und der Mittelwert der vier Viertel (Nordwest,
 * Nordost, Südwest, Südost). Feiner geht es nicht: Landsat misst die
 * Temperatur nur mit etwa 100 m Auflösung.
 */

import type { Weather } from './atmosphere.ts'
import { surfaceTempAt } from './energyBalance.ts'
import { simulateGrid, type CityGrid } from './grid.ts'

/** Eine Landsat-Aufnahme eines Orts. */
export interface LandsatScene {
  sceneId: string
  /** Datum JJJJ-MM-TT. */
  date: string
  /** Überflugzeit in Weltzeit (UTC), HH:MM. */
  timeUtc: string
  /** Überflugzeit als wahre Sonnenzeit am Ort in Dezimalstunden. */
  solarHour: number
  /** Gemessene mittlere Oberflächentemperatur des Ausschnitts in °C. */
  landsatMeanC: number
  /** Gemessene Mittel der vier Viertel: Nordwest, Nordost, Südwest, Südost. */
  landsatQuadrantsC: number[]
  pixelCount: number
  /** Wetter des Aufnahmetags. */
  weather: Weather
}

export interface Comparison {
  scene: LandsatScene
  modelMeanC: number
  modelQuadrantsC: number[]
  /** Modell minus Messung in Kelvin. Positiv = Modell zu warm. */
  differenceK: number
  /** Liegt das wärmste Viertel im Modell dort, wo auch Landsat es misst? */
  hottestQuadrantMatches: boolean
  /**
   * Fehler im Muster: mittlerer Betrag, um den die Viertel vom eigenen Mittelwert
   * abweichen, Modell gegen Messung. Unabhängig davon, ob das Modell insgesamt zu
   * warm oder zu kalt ist; zeigt, ob warme und kühle Bereiche richtig verteilt sind.
   */
  patternErrorK: number
}

const mean = (values: number[]): number => values.reduce((sum, v) => sum + v, 0) / values.length

/** Simuliert den Aufnahmetag und vergleicht mit der Messung. */
export function compareScene(grid: CityGrid, scene: LandsatScene): Comparison {
  const result = simulateGrid(grid, scene.weather)
  const temps = result.cells.map((cell) => surfaceTempAt(cell, scene.solarHour))

  const quadrant = (east: boolean, south: boolean) =>
    mean(
      temps.filter((_, index) => {
        const x = index % grid.width
        const y = Math.floor(index / grid.width)
        return x >= grid.width / 2 === east && y >= grid.height / 2 === south
      }),
    )
  const modelQuadrantsC = [
    quadrant(false, false),
    quadrant(true, false),
    quadrant(false, true),
    quadrant(true, true),
  ]
  const hottest = (values: number[]) => values.indexOf(Math.max(...values))
  const modelMeanC = mean(temps)

  return {
    scene,
    modelMeanC,
    modelQuadrantsC,
    differenceK: modelMeanC - scene.landsatMeanC,
    hottestQuadrantMatches: hottest(modelQuadrantsC) === hottest(scene.landsatQuadrantsC),
    patternErrorK: mean(
      modelQuadrantsC.map((value, i) =>
        Math.abs(value - modelMeanC - (scene.landsatQuadrantsC[i] - scene.landsatMeanC)),
      ),
    ),
  }
}

export interface ValidationSummary {
  count: number
  /** Mittlerer Betrag der Abweichung in Kelvin. */
  meanAbsErrorK: number
  /** Mittlere Abweichung mit Vorzeichen. Positiv = Modell im Schnitt zu warm. */
  biasK: number
  /** In so vielen Aufnahmen stimmt das wärmste Viertel überein. */
  hottestQuadrantMatches: number
  /** Mittlerer Fehler im Muster der Viertel in Kelvin (siehe Comparison.patternErrorK). */
  meanPatternErrorK: number
}

export function summarizeComparisons(comparisons: Comparison[]): ValidationSummary {
  return {
    count: comparisons.length,
    meanAbsErrorK: mean(comparisons.map((c) => Math.abs(c.differenceK))),
    biasK: mean(comparisons.map((c) => c.differenceK)),
    hottestQuadrantMatches: comparisons.filter((c) => c.hottestQuadrantMatches).length,
    meanPatternErrorK: mean(comparisons.map((c) => c.patternErrorK)),
  }
}
