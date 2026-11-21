import { describe, expect, test } from 'vitest'
import {
  NO_MEASURES,
  applyMeasures,
  applyOverrides,
  cellRanks,
  generateDistrict,
  sealedShare,
} from './district.ts'
import type { CityGrid } from './grid.ts'

const count = (grid: CityGrid, surface: string): number =>
  grid.cells.filter((cell) => cell.surface === surface).length

const params = { sealing: 0.7, density: 0.4, seed: 7 }
const base = generateDistrict(params)
const ranks = cellRanks(params.seed, base.cells.length)

describe('Stadtviertel-Generator', () => {
  test('gleicher Startwert ergibt dasselbe Viertel', () => {
    expect(generateDistrict(params)).toEqual(base)
    expect(generateDistrict({ ...params, seed: 8 })).not.toEqual(base)
  })

  test('ohne Bebauung gibt es keine Dächer, bei voller Versiegelung kein Grün', () => {
    expect(count(generateDistrict({ ...params, density: 0 }), 'roof')).toBe(0)
    const sealed = generateDistrict({ ...params, sealing: 1 })
    expect(count(sealed, 'grass') + count(sealed, 'tree')).toBe(0)
    expect(sealedShare(sealed)).toBe(1)
  })

  test('mehr Bebauungsdichte ergibt mehr Dächer, bestehende bleiben stehen', () => {
    const denser = generateDistrict({ ...params, density: 0.6 })
    expect(count(denser, 'roof')).toBeGreaterThan(count(base, 'roof'))
    base.cells.forEach((cell, index) => {
      if (cell.surface === 'roof') expect(denser.cells[index].surface).toBe('roof')
    })
  })

  test('Straßen bleiben immer Asphalt', () => {
    const green = generateDistrict({ sealing: 0, density: 0, seed: 7 })
    expect(count(green, 'asphalt')).toBeGreaterThan(0)
    expect(count(green, 'concrete')).toBe(0)
  })
})

describe('Maßnahmen', () => {
  test('ohne Maßnahmen bleibt das Raster unverändert', () => {
    expect(applyMeasures(base, NO_MEASURES, ranks)).toEqual(base)
  })

  test('ein Parkplatz aus Asphalt lässt sich entsiegeln, eine Straße nicht', () => {
    const grid: CityGrid = {
      width: 2,
      height: 1,
      cellSizeM: 10,
      cells: [
        { surface: 'asphalt', mist: false },
        { surface: 'asphalt', mist: false, street: true },
      ],
    }
    const result = applyMeasures(grid, { ...NO_MEASURES, unsealing: 1 }, [0.5, 0.5])
    expect(result.cells[0].surface).toBe('permeable')
    expect(result.cells[1].surface).toBe('asphalt')
  })

  test('100 % Dachbegrünung lässt kein dunkles Dach übrig', () => {
    const result = applyMeasures(base, { ...NO_MEASURES, greenRoof: 1 }, ranks)
    expect(count(result, 'roof')).toBe(0)
    expect(count(result, 'greenRoof')).toBe(count(base, 'roof'))
  })

  test('Gründach und Cool Roof teilen sich die Dächer', () => {
    const result = applyMeasures(base, { ...NO_MEASURES, greenRoof: 0.6, coolRoof: 1 }, ranks)
    expect(count(result, 'roof')).toBe(0)
    expect(count(result, 'greenRoof') + count(result, 'coolRoof')).toBe(count(base, 'roof'))
    expect(count(result, 'greenRoof')).toBeGreaterThan(0)
    expect(count(result, 'coolRoof')).toBeGreaterThan(0)
  })

  test('Bäume und Entsiegelung ersetzen nur Pflaster, keine Straßen', () => {
    const result = applyMeasures(base, { ...NO_MEASURES, tree: 0.5, unsealing: 0.5 }, ranks)
    expect(count(result, 'concrete')).toBe(0)
    expect(count(result, 'asphalt')).toBe(count(base, 'asphalt'))
    expect(sealedShare(result)).toBeLessThan(sealedShare(base))
  })

  test('Sprühnebel läuft nur auf versiegeltem Boden', () => {
    const result = applyMeasures(base, { ...NO_MEASURES, mist: 1 }, ranks)
    for (const cell of result.cells) {
      const sealed = cell.surface === 'asphalt' || cell.surface === 'concrete'
      expect(cell.mist).toBe(sealed)
    }
  })

  test('von Hand gemalte Zellen haben Vorrang', () => {
    const painted = applyOverrides(base, new Map([[0, { surface: 'water', mist: false }]]))
    expect(painted.cells[0].surface).toBe('water')
    expect(painted.cells[1]).toEqual(base.cells[1])
    expect(applyOverrides(base, new Map())).toBe(base)
  })
})
