/**
 * Äußere Bedingungen: Sonnenstand, Sonnenstrahlung, Lufttemperatur,
 * Wärmestrahlung der Atmosphäre und Luftfeuchte.
 */

import { SOLAR_CONSTANT, celsiusToKelvin } from './constants.ts'

export interface Weather {
  /** Geografische Breite in Grad (Nord positiv). */
  latitudeDeg: number
  /** Tag im Jahr, 1 = 1. Januar. */
  dayOfYear: number
  /** Durchlässigkeit der Atmosphäre für Sonnenlicht: ~0,75 klar, ~0,3 stark bewölkt. */
  transmissivity: number
  /** Tiefste Lufttemperatur des Tages in °C (früh morgens). */
  tMinC: number
  /** Höchste Lufttemperatur des Tages in °C (nachmittags). */
  tMaxC: number
  /** Windgeschwindigkeit über freiem Gelände in m/s. */
  windSpeed: number
  /** Relative Luftfeuchte zur Zeit der Höchsttemperatur (0–1). */
  relHumidityAtMax: number
}

/** Ein heißer, klarer Hochsommertag in Norddeutschland (Elmshorn, 20. Juli). */
export const DEFAULT_WEATHER: Weather = {
  latitudeDeg: 53.75,
  dayOfYear: 201,
  transmissivity: 0.72,
  tMinC: 17,
  tMaxC: 31,
  windSpeed: 2,
  relHumidityAtMax: 0.4,
}

/** Uhrzeit (wahre Sonnenzeit), zu der die Luft am wärmsten ist. */
const HOUR_OF_MAX_AIR_TEMP = 15

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180

/**
 * Sinus der Sonnenhöhe über dem Horizont.
 *   sin h = sin φ · sin δ + cos φ · cos δ · cos ω
 * φ = Breite, δ = Deklination der Sonne, ω = Stundenwinkel (15° pro Stunde).
 * Negative Werte bedeuten: Die Sonne steht unter dem Horizont.
 */
export function sinSolarElevation(latitudeDeg: number, dayOfYear: number, hour: number): number {
  const declination = toRadians(23.44) * Math.sin((2 * Math.PI * (284 + dayOfYear)) / 365)
  const latitude = toRadians(latitudeDeg)
  const hourAngle = toRadians(15 * (hour - 12))
  return (
    Math.sin(latitude) * Math.sin(declination) +
    Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle)
  )
}

/**
 * Uhrzeiten von Sonnenauf- und -untergang (wahre Sonnenzeit).
 *   cos ω₀ = −tan φ · tan δ   → halbe Tageslänge ω₀ in Grad, 15° = 1 Stunde
 */
export function daylight(weather: Weather): { sunrise: number; sunset: number } {
  const declination = toRadians(23.44) * Math.sin((2 * Math.PI * (284 + weather.dayOfYear)) / 365)
  const cosHalfDay = -Math.tan(toRadians(weather.latitudeDeg)) * Math.tan(declination)
  const halfDayHours = (Math.acos(Math.min(1, Math.max(-1, cosHalfDay))) * 12) / Math.PI
  return { sunrise: 12 - halfDayHours, sunset: 12 + halfDayHours }
}

/**
 * Sonnenstrahlung auf eine waagerechte Fläche in W/m².
 *   K↓ = S₀ · τ · sin h
 */
export function shortwaveDown(weather: Weather, hour: number): number {
  const sinElevation = sinSolarElevation(weather.latitudeDeg, weather.dayOfYear, hour)
  return SOLAR_CONSTANT * weather.transmissivity * Math.max(0, sinElevation)
}

/**
 * Lufttemperatur in °C als Kosinus-Tagesgang zwischen Minimum und Maximum.
 */
export function airTemperatureC(weather: Weather, hour: number): number {
  const mean = (weather.tMaxC + weather.tMinC) / 2
  const amplitude = (weather.tMaxC - weather.tMinC) / 2
  return mean + amplitude * Math.cos((2 * Math.PI * (hour - HOUR_OF_MAX_AIR_TEMP)) / 24)
}

/** Tagesmittel der Lufttemperatur in °C. */
export function meanAirTemperatureC(weather: Weather): number {
  return (weather.tMaxC + weather.tMinC) / 2
}

/**
 * Wärmestrahlung der Atmosphäre zum Boden in W/m² bei klarem Himmel.
 * Formel nach Swinbank (1963):  L↓ = 5,31·10⁻¹³ · T⁶   (T in Kelvin)
 */
export function longwaveDown(airTempC: number): number {
  return 5.31e-13 * celsiusToKelvin(airTempC) ** 6
}

/**
 * Sättigungsdampfdruck in Pa (Magnus-Formel).
 * So viel Wasserdampf kann Luft der Temperatur T höchstens enthalten.
 */
export function saturationVapourPressure(tempC: number): number {
  return 610.94 * Math.exp((17.625 * tempC) / (tempC + 243.04))
}

/**
 * Dampfdruck der Luft in Pa. Er wird über den Tag als konstant angenommen
 * (gleiche Wassermenge in der Luft) und kann den Sättigungswert der
 * kältesten Stunde nicht überschreiten.
 */
export function airVapourPressure(weather: Weather): number {
  return Math.min(
    weather.relHumidityAtMax * saturationVapourPressure(weather.tMaxC),
    saturationVapourPressure(weather.tMinC),
  )
}
