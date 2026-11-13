/**
 * Wasserhaushalt bei Starkregen.
 *
 * Vereinfachung: Jede Fläche lässt den Anteil ψ (Abflussbeiwert) des Regens
 * oberflächlich abfließen. Der Rest (1 − ψ) wird zurückgehalten: Er
 * versickert, wird gespeichert oder verdunstet später.
 * 1 mm Regen auf 1 m² entspricht 1 Liter.
 */

import { MATERIALS } from '../data/materials.ts'
import type { CityGrid } from './grid.ts'

export interface RainBalance {
  /** Gesamter Niederschlag auf dem Raster in Litern. */
  rainfallL: number
  /** Zurückgehaltenes Wasser in Litern. */
  retainedL: number
  /** Oberflächenabfluss in die Kanalisation in Litern. */
  runoffL: number
}

export function rainBalance(grid: CityGrid, rainMm: number): RainBalance {
  const cellArea = grid.cellSizeM ** 2
  const rainfallL = rainMm * cellArea * grid.cells.length
  const retainedL = grid.cells.reduce(
    (sum, cell) => sum + (1 - MATERIALS[cell.surface].runoffCoefficient) * rainMm * cellArea,
    0,
  )
  return { rainfallL, retainedL, runoffL: rainfallL - retainedL }
}
