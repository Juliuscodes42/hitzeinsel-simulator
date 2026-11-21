import { describe, expect, test } from 'vitest'
import { createUniformGrid, type CityGrid } from '../model/grid.ts'
import {
  applyCorrection,
  correctionFromGrid,
  parseCorrections,
  placeKey,
} from './corrections.ts'
import type { Place } from './places.ts'

const grid: CityGrid = createUniformGrid('grass', 2, 2)
grid.cells[0] = { surface: 'asphalt', mist: true, street: true }
grid.cells[3] = { surface: 'roof', mist: false }

describe('Korrigierte Raster', () => {
  test('speichern und wieder anwenden ergibt dasselbe Raster, ohne Sprühnebel', () => {
    const correction = correctionFromGrid(grid, '2026-11-14')
    expect(correction.surfaces).toEqual(['asphalt', 'grass', 'grass', 'roof'])
    expect(correction.streets).toEqual([0])

    const restored = applyCorrection(createUniformGrid('concrete', 2, 2), correction)
    expect(restored.cells[0]).toEqual({ surface: 'asphalt', mist: false, street: true })
    expect(restored.cells[3]).toEqual({ surface: 'roof', mist: false })
  })

  test('eine Korrektur falscher Größe wird nicht angewendet', () => {
    const big = createUniformGrid('concrete', 3, 3)
    expect(applyCorrection(big, correctionFromGrid(grid, '2026-11-14'))).toBe(big)
    expect(applyCorrection(big, undefined)).toBe(big)
  })

  test('Beispielorte heißen nach ihrer id, andere Orte nach ihrem Ausschnitt', () => {
    const place = {
      name: 'Test',
      bbox: { south: 53.1234567, west: 9.1, north: 53.2, east: 9.2 },
      grid,
      guessedShare: 0,
      imageUrl: '',
      imageAttribution: '',
    } satisfies Place
    expect(placeKey(place)).toBe('53.12346,9.10000,53.20000,9.20000')
    expect(placeKey({ ...place, id: 'ebs-elmshorn' })).toBe('ebs-elmshorn')
  })
})

describe('Korrektur-Datei einlesen', () => {
  const valid = { surfaces: ['asphalt', 'grass'], streets: [0], savedAt: '2026-11-14' }

  test('gültige Einträge werden übernommen, ungültige übersprungen', () => {
    const text = JSON.stringify({
      gut: valid,
      unbekannteFlaeche: { ...valid, surfaces: ['lava'] },
      falscherIndex: { ...valid, streets: [7] },
      keinObjekt: 42,
    })
    expect(parseCorrections(text)).toEqual({ gut: valid })
  })

  test('unbrauchbare Dateien werden mit verständlicher Meldung abgelehnt', () => {
    expect(() => parseCorrections('kein json')).toThrow(/JSON/)
    expect(() => parseCorrections('[1, 2]')).toThrow(/keine Korrekturen/)
    expect(() => parseCorrections('{"x": 1}')).toThrow(/keine gültigen/)
  })
})
