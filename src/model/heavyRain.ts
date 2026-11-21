/**
 * Starkregen am Ort aus KOSTRA-DWD-2020 (Deutscher Wetterdienst).
 *
 * KOSTRA gibt für jede 5-km-Zelle in Deutschland an, wie viel Regen in einer
 * bestimmten Dauer (hier 60 Minuten) im Mittel einmal in T Jahren fällt.
 * Ein „30-jährlicher Regen" ist also ein Regen, der statistisch einmal in
 * 30 Jahren erreicht oder überschritten wird.
 *
 * Das Raster liegt in der flächentreuen Projektion ETRS89-LAEA (EPSG:3035).
 * Geografische Koordinaten werden dafür umgerechnet (EPSG Guidance Note 7-2).
 */

/** Wiederkehrzeiten, die in den Daten enthalten sind (Jahre). */
export const RETURN_PERIODS = [5, 30, 100] as const
export type ReturnPeriod = (typeof RETURN_PERIODS)[number]

/** Aufbereitete KOSTRA-Daten (siehe scripts/build-kostra.py). */
export interface KostraGrid {
  source: string
  durationMin: number
  ncols: number
  nrows: number
  xllcorner: number
  yllcorner: number
  cellsize: number
  /** Je Wiederkehrzeit ein Zeichen pro Zelle, Zeilen von Nord nach Süd. */
  returnPeriods: Record<string, string>
}

// GRS80-Ellipsoid und Parameter von EPSG:3035
const A = 6_378_137
const E2 = 0.006694380022900787 // e² = 2f − f², f = 1/298.257222101
const E = Math.sqrt(E2)
const LAT0 = (52 * Math.PI) / 180
const LON0 = (10 * Math.PI) / 180
const FALSE_EASTING = 4_321_000
const FALSE_NORTHING = 3_210_000

/** Hilfsgröße q der flächentreuen Azimutalprojektion. */
function q(lat: number): number {
  const s = Math.sin(lat)
  return (1 - E2) * (s / (1 - E2 * s * s) - (1 / (2 * E)) * Math.log((1 - E * s) / (1 + E * s)))
}

const Q_POLE = q(Math.PI / 2)
const RQ = A * Math.sqrt(Q_POLE / 2)
const BETA0 = Math.asin(q(LAT0) / Q_POLE)
const D =
  (A * Math.cos(LAT0)) / Math.sqrt(1 - E2 * Math.sin(LAT0) ** 2) / (RQ * Math.cos(BETA0))

/** Geografische Koordinaten (Grad) → ETRS89-LAEA in Metern (Ost, Nord). */
export function toLaea(latDeg: number, lonDeg: number): { x: number; y: number } {
  const lat = (latDeg * Math.PI) / 180
  const lon = (lonDeg * Math.PI) / 180
  const beta = Math.asin(q(lat) / Q_POLE)
  const b =
    RQ *
    Math.sqrt(
      2 /
        (1 +
          Math.sin(BETA0) * Math.sin(beta) +
          Math.cos(BETA0) * Math.cos(beta) * Math.cos(lon - LON0)),
    )
  return {
    x: FALSE_EASTING + b * D * Math.cos(beta) * Math.sin(lon - LON0),
    y:
      FALSE_NORTHING +
      (b / D) *
        (Math.cos(BETA0) * Math.sin(beta) -
          Math.sin(BETA0) * Math.cos(beta) * Math.cos(lon - LON0)),
  }
}

/**
 * Regenhöhe in mm für 60 Minuten und die Wiederkehrzeit am Ort.
 * undefined = außerhalb des Rasters (nicht in Deutschland).
 */
export function heavyRainMm(
  grid: KostraGrid,
  latDeg: number,
  lonDeg: number,
  period: ReturnPeriod,
): number | undefined {
  const { x, y } = toLaea(latDeg, lonDeg)
  const column = Math.floor((x - grid.xllcorner) / grid.cellsize)
  const rowFromSouth = Math.floor((y - grid.yllcorner) / grid.cellsize)
  if (column < 0 || column >= grid.ncols || rowFromSouth < 0 || rowFromSouth >= grid.nrows) {
    return undefined
  }
  const row = grid.nrows - 1 - rowFromSouth
  const code = grid.returnPeriods[String(period)]?.charCodeAt(row * grid.ncols + column)
  if (code === undefined || code === 33) return undefined // "!" = keine Daten
  return code - 35
}
