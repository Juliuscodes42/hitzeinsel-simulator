/**
 * Das Stadtraster: viele Oberflächen nebeneinander.
 *
 * Jede Zelle wird mit der Energiebilanz aus energyBalance.ts berechnet.
 * Die Bebauung in der Umgebung verändert dabei drei Dinge für Bodenzellen:
 * weniger sichtbarer Himmel, mehr Schatten, weniger Wind.
 */

import { MATERIALS, type SurfaceType } from '../data/materials.ts'
import type { MeasureId } from '../data/measures.ts'
import type { Weather } from './atmosphere.ts'
import {
  OPEN_CONDITIONS,
  simulateDay,
  surfaceTempAt,
  type CellConditions,
  type DayResult,
} from './energyBalance.ts'

export interface GridCell {
  surface: SurfaceType
  mist: boolean
  /** Verkehrsfläche (Straße, Weg): Maßnahmen bauen sie nicht um. */
  street?: boolean
  /** Maßnahme, durch die die Zelle entstanden ist (fehlt im Ist-Zustand). */
  measure?: MeasureId
  /** Überdachung über dem Boden: Solardach oder Sonnensegel. */
  cover?: 'pv' | 'sail'
  /** Zusätzlicher Regenwasserspeicher in Litern pro m² (Mulde, Rigole, Zisterne). */
  storageL?: number
  /** Auf diesem Dach gibt es eine Zisterne. */
  cistern?: boolean
}

export interface CityGrid {
  width: number
  height: number
  /** Kantenlänge einer Zelle in Metern. */
  cellSizeM: number
  /** Zellen zeilenweise von links oben nach rechts unten. */
  cells: GridCell[]
}

/**
 * Umkreis in Metern, in dem Gebäude eine Bodenzelle beeinflussen.
 * Bei 10-m-Zellen sind das 2 Zellen in jede Richtung (Fenster 5 × 5),
 * bei 2-m-Zellen 10 Zellen (Fenster 21 × 21).
 */
const NEIGHBOURHOOD_RADIUS_M = 20
/** Die Bebauungsdichte wird auf solche Stufen gerundet (spart Rechenzeit). */
const DENSITY_STEP = 0.05

/**
 * Annahmen zur Wirkung der Bebauungsdichte d (0–1) auf Bodenzellen.
 * Stark vereinfacht; ersetzt keine Strömungs- oder Schattensimulation.
 */
const SKY_VIEW_LOSS = 0.6 // ψ = 1 − 0,6·d
const SHADE_GAIN = 0.5 // s = 0,5·d
const WIND_LOSS = 0.6 // u_Boden = u·(1 − 0,6·d)

/**
 * Überdachungen (eigene Annahmen, Frage D4 im Fragenkatalog):
 * Ein Solardach lässt etwa 5 % der Sonne durch, ein Sonnensegel etwa 20 %.
 * Beide verdecken den größten Teil des Himmels; die Unterseite ist warm,
 * deshalb kühlt der Boden nachts kaum noch durch Abstrahlung.
 */
export const COVER_SHADE = { pv: 0.95, sail: 0.8 } as const
const COVER_SKY_VIEW = 0.3

/** Erzeugt ein Raster, das vollständig aus einer Oberfläche besteht. */
export function createUniformGrid(
  surface: SurfaceType,
  width = 20,
  height = 20,
  cellSizeM = 10,
): CityGrid {
  return {
    width,
    height,
    cellSizeM,
    cells: Array.from({ length: width * height }, () => ({ surface, mist: false })),
  }
}

const neighbourhoodRadius = (grid: CityGrid): number =>
  Math.max(1, Math.round(NEIGHBOURHOOD_RADIUS_M / grid.cellSizeM))

/** Anteil der Gebäudezellen in der Umgebung einer Zelle (0–1), ohne die Zelle selbst. */
export function localBuildingDensity(grid: CityGrid, x: number, y: number): number {
  return buildingDensities(grid)[y * grid.width + x]
}

const densityCache = new WeakMap<CityGrid, Float32Array>()

/**
 * Bebauungsdichte für alle Zellen auf einmal. Eine Summentabelle
 * (Summe aller Gebäudezellen links oberhalb) macht jedes Fenster zu vier
 * Nachschlägen, auch bei großen Fenstern.
 */
export function buildingDensities(grid: CityGrid): Float32Array {
  const cached = densityCache.get(grid)
  if (cached) return cached
  const { width, height } = grid
  const radius = neighbourhoodRadius(grid)
  const sums = new Int32Array((width + 1) * (height + 1))
  for (let y = 0; y < height; y++) {
    let rowSum = 0
    for (let x = 0; x < width; x++) {
      rowSum += MATERIALS[grid.cells[y * width + x].surface].isRoof ? 1 : 0
      sums[(y + 1) * (width + 1) + x + 1] = sums[y * (width + 1) + x + 1] + rowSum
    }
  }
  const sumIn = (x0: number, y0: number, x1: number, y1: number) =>
    sums[y1 * (width + 1) + x1] -
    sums[y0 * (width + 1) + x1] -
    sums[y1 * (width + 1) + x0] +
    sums[y0 * (width + 1) + x0]

  const densities = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius)
      const y0 = Math.max(0, y - radius)
      const x1 = Math.min(width, x + radius + 1)
      const y1 = Math.min(height, y + radius + 1)
      const self = MATERIALS[grid.cells[y * width + x].surface].isRoof ? 1 : 0
      const total = (x1 - x0) * (y1 - y0) - 1
      densities[y * width + x] = total <= 0 ? 0 : (sumIn(x0, y0, x1, y1) - self) / total
    }
  }
  densityCache.set(grid, densities)
  return densities
}

