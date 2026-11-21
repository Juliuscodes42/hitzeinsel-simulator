/**
 * Beispielpunkte und Prüfpunkte der Bilderkennung, je Ort auf dem Gerät gespeichert.
 */

import type { LabeledPoint } from '../model/learning.ts'
import { SURFACE_TYPES } from './materials.ts'

export interface PlacePoints {
  /** Beispiele, aus denen gelernt wird. */
  training: LabeledPoint[]
  /** Prüfpunkte, an denen die Genauigkeit gemessen wird. Sie fließen nie ins Lernen ein. */
  checks: LabeledPoint[]
}

export type PointSet = keyof PlacePoints

export const NO_POINTS: PlacePoints = { training: [], checks: [] }

const STORAGE_KEY = 'erkennung-punkte'

const isPoint = (value: unknown): value is LabeledPoint =>
  typeof value === 'object' &&
  value !== null &&
  Number.isInteger((value as LabeledPoint).index) &&
  SURFACE_TYPES.includes((value as LabeledPoint).surface)

export function loadPoints(): Record<string, PlacePoints> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<
      string,
      Partial<PlacePoints>
    >
    const result: Record<string, PlacePoints> = {}
    for (const [key, value] of Object.entries(parsed)) {
      result[key] = {
        training: (value?.training ?? []).filter(isPoint),
        checks: (value?.checks ?? []).filter(isPoint),
      }
    }
    return result
  } catch {
    return {}
  }
}

export function storePoints(points: Record<string, PlacePoints>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(points))
  } catch {
    // Speicher voll oder gesperrt: Die Punkte gelten dann nur bis zum Neuladen.
  }
}

/** Setzt, ersetzt oder entfernt (surface = null) den Punkt an einer Zelle. */
export function withPoint(
  points: PlacePoints,
  set: PointSet,
  index: number,
  surface: LabeledPoint['surface'] | null,
): PlacePoints {
  const others = points[set].filter((point) => point.index !== index)
  const existing = points[set].find((point) => point.index === index)
  if (surface === null) return existing ? { ...points, [set]: others } : points
  if (existing?.surface === surface) return points
  return { ...points, [set]: [...others, { index, surface }] }
}
