import { useMemo } from 'react'
import { EXAMPLES_GENERATED, EXAMPLE_PLACES } from '../data/examplePlaces.ts'
import { compareScene, summarizeComparisons } from '../model/validation.ts'
import { formatDelta, formatHour, formatNumber, formatTemp } from './format.ts'

const formatDate = (date: string): string => date.split('-').reverse().join('.')

/**
 * Vergleich des Modells mit Satellitenmessungen (Landsat) an den Beispielorten.
 * Gerechnet wird immer mit dem aktuellen Modell, die Tabelle zeigt also den
 * tatsächlichen Stand und keine eingefrorenen Zahlen.
 */
export function ValidationPanel() {
  const rows = useMemo(
    () =>
      EXAMPLE_PLACES.flatMap((place) =>
        place.scenes.map((scene) => ({ place, comparison: compareScene(place.grid, scene) })),
      ),
    [],
  )

  if (rows.length === 0) {
    return <p className="panel-lead">Für die Beispielorte liegen keine Satellitenaufnahmen vor.</p>
  }

  const summary = summarizeComparisons(rows.map((row) => row.comparison))
  const direction =
    Math.abs(summary.biasK) < 0.5 ? 'weder zu warm noch zu kalt' : summary.biasK > 0 ? 'zu warm' : 'zu kalt'

  return (
    <div className="validation">
      <div className="kpis">
        <div className="kpi">
          <p className="kpi-label">Mittlere Abweichung (Betrag)</p>
          <p className="kpi-value">{formatNumber(summary.meanAbsErrorK)} K</p>
          <p className="kpi-note">{summary.count} Aufnahmen</p>
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
          <p className="kpi-note">Zufall wäre 1 von 4</p>
        </div>
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
              <th scope="col">Modell</th>
              <th scope="col">Abweichung</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ place, comparison }) => (
              <tr key={comparison.scene.sceneId}>
                <th scope="row">{place.name}</th>
                <td>{formatDate(comparison.scene.date)}</td>
                <td>{formatHour(comparison.scene.solarHour)}</td>
                <td>{formatTemp(comparison.scene.weather.tMaxC)}</td>
                <td>{formatTemp(comparison.scene.landsatMeanC)}</td>
                <td>{formatTemp(comparison.modelMeanC)}</td>
                <td>{formatDelta(comparison.differenceK)}</td>
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
            Die Raster stammen unverändert aus OpenStreetMap. Geschätzte Flächen (zum Beispiel
            Schulhöfe) wurden nicht von Hand korrigiert und sind eine Fehlerquelle.
          </li>
          <li>
            Der Satellit sieht von oben auf Dächer und Baumkronen und nimmt für alle Flächen
            geschätzte Emissionsgrade an. Auch seine Werte haben einen Fehler von etwa 1 bis 2 K.
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
