/**
 * Optimierer: Welche Maßnahmen bringen mit einem festen Budget die meiste Kühlung?
 *
 * Idee: Für jede Zelle wird ausgerechnet, um wie viel Kelvin jede mögliche
 * Maßnahme sie abkühlt und was das kostet. Danach wird das Budget in der
 * Reihenfolge „meiste Kühlung pro Euro zuerst" ausgegeben.
 *
 * Fachlich ist das ein Rucksackproblem mit Auswahlgruppen (jede Zelle erhält
 * höchstens eine Maßnahme). Das verwendete Greedy-Verfahren über die
 * Zusatznutzen ist dafür ein Standardverfahren: Es liegt höchstens um den
 * Nutzen einer einzelnen Maßnahme unter dem bestmöglichen Ergebnis.
 *
 * Wichtig: Weil das Modell Nachbarflächen nicht koppelt, hängt der Nutzen
 * einer Maßnahme nur von ihrer eigenen Zelle ab.
 */

import type { SurfaceType } from '../data/materials.ts'
import type { Weather } from './atmosphere.ts'
import { simulateDay, surfaceTempAt, type DayResult } from './energyBalance.ts'
import { conditionsAt, type CityGrid, type GridCell } from './grid.ts'

/** Worauf optimiert wird. */
export type Goal = 'mean' | 'day' | 'night'

export const GOAL_LABELS: Record<Goal, string> = {
  mean: 'Mittel über 24 Stunden',
  day: 'Nachmittagshitze (15 Uhr)',
  night: 'Nächtlicher Hitzestau (4 Uhr)',
}

export type ActionKind = 'greenRoof' | 'coolRoof' | 'tree' | 'permeable' | 'mist'

export const ACTION_KINDS: ActionKind[] = ['greenRoof', 'coolRoof', 'tree', 'permeable', 'mist']

export const ACTION_LABELS: Record<ActionKind, string> = {
  greenRoof: 'Dachbegrünung',
  coolRoof: 'Cool Roof',
  tree: 'Laubbäume',
  permeable: 'Entsiegelung',
  mist: 'Sprühnebel',
}

/** Kosten je Quadratmeter in Euro. */
export type CostTable = Record<ActionKind, number>

/**
 * Grobe Richtwerte für Bau bzw. Installation, ohne laufende Kosten.
 * Eigene Annahmen, die mit Fachleuten abgestimmt werden müssen
 * (Frage D3 im Fragenkatalog). In der App lassen sie sich ändern.
 */
export const DEFAULT_COSTS: CostTable = {
  greenRoof: 60,
  coolRoof: 25,
  tree: 100,
  permeable: 80,
  mist: 50,
}

export interface Action {
  /** Index der Zelle im Raster. */
  index: number
  kind: ActionKind
  cost: number
  /** Abkühlung dieser Zelle in Kelvin (bezogen auf das gewählte Ziel). */
  coolingK: number
}

export interface KindSummary {
  count: number
  cost: number
  /** Beitrag zur Abkühlung des gesamten Viertels in Kelvin. */
  coolingK: number
}

export interface Proposal {
  actions: Action[]
  totalCost: number
  /** Abkühlung des gesamten Viertels in Kelvin (Mittel aller Zellen). */
  coolingK: number
  byKind: Record<ActionKind, KindSummary>
  /** Die umgebauten Zellen, fertig zum Übernehmen ins Raster. */
  cells: Map<number, GridCell>
}

const goalValue = (result: DayResult, goal: Goal): number =>
  goal === 'day' ? surfaceTempAt(result, 15) : goal === 'night' ? surfaceTempAt(result, 4) : result.meanC

/** Die Zelle nach einer Maßnahme. */
function applyAction(cell: GridCell, kind: ActionKind): GridCell {
  if (kind === 'mist') return { ...cell, mist: true }
  return { ...cell, surface: kind satisfies SurfaceType, mist: false }
}

/** Welche Maßnahmen sind auf dieser Zelle möglich? */
export function possibleActions(cell: GridCell): ActionKind[] {
  if (cell.surface === 'roof') return ['greenRoof', 'coolRoof']
  const sealedGround = cell.surface === 'asphalt' || cell.surface === 'concrete'
  if (!sealedGround) return []
  const kinds: ActionKind[] = cell.street ? [] : ['tree', 'permeable']
  if (!cell.mist) kinds.push('mist')
  return kinds
}

interface Option {
  kind: ActionKind
  cost: number
  coolingK: number
}

/**
 * Behält nur die Maßnahmen einer Zelle, die sich lohnen können: Sortiert
 * nach Kosten muss jede teurere mehr kühlen, und der Zusatznutzen pro Euro
 * muss von Stufe zu Stufe abnehmen.
 */
