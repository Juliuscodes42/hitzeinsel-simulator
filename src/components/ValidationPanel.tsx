import { useMemo, useState } from 'react'
import { applyCorrection, type Corrections } from '../data/corrections.ts'
import { EXAMPLES_GENERATED, EXAMPLE_PLACES, type ExamplePlace } from '../data/examplePlaces.ts'
import { loadPlace } from '../data/placeLoader.ts'
import type { PlacePoints } from '../data/recognitionPoints.ts'
import type { CityGrid } from '../model/grid.ts'
import { trainClassifier } from '../model/learning.ts'
import { recognize } from '../model/recognition.ts'
import {
  compareScene,
  summarizeComparisons,
  type Comparison,
  type ValidationSummary,
} from '../model/validation.ts'
import { formatDelta, formatHour, formatNumber, formatTemp } from './format.ts'

const formatDate = (date: string): string => date.split('-').reverse().join('.')

interface ValidationPanelProps {
  /** Von Hand korrigierte Raster je Ort. */
  corrections: Corrections
  /** Beispielpunkte der Bilderkennung je Ort. */
  points: Record<string, PlacePoints>
}

/** Raster eines Beispielorts aus der Bilderkennung, wie es die App auch sonst nutzt. */
interface RecognizedExample {
  grid: CityGrid
  /** Was in das Raster eingeflossen ist, für die Anzeige. */
  extras: string[]
  /** Kein Luftbild: nur OpenStreetMap in 2 m. */
  osmOnly: boolean
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading'; done: number }
  | { kind: 'ready'; examples: Record<string, RecognizedExample> }
  | { kind: 'error'; text: string }

/** Lädt Luftbild und Bilderkennung eines Beispielorts. */
async function recognizeExample(
  example: ExamplePlace,
  corrections: Corrections,
  points: Record<string, PlacePoints>,
): Promise<RecognizedExample> {
  const place = await loadPlace({ id: example.id, name: example.name, bbox: example.bbox }, () => {})
  const extras: string[] = []
  let grid = place.grid
  const training = points[example.id]?.training ?? []
  if (place.recognition && training.length > 0) {
    const classifier = trainClassifier(place.recognition.features, training)
    if (classifier) {
      const { prior, sources, features } = place.recognition
      grid = recognize(prior, sources, features, classifier).grid
      extras.push(`gelernt aus ${training.length} Beispielen`)
    }
  }
  const correction = corrections[example.id]
  const corrected = applyCorrection(grid, correction)
  if (corrected !== grid) extras.push('von Hand korrigiert')
  return { grid: corrected, extras, osmOnly: !place.recognition }
}

/**
 * Vergleich des Modells mit Satellitenmessungen (Landsat) an den Beispielorten.
 * Gerechnet wird immer mit dem aktuellen Modell, die Tabelle zeigt also den
 * tatsächlichen Stand und keine eingefrorenen Zahlen.
 *
 * Verglichen werden zwei Raster: das alte aus OpenStreetMap (10-m-Zellen) und
 * das aus der Bilderkennung (2-m-Zellen). So zeigt sich, ob die Bilderkennung
 * das Modell genauer macht.
 */
export function ValidationPanel({ corrections, points }: ValidationPanelProps) {
  const [state, setState] = useState<LoadState>({ kind: 'idle' })

  // Mit dem alten OpenStreetMap-Raster: ändert sich nie.
  const original = useMemo(
    () =>
      EXAMPLE_PLACES.flatMap((place) =>
        place.scenes.map((scene) => ({ place, comparison: compareScene(place.grid, scene) })),
      ),
    [],
  )

  // Mit der Bilderkennung, sobald sie geladen ist.
  const recognized = useMemo(() => {
    if (state.kind !== 'ready') return null
    return original.map(({ place, comparison }) =>
      compareScene(state.examples[place.id].grid, comparison.scene),
    )
  }, [state, original])

  if (original.length === 0) {
    return <p className="panel-lead">Für die Beispielorte liegen keine Satellitenaufnahmen vor.</p>
  }

  const load = async () => {
    setState({ kind: 'loading', done: 0 })
    try {
      const examples: Record<string, RecognizedExample> = {}
      let done = 0
      await Promise.all(
        EXAMPLE_PLACES.map(async (example) => {
          examples[example.id] = await recognizeExample(example, corrections, points)
          done++
          setState({ kind: 'loading', done })
        }),
      )
      // Kurz warten, damit die Anzeige „rechnet …" erscheint, bevor gerechnet wird.
      await new Promise((resolve) => setTimeout(resolve, 30))
      setState({ kind: 'ready', examples })
    } catch (problem) {
      setState({ kind: 'error', text: problem instanceof Error ? problem.message : String(problem) })
    }
  }

  const osmSummary = summarizeComparisons(original.map((row) => row.comparison))
  const recognizedSummary = recognized ? summarizeComparisons(recognized) : null
  const osmOnlyPlaces =
    state.kind === 'ready'
      ? EXAMPLE_PLACES.filter((place) => state.examples[place.id].osmOnly).map((place) => place.name)
      : []
  const extras =
    state.kind === 'ready'
      ? EXAMPLE_PLACES.flatMap((place) =>
          state.examples[place.id].extras.length > 0
            ? [`${place.name}: ${state.examples[place.id].extras.join(', ')}`]
            : [],
        )
      : []

  const summaryRows: { label: string; value: (summary: ValidationSummary) => string; hint: string }[] = [
    {
      label: 'Mittlere Abweichung (Betrag)',
      value: (summary) => `${formatNumber(summary.meanAbsErrorK)} °C`,
      hint: 'Wie weit der Mittelwert des Ausschnitts danebenliegt.',
    },
    {
      label: 'Richtung',
      value: (summary) => formatDelta(summary.biasK),
      hint: 'Plus = Modell im Schnitt zu warm, minus = zu kalt.',
    },
    {
      label: 'Fehler im Muster der Viertel',
      value: (summary) => `${formatNumber(summary.meanPatternErrorK)} °C`,
      hint: 'Ob warme und kühle Viertel richtig verteilt sind, unabhängig von der Richtung.',
    },
    {
      label: 'Wärmstes Viertel getroffen',
      value: (summary) => `${summary.hottestQuadrantMatches} von ${summary.count}`,
      hint: 'Zufall wäre etwa 1 von 4.',
    },
  ]

  return (
    <div className="validation">
      <div className="validation-load">
        {state.kind === 'idle' || state.kind === 'error' ? (
          <button type="button" className="button button-primary" onClick={load}>
            Auch mit Bilderkennung vergleichen
          </button>
        ) : null}
        <p className={`slider-hint${state.kind === 'error' ? ' is-error' : ''}`} role="status">
          {state.kind === 'idle' &&
            'Lädt die Luftbilder der vier Beispielorte und rechnet alle Aufnahmen mit den erkannten 2-m-Rastern nach.'}
          {state.kind === 'loading' &&
            `Lade Luftbilder und erkenne Flächen … (${state.done} von ${EXAMPLE_PLACES.length} Orten)`}
          {state.kind === 'error' && `Das hat nicht geklappt: ${state.text}`}
          {state.kind === 'ready' &&
            (osmOnlyPlaces.length > 0
              ? `Ohne Luftbild (nur OpenStreetMap in 2 m): ${osmOnlyPlaces.join(', ')}.`
              : 'Alle vier Orte mit amtlichem Luftbild erkannt.')}
        </p>
        {extras.length > 0 && <p className="slider-hint">Eingeflossen: {extras.join('; ')}.</p>}
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Kennzahl</th>
              <th scope="col">OpenStreetMap, 10 m</th>
              <th scope="col">Bilderkennung, 2 m</th>
            </tr>
          </thead>
          <tbody>
            {summaryRows.map((row) => (
              <tr key={row.label}>
                <th scope="row" title={row.hint}>
                  {row.label}
                </th>
                <td>{row.value(osmSummary)}</td>
                <td>{recognizedSummary ? row.value(recognizedSummary) : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Ort</th>
              <th scope="col">Datum</th>
              <th scope="col">Sonnenzeit</th>
              <th scope="col">Luft max.</th>
              <th scope="col">Landsat</th>
              <th scope="col">OSM 10 m</th>
              <th scope="col">Abweichung</th>
              <th scope="col">Erkennung 2 m</th>
              <th scope="col">Abweichung</th>
            </tr>
          </thead>
          <tbody>
            {original.map(({ place, comparison }, index) => {
              const second: Comparison | undefined = recognized?.[index]
              return (
                <tr key={comparison.scene.sceneId}>
                  <th scope="row">{place.name}</th>
                  <td>{formatDate(comparison.scene.date)}</td>
                  <td>{formatHour(comparison.scene.solarHour)}</td>
                  <td>{formatTemp(comparison.scene.weather.tMaxC)}</td>
                  <td>{formatTemp(comparison.scene.landsatMeanC)}</td>
                  <td>{formatTemp(comparison.modelMeanC)}</td>
                  <td>{formatDelta(comparison.differenceK)}</td>
                  <td>{second ? formatTemp(second.modelMeanC) : '–'}</td>
                  <td>{second ? formatDelta(second.differenceK) : '–'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <details className="chart-table">
        <summary>Wie der Vergleich entsteht und was er nicht leistet</summary>
        <ul className="plain-list">
          <li>
            Landsat 8 und 9 überfliegen Deutschland am späten Vormittag. Verwendet wird die
            Oberflächentemperatur aus Collection 2 Level-2 (Band ST_B10) für wolkenfreie
            Sommertage.
          </li>
          <li>
            Das Modell rechnet denselben Tag mit dem Wetter von Open-Meteo und wird zur
            Überflugzeit abgelesen. Verglichen wird der Mittelwert über 200 m × 200 m und die
            vier Viertel.
          </li>
          <li>
            Landsat misst die Temperatur nur mit etwa 100 m Auflösung. Einzelne Zellen lassen
            sich deshalb nicht prüfen, nur der Ausschnitt und seine vier Viertel.
          </li>
          <li>
            „OSM 10 m" ist das ursprüngliche Raster aus OpenStreetMap, in dem fehlende Flächen
            geschätzt werden. „Erkennung 2 m" ist das Raster aus Luftbild und OpenStreetMap,
            einschließlich gelernter Beispiele und gespeicherter Korrekturen für den Ort.
          </li>
          <li>
            Wer Beispiele setzt oder korrigiert, sollte nur nach dem Luftbild gehen und nicht so
            lange ändern, bis die Zahl passt. Sonst beweist der Vergleich nichts mehr.
          </li>
          <li>
            Die Luftbilder stammen nicht vom selben Tag wie die Landsat-Aufnahmen. Was sich
            dazwischen verändert hat, ist eine Fehlerquelle.
          </li>
          <li>
            Der Satellit sieht von oben auf Dächer und Baumkronen und nimmt für alle Flächen
            geschätzte Emissionsgrade an. Auch seine Werte haben einen Fehler von etwa 1 bis 2 °C.
          </li>
          <li>
            Wenige Aufnahmen an vier Orten sind eine Stichprobe und kein Beweis. Stand der
            Daten: {formatDate(EXAMPLES_GENERATED)}.
          </li>
        </ul>
      </details>
    </div>
  )
}