/** Leitet aus Zelle und Bebauungsdichte die Bedingungen für die Energiebilanz ab. */
export function conditionsFor(cell: GridCell, density: number): CellConditions {
  if (MATERIALS[cell.surface].isRoof) {
    return { ...OPEN_CONDITIONS, surface: cell.surface, mist: cell.mist }
  }
  const conditions: CellConditions = {
    surface: cell.surface,
    skyViewFactor: 1 - SKY_VIEW_LOSS * density,
    shade: SHADE_GAIN * density,
    windFactor: 1 - WIND_LOSS * density,
    mist: cell.mist,
  }
  if (cell.cover) {
    // Schatten von Gebäuden und Dach zusammen: Durchgelassenes wird multipliziert.
    conditions.shade = 1 - (1 - conditions.shade) * (1 - COVER_SHADE[cell.cover])
    conditions.skyViewFactor *= COVER_SKY_VIEW
  }
  return conditions
}

/**
 * Bedingungen für die Zelle an einer Stelle des Rasters. Mit `cell` lässt sich
 * durchspielen, was wäre, wenn dort eine andere Oberfläche läge.
 */
export function conditionsAt(
  grid: CityGrid,
  index: number,
  cell: GridCell = grid.cells[index],
): CellConditions {
  if (MATERIALS[cell.surface].isRoof) return conditionsFor(cell, 0)
  const density = buildingDensities(grid)[index]
  return conditionsFor(cell, Math.round(density / DENSITY_STEP) * DENSITY_STEP)
}

export interface GridResult {
  /** Tagesgang jeder Zelle, in derselben Reihenfolge wie grid.cells. */
  cells: DayResult[]
}

/**
 * Simuliert alle Zellen des Rasters. Zellen mit gleicher Oberfläche und
 * gleicher Umgebung werden nur einmal berechnet.
 */
export function simulateGrid(grid: CityGrid, weather: Weather): GridResult {
  const cache = new Map<string, DayResult>()
  const cells = grid.cells.map((cell, index) => {
    const conditions = conditionsAt(grid, index, cell)
    const key = `${cell.surface}|${cell.mist}|${cell.cover ?? ''}|${conditions.skyViewFactor.toFixed(3)}`
    let result = cache.get(key)
    if (!result) {
      result = simulateDay(conditions, weather)
      cache.set(key, result)
    }
    return result
  })
  return { cells }
}

/** Kennzahlen für das ganze Raster. */
export interface GridSummary {
  /** Mittlere Oberflächentemperatur um 15 Uhr in °C. */
  meanAfternoonC: number
  /** Mittlere Oberflächentemperatur um 4 Uhr in °C (nächtlicher Hitzestau). */
  meanNightC: number
  /** Mittel der Tageshöchstwerte aller Zellen in °C. */
  meanMaxC: number
  /** Flächengemittelte Albedo (0–1). */
  meanAlbedo: number
}

const average = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length

/** Mittlere Oberflächentemperatur aller Zellen zu einer Uhrzeit in °C. */
export function meanSurfaceTempAt(result: GridResult, hour: number): number {
  return average(result.cells.map((cell) => surfaceTempAt(cell, hour)))
}

/** Ein Punkt der Tageskurve des ganzen Viertels. */
export interface CurvePoint {
  hour: number
  /** Mittlere Oberflächentemperatur aller Zellen in °C. */
  surfaceC: number
  airC: number
}

/** Tagesgang der mittleren Oberflächentemperatur, ein Punkt alle 10 Minuten. */
export function meanDailyCurve(result: GridResult): CurvePoint[] {
  const first = result.cells[0].samples
  return first.map((sample, i) => ({
    hour: sample.hour,
    surfaceC: average(result.cells.map((cell) => cell.samples[i].surfaceC)),
    airC: sample.airC,
  }))
}

/** Flächengemittelte Albedo des Rasters (0–1). */
export function meanAlbedo(grid: CityGrid): number {
  return average(grid.cells.map((cell) => MATERIALS[cell.surface].albedo))
}

export function summarize(grid: CityGrid, result: GridResult): GridSummary {
  return {
    meanAfternoonC: average(result.cells.map((cell) => surfaceTempAt(cell, 15))),
    meanNightC: average(result.cells.map((cell) => surfaceTempAt(cell, 4))),
    meanMaxC: average(result.cells.map((cell) => cell.maxC)),
    meanAlbedo: average(grid.cells.map((cell) => MATERIALS[cell.surface].albedo)),
  }
}
