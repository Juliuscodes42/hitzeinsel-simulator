/**
 * Bilderkennung: Oberflächen aus einem Luftbild und OpenStreetMap bestimmen.
 *
 * Vorgehen:
 *  1. Das Luftbild wird in Zellen (z. B. 2 m × 2 m) geteilt. Für jede Zelle
 *     werden einfache Merkmale der Bildpunkte berechnet: mittlere Farbe,
 *     Helligkeit, „Grünheit" und Rauheit (wie stark die Helligkeit schwankt).
 *  2. OpenStreetMap liefert die Lage von Gebäuden, Straßen und Gewässern.
 *     Diese Angaben sind genauer als Farben, weil ein dunkles Dach und
 *     Asphalt im Bild fast gleich aussehen.
 *  3. Für alles andere entscheiden Regeln über die Farbe: Pflanzen sind grün,
 *     Bäume dunkler und rauer als Rasen, Sand und Kies rötlich-gelb,
 *     Asphalt dunkelgrau, Pflaster hellgrau.
 *  4. Wer Beispielpunkte markiert, kann die Regeln durch ein gelerntes
 *     Verfahren ersetzen (k-nächste Nachbarn, siehe learning.ts).
 */

import type { SurfaceType } from '../data/materials.ts'
import type { CityGrid, GridCell } from './grid.ts'
import type { CellSource } from './osm.ts'

/** Merkmale je Zelle, in dieser Reihenfolge gespeichert. */
export const FEATURE_NAMES = [
  'rot',
  'grün',
  'blau',
  'Helligkeit',
  'Rauheit',
  'Grünheit',
  'Pflanzenanteil',
] as const
export const FEATURE_COUNT = FEATURE_NAMES.length

const R = 0
const G = 1
const B = 2
const LUM = 3
const TEX = 4
const EXG = 5
const GREEN_SHARE = 6

/** Ab dieser Grünheit (2g − r − b)/(r + g + b) gilt ein Bildpunkt als Pflanze. */
const PLANT_PIXEL_EXG = 0.06

/**
 * Berechnet die Merkmale aller Zellen.
 *
 * @param pixels Bildpunkte zeilenweise, je Punkt `channels` Werte 0–255 (RGB oder RGBA)
 * @returns Feld mit FEATURE_COUNT Werten je Zelle (Werte 0–1)
 */
export function extractFeatures(
  pixels: ArrayLike<number>,
  imageWidth: number,
  imageHeight: number,
  gridWidth: number,
  gridHeight: number,
  channels = 4,
): Float32Array {
  const features = new Float32Array(gridWidth * gridHeight * FEATURE_COUNT)
  for (let cy = 0; cy < gridHeight; cy++) {
    const y0 = Math.floor((cy * imageHeight) / gridHeight)
    const y1 = Math.max(y0 + 1, Math.floor(((cy + 1) * imageHeight) / gridHeight))
    for (let cx = 0; cx < gridWidth; cx++) {
      const x0 = Math.floor((cx * imageWidth) / gridWidth)
      const x1 = Math.max(x0 + 1, Math.floor(((cx + 1) * imageWidth) / gridWidth))
      let r = 0
      let g = 0
      let b = 0
      let lum = 0
      let lumSq = 0
      let exg = 0
      let plants = 0
      let count = 0
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * imageWidth + x) * channels
          const pr = pixels[i] / 255
          const pg = pixels[i + 1] / 255
          const pb = pixels[i + 2] / 255
          const l = 0.299 * pr + 0.587 * pg + 0.114 * pb
          const e = (2 * pg - pr - pb) / (pr + pg + pb + 1e-6)
          r += pr
          g += pg
          b += pb
          lum += l
          lumSq += l * l
          exg += e
          if (e > PLANT_PIXEL_EXG) plants++
          count++
        }
      }
      const o = (cy * gridWidth + cx) * FEATURE_COUNT
      const meanLum = lum / count
      features[o + R] = r / count
      features[o + G] = g / count
      features[o + B] = b / count
      features[o + LUM] = meanLum
      features[o + TEX] = Math.sqrt(Math.max(0, lumSq / count - meanLum * meanLum))
      features[o + EXG] = exg / count
      features[o + GREEN_SHARE] = plants / count
    }
  }
  return features
}

