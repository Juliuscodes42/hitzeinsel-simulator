/**
 * Rastert OpenStreetMap für die Beispielorte in 2-m-Zellen (100 × 100) und legt
 * das Ergebnis in der App ab. So muss beim Klick auf einen Beispielort nur
 * noch das Luftbild geladen werden.
 *
 * Aufruf (im Projektordner):  node scripts/build-example-priors.ts
 * Ergebnis: src/data/examplePriors.json
 *
 * Kodierung: je Zelle ein Zeichen.
 *  surfaces: Index in SURFACE_TYPES als Ziffer bzw. Buchstabe (0–9, a–z)
 *  sources:  b = Gebäude, s = Straße, w = Wasser, m = kartiert, g = geschätzt
 */

import { writeFileSync } from 'node:fs'
import raw from '../src/data/examplePlaces.json' with { type: 'json' }
import { SURFACE_TYPES } from '../src/data/materials.ts'
import { rasterizeOsm, type OsmElement } from '../src/model/osm.ts'

/** Bundesland der Beispielorte (für das amtliche Luftbild). */
const STATES: Record<string, string> = {
  'ebs-elmshorn': 'DE-SH',
  'koeln-neumarkt': 'DE-NW',
  'berlin-potsdamer-platz': 'DE-BE',
  'freiburg-vauban': 'DE-BW',
}

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

async function fetchOsm(box: string): Promise<OsmElement[]> {
  const query = `[out:json][timeout:60];(way(${box});relation["type"="multipolygon"](${box});node["natural"="tree"](${box}););out geom;`
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const response = await fetch(ENDPOINTS[attempt % ENDPOINTS.length], {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'hitzeinsel-simulator (Schulprojekt)',
        },
        signal: AbortSignal.timeout(90_000),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return ((await response.json()) as { elements: OsmElement[] }).elements
    } catch (error) {
      console.log(`   Overpass-Versuch ${attempt + 1} fehlgeschlagen: ${String(error).slice(0, 80)}`)
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }
  }
  throw new Error('Overpass nicht erreichbar')
}

const SOURCE_CODES = { building: 'b', street: 's', water: 'w', mapped: 'm', guessed: 'g' } as const

const places: Record<string, unknown> = {}
for (const place of raw.places) {
  const state = STATES[place.id]
  if (!state) throw new Error(`Bundesland für ${place.id} fehlt`)
  const { bbox } = place
  const elements = await fetchOsm(`${bbox.south},${bbox.west},${bbox.north},${bbox.east}`)
  const { grid, sources } = rasterizeOsm(elements, bbox, 100, 100, 2)
  places[place.id] = {
    state,
    surfaces: grid.cells.map((cell) => SURFACE_TYPES.indexOf(cell.surface).toString(36)).join(''),
    streets: grid.cells.flatMap((cell, index) => (cell.street ? [index] : [])),
    sources: sources.map((source) => SOURCE_CODES[source]).join(''),
  }
  console.log(`${place.name}: ${elements.length} OSM-Elemente`)
}

writeFileSync(
  new URL('../src/data/examplePriors.json', import.meta.url),
  JSON.stringify({ generated: new Date().toISOString().slice(0, 10), places }) + '\n',
)
console.log('Gespeichert: src/data/examplePriors.json')
