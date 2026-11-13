/**
 * Das Stadtraster: viele Oberflächen nebeneinander.
 *
 * Jede Zelle wird mit der Energiebilanz aus energyBalance.ts berechnet.
 * Die Bebauung in der Umgebung verändert dabei drei Dinge für Bodenzellen:
 * weniger sichtbarer Himmel, mehr Schatten, weniger Wind.
 */

import { MATERIALS, type SurfaceType } from '../data/materials.ts'
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
}

export interface CityGrid {
  width: number
  height: number
  /** Kantenlänge einer Zelle in Metern. */
  cellSizeM: number
  /** Zellen zeilenweise von links oben nach rechts unten. */
  cells: GridCell[]
}

/** Umkreis in Zellen, in dem Gebäude eine Bodenzelle beeinflussen. */
const NEIGHBOURHOOD_RADIUS = 2
/** Die Bebauungsdichte wird auf solche Stufen gerundet (spart Rechenzeit). */
const DENSITY_STEP = 0.05

/**
 * Annahmen zur Wirkung der Bebauungsdichte d (0–1) auf Bodenzellen.
 * Stark vereinfacht; ersetzt keine Strömungs- oder Schattensimulation.
 */
const SKY_VIEW_LOSS = 0.6 // ψ = 1 − 0,6·d
const SHADE_GAIN = 0.5 // s = 0,5·d
const WIND_LOSS = 0.6 // u_Boden = u·(1 − 0,6·d)

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

/** Anteil der Gebäudezellen in der Umgebung einer Zelle (0–1). */
export function localBuildingDensity(grid: CityGrid, x: number, y: number): number {
  let buildings = 0
  let total = 0
  for (let dy = -NEIGHBOURHOOD_RADIUS; dy <= NEIGHBOURHOOD_RADIUS; dy++) {
    for (let dx = -NEIGHBOURHOOD_RADIUS; dx <= NEIGHBOURHOOD_RADIUS; dx++) {
      const nx = x + dx
      const ny = y + dy
      const isSelf = dx === 0 && dy === 0
      if (isSelf || nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue
      total++
      if (MATERIALS[grid.cells[ny * grid.width + nx].surface].isRoof) buildings++
    }
  }
  return total === 0 ? 0 : buildings / total
}

/** Leitet aus Zelle und Bebauungsdichte die Bedingungen für die Energiebilanz ab. */
export function conditionsFor(cell: GridCell, density: number): CellConditions {
  if (MATERIALS[cell.surface].isRoof) {
    return { ...OPEN_CONDITIONS, surface: cell.surface, mist: cell.mist }
  }
  return {
    surface: cell.surface,
    skyViewFactor: 1 - SKY_VIEW_LOSS * density,
    shade: SHADE_GAIN * density,
    windFactor: 1 - WIND_LOSS * density,
    mist: cell.mist,
  }
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
    const x = index % grid.width
    const y = Math.floor(index / grid.width)
    const density = MATERIALS[cell.surface].isRoof
      ? 0
      : Math.round(localBuildingDensity(grid, x, y) / DENSITY_STEP) * DENSITY_STEP
    const key = `${cell.surface}|${cell.mist}|${density.toFixed(2)}`
    let result = cache.get(key)
    if (!result) {
      result = simulateDay(conditionsFor(cell, density), weather)
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

export function summarize(grid: CityGrid, result: GridResult): GridSummary {
  return {
    meanAfternoonC: average(result.cells.map((cell) => surfaceTempAt(cell, 15))),
    meanNightC: average(result.cells.map((cell) => surfaceTempAt(cell, 4))),
    meanMaxC: average(result.cells.map((cell) => cell.maxC)),
    meanAlbedo: average(grid.cells.map((cell) => MATERIALS[cell.surface].albedo)),
  }
}
