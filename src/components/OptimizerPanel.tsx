import { useId, useMemo, useState } from 'react'
import type { Weather } from '../model/atmosphere.ts'
import type { CityGrid, GridCell } from '../model/grid.ts'
import {
  ACTION_KINDS,
  ACTION_LABELS,
  DEFAULT_COSTS,
  GOAL_LABELS,
  maximumCost,
  optimize,
  type CostTable,
  type Goal,
} from '../model/optimizer.ts'
import { formatEuro, formatNumber } from './format.ts'
import { Slider } from './Slider.tsx'

interface OptimizerPanelProps {
  /** Das Viertel ohne Maßnahmen (Ist-Zustand). */
  grid: CityGrid
  weather: Weather
  /** Übernimmt die vorgeschlagenen Zellen ins Raster. */
  onApply: (cells: Map<number, GridCell>) => void
}

const BUDGET_STEP = 10_000

/**
 * Der Optimierer: Budget und Ziel wählen, Vorschlag ablesen und ins Raster
 * übernehmen. Der Vorschlag wird bei jeder Änderung sofort neu berechnet.
 */
export function OptimizerPanel({ grid, weather, onApply }: OptimizerPanelProps) {
  const goalId = useId()
  const [budget, setBudget] = useState(150_000)
  const [goal, setGoal] = useState<Goal>('mean')
  const [costs, setCosts] = useState<CostTable>(DEFAULT_COSTS)

  const budgetLimit = Math.max(
    BUDGET_STEP,
    Math.ceil(maximumCost(grid, costs) / BUDGET_STEP) * BUDGET_STEP,
  )
  const effectiveBudget = Math.min(budget, budgetLimit)
  const proposal = useMemo(
    () => optimize(grid, weather, effectiveBudget, goal, costs),
    [grid, weather, effectiveBudget, goal, costs],
  )

  const used = ACTION_KINDS.filter((kind) => proposal.byKind[kind].count > 0).sort(
    (a, b) => proposal.byKind[b].coolingK - proposal.byKind[a].coolingK,
  )
  const cellArea = grid.cellSizeM ** 2

  return (
    <div className="optimizer">
      <div className="optimizer-inputs">
        <Slider
          label="Budget"
          display={formatEuro(effectiveBudget)}
          value={effectiveBudget}
          min={0}
          max={budgetLimit}
          step={BUDGET_STEP}
          hint={`Alles umzubauen würde etwa ${formatEuro(budgetLimit)} kosten.`}
          onChange={setBudget}
        />
        <div className="field">
          <label htmlFor={goalId}>Ziel</label>
          <select id={goalId} value={goal} onChange={(event) => setGoal(event.target.value as Goal)}>
            {(Object.keys(GOAL_LABELS) as Goal[]).map((key) => (
              <option key={key} value={key}>
                {GOAL_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {proposal.actions.length === 0 ? (
        <p className="optimizer-result">
          {effectiveBudget === 0
            ? 'Budget einstellen, um einen Vorschlag zu erhalten.'
            : 'Mit diesem Budget ist keine Maßnahme möglich, oder das Viertel hat keine Flächen, die sich umbauen lassen.'}
        </p>
      ) : (
        <>
          <p className="optimizer-result">
            Mit <b>{formatEuro(proposal.totalCost)}</b> lassen sich{' '}
            <b>{formatNumber(proposal.actions.length * cellArea, 0)} m²</b>{' '}
            umbauen. Das kühlt das Viertel im Ziel „{GOAL_LABELS[goal]}" um{' '}
            <b>{formatNumber(proposal.coolingK, 2)} °C</b>. Am meisten trägt{' '}
            <b>{ACTION_LABELS[used[0]]}</b> bei.
          </p>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Maßnahme</th>
                  <th scope="col">Fläche</th>
                  <th scope="col">Kosten</th>
                  <th scope="col">Kühlung</th>
                  <th scope="col">je 100.000 €</th>
                </tr>
              </thead>
              <tbody>
                {used.map((kind) => {
                  const summary = proposal.byKind[kind]
                  return (
                    <tr key={kind}>
                      <th scope="row">{ACTION_LABELS[kind]}</th>
                      <td>{formatNumber(summary.count * cellArea, 0)} m²</td>
                      <td>{formatEuro(summary.cost)}</td>
                      <td>{formatNumber(summary.coolingK, 2)} °C</td>
                      <td>{formatNumber((summary.coolingK / summary.cost) * 100_000, 2)} °C</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="optimizer-actions">
            <button type="button" className="button button-primary" onClick={() => onApply(proposal.cells)}>
              Vorschlag ins Raster übernehmen
            </button>
            <p className="slider-hint">
              Ersetzt die Regler-Maßnahmen und gemalten Zellen durch den Vorschlag.
            </p>
          </div>
        </>
      )}

      <details className="chart-table">
        <summary>Kosten je Quadratmeter ändern</summary>
        <div className="cost-grid">
          {ACTION_KINDS.map((kind) => (
            <label key={kind} className="cost-field">
              <span>{ACTION_LABELS[kind]}</span>
              <span className="cost-input">
                <input
                  type="number"
                  min={1}
                  max={2000}
                  step={5}
                  value={costs[kind]}
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    if (value >= 1) setCosts({ ...costs, [kind]: value })
                  }}
                />
                €/m²
              </span>
            </label>
          ))}
        </div>
        <p className="note">
          Baukosten aus dem Maßnahmenkatalog (Richtwerte aus Ratgebern und Kommunen, Quellen
          in docs/kosten.md), ohne Pflege und Förderung. Der Optimierer gibt das Budget in der
          Reihenfolge „meiste Kühlung pro Euro zuerst" aus. Jede Fläche erhält höchstens eine
          Maßnahme, Sprühnebel kommt zusätzlich. Straßen bekommen nur Sprühnebel. Zisternen
          kühlen nicht und werden deshalb nicht vorgeschlagen.
        </p>
      </details>
    </div>
  )
}
