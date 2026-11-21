/**
 * Erzeugt ein Beispiel-Stadtviertel und wendet Kühlungs-Maßnahmen darauf an.
 *
 * Alles hier ist reine Daten-Umformung ohne Physik: Aus Reglerwerten wird ein
 * Raster, das anschließend von grid.ts simuliert wird.
 */

import { MATERIALS } from '../data/materials.ts'
import { MEASURES, MEASURE_BY_ID, fitsTarget, type MeasureId } from '../data/measures.ts'
import type { CityGrid, GridCell } from './grid.ts'

export interface DistrictParams {
  /** Versiegelungsgrad der unbebauten Flächen (0–1). */
  sealing: number
  /** Bebauungsdichte: Anteil der Blockflächen mit Gebäuden (0–1). */
  density: number
  /** Startwert des Zufallsgenerators. Gleicher Wert = gleiches Viertel. */
  seed: number
}

/**
 * Anteil der jeweils geeigneten Flächen, auf denen eine Maßnahme umgesetzt
 * wird (0–1), für jede Maßnahme aus dem Katalog (src/data/measures.ts).
 */
export type Measures = Record<MeasureId, number>

export const NO_MEASURES: Measures = Object.fromEntries(
  MEASURES.map((measure) => [measure.id, 0]),
) as Measures

/** Alle so viele Zellen verläuft eine Straße. */
const STREET_SPACING = 7
const STREET_OFFSET = 3
/** Gebäude entstehen in Klötzen dieser Kantenlänge (in Zellen). */
const BUILDING_BLOCK = 2
/** Anteil der Grünflächen, auf denen schon Bäume stehen. */
const EXISTING_TREE_SHARE = 0.2

/** Kleiner, schneller Zufallsgenerator (mulberry32) mit festem Startwert. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const randomList = (random: () => number, count: number): number[] =>
  Array.from({ length: count }, random)

const isStreet = (x: number, y: number): boolean =>
  x % STREET_SPACING === STREET_OFFSET || y % STREET_SPACING === STREET_OFFSET

/**
 * Baut ein Viertel aus Straßen, Gebäuden, Pflaster und Grün.
 *
 * Jede Zelle bekommt feste Zufallszahlen. Die Regler verschieben nur die
 * Schwellen. Dadurch wächst und schrumpft das Viertel beim Ziehen eines
 * Reglers gleichmäßig, statt jedes Mal neu gewürfelt zu werden.
 */
export function generateDistrict(
  params: DistrictParams,
  width = 20,
  height = 20,
  cellSizeM = 10,
): CityGrid {
  const random = createRandom(params.seed)
  const blocksX = Math.ceil(width / BUILDING_BLOCK)
  const blocksY = Math.ceil(height / BUILDING_BLOCK)
  const buildingNoise = randomList(random, blocksX * blocksY)
  const sealingNoise = randomList(random, width * height)
  const treeNoise = randomList(random, width * height)

  const cells: GridCell[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x
      const block = Math.floor(y / BUILDING_BLOCK) * blocksX + Math.floor(x / BUILDING_BLOCK)
      let surface: GridCell['surface']
      if (isStreet(x, y)) surface = 'asphalt'
      else if (buildingNoise[block] < params.density) surface = 'roof'
      else if (sealingNoise[index] < params.sealing) surface = 'concrete'
      else if (treeNoise[index] < EXISTING_TREE_SHARE) surface = 'tree'
      else surface = 'grass'
      cells.push(isStreet(x, y) ? { surface, mist: false, street: true } : { surface, mist: false })
    }
  }
  return { width, height, cellSizeM, cells }
}

/**
 * Feste Zufallsränge je Zelle. Sie legen fest, in welcher Reihenfolge
 * Maßnahmen Flächen erfassen: 30 % Dachbegrünung trifft immer dieselben
 * Dächer, 60 % dieselben plus weitere.
 */
