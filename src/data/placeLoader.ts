/**
 * Lädt einen Ort für die Simulation: OpenStreetMap-Raster in 2-m-Zellen,
 * amtliches Luftbild des Bundeslands und daraus die Bilderkennung.
 *
 * Klappt das Luftbild nicht (kein Internet, Dienst gestört, Ort nicht in
 * Deutschland), wird mit dem reinen OpenStreetMap-Raster gerechnet.
 */

import { SURFACE_TYPES } from './materials.ts'
import type { CityGrid } from '../model/grid.ts'
import { rasterizeOsm, type BBox, type CellSource } from '../model/osm.ts'
import { extractFeatures, recognize } from '../model/recognition.ts'
import {
  DOP_SERVICES,
  dopImageUrl,
  loadImagePixels,
  stateAt,
} from './aerialImagery.ts'
import { IMAGERY_ATTRIBUTION, aerialImageUrl, fetchOsm, type Place } from './places.ts'

/** Raster der Bilderkennung: 100 × 100 Zellen à 2 m = 200 m × 200 m. */
export const RECOGNITION_CELLS = 100
export const RECOGNITION_CELL_SIZE_M = 2

export interface PlaceRequest {
  id?: string
  name: string
  bbox: BBox
  /** Bundesland, falls bekannt (spart die Ortsbestimmung). */
  state?: string
}

/** Fortschrittsmeldung für die Anzeige. */
export type ProgressReport = (text: string) => void

const SOURCE_FROM_CODE: Record<string, CellSource> = {
  b: 'building',
  s: 'street',
  w: 'water',
  m: 'mapped',
  g: 'guessed',
}

interface StoredPrior {
  state: string
  surfaces: string
  streets: number[]
  sources: string
}

/** Fest eingebautes OSM-Raster eines Beispielorts (siehe scripts/build-example-priors.ts). */
export async function examplePrior(
  id: string,
): Promise<{ grid: CityGrid; sources: CellSource[]; state: string } | null> {
  // Erst bei Bedarf laden, damit die Seite selbst klein bleibt.
  const priors = (await import('./examplePriors.json')).default
  const stored = (priors.places as Record<string, StoredPrior>)[id]
  if (!stored) return null
  const streets = new Set(stored.streets)
  return {
    state: stored.state,
    sources: [...stored.sources].map((code) => SOURCE_FROM_CODE[code]),
    grid: {
      width: RECOGNITION_CELLS,
      height: RECOGNITION_CELLS,
      cellSizeM: RECOGNITION_CELL_SIZE_M,
      cells: [...stored.surfaces].map((code, index) => {
        const surface = SURFACE_TYPES[parseInt(code, 36)]
        return streets.has(index) ? { surface, mist: false, street: true } : { surface, mist: false }
      }),
    },
  }
}

/** Lädt einen Ort vollständig. */
export async function loadPlace(request: PlaceRequest, report: ProgressReport): Promise<Place> {
  const { bbox } = request
  let prior: CityGrid
  let sources: CellSource[]
  let state = request.state

  const stored = request.id ? await examplePrior(request.id) : null
  if (stored) {
    prior = stored.grid
    sources = stored.sources
    state ??= stored.state
  } else {
    report('Lade Gebäude, Straßen und Gewässer aus OpenStreetMap … Das kann bis zu einer Minute dauern.')
    const raster = rasterizeOsm(
      await fetchOsm(bbox),
      bbox,
      RECOGNITION_CELLS,
      RECOGNITION_CELLS,
      RECOGNITION_CELL_SIZE_M,
    )
    prior = raster.grid
    sources = raster.sources
  }
  const osmOnly = (notice: string): Place => ({
    id: request.id,
    name: request.name,
    bbox,
    grid: prior,
    guessedShare: sources.filter((source) => source === 'guessed').length / sources.length,
    imageUrl: aerialImageUrl(bbox),
    imageAttribution: IMAGERY_ATTRIBUTION,
    notice,
  })

  if (!state) {
    report('Bestimme das Bundesland …')
    const center = { lat: (bbox.north + bbox.south) / 2, lon: (bbox.east + bbox.west) / 2 }
    state = await stateAt(center.lat, center.lon).catch(() => undefined)
  }
  const service = state ? DOP_SERVICES[state] : undefined
  if (!service) {
    return osmOnly(
      'Für diesen Ort gibt es kein amtliches Luftbild. Die Flächen stammen nur aus OpenStreetMap.',
    )
  }

  report(`Lade das amtliche Luftbild (${service.state}) und erkenne die Flächen …`)
  const imageUrl = dopImageUrl(service, bbox)
  try {
    const image = await loadImagePixels(imageUrl)
    const features = extractFeatures(
      image.pixels,
      image.width,
      image.height,
      RECOGNITION_CELLS,
      RECOGNITION_CELLS,
    )
    const { grid, uncertain } = recognize(prior, sources, features)
    return {
      id: request.id,
      name: request.name,
      bbox,
      grid,
      guessedShare: uncertain.filter(Boolean).length / uncertain.length,
      imageUrl,
      imageAttribution: service.attribution,
      recognition: { prior, sources, features },
    }
  } catch {
    return osmOnly(
      `Das Luftbild aus ${service.state} war nicht erreichbar. Die Flächen stammen nur aus OpenStreetMap.`,
    )
  }
}