/** Merkmale einer Zelle als Feld. */
export function featuresOf(features: Float32Array, index: number): Float32Array {
  return features.subarray(index * FEATURE_COUNT, (index + 1) * FEATURE_COUNT)
}

/** Ergebnis der Regeln für eine Zelle. */
export interface CellGuess {
  surface: SurfaceType
  /** Unsicher, z. B. im Schatten: Hier helfen Beispielpunkte am meisten. */
  uncertain: boolean
}

/** Regeln für eine Zelle. `prior` ist das, was OpenStreetMap dort angibt. */
export function classifyByRules(f: ArrayLike<number>, prior: GridCell, source: CellSource): CellGuess {
  const r = f[R]
  const g = f[G]
  const b = f[B]
  const lum = f[LUM]
  const tex = f[TEX]
  const plants = f[GREEN_SHARE]
  const sure = (surface: SurfaceType): CellGuess => ({ surface, uncertain: false })

  // Gebäude: Lage aus OSM, Art des Dachs aus dem Bild.
  if (source === 'building') {
    if (plants > 0.5) return sure('greenRoof')
    if (lum > 0.72 && Math.max(r, g, b) - Math.min(r, g, b) < 0.12) return sure('coolRoof')
    return sure('roof')
  }

  const isPlant = plants > 0.4
  // Dunkel, rau oder kräftig grün: Baumkrone. Hell und glatt: Rasen.
  const plantType = (): SurfaceType => (lum < 0.25 || tex > 0.07 ? 'tree' : 'grass')

  // Gewässer aus OSM; Bäume am Ufer ragen manchmal darüber.
  if (source === 'water') return isPlant && plants > 0.6 ? sure(plantType()) : sure('water')

  if (isPlant) return sure(plantType())

  // Sehr dunkel: meist Schatten. Das Bild verrät dort wenig, also gilt OSM.
  if (lum < 0.16) return { surface: prior.surface, uncertain: true }

  // Straßen: Belag aus OSM (Angabe "surface" oder Straßenklasse).
  if (source === 'street') return sure(prior.surface)

  // Trockenes Gras und Wiesen im Hochsommer: gelblich, kaum Blau, eher glatt.
  if (g - b > 0.06 && g >= r - 0.03 && tex < 0.08 && lum > 0.22) return sure('grass')

  // Sand, Kies, offener Boden: rötlich-gelb und farbig.
  const saturation = (Math.max(r, g, b) - Math.min(r, g, b)) / (Math.max(r, g, b) + 1e-6)
  if (r - b > 0.07 && saturation > 0.18 && lum > 0.25) return sure('permeable')

  // Befestigt. Ist die Fläche in OSM eingetragen (z. B. Parkplatz mit Belag), gilt OSM.
  if (source === 'mapped' && ['asphalt', 'concrete', 'permeable'].includes(prior.surface)) {
    return sure(prior.surface)
  }
  return { surface: lum < 0.35 ? 'asphalt' : 'concrete', uncertain: source === 'guessed' }
}

/**
 * Glättet einzelne Ausreißer: Eine Pflanzen- oder Belagzelle, die von
 * anderen umgeben ist, bekommt die häufigste Oberfläche ihrer Nachbarn.
 * Gebäude, Straßen und Wasser bleiben unverändert.
 */