export function cellRanks(seed: number, count: number, width = count, cellSizeM = 10): number[] {
  const random = createRandom(seed ^ 0x9e3779b9)
  // Bei feinen Rastern bekommen Flecken von etwa 10 m × 10 m denselben Rang,
  // damit Maßnahmen als zusammenhängende Flächen entstehen und nicht als
  // einzelne 2-m-Pünktchen. Ein kleiner Zusatz ordnet die Zellen im Fleck.
  const patch = Math.max(1, Math.round(PATCH_SIZE_M / cellSizeM))
  if (patch === 1) return randomList(random, count)
  const height = Math.ceil(count / width)
  const patchesX = Math.ceil(width / patch)
  const patchRanks = randomList(random, patchesX * Math.ceil(height / patch))
  return Array.from({ length: count }, (_, index) => {
    const x = index % width
    const y = Math.floor(index / width)
    const patchRank = patchRanks[Math.floor(y / patch) * patchesX + Math.floor(x / patch)]
    return Math.min(0.999999, patchRank + random() * 1e-6)
  })
}

/** Kantenlänge der Flecken, in denen Maßnahmen gemeinsam umgesetzt werden. */
const PATCH_SIZE_M = 10

/** Gruppen, in denen sich Maßnahmen die Flächen teilen, in Katalog-Reihenfolge. */
const EXCLUSIVE_GROUPS = (['roof', 'square'] as const).map((target) =>
  MEASURES.filter((measure) => measure.exclusive && measure.target === target),
)

/**
 * Wendet die Maßnahmen auf ein Raster an und gibt ein neues Raster zurück.
 *
 * Teilen sich mehrere Maßnahmen dieselben Flächen (z. B. Gründach und
 * Cool Roof auf dunklen Dächern), kommen sie in der Reihenfolge des Katalogs
 * zum Zug: Die erste erhält ihren Anteil, die nächste den folgenden Anteil
 * und so weiter, zusammen höchstens alle Flächen.
 *
 * Zisterne und Sprühnebel kommen zusätzlich hinzu. Sie nutzen eigene,
 * verschobene Ränge, damit sie nicht immer dieselben Zellen bevorzugen.
 */
export function applyMeasures(base: CityGrid, measures: Measures, ranks: number[]): CityGrid {
  if (Object.values(measures).every((share) => share === 0)) return base
  const cells = base.cells.map((original, index): GridCell => {
    const rank = ranks[index]
    let cell = original

    for (const group of EXCLUSIVE_GROUPS) {
      if (!fitsTarget(cell, group[0].target)) continue
      let upTo = 0
      for (const measure of group) {
        upTo += measures[measure.id]
        if (rank < upTo) {
          cell = measure.apply(cell)
          break
        }
      }
    }

    if (fitsTarget(cell, 'anyRoof') && (rank + 0.5) % 1 < measures.cistern) {
      cell = MEASURE_BY_ID.cistern.apply(cell)
    }
    // Sprühnebel nur dort, wo danach noch versiegelter Boden liegt.
    if (fitsTarget(cell, 'sealed') && 1 - rank < measures.mist) {
      cell = MEASURE_BY_ID.mist.apply(cell)
    }
    return cell
  })
  return { ...base, cells }
}

/** Überschreibt einzelne Zellen, die von Hand gemalt wurden. */
export function applyOverrides(
  grid: CityGrid,
  overrides: ReadonlyMap<number, GridCell>,
): CityGrid {
  if (overrides.size === 0) return grid
  return { ...grid, cells: grid.cells.map((cell, index) => overrides.get(index) ?? cell) }
}

/** Anteil der Zellen, von denen Regen fast vollständig abfließt (0–1). */
export function sealedShare(grid: CityGrid): number {
  const sealed = grid.cells.filter(
    (cell) => MATERIALS[cell.surface].runoffCoefficient >= 0.9,
  ).length
  return sealed / grid.cells.length
}
