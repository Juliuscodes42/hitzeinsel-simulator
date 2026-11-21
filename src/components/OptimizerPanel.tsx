import { useId, useMemo, useState } from 'react'
import { MEASURES, MEASURE_BY_ID } from '../data/measures.ts'
import type { Weather } from '../model/atmosphere.ts'
import {
  DEFAULT_COST_SETTINGS,
  FUNDING_PRESETS,
  costBreakdown,
  costTable,
  fundingFor,
  type CostSettings,
} from '../model/costs.ts'
import type { CityGrid, GridCell } from '../model/grid.ts'
import {
  ACTION_KINDS,
  ACTION_LABELS,
  GOAL_LABELS,
  maximumCost,
  optimize,
  type Goal,
} from '../model/optimizer.ts'
import { Fold } from './Fold.tsx'
import { formatEuro, formatNumber, formatPercent } from './format.ts'
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
 * Der Optimierer: Budget oder Ziel vorgeben, Vorschlag ablesen und ins
 * Raster übernehmen. Kosten wahlweise nur für den Bau oder über einen
 * Zeitraum mit Pflege, Erneuerung, Förderung und Einsparungen.
 */
export function OptimizerPanel({ grid, weather, onApply }: OptimizerPanelProps) {
  const goalId = useId()
  const [mode, setMode] = useState<'budget' | 'target'>('budget')
  const [budget, setBudget] = useState(150_000)
  const [targetK, setTargetK] = useState(1)
  const [goal, setGoal] = useState<Goal>('mean')
  const [settings, setSettings] = useState<CostSettings>(DEFAULT_COST_SETTINGS)
  const [presetId, setPresetId] = useState('none')

  const costs = useMemo(() => costTable(settings), [settings])
  const budgetLimit = Math.max(
    BUDGET_STEP,
    Math.ceil(maximumCost(grid, costs) / BUDGET_STEP) * BUDGET_STEP,
  )
  const effectiveBudget = Math.min(budget, budgetLimit)
  const proposal = useMemo(
    () =>
      mode === 'budget'
        ? optimize(grid, weather, effectiveBudget, goal, costs)
        : optimize(grid, weather, 0, goal, costs, targetK),
    [grid, weather, effectiveBudget, goal, costs, mode, targetK],
  )
  const targetLimit = Math.max(0.1, Math.floor(proposal.maxCoolingK * 10) / 10)

  const used = ACTION_KINDS.filter((kind) => proposal.byKind[kind].count > 0).sort(
    (a, b) => proposal.byKind[b].coolingK - proposal.byKind[a].coolingK,
  )
  const cellArea = grid.cellSizeM ** 2
  const lifecycle = settings.basis === 'lifecycle'
  const costWord = lifecycle ? `über ${settings.years} Jahre` : 'für den Bau'
  const fundingNote = presetId === 'none' ? '' : ', nach Förderung'

  return (
    <div className="optimizer">
      <div className="toggle toggle-wide" role="group" aria-label="Was wird vorgegeben?">
        <button type="button" aria-pressed={mode === 'budget'} onClick={() => setMode('budget')}>
          Budget vorgeben
        </button>
        <button type="button" aria-pressed={mode === 'target'} onClick={() => setMode('target')}>
          Ziel vorgeben
        </button>
      </div>

      <div className="optimizer-inputs">
        {mode === 'budget' ? (
          <Slider
            label={`Budget ${costWord}`}
            display={formatEuro(effectiveBudget)}
            value={effectiveBudget}
            min={0}
            max={budgetLimit}
            step={BUDGET_STEP}
            hint={`Alles umzubauen würde etwa ${formatEuro(budgetLimit)} kosten (${costWord}${fundingNote}).`}
            onChange={setBudget}
          />
        ) : (
          <Slider
            label="Gewünschte Abkühlung"
            display={`−${formatNumber(Math.min(targetK, targetLimit))} °C`}
            value={Math.min(targetK, targetLimit)}
            min={0.1}
            max={targetLimit}
            step={0.1}
            hint={`Mit allen Maßnahmen wären höchstens −${formatNumber(proposal.maxCoolingK)} °C möglich.`}
            onChange={setTargetK}
          />
        )}
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
          {mode === 'budget' && effectiveBudget === 0
            ? 'Budget einstellen, um einen Vorschlag zu erhalten.'
            : 'Hier ist keine Maßnahme möglich, oder das Viertel hat keine Flächen, die sich umbauen lassen.'}
        </p>
      ) : (
        <>
          <p className="optimizer-result">
            {mode === 'budget' ? (
              <>
                Mit <b>{formatEuro(proposal.totalCost)}</b> ({costWord}
                {fundingNote}) lassen sich{' '}
              </>
            ) : (
              <>
                Für <b>−{formatNumber(Math.min(targetK, targetLimit))} °C</b> braucht es mindestens{' '}
                <b>{formatEuro(proposal.totalCost)}</b> ({costWord}
                {fundingNote}). Dafür werden{' '}
              </>
            )}
            <b>{formatNumber(proposal.actions.length * cellArea, 0)} m²</b>{' '}
            {mode === 'budget' ? 'umbauen' : 'umgebaut'}. Das kühlt das
            Viertel im Ziel „{GOAL_LABELS[goal]}" um <b>{formatNumber(proposal.coolingK, 2)} °C</b>.
            Am meisten trägt <b>{ACTION_LABELS[used[0]]}</b> bei.
            {mode === 'target' && !proposal.reached && ' Das Ziel ist mit den möglichen Maßnahmen nicht ganz erreichbar.'}
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

      <Fold
        title="Kosten und Förderung"
        note={`${lifecycle ? `${settings.years} Jahre` : 'nur Bau'}, ${
          FUNDING_PRESETS.find((preset) => preset.id === presetId)?.label ?? 'eigene Förderung'
        }`}
      >
        <div className="toggle toggle-wide" role="group" aria-label="Welche Kosten zählen?">
          <button
            type="button"
            aria-pressed={!lifecycle}
            onClick={() => setSettings({ ...settings, basis: 'build' })}
          >
            Nur Baukosten
          </button>
          <button
            type="button"
            aria-pressed={lifecycle}
            onClick={() => setSettings({ ...settings, basis: 'lifecycle' })}
          >
            Kosten über Jahre
          </button>
        </div>
        {lifecycle && (
          <>
            <Slider
              label="Zeitraum"
              display={`${settings.years} Jahre`}
              value={settings.years}
              min={5}
              max={40}
              step={5}
              hint="Bau, Erneuerung nach Ende der Lebensdauer, Pflege und Einsparungen in diesem Zeitraum. Ohne Zinsen und Preissteigerung."
              onChange={(years) => setSettings({ ...settings, years })}
            />
            <Slider
              label="Wert des Solarstroms"
              display={`${formatNumber(settings.electricityPrice * 100, 0)} ct/kWh`}
              value={settings.electricityPrice}
              min={0}
              max={0.3}
              step={0.01}
              hint="Einspeisung bringt etwa 7 ct/kWh, selbst genutzter Strom spart über 20 ct/kWh."
              onChange={(electricityPrice) => setSettings({ ...settings, electricityPrice })}
            />
            <Slider
              label="Niederschlagswassergebühr"
              display={`${formatNumber(settings.rainFee, 2)} €/m² im Jahr`}
              value={settings.rainFee}
              min={0}
              max={2}
              step={0.05}
              hint="Gebühr für Flächen, deren Regen in den Kanal fließt (Bremen 0,83, Münster 0,95, Dortmund 1,80 €)."
              onChange={(rainFee) => setSettings({ ...settings, rainFee })}
            />
          </>
        )}

        <div className="funding-presets" role="group" aria-label="Förderung">
          {FUNDING_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="swatch"
              aria-pressed={presetId === preset.id}
              title={preset.hint}
              onClick={() => {
                setPresetId(preset.id)
                setSettings({ ...settings, funding: fundingFor(preset.id) })
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <p className="slider-hint">
          {FUNDING_PRESETS.find((preset) => preset.id === presetId)?.hint ??
            'Eigene Förderquoten aus der Tabelle.'}{' '}
          Förderprogramme ändern sich oft und gelten nicht überall; vor einer Planung bei der Stadt
          nachfragen.
        </p>

        <div className="table-scroll">
          <table className="cost-table">
            <thead>
              <tr>
                <th scope="col">Maßnahme</th>
                <th scope="col">Bau €/m²</th>
                <th scope="col">Förderung</th>
                {lifecycle && <th scope="col">Pflege, Erneuerung, Ersparnis</th>}
                <th scope="col">{lifecycle ? `Summe ${settings.years} J.` : 'Summe'}</th>
              </tr>
            </thead>
            <tbody>
              {MEASURES.map((measure) => {
                const breakdown = costBreakdown(measure.id, settings)
                const extras = [
                  breakdown.builds > 1 ? `${breakdown.builds}× gebaut` : '',
                  breakdown.maintenance > 0 ? `Pflege ${formatEuro(breakdown.maintenance)}` : '',
                  breakdown.savings > 0 ? `− ${formatEuro(breakdown.savings)}` : '',
                ].filter(Boolean)
                return (
                  <tr key={measure.id}>
                    <th scope="row" title={MEASURE_BY_ID[measure.id].cost.note}>
                      {measure.label}
                      {measure.cost.confidence !== 'belegt' && (
                        <span className="confidence"> ({measure.cost.confidence})</span>
                      )}
                    </th>
                    <td>
                      <input
                        className="cost-number"
                        type="number"
                        min={1}
                        max={2000}
                        step={5}
                        aria-label={`Baukosten ${measure.label} in Euro pro Quadratmeter`}
                        value={settings.build[measure.id]}
                        onChange={(event) => {
                          const value = Number(event.target.value)
                          if (value >= 1)
                            setSettings({ ...settings, build: { ...settings.build, [measure.id]: value } })
                        }}
                      />
                    </td>
                    <td>
                      <input
                        className="cost-number"
                        type="number"
                        min={0}
                        max={100}
                        step={5}
                        aria-label={`Förderquote ${measure.label} in Prozent`}
                        value={Math.round(settings.funding[measure.id] * 100)}
                        onChange={(event) => {
                          const value = Number(event.target.value)
                          if (value >= 0 && value <= 100) {
                            setPresetId('custom')
                            setSettings({
                              ...settings,
                              funding: { ...settings.funding, [measure.id]: value / 100 },
                            })
                          }
                        }}
                      />{' '}
                      %
                    </td>
                    {lifecycle && <td className="cost-extras">{extras.join(', ') || '–'}</td>}
                    <td>{formatEuro(breakdown.total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="note">
          Richtwerte mit Spannweiten und Quellen in docs/kosten.md; „grob" und „Annahme" markieren
          unsichere Werte. Maus über den Namen zeigt die Herkunft. Eine negative Summe heißt: Die
          Maßnahme bezahlt sich im Zeitraum selbst; der Optimierer rechnet sie dann mit 1 €/m².
          Förderanteil insgesamt: {formatPercent(
            MEASURES.reduce((sum, measure) => sum + settings.funding[measure.id], 0) / MEASURES.length,
          )}{' '}
          im Mittel über alle Maßnahmen.
        </p>
      </Fold>
    </div>
  )
}
