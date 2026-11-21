import { MATERIALS, SURFACE_TYPES, type SurfaceType } from '../data/materials.ts'
import type { PlacePoints, PointSet } from '../data/recognitionPoints.ts'
import type { Accuracy } from '../model/learning.ts'
import { SURFACE_COLORS } from './colors.ts'
import { formatPercent } from './format.ts'

/** Was ein Klick ins Raster gerade bewirkt, während markiert wird. */
export interface MarkingTool {
  set: PointSet
  /** null = Punkt entfernen */
  surface: SurfaceType | null
}

interface RecognitionPanelProps {
  points: PlacePoints
  tool: MarkingTool | null
  onToolChange: (tool: MarkingTool | null) => void
  onClear: (set: PointSet) => void
  /** Genauigkeit der drei Verfahren an den Prüfpunkten. */
  accuracy: { osm: Accuracy; rules: Accuracy; learned: Accuracy | null }
  /** Wird mit gelernten Beispielen gerechnet? */
  learning: boolean
}

/** Mindestzahl Prüfpunkte, ab der eine Genauigkeit angezeigt wird. */
export const MIN_CHECKS = 10

const SET_TEXT: Record<PointSet, { label: string; hint: string }> = {
  training: {
    label: 'Beispiele zum Lernen',
    hint: 'Oberfläche wählen, dann im Bild auf passende Stellen klicken. Je Oberfläche helfen 3 bis 5 Beispiele, besonders dort, wo die Erkennung danebenliegt.',
  },
  checks: {
    label: 'Prüfpunkte',
    hint: 'Gleichmäßig verteilt ins Bild klicken und jeweils angeben, was dort wirklich liegt. Prüfpunkte fließen nie ins Lernen ein, sonst wäre die Messung geschönt.',
  },
}

/**
 * Bilderkennung verbessern und prüfen: Beispielpunkte setzen, aus denen
 * gelernt wird, und Prüfpunkte, an denen gemessen wird, wie oft die
 * Erkennung richtig liegt.
 */
export function RecognitionPanel({
  points,
  tool,
  onToolChange,
  onClear,
  accuracy,
  learning,
}: RecognitionPanelProps) {
  const rows: { name: string; result: Accuracy | null }[] = [
    { name: 'Nur OpenStreetMap', result: accuracy.osm },
    { name: 'Bilderkennung mit Regeln', result: accuracy.rules },
    { name: 'Bilderkennung mit Lernen', result: accuracy.learned },
  ]
  const enoughChecks = points.checks.length >= MIN_CHECKS

  return (
    <div className="recognition">
      <div className="toggle toggle-wide" role="group" aria-label="Welche Punkte setzen?">
        {(['training', 'checks'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={tool?.set === option}
            onClick={() =>
              onToolChange(
                tool?.set === option ? null : { set: option, surface: tool?.surface ?? 'grass' },
              )
            }
          >
            {SET_TEXT[option].label} ({points[option].length})
          </button>
        ))}
      </div>

      {tool ? (
        <>
          <p className="slider-hint">{SET_TEXT[tool.set].hint}</p>
          <div className="palette-swatches" role="group" aria-label="Was liegt an der Stelle?">
            {SURFACE_TYPES.map((surface) => (
              <button
                key={surface}
                type="button"
                className="swatch"
                aria-pressed={tool.surface === surface}
                onClick={() => onToolChange({ ...tool, surface })}
              >
                <span
                  className="swatch-color"
                  style={{ background: SURFACE_COLORS[surface] }}
                  aria-hidden="true"
                />
                {MATERIALS[surface].label}
              </button>
            ))}
            <button
              type="button"
              className="swatch"
              aria-pressed={tool.surface === null}
              onClick={() => onToolChange({ ...tool, surface: null })}
            >
              <span className="swatch-color swatch-erase" aria-hidden="true" />
              Punkt entfernen
            </button>
          </div>
          {points[tool.set].length > 0 && (
            <p className="slider-hint">
              <button type="button" className="link-button" onClick={() => onClear(tool.set)}>
                Alle {SET_TEXT[tool.set].label} löschen
              </button>
            </p>
          )}
        </>
      ) : (
        <p className="slider-hint">
          Oben wählen, welche Punkte gesetzt werden. Im Bild sind Beispiele gefüllte Kreise und
          Prüfpunkte Ringe.
        </p>
      )}

      <div className="recognition-result">
        <h4>Wie oft liegt die Erkennung richtig?</h4>
        {enoughChecks ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Verfahren</th>
                  <th scope="col">richtig</th>
                  <th scope="col">Anteil</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ name, result }) => (
                  <tr key={name}>
                    <th scope="row">{name}</th>
                    <td>{result ? `${result.correct} von ${result.total}` : '–'}</td>
                    <td>{result ? formatPercent(result.share) : 'noch nicht gelernt'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="slider-hint">
            Ab {MIN_CHECKS} Prüfpunkten steht hier, wie oft OpenStreetMap allein, die Regeln und
            das gelernte Verfahren richtig liegen. Bisher: {points.checks.length}.
          </p>
        )}
        <p className="slider-hint">
          {learning
            ? 'Das Raster nutzt jetzt das gelernte Verfahren.'
            : 'Das Raster nutzt die Regeln. Gelernt wird, sobald es Beispiele für mindestens zwei Bodenarten gibt.'}
        </p>
      </div>
    </div>
  )
}
