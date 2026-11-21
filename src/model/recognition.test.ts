import { describe, expect, test } from 'vitest'
import { createUniformGrid, type GridCell } from './grid.ts'
import { measureAccuracy, trainClassifier } from './learning.ts'
import type { CellSource } from './osm.ts'
import { FEATURE_COUNT, classifyByRules, extractFeatures, recognize } from './recognition.ts'

/** Ein einfarbiges Bild (RGBA) mit width × height Bildpunkten. */
function solidImage(width: number, height: number, color: (x: number, y: number) => number[]) {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = color(x, y)
      pixels.set([r, g, b, 255], (y * width + x) * 4)
    }
  }
  return pixels
}

/** Merkmale einer einzelnen Zelle mit dieser Farbe. */
const featuresFor = (color: (x: number, y: number) => number[]) =>
  extractFeatures(solidImage(10, 10, color), 10, 10, 1, 1)

const ground: GridCell = { surface: 'grass', mist: false }

describe('Merkmale', () => {
  test('ein grauer Punkt hat keine Grünheit und keine Rauheit', () => {
    const f = featuresFor(() => [128, 128, 128])
    expect(f).toHaveLength(FEATURE_COUNT)
    expect(f[3]).toBeCloseTo(128 / 255, 3) // Helligkeit
    expect(f[4]).toBeCloseTo(0, 5) // Rauheit
    expect(f[5]).toBeCloseTo(0, 5) // Grünheit
  })

  test('ein Schachbrett ist rau', () => {
    const f = featuresFor((x, y) => ((x + y) % 2 ? [20, 60, 20] : [90, 160, 80]))
    expect(f[4]).toBeGreaterThan(0.1)
  })

  test('jede Zelle bekommt ihren eigenen Bildausschnitt', () => {
    const pixels = solidImage(20, 10, (x) => (x < 10 ? [0, 0, 0] : [255, 255, 255]))
    const f = extractFeatures(pixels, 20, 10, 2, 1)
    expect(f[3]).toBeCloseTo(0, 3)
    expect(f[FEATURE_COUNT + 3]).toBeCloseTo(1, 3)
  })
})

describe('Regeln', () => {
  const classify = (color: number[], source: CellSource = 'guessed', prior = ground) =>
    classifyByRules(featuresFor(() => color), prior, source).surface

  test('kräftiges helles Grün ist Rasen, dunkles Grün ist Baum', () => {
    expect(classify([110, 170, 70])).toBe('grass')
    expect(classify([30, 70, 30])).toBe('tree')
  })

  test('dunkelgrau ist Asphalt, hellgrau Pflaster, sandfarben unversiegelt', () => {
    expect(classify([70, 70, 75])).toBe('asphalt')
    expect(classify([160, 160, 158])).toBe('concrete')
    expect(classify([200, 170, 120])).toBe('permeable')
  })

  test('Gebäude aus OSM: grünes Dach ist Gründach, helles Dach ist Cool Roof', () => {
    expect(classify([90, 140, 60], 'building')).toBe('greenRoof')
    expect(classify([230, 230, 228], 'building')).toBe('coolRoof')
    expect(classify([120, 70, 60], 'building')).toBe('roof')
  })

  test('im Schatten gilt OpenStreetMap, die Zelle ist aber unsicher', () => {
    const guess = classifyByRules(
      featuresFor(() => [25, 28, 35]),
      { surface: 'concrete', mist: false },
      'mapped',
    )
    expect(guess).toEqual({ surface: 'concrete', uncertain: true })
  })

  test('Straßen behalten ihren Belag aus OSM, Wasser bleibt Wasser', () => {
    expect(classify([160, 160, 158], 'street', { surface: 'asphalt', mist: false })).toBe('asphalt')
    expect(classify([40, 60, 80], 'water', { surface: 'water', mist: false })).toBe('water')
  })
})

describe('Erkennen und Lernen', () => {
  // 10 × 1 Zellen: links fünf graue, rechts fünf grüne Zellen.
  const width = 10
  const pixels = solidImage(100, 10, (x) => (x < 50 ? [150, 150, 150] : [100, 170, 60]))
  const features = extractFeatures(pixels, 100, 10, width, 1)
  const prior = createUniformGrid('concrete', width, 1, 2)
  const sources: CellSource[] = Array(width).fill('guessed')

  test('die Regeln erkennen Pflaster und Rasen', () => {
    const { grid } = recognize(prior, sources, features)
    expect(grid.cells.map((cell) => cell.surface)).toEqual([
      ...Array(5).fill('concrete'),
      ...Array(5).fill('grass'),
    ])
  })

  test('mit Beispielpunkten lernt das Verfahren eine andere Zuordnung', () => {
    // Angenommen, das Graue ist in Wahrheit Kies (unversiegelt).
    const decide = trainClassifier(features, [
      { index: 0, surface: 'permeable' },
      { index: 9, surface: 'grass' },
    ])
    expect(decide).not.toBeNull()
    const { grid } = recognize(prior, sources, features, decide!)
    expect(grid.cells[2].surface).toBe('permeable')
    expect(grid.cells[7].surface).toBe('grass')
  })

  test('ohne Beispiele für Pflanzen bleiben erkannte Pflanzen erhalten', () => {
    // Drei Streifen: hellgrau, dunkelgrau, grün. Beispiele nur für die beiden Grautöne.
    const stripes = solidImage(150, 10, (x) =>
      x < 50 ? [170, 170, 168] : x < 100 ? [60, 60, 64] : [100, 170, 60],
    )
    const stripeFeatures = extractFeatures(stripes, 150, 10, 15, 1)
    const decide = trainClassifier(stripeFeatures, [
      { index: 0, surface: 'concrete' },
      { index: 7, surface: 'asphalt' },
    ])
    const { grid } = recognize(
      createUniformGrid('concrete', 15, 1, 2),
      Array(15).fill('guessed'),
      stripeFeatures,
      decide!,
    )
    expect(grid.cells[12].surface).toBe('grass')
  })

  test('mit nur einer Bodenart gibt es nichts zu lernen', () => {
    expect(trainClassifier(features, [{ index: 0, surface: 'permeable' }])).toBeNull()
  })

  test('die Genauigkeit zählt Treffer und Verwechslungen', () => {
    const { grid } = recognize(prior, sources, features)
    const accuracy = measureAccuracy(grid, [
      { index: 1, surface: 'concrete' },
      { index: 6, surface: 'grass' },
      { index: 3, surface: 'permeable' },
      { index: 8, surface: 'tree' },
    ])
    expect(accuracy.correct).toBe(2)
    expect(accuracy.share).toBe(0.5)
    expect(accuracy.confusion.permeable).toEqual({ concrete: 1 })
    expect(accuracy.confusion.tree).toEqual({ grass: 1 })
  })
})
