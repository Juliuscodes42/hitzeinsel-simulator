import { describe, expect, test } from 'vitest'
import { MEASURE_BY_ID } from '../data/measures.ts'
import { DEFAULT_WEATHER } from './atmosphere.ts'
import { applyOverrides, generateDistrict } from './district.ts'
import { simulateGrid, type CityGrid, type GridCell } from './grid.ts'
import {
  DEFAULT_COSTS,
  maximumCost,
  optimize,
  possibleActions,
  type ActionKind,
  type Goal,
} from './optimizer.ts'

const grid = generateDistrict({ sealing: 0.75, density: 0.35, seed: 7 })
const BUDGET = 300_000

const meanValue = (candidate: CityGrid, goal: Goal): number => {
  const result = simulateGrid(candidate, DEFAULT_WEATHER)
  const values = result.cells.map((cell) =>
    goal === 'mean' ? cell.meanC : cell.samples[(goal === 'day' ? 15 : 4) * 6].surfaceC,
  )
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/** Gibt dasselbe Budget zufällig aus (fester Zufall, damit der Test wiederholbar ist). */
function randomSpending(budget: number, seed: number): Map<number, GridCell> {
  let state = seed
  const random = () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
  const cells = new Map<number, GridCell>()
  const order = grid.cells.map((_, index) => index).sort(() => random() - 0.5)
  let remaining = budget
  for (const index of order) {
    const kinds = possibleActions(grid.cells[index])
    if (kinds.length === 0) continue
    const kind: ActionKind = kinds[Math.floor(random() * kinds.length)]
    const cost = DEFAULT_COSTS[kind] * 100
    if (cost > remaining) continue
    remaining -= cost
    cells.set(index, MEASURE_BY_ID[kind].apply(grid.cells[index]))
  }
  return cells
}

describe('Mögliche Maßnahmen', () => {
  test('Dächer, Höfe und Straßen bekommen unterschiedliche Angebote', () => {
    expect(possibleActions({ surface: 'roof', mist: false })).toEqual([
      'greenRoof',
      'blueGreenRoof',
      'coolRoof',
    ])
    expect(possibleActions({ surface: 'concrete', mist: false })).toEqual([
      'tree',
      'treeTrench',
      'unsealing',
      'swale',
      'pond',
      'coolPavement',
      'pvCanopy',
      'shadeSail',
      'mist',
    ])
    expect(possibleActions({ surface: 'asphalt', mist: false, street: true })).toEqual(['mist'])
    expect(possibleActions({ surface: 'grass', mist: false })).toEqual([])
    expect(possibleActions({ surface: 'greenRoof', mist: false })).toEqual([])
  })
})

describe('Optimierer', () => {
  test('ohne Budget gibt es keinen Vorschlag', () => {
    const proposal = optimize(grid, DEFAULT_WEATHER, 0, 'mean')
    expect(proposal.actions).toHaveLength(0)
    expect(proposal.coolingK).toBe(0)
  })

  test('das Budget wird eingehalten und fast ganz genutzt', () => {
    const proposal = optimize(grid, DEFAULT_WEATHER, BUDGET, 'mean')
    expect(proposal.totalCost).toBeLessThanOrEqual(BUDGET)
    expect(proposal.totalCost).toBeGreaterThan(BUDGET * 0.95)
  })

  test('die angegebene Abkühlung stimmt mit einer vollen Simulation überein', () => {
    for (const goal of ['mean', 'day', 'night'] as const) {
      const proposal = optimize(grid, DEFAULT_WEATHER, BUDGET, goal)
      const simulated = meanValue(grid, goal) - meanValue(applyOverrides(grid, proposal.cells), goal)
      expect(proposal.coolingK).toBeCloseTo(simulated, 6)
    }
  })

  test('mehr Budget bringt mehr Kühlung', () => {
    const small = optimize(grid, DEFAULT_WEATHER, 100_000, 'mean')
    const large = optimize(grid, DEFAULT_WEATHER, 400_000, 'mean')
    expect(large.coolingK).toBeGreaterThan(small.coolingK)
  })

  test('der Vorschlag kühlt deutlich stärker als zufällig verteilte Maßnahmen', () => {
    const proposal = optimize(grid, DEFAULT_WEATHER, BUDGET, 'mean')
    const before = meanValue(grid, 'mean')
    for (const seed of [1, 2, 3, 4, 5]) {
      const random = before - meanValue(applyOverrides(grid, randomSpending(BUDGET, seed)), 'mean')
      expect(proposal.coolingK).toBeGreaterThan(random * 1.2)
    }
  })

  test('Straßen werden nie bepflanzt oder entsiegelt', () => {
    const proposal = optimize(grid, DEFAULT_WEATHER, maximumCost(grid), 'mean')
    for (const action of proposal.actions) {
      if (grid.cells[action.index].street) expect(action.kind).toBe('mist')
    }
  })

  test('mit unbegrenztem Budget wird jede mögliche Fläche umgebaut', () => {
    const proposal = optimize(grid, DEFAULT_WEATHER, maximumCost(grid), 'day')
    const improvable = grid.cells.filter((cell) => possibleActions(cell).length > 0).length
    expect(proposal.actions).toHaveLength(improvable)
  })

  test('teurere Maßnahmen verändern den Vorschlag', () => {
    const cheap = optimize(grid, DEFAULT_WEATHER, BUDGET, 'mean')
    const pricey = optimize(grid, DEFAULT_WEATHER, BUDGET, 'mean', {
      ...DEFAULT_COSTS,
      coolRoof: 500,
    })
    expect(pricey.byKind.coolRoof.count).toBeLessThan(cheap.byKind.coolRoof.count + 1)
    expect(pricey.coolingK).toBeLessThanOrEqual(cheap.coolingK)
  })
})
