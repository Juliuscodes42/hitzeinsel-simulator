/**
 * Erzeugt ein Beispiel-Stadtviertel und wendet Kühlungs-Maßnahmen darauf an.
 *
 * Alles hier ist reine Daten-Umformung ohne Physik: Aus Reglerwerten wird ein
 * Raster, das anschließend von grid.ts simuliert wird.
 */

import { MATERIALS } from '../data/materials.ts'
import type { CityGrid, GridCell } from './grid.ts'

export interface DistrictParams {
  /** Versiegelungsgrad der unbebauten Flächen (0–1). */
  sealing: number
  /** Bebauungsdichte: Anteil der Blockflächen mit Gebäuden (0–1). */
  density: number
  /** Startwert des Zufallsgenerators. Gleicher Wert = gleiches Viertel. */
  seed: number
}

/** Anteil der jeweils geeigneten Flächen, auf denen eine Maßnahme umgesetzt wird (0–1). */
export interface Measures {
  /** Dachbegrünung: dunkles Dach wird Gründach. */
  greenRoofs: number
  /** Cool Roofs: dunkles Dach wird hell gestrichen. */
  coolRoofs: number
  /** Laubbäume auf versiegelten Höfen, Plätzen und Parkplätzen. */
  trees: number
  /** Entsiegelung: Pflaster und Parkplatz-Asphalt werden Rasengitter. */
  unsealing: number
  /** Sprühnebel auf Straßen und Plätzen. */
  mist: number
}

export const NO_MEASURES: Measures = {
  greenRoofs: 0,
  coolRoofs: 0,
  trees: 0,
  unsealing: 0,
  mist: 0,
}

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
export function cellRanks(seed: number, count: number): number[] {
  return randomList(createRandom(seed ^ 0x9e3779b9), count)
}

/**
 * Wendet die Maßnahmen auf ein Raster an und gibt ein neues Raster zurück.
 *
 * Teilen sich zwei Maßnahmen dieselben Flächen (Gründach und Cool Roof,
 * Bäume und Entsiegelung), kommt die erste zuerst zum Zug und die zweite
 * erhält höchstens den Rest.
 */
export function applyMeasures(base: CityGrid, measures: Measures, ranks: number[]): CityGrid {
  const cells = base.cells.map((cell, index): GridCell => {
    const rank = ranks[index]
    let surface = cell.surface

    if (surface === 'roof') {
      if (rank < measures.greenRoofs) surface = 'greenRoof'
      else if (rank < measures.greenRoofs + measures.coolRoofs) surface = 'coolRoof'
    } else if (!cell.street && (surface === 'concrete' || surface === 'asphalt')) {
      // Höfe, Plätze und Parkplätze, aber keine Straßen.
      if (rank < measures.trees) surface = 'tree'
      else if (rank < measures.trees + measures.unsealing) surface = 'permeable'
    }

    // Sprühnebel nur dort, wo danach noch versiegelter Boden liegt.
    const sealedGround = surface === 'asphalt' || surface === 'concrete'
    // Eigener Rang (gespiegelt), damit Nebel nicht dieselben Zellen bevorzugt.
    const mist = cell.mist || (sealedGround && 1 - rank < measures.mist)

    return cell.street ? { surface, mist, street: true } : { surface, mist }
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
