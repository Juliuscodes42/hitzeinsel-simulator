/**
 * Wurzel-Komponente: hält den Zustand der App und verbindet Regler,
 * Modell und Darstellung.
 *
 * Datenfluss:
 *   Regler → Ausgangsviertel (Ist) → + Maßnahmen + gemalte Zellen (Soll)
 *          → Simulation beider Raster → Raster-Ansicht und Kennzahlen
 */

import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { BrushPalette, type Brush } from './components/BrushPalette.tsx'
import { CityGridView, type ViewMode } from './components/CityGridView.tsx'
import { ControlPanel } from './components/ControlPanel.tsx'
import { formatDelta, formatHour, formatPercent, formatTemp } from './components/format.ts'
import { Slider } from './components/Slider.tsx'
import { TemperatureLegend } from './components/TemperatureLegend.tsx'
import { MATERIALS } from './data/materials.ts'
import { DEFAULT_WEATHER, airTemperatureC } from './model/atmosphere.ts'
import {
  NO_MEASURES,
  applyMeasures,
  applyOverrides,
  cellRanks,
  generateDistrict,
  sealedShare,
  type DistrictParams,
} from './model/district.ts'
import { surfaceTempAt } from './model/energyBalance.ts'
import { meanSurfaceTempAt, simulateGrid, type GridCell } from './model/grid.ts'

const DEFAULT_DISTRICT: DistrictParams = { sealing: 0.75, density: 0.35, seed: 7 }
const NO_OVERRIDES: ReadonlyMap<number, GridCell> = new Map()

