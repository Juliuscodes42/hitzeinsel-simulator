/**
 * Lernen aus Beispielpunkten und Messen der Genauigkeit.
 *
 * Verfahren: k-nächste Nachbarn (kNN). Für eine Zelle werden unter allen
 * markierten Beispielen die k mit den ähnlichsten Merkmalen gesucht
 * (kleinster Abstand). Die Oberfläche, die unter ihnen am häufigsten
 * vorkommt, gewinnt. Damit alle Merkmale gleich zählen, werden sie vorher
 * standardisiert (Mittelwert 0, Streuung 1).
 *
 * Gebäude werden weiter über OpenStreetMap erkannt. Für Gebäudezellen wird
 * nur unter Dach-Beispielen gesucht, für alle anderen nur unter Boden-Beispielen.
 */

import { MATERIALS, type SurfaceType } from '../data/materials.ts'
import type { CityGrid } from './grid.ts'
import { FEATURE_COUNT, featuresOf, type Decide } from './recognition.ts'

/** Ein markierter Punkt: Zelle und die Oberfläche, die dort wirklich liegt. */
export interface LabeledPoint {
  index: number
  surface: SurfaceType
}

/** Anzahl der Nachbarn, die abstimmen. */
const K = 5
/**
 * Ist ein Beispiel so nah (standardisierter Abstand), gilt das Gelernte auch dann,
 * wenn die Regeln eine Oberfläche vermuten, für die es keine Beispiele gibt.
 */
const NEAR_DISTANCE = 1

interface Example {
  values: Float32Array
  surface: SurfaceType
}

/** Mittelwert und Streuung jedes Merkmals über alle Zellen. */
function statistics(features: Float32Array): { mean: Float32Array; spread: Float32Array } {
  const count = features.length / FEATURE_COUNT
  const mean = new Float32Array(FEATURE_COUNT)
  const spread = new Float32Array(FEATURE_COUNT)
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < FEATURE_COUNT; k++) mean[k] += features[i * FEATURE_COUNT + k] / count
  }
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < FEATURE_COUNT; k++) {
      spread[k] += (features[i * FEATURE_COUNT + k] - mean[k]) ** 2 / count
    }
  }
  for (let k = 0; k < FEATURE_COUNT; k++) spread[k] = Math.sqrt(spread[k]) || 1
  return { mean, spread }
}

/**
 * Baut aus den Beispielpunkten ein Entscheidungsverfahren für recognize().
 * Gibt null zurück, solange zu wenige Beispiele vorliegen: mindestens zwei
 * verschiedene Bodenarten sind nötig, sonst gibt es nichts zu unterscheiden.
 */
export function trainClassifier(features: Float32Array, points: LabeledPoint[]): Decide | null {
  const { mean, spread } = statistics(features)
  const normalise = (values: ArrayLike<number>): Float32Array => {
    const out = new Float32Array(FEATURE_COUNT)
    for (let k = 0; k < FEATURE_COUNT; k++) out[k] = (values[k] - mean[k]) / spread[k]
    return out
  }
  const examples: Example[] = points.map((point) => ({
    values: normalise(featuresOf(features, point.index)),
    surface: point.surface,
  }))
  const roofExamples = examples.filter((example) => MATERIALS[example.surface].isRoof)
  const groundExamples = examples.filter((example) => !MATERIALS[example.surface].isRoof)
  const kinds = (list: Example[]) => new Set(list.map((example) => example.surface)).size
  if (kinds(groundExamples) < 2) return null

  const vote = (values: Float32Array, list: Example[]): { surface: SurfaceType; nearest: number } => {
    const nearest = list
      .map((example) => {
        let distance = 0
        for (let k = 0; k < FEATURE_COUNT; k++) distance += (example.values[k] - values[k]) ** 2
        return { distance, surface: example.surface }
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, K)
    const counts = new Map<SurfaceType, number>()
    // Nähere Nachbarn zählen etwas mehr, damit es bei Gleichstand eine klare Entscheidung gibt.
    for (const { distance, surface } of nearest) {
      counts.set(surface, (counts.get(surface) ?? 0) + 1 / (1 + distance))
    }
    return {
      surface: [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0],
      nearest: Math.sqrt(nearest[0].distance),
    }
  }

  const roofKinds = new Set(roofExamples.map((example) => example.surface))
  const groundKinds = new Set(groundExamples.map((example) => example.surface))

  return (f, prior, source, ruleSurface) => {
    const values = normalise(f)
    // Gelernt wird zwischen den Oberflächen, für die es Beispiele gibt. Vermuten die
    // Regeln etwas anderes (z. B. Baum, ohne Baum-Beispiele), gelten sie, außer ein
    // Beispiel sieht der Zelle sehr ähnlich.
    const decideAmong = (list: Example[], known: Set<SurfaceType>) => {
      const result = vote(values, list)
      return known.has(ruleSurface) || result.nearest < NEAR_DISTANCE ? result.surface : null
    }
    if (source === 'building') return roofKinds.size >= 2 ? decideAmong(roofExamples, roofKinds) : null
    const surface = decideAmong(groundExamples, groundKinds)
    if (surface === null) return null
    // Straßen behalten ihren Belag aus OSM, außer das Gelernte sagt „Pflanze".
    if (source === 'street' && !['tree', 'grass'].includes(surface)) return prior.surface
    return surface
  }
}

/** Ergebnis eines Vergleichs mit Prüfpunkten. */
export interface Accuracy {
  /** Anteil richtig erkannter Prüfpunkte (0–1). */
  share: number
  correct: number
  total: number
  /** Verwechslungen: confusion[wahr][erkannt] = Anzahl. */
  confusion: Partial<Record<SurfaceType, Partial<Record<SurfaceType, number>>>>
}

/** Vergleicht ein Raster mit Prüfpunkten, deren wahre Oberfläche bekannt ist. */
export function measureAccuracy(grid: CityGrid, checkpoints: LabeledPoint[]): Accuracy {
  const confusion: Accuracy['confusion'] = {}
  let correct = 0
  for (const point of checkpoints) {
    const found = grid.cells[point.index].surface
    if (found === point.surface) correct++
    const row = (confusion[point.surface] ??= {})
    row[found] = (row[found] ?? 0) + 1
  }
  return {
    share: checkpoints.length === 0 ? 0 : correct / checkpoints.length,
    correct,
    total: checkpoints.length,
    confusion,
  }
}
