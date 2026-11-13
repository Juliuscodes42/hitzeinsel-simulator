/**
 * Farben für die Rasterdarstellung.
 */

import type { SurfaceType } from '../data/materials.ts'

/** Stützstellen der Temperaturskala: [Temperatur in °C, Rot, Grün, Blau]. */
const TEMPERATURE_STOPS: readonly (readonly [number, number, number, number])[] = [
  [20, 38, 150, 92], // kühl: grün
  [26, 150, 196, 80],
  [32, 240, 212, 64], // warm: gelb
  [38, 242, 150, 46],
  [45, 214, 48, 36], // extrem heiß: rot
  [55, 110, 16, 62], // darüber: dunkelrot-violett
]

export const TEMPERATURE_SCALE_MIN = TEMPERATURE_STOPS[0][0]
export const TEMPERATURE_SCALE_MAX = TEMPERATURE_STOPS[TEMPERATURE_STOPS.length - 1][0]

/** Farbe für eine Oberflächentemperatur, linear zwischen den Stützstellen gemischt. */
export function temperatureColor(tempC: number): string {
  const clamped = Math.min(TEMPERATURE_SCALE_MAX, Math.max(TEMPERATURE_SCALE_MIN, tempC))
  for (let i = 1; i < TEMPERATURE_STOPS.length; i++) {
    const [t0, r0, g0, b0] = TEMPERATURE_STOPS[i - 1]
    const [t1, r1, g1, b1] = TEMPERATURE_STOPS[i]
    if (clamped <= t1) {
      const f = (clamped - t0) / (t1 - t0)
      const mix = (a: number, b: number) => Math.round(a + (b - a) * f)
      return `rgb(${mix(r0, r1)} ${mix(g0, g1)} ${mix(b0, b1)})`
    }
  }
  return 'rgb(110 16 62)'
}

/** CSS-Farbverlauf der gesamten Skala, für die Legende. */
export const TEMPERATURE_GRADIENT = `linear-gradient(to right, ${TEMPERATURE_STOPS.map(
  ([t, r, g, b]) =>
    `rgb(${r} ${g} ${b}) ${(
      ((t - TEMPERATURE_SCALE_MIN) / (TEMPERATURE_SCALE_MAX - TEMPERATURE_SCALE_MIN)) *
      100
    ).toFixed(1)}%`,
).join(', ')})`

/** Farben der Oberflächentypen in der Flächenansicht. */
export const SURFACE_COLORS: Record<SurfaceType, string> = {
  asphalt: '#4b5057',
  concrete: '#a8a9a3',
  permeable: '#b9c48c',
  grass: '#7fbf6a',
  tree: '#2f7d3b',
  water: '#4a90c9',
  roof: '#7d4d3c',
  coolRoof: '#eef0f2',
  greenRoof: '#5aa37c',
}
