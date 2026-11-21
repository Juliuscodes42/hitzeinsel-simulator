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

import { MEASURES, MEASURE_BY_ID, canApply, type MeasureId } from '../data/measures.ts'
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

/** Maßnahmen, die der Optimierer verwenden kann: alle, die kühlen. */
export type ActionKind = MeasureId

export const ACTION_KINDS: ActionKind[] = MEASURES.filter((measure) => measure.cools).map(
  (measure) => measure.id,
)

export const ACTION_LABELS = Object.fromEntries(
  MEASURES.map((measure) => [measure.id, measure.label]),
) as Record<ActionKind, string>

/** Kosten je Quadratmeter in Euro. */
export type CostTable = Record<ActionKind, number>

/** Baukosten aus dem Maßnahmenkatalog (Quellen in docs/kosten.md). In der App änderbar. */
export const DEFAULT_COSTS = Object.fromEntries(
  MEASURES.map((measure) => [measure.id, measure.cost.build]),
) as CostTable

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
  /** Größtmögliche Abkühlung, wenn alles umgebaut wird. */
  maxCoolingK: number
  /** Bei Zielvorgabe: Wurde das Ziel erreicht? */
  reached: boolean
}

const goalValue = (result: DayResult, goal: Goal): number =>
  goal === 'day' ? surfaceTempAt(result, 15) : goal === 'night' ? surfaceTempAt(result, 4) : result.meanC

/** Die Zelle nach einer Maßnahme. */
const applyAction = (cell: GridCell, kind: ActionKind): GridCell => MEASURE_BY_ID[kind].apply(cell)

/** Welche kühlenden Maßnahmen sind auf dieser Zelle möglich? */
export function possibleActions(cell: GridCell): ActionKind[] {
  return ACTION_KINDS.filter((kind) => canApply(cell, MEASURE_BY_ID[kind]))
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
  /**
   * Zielvorgabe in Kelvin: Statt ein Budget auszugeben, wird so lange gebaut,
   * bis das Viertel um diesen Wert kühler ist (günstigste Maßnahmen zuerst).
   */
  targetK?: number,
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

  // Größtmögliche Abkühlung: jede Zelle mit ihrer am stärksten kühlenden Stufe.
  const bestPerCell = new Map<number, number>()
  for (const step of steps) {
    bestPerCell.set(step.index, Math.max(bestPerCell.get(step.index) ?? 0, step.option.coolingK))
  }
  const maxCoolingK = [...bestPerCell.values()].reduce((sum, value) => sum + value, 0) / grid.cells.length

  // 2. Budget ausgeben bzw. bis zum Ziel bauen: die Stufe mit der meisten
  //    Kühlung pro Euro zuerst.
  steps.sort((a, b) => b.efficiency - a.efficiency || a.index - b.index)
  const chosen = new Map<number, { level: number; option: Option }>()
  let remaining = targetK === undefined ? budget : Infinity
  // Abkühlung des Viertels mal Zellenzahl, damit nicht bei jedem Schritt geteilt wird.
  const targetSum = (targetK ?? Infinity) * grid.cells.length
  let coolingSum = 0
  for (const step of steps) {
    if (coolingSum >= targetSum) break
    const current = chosen.get(step.index)
    const currentLevel = current?.level ?? -1
    if (step.level !== currentLevel + 1 || step.extraCost > remaining) continue
    chosen.set(step.index, { level: step.level, option: step.option })
    remaining -= step.extraCost
    coolingSum += step.option.coolingK - (current?.option.coolingK ?? 0)
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
    maxCoolingK,
    reached: targetK === undefined || coolingSum >= targetSum - 1e-9,
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
