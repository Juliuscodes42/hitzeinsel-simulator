/**
 * Wurzel-Komponente: hält den Zustand der App und verbindet Regler,
 * Modell und Darstellung.
 *
 * Datenfluss:
 *   Regler → Ausgangsviertel (Ist) → + Maßnahmen + gemalte Zellen (Soll)
 *          → Simulation beider Raster → Raster-Ansicht und Kennzahlen
 */

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { DEFAULT_ALIGNMENT } from './components/alignment.ts'
import { BackgroundControls } from './components/BackgroundControls.tsx'
import { BrushPalette, type Brush } from './components/BrushPalette.tsx'
import { CityGridView, type ViewMode } from './components/CityGridView.tsx'
import { ControlPanel, type GridSource } from './components/ControlPanel.tsx'
import { CorrectionControls } from './components/CorrectionControls.tsx'
import { DayChart } from './components/DayChart.tsx'
import {
  formatDelta,
  formatHour,
  formatLitres,
  formatNumber,
  formatPercent,
  formatTemp,
} from './components/format.ts'
import { FormulaDialog } from './components/FormulaDialog.tsx'
import { OptimizerPanel } from './components/OptimizerPanel.tsx'
import { PlacePicker } from './components/PlacePicker.tsx'
import { Slider } from './components/Slider.tsx'
import { TemperatureLegend } from './components/TemperatureLegend.tsx'
import { ValidationPanel } from './components/ValidationPanel.tsx'
import {
  applyCorrection,
  correctionFromGrid,
  loadCorrections,
  placeKey,
  storeCorrections,
  type Corrections,
} from './data/corrections.ts'
import { MATERIALS } from './data/materials.ts'
import { IMAGERY_ATTRIBUTION, OSM_ATTRIBUTION, type Place } from './data/places.ts'
import { DEFAULT_WEATHER, airTemperatureC, daylight } from './model/atmosphere.ts'
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
import {
  meanAlbedo,
  meanDailyCurve,
  meanSurfaceTempAt,
  simulateGrid,
  type GridCell,
} from './model/grid.ts'
import { rainBalance } from './model/water.ts'

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
  const [rainMm, setRainMm] = useState(40)
  const [formulasOpen, setFormulasOpen] = useState(false)
  // Echter Ort und Bild unter dem Raster
  const [mode, setMode] = useState<GridSource>('example')
  const [place, setPlace] = useState<Place | null>(null)
  const [customImage, setCustomImage] = useState<string | null>(null)
  const [alignment, setAlignment] = useState(DEFAULT_ALIGNMENT)
  const [cellOpacity, setCellOpacity] = useState(0.65)
  const [weatherLabel, setWeatherLabel] = useState<string | null>(null)
  const [corrections, setCorrections] = useState<Corrections>(loadCorrections)

  // Beim schnellen Ziehen eines Reglers darf die Rechnung kurz hinterherhinken,
  // damit der Regler selbst flüssig bleibt.
  const liveWeather = useDeferredValue(weather)
  const liveDistrict = useDeferredValue(district)
  const liveMeasures = useDeferredValue(measures)

  // Ist-Zustand: das Viertel ohne Maßnahmen.
  const activePlace = mode === 'place' ? place : null
  const activeKey = activePlace ? placeKey(activePlace) : null
  const activeCorrection = activeKey ? corrections[activeKey] : undefined
  // Ist-Zustand: echter Ort (mit Korrektur, falls gespeichert) oder Beispielviertel.
  const baseGrid = useMemo(
    () =>
      activePlace
        ? applyCorrection(activePlace.grid, activeCorrection)
        : generateDistrict(liveDistrict),
    [activePlace, activeCorrection, liveDistrict],
  )

  /** Übernimmt geänderte Korrekturen und merkt sie sich auf diesem Gerät. */
  const updateCorrections = (next: Corrections) => {
    setCorrections(next)
    storeCorrections(next)
    setOverrides(NO_OVERRIDES)
  }
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
  const baseCurve = useMemo(() => meanDailyCurve(baseResult), [baseResult])
  const curve = useMemo(() => meanDailyCurve(result), [result])
  const { sunrise, sunset } = useMemo(() => daylight(liveWeather), [liveWeather])

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

  // Adresse des hochgeladenen Bilds wieder freigeben, wenn es ersetzt wird.
  useEffect(() => {
    if (!customImage) return
    return () => URL.revokeObjectURL(customImage)
  }, [customImage])

  // Wetter wird für den geladenen Ort geholt, sonst für den Standardort Elmshorn.
  const weatherLocation = activePlace
    ? {
        name: activePlace.name.split(',')[0],
        lat: (activePlace.bbox.north + activePlace.bbox.south) / 2,
        lon: (activePlace.bbox.east + activePlace.bbox.west) / 2,
      }
    : { name: 'Elmshorn', lat: DEFAULT_WEATHER.latitudeDeg, lon: 9.65 }

  const background = customImage
    ? { url: customImage, ...alignment }
    : activePlace
      ? { url: activePlace.imageUrl, ...DEFAULT_ALIGNMENT }
      : null

  // Ohne Bild gibt es keine Luftbild-Ansicht; dann wird die Temperatur gezeigt.
  const shownView: ViewMode = view === 'aerial' && !background ? 'temperature' : view

  const baseMean = meanSurfaceTempAt(baseResult, hour)
  const mean = meanSurfaceTempAt(result, hour)
  const hottest = Math.max(...result.cells.map((cell) => surfaceTempAt(cell, hour)))
  const inspectedCell = inspected === null ? null : grid.cells[inspected]
  const baseRain = rainBalance(baseGrid, rainMm)
  const rain = rainBalance(grid, rainMm)
  const baseAlbedo = meanAlbedo(baseGrid)
  const albedo = meanAlbedo(grid)
  const areaHectares = (grid.cells.length * grid.cellSizeM ** 2) / 10_000

  return (
    <div className="app">
      <header className="app-header">
        <p className="kennung">Jugend forscht 2027</p>
        <h1>Hitzeinsel-Simulator</h1>
        <p className="untertitel">
          Wie heiß wird ein Stadtviertel, und was bringen Bäume, Gründächer und entsiegelte
          Flächen?
        </p>
        <button type="button" className="button" onClick={() => setFormulasOpen(true)}>
          Formeln und Annahmen
        </button>
      </header>

      <main className="layout">
        <ControlPanel
          weather={weather}
          onWeatherChange={setWeather}
          weatherLocation={weatherLocation}
          weatherLabel={weatherLabel}
          onWeatherLoaded={(loaded, label) => {
            setWeather(loaded)
            setWeatherLabel(label)
          }}
          onWeatherReset={() => {
            setWeather(DEFAULT_WEATHER)
            setWeatherLabel(null)
          }}
          rainMm={rainMm}
          onRainChange={setRainMm}
          mode={mode}
          onModeChange={(next) => {
            if (next !== mode) setOverrides(NO_OVERRIDES)
            setMode(next)
          }}
          placeSummary={
            place
              ? `${place.name}. Flächen aus OpenStreetMap, ${formatPercent(place.guessedShare)} der Zellen sind geschätzt und sollten geprüft werden.`
              : null
          }
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
          {mode === 'place' && (
            <section className="panel" aria-labelledby="ort">
              <div>
                <h2 id="ort">Ort wählen</h2>
                <p className="panel-lead">
                  Der gelbe Rahmen zeigt 200 m × 200 m. Gebäude, Straßen, Parkplätze und
                  Grünflächen kommen aus OpenStreetMap. Was dort fehlt, lässt sich unten mit dem
                  Pinsel nachtragen.
                </p>
              </div>
              <PlacePicker
                onLoaded={(loaded) => {
                  setPlace(loaded)
                  setOverrides(NO_OVERRIDES)
                  setView('aerial')
                }}
              />
              {activePlace && activeKey && (
                <CorrectionControls
                  placeKey={activeKey}
                  corrections={corrections}
                  hasUnsavedChanges={overrides.size > 0}
                  onSave={() =>
                    updateCorrections({
                      ...corrections,
                      // Gespeichert wird das Raster ohne Regler-Maßnahmen, nur mit gemalten Zellen.
                      [activeKey]: correctionFromGrid(
                        applyOverrides(baseGrid, overrides),
                        new Date().toISOString().slice(0, 10),
                      ),
                    })
                  }
                  onRestoreOriginal={() => {
                    const { [activeKey]: _removed, ...rest } = corrections
                    updateCorrections(rest)
                  }}
                  onImport={(imported) => updateCorrections({ ...corrections, ...imported })}
                />
              )}
            </section>
          )}

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
              <p className="kpi-label">Regenrückhalt</p>
              <p className="kpi-value">{formatLitres(rain.retainedL)}</p>
              <p className={`kpi-note${rain.retainedL > baseRain.retainedL + 1 ? ' is-cooler' : ''}`}>
                Ist: {formatLitres(baseRain.retainedL)}
              </p>
            </div>
            <div className="kpi">
              <p className="kpi-label">Mittlere Albedo</p>
              <p className="kpi-value">{formatNumber(albedo, 2)}</p>
              <p className="kpi-note">Ist: {formatNumber(baseAlbedo, 2)}</p>
            </div>
            <div className="kpi">
              <p className="kpi-label">Versiegelt</p>
              <p className="kpi-value">{formatPercent(sealedShare(grid))}</p>
              <p className="kpi-note">Ist: {formatPercent(sealedShare(baseGrid))}</p>
            </div>
          </section>
          <p className="kpi-caption">
            Temperaturen: Mittel aller Oberflächen um {formatHour(hour)} Uhr. Regenrückhalt: bei{' '}
            {formatNumber(rainMm, 0)} mm Starkregen auf {formatNumber(areaHectares, 0)} Hektar.
          </p>

          <section className="panel map-panel" aria-labelledby="karte">
            <div className="panel-head">
              <h2 id="karte">Stadtraster</h2>
              <div className="toggle" role="group" aria-label="Ansicht">
                {background && (
                  <button
                    type="button"
                    aria-pressed={shownView === 'aerial'}
                    onClick={() => setView('aerial')}
                  >
                    Luftbild
                  </button>
                )}
                <button
                  type="button"
                  aria-pressed={shownView === 'temperature'}
                  onClick={() => setView('temperature')}
                >
                  Temperatur
                </button>
                <button
                  type="button"
                  aria-pressed={shownView === 'surface'}
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
              view={shownView}
              baseCells={baseGrid.cells}
              background={background}
              cellOpacity={cellOpacity}
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

            {activePlace && (
              <p className="attribution">
                {customImage ? OSM_ATTRIBUTION : `${IMAGERY_ATTRIBUTION} · ${OSM_ATTRIBUTION}`}
              </p>
            )}

            {shownView === 'aerial' && (
              <p className="slider-hint aerial-hint">
                Luftbild mit Raster. Farbig sind nur Flächen, die durch Maßnahmen, den Vorschlag
                oder den Pinsel umgebaut wurden. Die Farben stehen unten bei „Selbst umbauen".
              </p>
            )}
            {shownView === 'temperature' && <TemperatureLegend />}

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

            <BackgroundControls
              hasBackground={background !== null && shownView !== 'aerial'}
              cellOpacity={cellOpacity}
              onCellOpacityChange={setCellOpacity}
              hasCustomImage={customImage !== null}
              onCustomImage={(file) => {
                setCustomImage(file ? URL.createObjectURL(file) : null)
                if (file) setView('aerial')
                setAlignment(DEFAULT_ALIGNMENT)
              }}
              alignment={alignment}
              onAlignmentChange={setAlignment}
            />
          </section>

          <section className="panel" aria-labelledby="tagesgang">
            <div>
              <h2 id="tagesgang">Tagesgang über 24 Stunden</h2>
              <p className="panel-lead">
                Mittlere Oberflächentemperatur des Viertels. Versiegelte Flächen speichern die
                Hitze und bleiben nachts warm, begrünte kühlen schneller ab. Ein Klick ins
                Diagramm stellt die Uhrzeit des Rasters ein.
              </p>
            </div>
            <DayChart
              base={baseCurve}
              improved={curve}
              hour={hour}
              onHourChange={setHour}
              sunrise={sunrise}
              sunset={sunset}
            />
          </section>

          <section className="panel" aria-labelledby="vorschlag">
            <div>
              <h2 id="vorschlag">Vorschlag berechnen</h2>
              <p className="panel-lead">
                Der Optimierer sucht für das Viertel ohne Maßnahmen die Kombination, die mit dem
                Budget am stärksten kühlt.
              </p>
            </div>
            <OptimizerPanel
              grid={baseGrid}
              weather={liveWeather}
              onApply={(cells) => {
                setMeasures(NO_MEASURES)
                setOverrides(cells)
              }}
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

          <section className="panel" aria-labelledby="pruefung">
            <div>
              <h2 id="pruefung">Vergleich mit Satellitenmessungen</h2>
              <p className="panel-lead">
                Stimmt das Modell? An den Beispielorten wird es mit Oberflächentemperaturen
                verglichen, die der Satellit Landsat an heißen Sommertagen gemessen hat.
              </p>
            </div>
            <ValidationPanel corrections={corrections} />
          </section>
        </div>
      </main>

      <FormulaDialog
        open={formulasOpen}
        onClose={() => setFormulasOpen(false)}
        weather={liveWeather}
        hour={hour}
      />
    </div>
  )
}
