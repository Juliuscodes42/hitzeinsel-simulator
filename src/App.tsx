/**
 * Wurzel-Komponente: hält den Zustand der App und verbindet Regler,
 * Modell und Darstellung.
 *
 * Die Seite führt in vier Schritten durch die Arbeit:
 *   1 Ort wählen → 2 Ausgangslage prüfen → 3 Maßnahmen wählen → 4 Ergebnis
 * Ab Schritt 2 steht links das Raster, rechts der Inhalt des Schritts.
 * Seltener gebrauchte Einstellungen sind aufklappbar (Fold).
 *
 * Datenfluss:
 *   Regler → Ausgangsviertel (Ist) → + Maßnahmen + gemalte Zellen (Soll)
 *          → Simulation beider Raster → Raster-Ansicht und Kennzahlen
 */

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_ALIGNMENT } from './components/alignment.ts'
import { BackgroundControls } from './components/BackgroundControls.tsx'
import { BrushPalette, type Brush } from './components/BrushPalette.tsx'
import { CityGridView, type GridMarker, type ViewMode } from './components/CityGridView.tsx'
import { CorrectionControls } from './components/CorrectionControls.tsx'
import { describeCell } from './components/cellText.ts'
import { DayChart } from './components/DayChart.tsx'
import { DistrictControls } from './components/DistrictControls.tsx'
import { Fold } from './components/Fold.tsx'
import {
  formatDelta,
  formatHour,
  formatLitres,
  formatNumber,
  formatPercent,
  formatTemp,
} from './components/format.ts'
import { FormulaDialog } from './components/FormulaDialog.tsx'
import { MeasureControls } from './components/MeasureControls.tsx'
import { RecognitionPanel, type MarkingTool } from './components/RecognitionPanel.tsx'
import { OptimizerPanel } from './components/OptimizerPanel.tsx'
import { PlacePicker } from './components/PlacePicker.tsx'
import { Slider } from './components/Slider.tsx'
import { Stepper } from './components/Stepper.tsx'
import { STEPS } from './components/steps.ts'
import { SurfaceLegend } from './components/SurfaceLegend.tsx'
import { TemperatureLegend } from './components/TemperatureLegend.tsx'
import { ValidationPanel } from './components/ValidationPanel.tsx'
import { WeatherControls } from './components/WeatherControls.tsx'
import {
  applyCorrection,
  correctionFromGrid,
  loadCorrections,
  placeKey,
  storeCorrections,
  type Corrections,
} from './data/corrections.ts'
import { MEASURE_BY_ID, canApply } from './data/measures.ts'
import { loadRegionalWeather, type RegionalWeather } from './data/regionalWeather.ts'
import { DEFAULT_LOCATION } from './data/weatherService.ts'
import { OSM_ATTRIBUTION, type Place } from './data/places.ts'
import {
  NO_POINTS,
  loadPoints,
  storePoints,
  withPoint,
  type PlacePoints,
} from './data/recognitionPoints.ts'
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
import type { ReturnPeriod } from './model/heavyRain.ts'
import { measureAccuracy, trainClassifier } from './model/learning.ts'
import { recognize } from './model/recognition.ts'
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

/** Woher das Raster kommt: erzeugtes Beispielviertel oder echter Ort. */
type GridSource = 'example' | 'place'

/** Überschrift und Erklärung der Schritte 2 bis 4. */
const STEP_TEXT = [
  null,
  {
    title: 'Ausgangslage prüfen',
    lead: 'So sieht das Modell den Ort heute, ohne Umbauten. Passt das Raster zum Luftbild? Dann geht es weiter.',
  },
  {
    title: 'Maßnahmen wählen',
    lead: 'Drei Wege zum kühleren Viertel. Sie lassen sich auch nacheinander nutzen.',
  },
  {
    title: 'Ergebnis ansehen',
    lead: 'Der Vergleich von heute (Ist) und nach dem Umbau (Soll).',
  },
] as const

