/**
 * Von Hand korrigierte Raster.
 *
 * OpenStreetMap kennt nicht jede Fläche. Wer ein Raster anhand des Luftbilds
 * nachgezeichnet hat, kann es als Korrektur speichern. Korrekturen liegen
 *   1. fest im Projekt (corrections.json, für alle Besucher) und
 *   2. im Browser dieses Geräts (überschreiben die festen).
 * Über „Herunterladen" und „Laden" wandern sie zwischen Geräten und ins Projekt.
 */

import type { CityGrid } from '../model/grid.ts'
import bundled from './corrections.json'
import { MATERIALS, type SurfaceType } from './materials.ts'
import type { Place } from './places.ts'

export interface GridCorrection {
  /** Oberfläche jeder Zelle, zeilenweise von Nordwest nach Südost. */
  surfaces: SurfaceType[]
  /** Indizes der Zellen, die Verkehrsfläche sind. */
  streets: number[]
  /** Datum der Korrektur, JJJJ-MM-TT. */
  savedAt: string
}

/** Korrekturen je Ort. Schlüssel siehe placeKey(). */
export type Corrections = Record<string, GridCorrection>

const STORAGE_KEY = 'raster-korrekturen'

/** Kennung eines Orts: bei Beispielorten die feste id, sonst der Ausschnitt. */
export function placeKey(place: Place & { id?: string }): string {
  if (place.id) return place.id
  const { south, west, north, east } = place.bbox
  return [south, west, north, east].map((value) => value.toFixed(5)).join(',')
}

/** Macht aus einem Raster eine Korrektur. Sprühnebel wird nicht gespeichert. */
export function correctionFromGrid(grid: CityGrid, savedAt: string): GridCorrection {
  return {
    surfaces: grid.cells.map((cell) => cell.surface),
    streets: grid.cells.flatMap((cell, index) => (cell.street ? [index] : [])),
    savedAt,
  }
}

/** Wendet eine Korrektur an. Passt sie nicht zur Rastergröße, bleibt das Original. */
export function applyCorrection(grid: CityGrid, correction: GridCorrection | undefined): CityGrid {
  if (!correction || correction.surfaces.length !== grid.cells.length) return grid
  const streets = new Set(correction.streets)
  return {
    ...grid,
    cells: correction.surfaces.map((surface, index) =>
      streets.has(index) ? { surface, mist: false, street: true } : { surface, mist: false },
    ),
  }
}

/** Prüft, ob ein eingelesener Wert eine gültige Korrektur ist. */
function isCorrection(value: unknown): value is GridCorrection {
  if (typeof value !== 'object' || value === null) return false
  const { surfaces, streets, savedAt } = value as Record<string, unknown>
  return (
    Array.isArray(surfaces) &&
    surfaces.length > 0 &&
    surfaces.every((surface) => typeof surface === 'string' && surface in MATERIALS) &&
    Array.isArray(streets) &&
    streets.every((index) => Number.isInteger(index) && index >= 0 && index < surfaces.length) &&
    typeof savedAt === 'string'
  )
}

/**
 * Liest Korrekturen aus dem Text einer Datei. Ungültige Einträge werden
 * übersprungen; ist gar nichts Brauchbares dabei, gibt es einen Fehler.
 */
export function parseCorrections(text: string): Corrections {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Die Datei ist keine gültige Korrektur-Datei (kein JSON).')
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Die Datei enthält keine Korrekturen.')
  }
  const valid = Object.fromEntries(Object.entries(data).filter(([, value]) => isCorrection(value)))
  if (Object.keys(valid).length === 0) throw new Error('Die Datei enthält keine gültigen Korrekturen.')
  return valid as Corrections
}

function readStored(): Corrections {
  try {
    const text = localStorage.getItem(STORAGE_KEY)
    return text ? parseCorrections(text) : {}
  } catch {
    return {} // kein Speicher verfügbar oder nichts Gültiges gespeichert
  }
}

/** Alle Korrekturen: die festen aus dem Projekt, überschrieben von denen dieses Geräts. */
export function loadCorrections(): Corrections {
  return { ...(bundled as Corrections), ...readStored() }
}

/** Speichert die Korrekturen dieses Geräts. Gibt false zurück, wenn das nicht geht. */
export function storeCorrections(corrections: Corrections): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(corrections))
    return true
  } catch {
    return false
  }
}

/** Ist die Korrektur fest im Projekt hinterlegt (und nicht nur auf diesem Gerät)? */
export const isBundled = (key: string): boolean => key in bundled