function smooth(cells: GridCell[], sources: CellSource[], width: number, height: number): GridCell[] {
  const fixed = (index: number) =>
    sources[index] === 'building' || sources[index] === 'street' || sources[index] === 'water'
  return cells.map((cell, index) => {
    if (fixed(index)) return cell
    const x = index % width
    const y = Math.floor(index / width)
    const counts = new Map<SurfaceType, number>()
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const neighbour = ny * width + nx
        if (fixed(neighbour)) continue
        const surface = cells[neighbour].surface
        counts.set(surface, (counts.get(surface) ?? 0) + 1)
      }
    }
    if ((counts.get(cell.surface) ?? 0) > 0) return cell
    let best: SurfaceType | null = null
    let bestCount = 0
    for (const [surface, count] of counts) {
      if (count > bestCount) {
        best = surface
        bestCount = count
      }
    }
    // Nur ersetzen, wenn die Nachbarn sich weitgehend einig sind.
    return best && bestCount >= 5 ? { ...cell, surface: best } : cell
  })
}

/** Fenster (Zellen in jede Richtung), in dem Baumkronen und Rasen geglättet werden. */
const PLANT_WINDOW = 2
/** Ab diesem Anteil Baumzellen unter den Pflanzenzellen im Fenster gilt eine Pflanzenzelle als Baum. */
const TREE_MAJORITY = 0.4

/**
 * Baumkronen haben helle und dunkle Stellen; einzeln betrachtet sieht eine
 * sonnige Stelle aus wie Rasen. Deshalb entscheidet für jede Pflanzenzelle
 * die Mehrheit der Pflanzenzellen in ihrer Umgebung (5 × 5 Zellen).
 */
function smoothPlants(cells: GridCell[], width: number, height: number): GridCell[] {
  const isPlant = (cell: GridCell) => cell.surface === 'tree' || cell.surface === 'grass'
  return cells.map((cell, index) => {
    if (!isPlant(cell)) return cell
    const x = index % width
    const y = Math.floor(index / width)
    let plants = 0
    let trees = 0
    for (let dy = -PLANT_WINDOW; dy <= PLANT_WINDOW; dy++) {
      for (let dx = -PLANT_WINDOW; dx <= PLANT_WINDOW; dx++) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const neighbour = cells[ny * width + nx]
        if (!isPlant(neighbour)) continue
        plants++
        if (neighbour.surface === 'tree') trees++
      }
    }
    const surface = trees / plants >= TREE_MAJORITY ? 'tree' : 'grass'
    return surface === cell.surface ? cell : { ...cell, surface }
  })
}

/**
 * Gelerntes Entscheidungsverfahren für eine Zelle. `ruleSurface` ist das
 * Ergebnis der Regeln. null = die Regeln gelten.
 */
export type Decide = (
  f: Float32Array,
  prior: GridCell,
  source: CellSource,
  ruleSurface: SurfaceType,
) => SurfaceType | null

export interface Recognition {
  grid: CityGrid
  /** Zellen, bei denen die Regeln unsicher waren. */
  uncertain: boolean[]
}

/**
 * Erkennt die Oberflächen aller Zellen.
 *
 * @param prior Raster aus OpenStreetMap in derselben Auflösung
 * @param sources Herkunft jeder Zelle im OSM-Raster
 * @param features Merkmale aus extractFeatures
 * @param decide optional ein gelerntes Verfahren; null = Regeln verwenden
 */
export function recognize(
  prior: CityGrid,
  sources: CellSource[],
  features: Float32Array,
  decide?: Decide,
): Recognition {
  const uncertain: boolean[] = []
  const cells = prior.cells.map((cell, index) => {
    const f = featuresOf(features, index)
    const rules = classifyByRules(f, cell, sources[index])
    const learned = decide?.(f, cell, sources[index], rules.surface) ?? null
    const guess = learned ? { surface: learned, uncertain: false } : rules
    uncertain.push(guess.uncertain)
    return sources[index] === 'street'
      ? { surface: guess.surface, mist: false, street: true }
      : { surface: guess.surface, mist: false }
  })
  return {
    grid: {
      ...prior,
      cells: smooth(smoothPlants(cells, prior.width, prior.height), sources, prior.width, prior.height),
    },
    uncertain,
  }
}