export default function App() {
  const [step, setStep] = useState(0)
  const [weather, setWeather] = useState(DEFAULT_WEATHER)
  const [district, setDistrict] = useState(DEFAULT_DISTRICT)
  const [measures, setMeasures] = useState(NO_MEASURES)
  // Von Hand gemalte Zellen: Korrekturen am Ist-Zustand (Schritt 2) und Umbauten (Schritt 3)
  const [fixes, setFixes] = useState(NO_OVERRIDES)
  const [overrides, setOverrides] = useState(NO_OVERRIDES)
  const [brush, setBrush] = useState<Brush>(null)
  const [brushSize, setBrushSize] = useState(1)
  // Bilderkennung: Beispiel- und Prüfpunkte je Ort, gerade gewähltes Markierwerkzeug
  const [allPoints, setAllPoints] = useState<Record<string, PlacePoints>>(loadPoints)
  const [marking, setMarking] = useState<MarkingTool | null>(null)
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
  // Wetter der Region: typischer Hitzetag und Starkregen, automatisch geladen.
  const [regionalLoaded, setRegionalLoaded] = useState<{ key: string; data: RegionalWeather } | null>(null)
  const [regionalFailed, setRegionalFailed] = useState<string | null>(null)
  const [rainPeriod, setRainPeriod] = useState<ReturnPeriod>(30)
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
  const points = (activeKey && allPoints[activeKey]) || NO_POINTS
  const recognition = activePlace?.recognition
  // Gelerntes Verfahren aus den Beispielpunkten (null = zu wenige Beispiele).
  const classifier = useMemo(
    () => (recognition ? trainClassifier(recognition.features, points.training) : null),
    [recognition, points.training],
  )
  // Erkanntes Raster: mit gelerntem Verfahren, sonst das Ergebnis der Regeln.
  const recognizedGrid = useMemo(() => {
    if (!activePlace) return null
    if (!recognition || !classifier) return activePlace.grid
    return recognize(recognition.prior, recognition.sources, recognition.features, classifier).grid
  }, [activePlace, recognition, classifier])

  // Ist-Zustand: echter Ort (mit Korrektur, falls gespeichert) oder Beispielviertel.
  // Dazu kommen die gerade gemalten, noch nicht gespeicherten Korrekturen.
  const baseGrid = useMemo(
    () =>
      applyOverrides(
        recognizedGrid
          ? applyCorrection(recognizedGrid, activeCorrection)
          : generateDistrict(liveDistrict),
        fixes,
      ),
    [recognizedGrid, activeCorrection, liveDistrict, fixes],
  )

  /** Ändert die Punkte des aktuellen Orts und speichert sie auf dem Gerät. */
  const updatePoints = (change: (current: PlacePoints) => PlacePoints) => {
    if (!activeKey) return
    setAllPoints((previous) => {
      const next = { ...previous, [activeKey]: change(previous[activeKey] ?? NO_POINTS) }
      storePoints(next)
      return next
    })
  }

  // Genauigkeit an den Prüfpunkten: OSM allein, Regeln, gelerntes Verfahren.
  const accuracy = useMemo(() => {
    if (!recognition || !activePlace) return null
    const rules = recognize(recognition.prior, recognition.sources, recognition.features).grid
    return {
      osm: measureAccuracy(recognition.prior, points.checks),
      rules: measureAccuracy(rules, points.checks),
      learned: classifier && recognizedGrid ? measureAccuracy(recognizedGrid, points.checks) : null,
    }
  }, [recognition, activePlace, classifier, recognizedGrid, points.checks])

  const markers = useMemo<GridMarker[]>(
    () => [
      ...points.training.map((point) => ({ ...point, kind: 'training' as const })),
      ...points.checks.map((point) => ({ ...point, kind: 'check' as const })),
    ],
    [points],
  )

  /** Übernimmt geänderte Korrekturen und merkt sie sich auf diesem Gerät. */
  const updateCorrections = (next: Corrections) => {
    setCorrections(next)
    storeCorrections(next)
    setFixes(NO_OVERRIDES)
  }
  const ranks = useMemo(
    () => cellRanks(liveDistrict.seed, baseGrid.cells.length, baseGrid.width, baseGrid.cellSizeM),
    [liveDistrict.seed, baseGrid.cells.length, baseGrid.width, baseGrid.cellSizeM],
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

  // Bei feinen Rastern malt der Pinsel einen Kreis aus mehreren Zellen.
  const paintRadius = grid.width > 30 ? brushSize : 0
  const paint = useCallback(
    (index: number) => {
      if (!brush) return
      const cx = index % grid.width
      const cy = Math.floor(index / grid.width)
      const targets: number[] = []
      for (let dy = -paintRadius; dy <= paintRadius; dy++) {
        for (let dx = -paintRadius; dx <= paintRadius; dx++) {
          const x = cx + dx
          const y = cy + dy
          if (dx * dx + dy * dy > paintRadius * paintRadius + paintRadius) continue
          if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) continue
          targets.push(y * grid.width + x)
        }
      }
      // In der Ausgangslage wird der Ist-Zustand korrigiert, danach umgebaut.
      const correcting = step === 1
      const cells = correcting ? baseGrid.cells : grid.cells
      ;(correcting ? setFixes : setOverrides)((previous) => {
        const next = new Map(previous)
        let changed = false
        for (const target of targets) {
          const current = cells[target]
          if (brush.kind === 'erase') {
            changed = next.delete(target) || changed
          } else if (brush.kind === 'measure') {
            // Maßnahmen, die die Fläche ersetzen, gehen vom Ist-Zustand aus; so lässt
            // sich eine Maßnahme durch eine andere übermalen. Zusätzliche Maßnahmen
            // (Sprühnebel, Zisterne) kommen auf das, was schon da ist.
            const measure = MEASURE_BY_ID[brush.measure]
            const start = measure.exclusive ? baseGrid.cells[target] : (next.get(target) ?? current)
            if (!canApply(start, measure) || next.get(target)?.measure === measure.id) continue
            next.set(target, measure.apply(start))
            changed = true
          } else {
            if (current.surface === brush.surface && !current.mist) continue
            next.set(target, { surface: brush.surface, mist: false })
            changed = true
          }
        }
        return changed ? next : previous
      })
    },
    [brush, grid, baseGrid, paintRadius, step],
  )

  /** Klick ins Raster: markieren (Bilderkennung) oder malen. */
  const handleGridPaint = (index: number) => {
    if (marking) {
      updatePoints((current) => withPoint(current, marking.set, index, marking.surface))
      return
    }
    paint(index)
  }

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
    : DEFAULT_LOCATION

  const applyRegionalRef = useRef<(data: RegionalWeather) => void>(() => {})
  const typicalLabel = (data: RegionalWeather) =>
    `Typischer Hitzetag in ${weatherLocation.name}: Mittel der ${data.heatDay.dayCount} heißesten Sommertage ${data.heatDay.firstYear}–${data.heatDay.lastYear}`

  /** Stellt Wetter und Starkregen auf die Werte der Region ein. */
  const applyRegional = (data: RegionalWeather, period = rainPeriod) => {
    setWeather(data.heatDay.weather)
    setWeatherLabel(typicalLabel(data))
    const mm = data.rainMm[period]
    if (mm !== undefined) setRainMm(mm)
  }
  useEffect(() => {
    applyRegionalRef.current = applyRegional
  })

  // Bei jedem neuen Ort das Wetter der Region laden. Von Hand geänderte Regler
  // werden dabei überschrieben, weil sie zum vorherigen Ort gehörten.
  const { lat: weatherLat, lon: weatherLon } = weatherLocation
  const regionKey = `${weatherLat},${weatherLon}`
  useEffect(() => {
    let cancelled = false
    loadRegionalWeather(weatherLat, weatherLon)
      .then((data) => {
        if (cancelled) return
        setRegionalLoaded({ key: `${weatherLat},${weatherLon}`, data })
        applyRegionalRef.current(data)
      })
      .catch(() => {
        if (!cancelled) setRegionalFailed(`${weatherLat},${weatherLon}`)
      })
    return () => {
      cancelled = true
    }
  }, [weatherLat, weatherLon])
  const regional = regionalLoaded?.key === regionKey ? regionalLoaded.data : null
  const regionalStatus = regional ? 'ready' : regionalFailed === regionKey ? 'error' : 'loading'

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

  const anyMeasure = Object.values(measures).some((share) => share > 0)
  const anyChange = anyMeasure || overrides.size > 0
  const cooler = mean < baseMean - 0.05

  /** Wechselt den Schritt und stellt die dazu passende Ansicht des Rasters ein. */
  const goTo = (next: number, hasImage = background !== null) => {
    setStep(next)
    setBrush(null)
    setMarking(null)
    // Ausgangslage: erkannte Flächen. Maßnahmen: Umbauten auf dem Luftbild. Ergebnis: Temperatur.
    if (next === 1) setView('surface')
    if (next === 2) setView(hasImage ? 'aerial' : 'temperature')
    if (next === 3) setView('temperature')
    window.scrollTo({ top: 0 })
  }

  const stepText = STEP_TEXT[step]

  const weatherNote =
    regionalStatus === 'loading' && !regional
      ? 'wird geladen …'
      : `${weatherLabel ? weatherLabel.split(/[:(]/)[0].trim() : 'Standardtag'}, ${formatNumber(weather.tMaxC)} °C`

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <p className="kennung">Jugend forscht 2027</p>
          <h1>Hitzeinsel-Simulator</h1>
          <p className="untertitel">
            Wie heiß wird ein Stadtviertel, und was bringen Bäume, Gründächer und entsiegelte
            Flächen?
          </p>
        </div>
        <button type="button" className="button" onClick={() => setFormulasOpen(true)}>
          Formeln und Annahmen
        </button>
      </header>

      <Stepper step={step} onStep={(next) => goTo(next)} />

      <main>
        {step === 0 && (
          <section className="panel step-panel step-start" aria-labelledby="schritt-titel">
            <div>
              <p className="step-count">Schritt 1 von {STEPS.length}</p>
              <h2 id="schritt-titel">Welchen Ort möchtest du untersuchen?</h2>
              <p className="panel-lead">
                Untersucht wird ein Ausschnitt von 200 m × 200 m. Danach prüfst du die
                Ausgangslage, wählst Maßnahmen und siehst, wie viel kühler es wird.
              </p>
            </div>
            <PlacePicker
              onLoaded={(loaded) => {
                setPlace(loaded)
                setMode('place')
                setFixes(NO_OVERRIDES)
                setOverrides(NO_OVERRIDES)
                setMeasures(NO_MEASURES)
                setCustomImage(null)
                goTo(1, true)
              }}
              onDistrict={() => {
                if (mode !== 'example') {
                  setFixes(NO_OVERRIDES)
                  setOverrides(NO_OVERRIDES)
                  setMeasures(NO_MEASURES)
                }
                setMode('example')
                goTo(1, customImage !== null)
              }}
            />
          </section>
        )}

        {step > 0 && stepText && (
          <div className="workspace">
            <section className="panel map-panel" aria-labelledby="karte">
              <div className="panel-head">
                <h2 id="karte">
                  {activePlace ? activePlace.name.split(',')[0] : 'Erfundenes Beispielviertel'}
                </h2>
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
                    aria-pressed={shownView === 'surface'}
                    onClick={() => setView('surface')}
                  >
                    Flächen
                  </button>
                  <button
                    type="button"
                    aria-pressed={shownView === 'temperature'}
                    onClick={() => setView('temperature')}
                  >
                    Temperatur
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
                painting={brush !== null || marking !== null}
                onPaint={handleGridPaint}
                onInspect={setInspected}
                markers={step === 1 ? markers : undefined}
              />

              <p className="inspect" aria-live="polite">
                {inspected !== null && inspectedCell
                  ? `${describeCell(inspectedCell)}: ${formatTemp(surfaceTempAt(result.cells[inspected], hour))} um ${formatHour(
                      hour,
                    )} Uhr, Tageshöchstwert ${formatTemp(result.cells[inspected].maxC)}`
                  : `Zelle berühren, um Werte zu sehen. Eine Zelle ist ${grid.cellSizeM} m × ${grid.cellSizeM} m groß.`}
              </p>

              {shownView === 'aerial' && (
                <p className="slider-hint aerial-hint">
                  Farbig sind nur umgebaute Flächen. Ohne Umbauten ist nur das Luftbild zu sehen.
                </p>
              )}
              {shownView === 'surface' && <SurfaceLegend />}
              {shownView === 'temperature' && <TemperatureLegend />}

              {shownView === 'temperature' && (
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
              )}

              <Fold title="Bild unter dem Raster" note={customImage ? 'eigenes Bild' : undefined}>
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
              </Fold>

              {activePlace && (
                <p className="attribution">
                  {customImage
                    ? OSM_ATTRIBUTION
                    : `${activePlace.imageAttribution} · ${OSM_ATTRIBUTION}`}
                </p>
              )}
            </section>

            <section className="panel step-panel" aria-labelledby="schritt-titel">
              <div>
                <p className="step-count">
                  Schritt {step + 1} von {STEPS.length}
                </p>
                <h2 id="schritt-titel">{stepText.title}</h2>
                <p className="panel-lead">{stepText.lead}</p>
              </div>

              {step === 1 && (
                <>
                  <div className="kpis">
                    <div className="kpi">
                      <p className="kpi-label">Oberflächen im Mittel</p>
                      <p className="kpi-value">{formatTemp(baseMean)}</p>
                      <p className="kpi-note">um {formatHour(hour)} Uhr</p>
                    </div>
                    <div className="kpi">
                      <p className="kpi-label">Luft</p>
                      <p className="kpi-value">{formatTemp(airTemperatureC(liveWeather, hour))}</p>
                      <p className="kpi-note">um {formatHour(hour)} Uhr</p>
                    </div>
                    <div className="kpi">
                      <p className="kpi-label">Versiegelt</p>
                      <p className="kpi-value">{formatPercent(sealedShare(baseGrid))}</p>
                    </div>
                  </div>

                  {activePlace?.notice && <p className="slider-hint is-error">{activePlace.notice}</p>}
                  {activePlace && recognition && (
                    <p className="slider-hint">
                      Die Flächen wurden im Luftbild erkannt: Gebäude, Straßen und Gewässer aus
                      OpenStreetMap, Pflanzen, Sand und Beläge aus den Farben. Eine Zelle ist 2 m ×
                      2 m groß.
                    </p>
                  )}

                  {activePlace && recognition && accuracy && (
                    <Fold
                      title="Erkennung prüfen und verbessern"
                      note={
                        accuracy.learned && points.checks.length >= 10
                          ? `${formatPercent(accuracy.learned.share)} richtig`
                          : points.checks.length >= 10
                            ? `${formatPercent(accuracy.rules.share)} richtig`
                            : `${formatPercent(activePlace.guessedShare)} unsicher`
                      }
                      onToggle={(open) => {
                        if (!open) setMarking(null)
                        else setBrush(null)
                      }}
                    >
                      <RecognitionPanel
                        points={points}
                        tool={marking}
                        onToolChange={(tool) => {
                          setMarking(tool)
                          if (tool) setBrush(null)
                        }}
                        onClear={(set) => updatePoints((current) => ({ ...current, [set]: [] }))}
                        accuracy={accuracy}
                        learning={classifier !== null}
                      />
                    </Fold>
                  )}

                  {activePlace ? (
                    <Fold
                      title="Flächen von Hand korrigieren"
                      note={fixes.size > 0 ? `${fixes.size} Zellen geändert` : 'mit dem Pinsel'}
                      onToggle={(open) => {
                        if (!open) setBrush(null)
                        else setMarking(null)
                      }}
                    >
                      <p className="slider-hint">
                        Wo das Raster trotzdem nicht zum Luftbild passt: Pinsel wählen, Flächen
                        nachzeichnen und als Korrektur speichern.
                      </p>
                      <BrushPalette
                        mode="surfaces"
                        brush={brush}
                        onChange={(next) => {
                          setBrush(next)
                          if (next) setMarking(null)
                        }}
                        paintedCount={fixes.size}
                        onClear={() => setFixes(NO_OVERRIDES)}
                        size={baseGrid.width > 30 ? brushSize : undefined}
                        onSizeChange={setBrushSize}
                        cellSizeM={baseGrid.cellSizeM}
                      />
                      {activeKey && (
                        <CorrectionControls
                          placeKey={activeKey}
                          corrections={corrections}
                          hasUnsavedChanges={fixes.size > 0}
                          onSave={() =>
                            updateCorrections({
                              ...corrections,
                              // Gespeichert wird das Raster ohne Regler-Maßnahmen, nur mit gemalten Zellen.
                              [activeKey]: correctionFromGrid(
                                baseGrid,
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
                    </Fold>
                  ) : (
                    <Fold title="Viertel anpassen" defaultOpen>
                      <DistrictControls
                        district={district}
                        onDistrictChange={(next) => {
                          // Ein neu gewürfeltes Viertel passt nicht mehr zu den gemalten Zellen.
                          if (next.seed !== district.seed) {
                            setFixes(NO_OVERRIDES)
                            setOverrides(NO_OVERRIDES)
                          }
                          setDistrict(next)
                        }}
                      />
                    </Fold>
                  )}

                  <Fold
                    title="Wetter ändern"
                    note={weatherNote}
                  >
                    <WeatherControls
                      weather={weather}
                      onWeatherChange={setWeather}
                      weatherLocation={weatherLocation}
                      weatherLabel={weatherLabel}
                      onWeatherLoaded={(loaded, label) => {
                        setWeather(loaded)
                        setWeatherLabel(label)
                      }}
                      typicalAvailable={regional !== null}
                      onTypical={() => regional && applyRegional(regional)}
                      regionalError={regionalStatus === 'error'}
                      onWeatherReset={() => {
                        setWeather(DEFAULT_WEATHER)
                        setWeatherLabel(null)
                      }}
                      rainMm={rainMm}
                      onRainChange={setRainMm}
                      regionalRain={regional?.rainMm ?? {}}
                      rainPeriod={rainPeriod}
                      onRainPeriodChange={(period) => {
                        setRainPeriod(period)
                        const mm = regional?.rainMm[period]
                        if (mm !== undefined) setRainMm(mm)
                      }}
                    />
                  </Fold>

                  {activePlace && fixes.size > 0 && (
                    <p className="slider-hint">
                      Hinweis: {fixes.size} korrigierte Zellen sind noch nicht gespeichert. Sie
                      gelten, bis die Seite neu geladen wird.
                    </p>
                  )}
                </>
              )}

              {step === 2 && (
                <>
                  <div className="result-strip" aria-live="polite">
                    <p>
                      <span className="result-label">Heute</span>
                      <strong>{formatTemp(baseMean)}</strong>
                    </p>
                    <span className="result-arrow" aria-hidden="true">
                      →
                    </span>
                    <p>
                      <span className="result-label">Nach Umbau</span>
                      <strong>{formatTemp(mean)}</strong>
                    </p>
                    <p className={`result-delta${cooler ? ' is-cooler' : ''}`}>
                      {anyChange ? formatDelta(mean - baseMean) : 'noch keine Maßnahme'}
                    </p>
                  </div>
                  <p className="slider-hint">
                    Mittel aller Oberflächen um {formatHour(hour)} Uhr.{' '}
                    <button
                      type="button"
                      className="link-button"
                      disabled={!anyChange}
                      onClick={() => {
                        setMeasures(NO_MEASURES)
                        setOverrides(NO_OVERRIDES)
                      }}
                    >
                      Alle Maßnahmen zurücksetzen
                    </button>
                  </p>

                  <Fold
                    title="Vorschlag berechnen lassen"
                    note="beste Kühlung fürs Budget"
                    group="weg"
                    defaultOpen
                  >
                    <OptimizerPanel
                      grid={baseGrid}
                      weather={liveWeather}
                      onApply={(cells) => {
                        setMeasures(NO_MEASURES)
                        setOverrides(cells)
                      }}
                    />
                  </Fold>
                  <Fold title="Anteile mit Reglern einstellen" note="z. B. 50 % Gründächer" group="weg">
                    <MeasureControls measures={measures} onMeasuresChange={setMeasures} />
                  </Fold>
                  <Fold
                    title="Einzelne Flächen selbst umbauen"
                    note="mit dem Pinsel"
                    group="weg"
                    onToggle={(open) => {
                      if (!open) setBrush(null)
                    }}
                  >
                    <BrushPalette
                      mode="measures"
                      brush={brush}
                      onChange={setBrush}
                      paintedCount={overrides.size}
                      onClear={() => setOverrides(NO_OVERRIDES)}
                      size={baseGrid.width > 30 ? brushSize : undefined}
                      onSizeChange={setBrushSize}
                      cellSizeM={baseGrid.cellSizeM}
                    />
                  </Fold>
                </>
              )}

              {step === 3 && (
                <>
                  <div className="kpis">
                    <div className="kpi">
                      <p className="kpi-label">Ohne Maßnahmen (Ist)</p>
                      <p className="kpi-value">{formatTemp(baseMean)}</p>
                    </div>
                    <div className="kpi">
                      <p className="kpi-label">Mit Maßnahmen (Soll)</p>
                      <p className="kpi-value">{formatTemp(mean)}</p>
                      <p className={`kpi-note${cooler ? ' is-cooler' : ''}`}>
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
                      <p
                        className={`kpi-note${
                          rain.retainedL > baseRain.retainedL + 1 ? ' is-cooler' : ''
                        }`}
                      >
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
                  </div>
                  <p className="kpi-caption">
                    Temperaturen: Mittel aller Oberflächen um {formatHour(hour)} Uhr. Regenrückhalt:
                    bei {formatNumber(rainMm, 0)} mm Starkregen auf {formatNumber(areaHectares, 0)}{' '}
                    Hektar.
                    {!anyChange && ' Noch ist keine Maßnahme gewählt, Ist und Soll sind gleich.'}
                  </p>

                  <div className="chart-block">
                    <h3>Tagesgang über 24 Stunden</h3>
                    <p className="panel-lead">
                      Versiegelte Flächen speichern Hitze und bleiben nachts warm, begrünte kühlen
                      schneller ab. Ein Klick ins Diagramm stellt die Uhrzeit ein.
                    </p>
                    <DayChart
                      base={baseCurve}
                      improved={curve}
                      hour={hour}
                      onHourChange={setHour}
                      sunrise={sunrise}
                      sunset={sunset}
                    />
                  </div>

                  <Fold title="Stimmt das Modell?" note="Vergleich mit Satellitenmessungen">
                    <p className="slider-hint">
                      An den Beispielorten wird das Modell mit Oberflächentemperaturen verglichen,
                      die der Satellit Landsat an heißen Sommertagen gemessen hat.
                    </p>
                    <ValidationPanel corrections={corrections} points={allPoints} />
                  </Fold>
                  <Fold title="Wie wird gerechnet?" note="Formeln und Annahmen">
                    <p className="slider-hint">
                      Strahlungsbilanz, Verdunstung, Konvektion und Wärmespeicherung mit allen
                      Stoffwerten und den Grenzen des Modells.
                    </p>
                    <div>
                      <button type="button" className="button" onClick={() => setFormulasOpen(true)}>
                        Formeln und Annahmen öffnen
                      </button>
                    </div>
                  </Fold>
                </>
              )}

              <div className="step-nav">
                <button type="button" className="button" onClick={() => goTo(step - 1)}>
                  ← {step === 1 ? 'Anderer Ort' : STEP_TEXT[step - 1]?.title}
                </button>
                {step < STEPS.length - 1 ? (
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => goTo(step + 1)}
                  >
                    Weiter: {STEP_TEXT[step + 1]?.title} →
                  </button>
                ) : (
                  <button type="button" className="button button-primary" onClick={() => goTo(0)}>
                    Neuen Ort untersuchen
                  </button>
                )}
              </div>
            </section>
          </div>
        )}
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