export default function App() {
  const [weather, setWeather] = useState(DEFAULT_WEATHER)
  const [district, setDistrict] = useState(DEFAULT_DISTRICT)
  const [measures, setMeasures] = useState(NO_MEASURES)
  const [overrides, setOverrides] = useState(NO_OVERRIDES)
  const [brush, setBrush] = useState<Brush>(null)
  const [hour, setHour] = useState(15)
  const [view, setView] = useState<ViewMode>('temperature')
  const [inspected, setInspected] = useState<number | null>(null)

  // Beim schnellen Ziehen eines Reglers darf die Rechnung kurz hinterherhinken,
  // damit der Regler selbst flüssig bleibt.
  const liveWeather = useDeferredValue(weather)
  const liveDistrict = useDeferredValue(district)
  const liveMeasures = useDeferredValue(measures)

  // Ist-Zustand: das Viertel ohne Maßnahmen.
  const baseGrid = useMemo(() => generateDistrict(liveDistrict), [liveDistrict])
  const ranks = useMemo(
    () => cellRanks(liveDistrict.seed, baseGrid.cells.length),
    [liveDistrict.seed, baseGrid.cells.length],
  )
  // Soll-Zustand: mit Maßnahmen und von Hand gemalten Zellen.
  const grid = useMemo(
    () => applyOverrides(applyMeasures(baseGrid, liveMeasures, ranks), overrides),
    [baseGrid, liveMeasures, ranks, overrides],
  )

  const baseResult = useMemo(() => simulateGrid(baseGrid, liveWeather), [baseGrid, liveWeather])
  const result = useMemo(() => simulateGrid(grid, liveWeather), [grid, liveWeather])

  const paint = useCallback(
    (index: number) => {
      if (!brush) return
      setOverrides((previous) => {
        const current = grid.cells[index]
        const next = new Map(previous)
        if (brush.kind === 'erase') {
          if (!previous.has(index)) return previous
          next.delete(index)
        } else if (brush.kind === 'mist') {
          if (current.mist) return previous
          next.set(index, { ...current, mist: true })
        } else {
          if (current.surface === brush.surface && !current.mist) return previous
          next.set(index, { surface: brush.surface, mist: false })
        }
        return next
      })
    },
    [brush, grid],
  )

  const baseMean = meanSurfaceTempAt(baseResult, hour)
  const mean = meanSurfaceTempAt(result, hour)
  const hottest = Math.max(...result.cells.map((cell) => surfaceTempAt(cell, hour)))
  const inspectedCell = inspected === null ? null : grid.cells[inspected]

  return (
    <div className="app">
      <header className="app-header">
        <p className="kennung">Jugend forscht 2027</p>
        <h1>Hitzeinsel-Simulator</h1>
        <p className="untertitel">
          Wie heiß wird ein Stadtviertel, und was bringen Bäume, Gründächer und entsiegelte
          Flächen?
        </p>
      </header>

      <main className="layout">
        <ControlPanel
          weather={weather}
          onWeatherChange={setWeather}
          district={district}
          onDistrictChange={(next) => {
            // Ein neu gewürfeltes Viertel passt nicht mehr zu den gemalten Zellen.
            if (next.seed !== district.seed) setOverrides(NO_OVERRIDES)
            setDistrict(next)
          }}
          measures={measures}
          onMeasuresChange={setMeasures}
          onResetMeasures={() => setMeasures(NO_MEASURES)}
        />

        <div className="stage">
          <section className="kpis" aria-label="Kennzahlen">
            <div className="kpi">
              <p className="kpi-label">Ohne Maßnahmen (Ist)</p>
              <p className="kpi-value">{formatTemp(baseMean)}</p>
            </div>
            <div className="kpi">
              <p className="kpi-label">Mit Maßnahmen (Soll)</p>
              <p className="kpi-value">{formatTemp(mean)}</p>
              <p className={`kpi-note${mean < baseMean - 0.05 ? ' is-cooler' : ''}`}>
                {formatDelta(mean - baseMean)}
              </p>
            </div>
            <div className="kpi">
              <p className="kpi-label">Heißeste Fläche</p>
              <p className="kpi-value">{formatTemp(hottest)}</p>
              <p className="kpi-note">Luft: {formatTemp(airTemperatureC(liveWeather, hour))}</p>
            </div>
            <div className="kpi">
              <p className="kpi-label">Versiegelt</p>
              <p className="kpi-value">{formatPercent(sealedShare(grid))}</p>
              <p className="kpi-note">Ist: {formatPercent(sealedShare(baseGrid))}</p>
            </div>
          </section>
          <p className="kpi-caption">
            Mittlere Oberflächentemperatur des Viertels um {formatHour(hour)} Uhr.
          </p>

          <section className="panel map-panel" aria-labelledby="karte">
            <div className="panel-head">
              <h2 id="karte">Stadtraster</h2>
              <div className="toggle" role="group" aria-label="Ansicht">
                <button
                  type="button"
                  aria-pressed={view === 'temperature'}
                  onClick={() => setView('temperature')}
                >
                  Temperatur
                </button>
                <button
                  type="button"
                  aria-pressed={view === 'surface'}
                  onClick={() => setView('surface')}
                >
                  Flächen
                </button>
              </div>
            </div>

            <CityGridView
              grid={grid}
              result={result}
              hour={hour}
              view={view}
              painting={brush !== null}
              onPaint={paint}
              onInspect={setInspected}
            />

            <p className="inspect" aria-live="polite">
              {inspected !== null && inspectedCell
                ? `${MATERIALS[inspectedCell.surface].label}${
                    inspectedCell.mist ? ' mit Sprühnebel' : ''
                  }: ${formatTemp(surfaceTempAt(result.cells[inspected], hour))} um ${formatHour(
                    hour,
                  )} Uhr, Tageshöchstwert ${formatTemp(result.cells[inspected].maxC)}`
                : 'Zelle berühren oder mit den Pfeiltasten ansteuern, um Werte zu sehen. Eine Zelle ist 10 m × 10 m groß.'}
            </p>

            {view === 'temperature' && <TemperatureLegend />}

            <Slider
              label="Uhrzeit"
              display={`${formatHour(hour)} Uhr`}
              value={hour}
              min={0}
              max={23.5}
              step={0.5}
              hint="Um 4 Uhr zeigt sich der nächtliche Hitzestau, um 14 bis 15 Uhr die größte Hitze."
              onChange={setHour}
            />
          </section>

          <section className="panel" aria-labelledby="pinsel">
            <h2 id="pinsel">Selbst umbauen</h2>
            <BrushPalette
              brush={brush}
              onChange={setBrush}
              paintedCount={overrides.size}
              onClear={() => setOverrides(NO_OVERRIDES)}
            />
          </section>
        </div>
      </main>
    </div>
  )
}
