import { useMemo } from 'react'
import { applyCorrection, type Corrections } from '../data/corrections.ts'
import { EXAMPLES_GENERATED, EXAMPLE_PLACES } from '../data/examplePlaces.ts'
import { compareScene, summarizeComparisons } from '../model/validation.ts'
import { formatDelta, formatHour, formatNumber, formatTemp } from './format.ts'

const formatDate = (date: string): string => date.split('-').reverse().join('.')

interface ValidationPanelProps {
  /** Von Hand korrigierte Raster je Ort. */
  corrections: Corrections
}

/**
 * Vergleich des Modells mit Satellitenmessungen (Landsat) an den Beispielorten.
 * Gerechnet wird immer mit dem aktuellen Modell, die Tabelle zeigt also den
 * tatsächlichen Stand und keine eingefrorenen Zahlen.
 *
 * Für Orte mit korrigiertem Raster wird zusätzlich mit der Korrektur gerechnet.
 */
export function ValidationPanel({ corrections }: ValidationPanelProps) {
  // Mit dem unveränderten OpenStreetMap-Raster: ändert sich nie.
  const original = useMemo(
    () =>
      EXAMPLE_PLACES.flatMap((place) =>
        place.scenes.map((scene) => ({ place, comparison: compareScene(place.grid, scene) })),
      ),
    [],
  )
  // Mit Korrektur, wo es eine gibt.
  const rows = useMemo(
    () =>
      original.map((row) => {
        const correction = corrections[row.place.id]
        return {
          ...row,
          corrected: correction
            ? compareScene(applyCorrection(row.place.grid, correction), row.comparison.scene)
            : null,
        }
      }),
    [original, corrections],
  )

  if (rows.length === 0) {
    return <p className="panel-lead">Für die Beispielorte liegen keine Satellitenaufnahmen vor.</p>
  }

  const correctedPlaces = new Set(rows.filter((row) => row.corrected).map((row) => row.place.id)).size
  const originalSummary = summarizeComparisons(rows.map((row) => row.comparison))
  const summary = summarizeComparisons(rows.map((row) => row.corrected ?? row.comparison))
  const direction =
    Math.abs(summary.biasK) < 0.5 ? 'weder zu warm noch zu kalt' : summary.biasK > 0 ? 'zu warm' : 'zu kalt'
  const anyCorrected = correctedPlaces > 0

  return (
    <div className="validation">
      <div className="kpis">
        <div className="kpi">
          <p className="kpi-label">Mittlere Abweichung (Betrag)</p>
          <p className="kpi-value">{formatNumber(summary.meanAbsErrorK)} °C</p>
          <p className="kpi-note">
            {anyCorrected
              ? `ohne Korrekturen: ${formatNumber(originalSummary.meanAbsErrorK)} °C`
              : `${summary.count} Aufnahmen`}
          </p>
        </div>
        <div className="kpi">
          <p className="kpi-label">Richtung</p>
          <p className="kpi-value">{formatDelta(summary.biasK)}</p>
          <p className="kpi-note">Modell im Schnitt {direction}</p>
        </div>
        <div className="kpi">
          <p className="kpi-label">Wärmstes Viertel getroffen</p>
          <p className="kpi-value">
            {summary.hottestQuadrantMatches} von {summary.count}
          </p>
          <p className="kpi-note">
            {anyCorrected
              ? `ohne Korrekturen: ${originalSummary.hottestQuadrantMatches} von ${summary.count}`
              : 'Zufall wäre 1 von 4'}
          </p>
        </div>
      </div>
      <p className="slider-hint">
        {anyCorrected
          ? `${correctedPlaces} von ${EXAMPLE_PLACES.length} Orten rechnen mit einem von Hand korrigierten Raster.`
          : 'Alle Orte rechnen mit dem unveränderten Raster aus OpenStreetMap. Korrigierte Raster lassen sich im Schritt „Ausgangslage" unter „Flächen korrigieren" speichern.'}
      </p>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Ort</th>
              <th scope="col">Datum</th>
              <th scope="col">Sonnenzeit</th>
              <th scope="col">Luft max.</th>
              <th scope="col">Landsat</th>
              <th scope="col">Modell</th>
              <th scope="col">Abweichung</th>
              {anyCorrected && <th scope="col">korrigiert</th>}
              {anyCorrected && <th scope="col">Abweichung</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ place, comparison, corrected }) => (
              <tr key={comparison.scene.sceneId}>
                <th scope="row">{place.name}</th>
                <td>{formatDate(comparison.scene.date)}</td>
                <td>{formatHour(comparison.scene.solarHour)}</td>
                <td>{formatTemp(comparison.scene.weather.tMaxC)}</td>
                <td>{formatTemp(comparison.scene.landsatMeanC)}</td>
                <td>{formatTemp(comparison.modelMeanC)}</td>
                <td>{formatDelta(comparison.differenceK)}</td>
                {anyCorrected && <td>{corrected ? formatTemp(corrected.modelMeanC) : '–'}</td>}
                {anyCorrected && <td>{corrected ? formatDelta(corrected.differenceK) : '–'}</td>}
              </tr>
            ))}
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
            Überflugzeit abgelesen. Verglichen wird der Mittelwert über 200 m × 200 m.
          </li>
          <li>
            Landsat misst die Temperatur nur mit etwa 100 m Auflösung. Einzelne Zellen lassen
            sich deshalb nicht prüfen, nur der Ausschnitt und seine vier Viertel.
          </li>
          <li>
            Die Spalte „Modell" nutzt das unveränderte Raster aus OpenStreetMap. Geschätzte
            Flächen (zum Beispiel Schulhöfe) sind dort eine Fehlerquelle. Die Spalte
            „korrigiert" nutzt ein von Hand nach dem Luftbild nachgezeichnetes Raster.
          </li>
          <li>
            Wer ein Raster korrigiert, sollte nur nach dem Luftbild gehen und nicht so lange
            ändern, bis die Zahl passt. Sonst beweist der Vergleich nichts mehr.
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
