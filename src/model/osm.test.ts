import { describe, expect, test } from 'vitest'
import { rasterizeOsm, squareAround, type OsmElement } from './osm.ts'

// 200 m × 200 m um einen Punkt in Elmshorn.
const LAT = 53.75
const LON = 9.65
const bbox = squareAround(LAT, LON, 200)

/** Rechnet Meter (x nach Osten, y nach Süden ab Nordwest-Ecke) in Koordinaten um. */
const at = (xM: number, yM: number) => ({
  lon: bbox.west + (xM / 200) * (bbox.east - bbox.west),
  lat: bbox.north - (yM / 200) * (bbox.north - bbox.south),
})

const rectangle = (x0: number, y0: number, x1: number, y1: number) => [
  at(x0, y0), at(x1, y0), at(x1, y1), at(x0, y1), at(x0, y0),
]

const cellAt = (elements: OsmElement[], column: number, row: number) =>
  rasterizeOsm(elements, bbox).grid.cells[row * 20 + column]

describe('Ausschnitt', () => {
  test('ist 200 m breit und 200 m hoch', () => {
    const heightM = (bbox.north - bbox.south) * 111_320
    const widthM = (bbox.east - bbox.west) * 111_320 * Math.cos((LAT * Math.PI) / 180)
    expect(heightM).toBeCloseTo(200, 3)
    expect(widthM).toBeCloseTo(200, 3)
  })
})

describe('OSM-Daten rastern', () => {
  test('ohne Daten ist alles geschätzter Rasen', () => {
    const { grid, guessedShare } = rasterizeOsm([], bbox)
    expect(grid.cells).toHaveLength(400)
    expect(grid.cells.every((cell) => cell.surface === 'grass')).toBe(true)
    expect(guessedShare).toBe(1)
  })

  test('ein Gebäude im Nordwesten wird zu Dachzellen', () => {
    const building: OsmElement = {
      type: 'way',
      tags: { building: 'yes' },
      geometry: rectangle(0, 0, 50, 30),
    }
    const { grid } = rasterizeOsm([building], bbox)
    expect(grid.cells.filter((cell) => cell.surface === 'roof')).toHaveLength(15) // 5 × 3 Zellen
    expect(grid.cells[0].surface).toBe('roof')
    expect(grid.cells[5].surface).toBe('grass')
  })

  test('eine Straße wird Asphalt und als Verkehrsfläche markiert', () => {
    const road: OsmElement = {
      type: 'way',
      tags: { highway: 'residential' },
      geometry: [at(0, 105), at(200, 105)],
    }
    const cell = cellAt([road], 10, 10)
    expect(cell.surface).toBe('asphalt')
    expect(cell.street).toBe(true)
    expect(cellAt([road], 10, 5).surface).toBe('grass')
  })

  test('ein Parkplatz wird Asphalt, bleibt aber für Maßnahmen frei', () => {
    const parking: OsmElement = {
      type: 'way',
      tags: { amenity: 'parking' },
      geometry: rectangle(100, 100, 200, 200),
    }
    const cell = cellAt([parking], 15, 15)
    expect(cell.surface).toBe('asphalt')
    expect(cell.street).toBeUndefined()
  })

  test('die Angabe "surface" bestimmt den Belag', () => {
    const parking: OsmElement = {
      type: 'way',
      tags: { amenity: 'parking', surface: 'grass_paver' },
      geometry: rectangle(100, 100, 200, 200),
    }
    expect(cellAt([parking], 15, 15).surface).toBe('permeable')
  })

  test('ein einzelner Baum färbt nur seine Zelle', () => {
    const tree: OsmElement = { type: 'node', tags: { natural: 'tree' }, ...at(55, 55) }
    const { grid } = rasterizeOsm([tree], bbox)
    expect(grid.cells[5 * 20 + 5].surface).toBe('tree')
    expect(grid.cells.filter((cell) => cell.surface === 'tree')).toHaveLength(1)
  })

  test('Gebäude haben Vorrang vor der Fläche, auf der sie stehen', () => {
    const elements: OsmElement[] = [
      { type: 'way', tags: { landuse: 'retail' }, geometry: rectangle(0, 0, 200, 200) },
      { type: 'way', tags: { building: 'retail' }, geometry: rectangle(0, 0, 100, 100) },
    ]
    const { grid, guessedShare } = rasterizeOsm(elements, bbox)
    expect(grid.cells[0].surface).toBe('roof')
    expect(grid.cells[399].surface).toBe('concrete')
    expect(guessedShare).toBeCloseTo(0.75, 5) // nur die Fläche ohne Gebäude ist geschätzt
  })

  test('Wasser und Wald aus Multipolygonen werden erkannt', () => {
    const lake: OsmElement = {
      type: 'relation',
      tags: { type: 'multipolygon', natural: 'water' },
      members: [{ type: 'way', role: 'outer', geometry: rectangle(0, 100, 100, 200) }],
    }
    const forest: OsmElement = {
      type: 'way',
      tags: { landuse: 'forest' },
      geometry: rectangle(100, 0, 200, 100),
    }
    expect(cellAt([lake, forest], 2, 15).surface).toBe('water')
    expect(cellAt([lake, forest], 15, 2).surface).toBe('tree')
  })
})
