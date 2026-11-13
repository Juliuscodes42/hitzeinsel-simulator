/**
 * Fest eingebaute Beispielorte. Sie funktionieren ohne Internet und bringen
 * Landsat-Messungen für den Vergleich mit dem Modell mit.
 *
 * Die Daten in examplePlaces.json erzeugt scripts/build-places.ts.
 */

import type { CityGrid } from '../model/grid.ts'
import type { LandsatScene } from '../model/validation.ts'
import raw from './examplePlaces.json'
import type { SurfaceType } from './materials.ts'
import { aerialImageUrl, type Place } from './places.ts'

export interface ExamplePlace extends Place {
  id: string
  lat: number
  lon: number
  scenes: LandsatScene[]
}

/** Datum, an dem die Beispielorte zuletzt erzeugt wurden. */
export const EXAMPLES_GENERATED: string = raw.generated

export const EXAMPLE_PLACES: ExamplePlace[] = raw.places.map((place) => {
  const streets = new Set(place.streets)
  const grid: CityGrid = {
    width: 20,
    height: 20,
    cellSizeM: 10,
    cells: (place.surfaces as SurfaceType[]).map((surface, index) =>
      streets.has(index) ? { surface, mist: false, street: true } : { surface, mist: false },
    ),
  }
  return {
    id: place.id,
    name: place.name,
    lat: place.lat,
    lon: place.lon,
    bbox: place.bbox,
    grid,
    guessedShare: place.guessedShare,
    imageUrl: aerialImageUrl(place.bbox),
    scenes: place.scenes,
  }
})