function efficientOptions(options: Option[]): Option[] {
  const sorted = options
    .filter((option) => option.coolingK > 0)
    .sort((a, b) => a.cost - b.cost || b.coolingK - a.coolingK)
  const frontier: Option[] = []
  const ratio = (from: Option | undefined, to: Option) =>
    (to.coolingK - (from?.coolingK ?? 0)) / (to.cost - (from?.cost ?? 0))

  for (const option of sorted) {
    if (frontier.length > 0 && option.coolingK <= frontier[frontier.length - 1].coolingK) continue
    // Eine Zwischenstufe fliegt raus, wenn der direkte Sprung zur neuen Stufe effizienter ist.
    while (frontier.length > 0) {
      const last = frontier[frontier.length - 1]
      const beforeLast = frontier[frontier.length - 2]
      if (option.cost > last.cost && ratio(beforeLast, last) > ratio(last, option)) break
      frontier.pop()
    }
    frontier.push(option)
  }
  return frontier
}

/**
 * Berechnet den Vorschlag für ein Raster.
 *
 * @param budget verfügbares Geld in Euro
 */
export function optimize(
  grid: CityGrid,
  weather: Weather,
  budget: number,
  goal: Goal,
  costs: CostTable = DEFAULT_COSTS,
): Proposal {
  const cellArea = grid.cellSizeM ** 2
  const cache = new Map<string, number>()

  /** Zielwert einer Zelle in °C, wenn dort `cell` läge. Gleiche Fälle werden nur einmal simuliert. */
  const valueOf = (index: number, cell: GridCell): number => {
    const conditions = conditionsAt(grid, index, cell)
    const key = JSON.stringify(conditions)
    let value = cache.get(key)
    if (value === undefined) {
      value = goalValue(simulateDay(conditions, weather), goal)
      cache.set(key, value)
    }
    return value
  }

  // 1. Für jede Zelle die lohnenden Maßnahmen bestimmen und in Stufen zerlegen.
  interface Step {
    index: number
    level: number
    option: Option
    extraCost: number
    efficiency: number
  }
  const steps: Step[] = []
  grid.cells.forEach((cell, index) => {
    const kinds = possibleActions(cell)
    if (kinds.length === 0) return
    const before = valueOf(index, cell)
    const options = efficientOptions(
      kinds.map((kind) => ({
        kind,
        cost: costs[kind] * cellArea,
        coolingK: before - valueOf(index, applyAction(cell, kind)),
      })),
    )
    options.forEach((option, level) => {
      const previous = options[level - 1]
      const extraCost = option.cost - (previous?.cost ?? 0)
      steps.push({
        index,
        level,
        option,
        extraCost,
        efficiency: (option.coolingK - (previous?.coolingK ?? 0)) / extraCost,
      })
    })
  })

  // 2. Budget ausgeben: die Stufe mit der meisten Kühlung pro Euro zuerst.
  steps.sort((a, b) => b.efficiency - a.efficiency || a.index - b.index)
  const chosen = new Map<number, { level: number; option: Option }>()
  let remaining = budget
  for (const step of steps) {
    const currentLevel = chosen.get(step.index)?.level ?? -1
    if (step.level !== currentLevel + 1 || step.extraCost > remaining) continue
    chosen.set(step.index, { level: step.level, option: step.option })
    remaining -= step.extraCost
  }

  // 3. Ergebnis zusammenfassen.
  const byKind = Object.fromEntries(
    ACTION_KINDS.map((kind) => [kind, { count: 0, cost: 0, coolingK: 0 }]),
  ) as Record<ActionKind, KindSummary>
  const actions: Action[] = []
  const cells = new Map<number, GridCell>()
  for (const [index, { option }] of chosen) {
    actions.push({ index, kind: option.kind, cost: option.cost, coolingK: option.coolingK })
    cells.set(index, applyAction(grid.cells[index], option.kind))
    const summary = byKind[option.kind]
    summary.count++
    summary.cost += option.cost
    summary.coolingK += option.coolingK / grid.cells.length
  }
  actions.sort((a, b) => a.index - b.index)

  return {
    actions,
    totalCost: actions.reduce((sum, action) => sum + action.cost, 0),
    coolingK: actions.reduce((sum, action) => sum + action.coolingK, 0) / grid.cells.length,
    byKind,
    cells,
  }
}

/** Flächen, auf denen überhaupt eine Maßnahme möglich ist. */
export function improvableShare(grid: CityGrid): number {
  return grid.cells.filter((cell) => possibleActions(cell).length > 0).length / grid.cells.length
}

/** Kosten, um jede mögliche Zelle mit ihrer teuersten Maßnahme umzubauen (Obergrenze fürs Budget). */
export function maximumCost(grid: CityGrid, costs: CostTable = DEFAULT_COSTS): number {
  const cellArea = grid.cellSizeM ** 2
  return grid.cells.reduce((sum, cell) => {
    const kinds = possibleActions(cell)
    return sum + (kinds.length ? Math.max(...kinds.map((kind) => costs[kind])) * cellArea : 0)
  }, 0)
}
