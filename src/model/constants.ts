/**
 * Physikalische Konstanten des Modells (SI-Einheiten).
 */

/** Stefan-Boltzmann-Konstante in W/(m²·K⁴). */
export const STEFAN_BOLTZMANN = 5.670374e-8

/** Solarkonstante: Sonnenstrahlung am Rand der Atmosphäre in W/m². */
export const SOLAR_CONSTANT = 1361

/** Psychrometerkonstante in Pa/K (bei Normaldruck). */
export const PSYCHROMETRIC_CONSTANT = 66

/** 0 °C in Kelvin. */
export const KELVIN_OFFSET = 273.15

/** Länge eines Tages in Sekunden. */
export const SECONDS_PER_DAY = 86_400

export const celsiusToKelvin = (celsius: number): number => celsius + KELVIN_OFFSET
