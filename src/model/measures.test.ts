import { describe, expect, test } from 'vitest'
import { MEASURES, MEASURE_BY_ID, canApply } from '../data/measures.ts'
import { DEFAULT_WEATHER } from './atmosphere.ts'
import { NO_MEASURES, applyMeasures } from './district.ts'
import { simulateDay, surfaceTempAt } from './energyBalance.ts'
import { conditionsFor, createUniformGrid, type GridCell } from './grid.ts'
import { rainBalance } from './water.ts'

const asphalt: GridCell = { surface: 'asphalt', mist: false }
const at15 = (cell: GridCell) => surfaceTempAt(simulateDay(conditionsFor(cell, 0), DEFAULT_WEATHER), 15)

describe('Maßnahmenkatalog', () => {
  test('jede Maßnahme hat Kosten mit Spannweite um den Standardwert', () => {
    for (const measure of MEASURES) {
      const [min, max] = measure.cost.range
      expect(min).toBeLessThanOrEqual(measure.cost.build)
      expect(max).toBeGreaterThanOrEqual(measure.cost.build)
      expect(measure.cost.lifetime).toBeGreaterThan(0)
    }
  })

  test('Maßnahmen gibt es nur auf geeigneten Flächen', () => {
    expect(canApply({ surface: 'roof', mist: false }, MEASURE_BY_ID.greenRoof)).toBe(true)
    expect(canApply(asphalt, MEASURE_BY_ID.greenRoof)).toBe(false)
    expect(canApply({ ...asphalt, street: true }, MEASURE_BY_ID.pvCanopy)).toBe(false)
    expect(canApply({ ...asphalt, street: true }, MEASURE_BY_ID.mist)).toBe(true)
    expect(canApply({ surface: 'greenRoof', mist: false }, MEASURE_BY_ID.cistern)).toBe(true)
  })
})

describe('Überdachungen', () => {
  test('ein Solardach kühlt Asphalt am Nachmittag stark, ein Segel etwas weniger', () => {
    const open = at15(asphalt)
    const pv = at15(MEASURE_BY_ID.pvCanopy.apply(asphalt))
    const sail = at15(MEASURE_BY_ID.shadeSail.apply(asphalt))
    expect(open - pv).toBeGreaterThan(10)
    expect(sail).toBeGreaterThan(pv)
    expect(sail).toBeLessThan(open - 5)
  })

  test('eine Zisterne ändert die Temperatur des Dachs nicht', () => {
    const roof: GridCell = { surface: 'roof', mist: false }
    expect(at15(MEASURE_BY_ID.cistern.apply(roof))).toBeCloseTo(at15(roof), 8)
  })
})

describe('Wasserspeicher', () => {
  test('eine Mulde fängt Abfluss der versiegelten Umgebung auf', () => {
    const grid = createUniformGrid('asphalt', 10, 10, 2)
    const before = rainBalance(grid, 40)
    expect(before.retainedL).toBe(0)
    grid.cells[0] = MEASURE_BY_ID.swale.apply(grid.cells[0])
    const after = rainBalance(grid, 40)
    // Rasen hält 80 % von 40 mm auf 4 m², die Mulde speichert 300 l/m² · 4 m².
    expect(after.retainedL).toBeCloseTo(0.8 * 40 * 4 + 300 * 4, 6)
  })

  test('mehr Speicher als Regen hält höchstens den ganzen Regen zurück', () => {
    const grid = createUniformGrid('asphalt', 2, 2, 2)
    grid.cells = grid.cells.map((cell) => MEASURE_BY_ID.swale.apply(cell))
    const balance = rainBalance(grid, 40)
    expect(balance.retainedL).toBeCloseTo(balance.rainfallL, 6)
    expect(balance.runoffL).toBeCloseTo(0, 6)
  })
})

describe('Anteile auf geteilten Flächen', () => {
  test('Maßnahmen auf Plätzen teilen sich die Flächen in Katalog-Reihenfolge', () => {
    const grid = createUniformGrid('concrete', 10, 1, 2)
    const ranks = Array.from({ length: 10 }, (_, i) => (i + 0.5) / 10)
    const result = applyMeasures(grid, { ...NO_MEASURES, tree: 0.3, pvCanopy: 0.2 }, ranks)
    expect(result.cells.filter((cell) => cell.measure === 'tree')).toHaveLength(3)
    expect(result.cells.filter((cell) => cell.cover === 'pv')).toHaveLength(2)
    expect(result.cells.filter((cell) => !cell.measure)).toHaveLength(5)
  })
})
