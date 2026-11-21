/** Zahlen in deutscher Schreibweise. */

export function formatNumber(value: number, digits = 1): string {
  return value.toLocaleString('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export const formatTemp = (tempC: number): string => `${formatNumber(tempC)} °C`

export const formatPercent = (share: number): string => `${Math.round(share * 100)} %`

/**
 * Temperaturunterschied mit Vorzeichen, z. B. "−3,2 °C".
 * Physikalisch korrekt wäre K; ein Unterschied von 1 K ist genau 1 °C.
 */
export function formatDelta(deltaK: number): string {
  const sign = deltaK > 0.05 ? '+' : deltaK < -0.05 ? '−' : '±'
  return `${sign}${formatNumber(Math.abs(deltaK))} °C`
}

/** Uhrzeit aus Dezimalstunden, z. B. 15.5 → "15:30". */
export function formatHour(hour: number): string {
  const h = Math.floor(hour) % 24
  const m = Math.round((hour - Math.floor(hour)) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Wassermenge in Litern mit Tausenderpunkten, z. B. "512.000 L". */
export const formatLitres = (litres: number): string =>
  `${Math.round(litres).toLocaleString('de-DE')} L`

/** Geldbetrag in Euro mit Tausenderpunkten, z. B. "150.000 €". */
export const formatEuro = (euro: number): string => `${Math.round(euro).toLocaleString('de-DE')} €`
