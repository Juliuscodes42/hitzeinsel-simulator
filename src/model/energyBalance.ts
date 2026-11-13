/**
 * Dynamische Energiebilanz einer einzelnen Oberfläche.
 *
 * Für jede Minute des Tages wird berechnet, wie viel Energie die Oberfläche
 * gewinnt und verliert. Der Überschuss erwärmt sie, ein Defizit kühlt sie ab:
 *
 *   C · dT/dt = Q* − H − LE − G
 *
 *   Q* = (1 − α)·(1 − s)·K↓ + ε·ψ·(L↓ − σ·T⁴)   Strahlungsbilanz
 *   H  = h·(T − T_Luft)                          fühlbare Wärme (Konvektion)
 *   LE = m·(h/γ)·(e_s(T) − e_Luft)               Verdunstung
 *   G  = k·(T − T_tief)                          Wärmeleitung in die Tiefe
 *
 * C ist die Wärmekapazität der aktiven Schicht. Weil Asphalt und Beton viel
 * Wärme speichern, geben sie diese nachts wieder ab. So entsteht der
 * nächtliche Hitzestau.
 */

import { MATERIALS, type Material, type SurfaceType } from '../data/materials.ts'
import {
  airTemperatureC,
  airVapourPressure,
  longwaveDown,
  meanAirTemperatureC,
  saturationVapourPressure,
  shortwaveDown,
  type Weather,
} from './atmosphere.ts'
import {
  PSYCHROMETRIC_CONSTANT,
  SECONDS_PER_DAY,
  STEFAN_BOLTZMANN,
  celsiusToKelvin,
} from './constants.ts'

/** Lage und Zustand einer Oberfläche in der Stadt. */
export interface CellConditions {
  surface: SurfaceType
  /** Himmelssichtfaktor ψ: Anteil des Himmels, den die Fläche "sieht" (0–1). */
  skyViewFactor: number
  /** Anteil der Sonnenstrahlung, den umliegende Gebäude abschatten (0–1). */
  shade: number
  /** Anteil der freien Windgeschwindigkeit, der am Boden ankommt (0–1). */
  windFactor: number
  /** Läuft hier tagsüber eine Sprühnebel-Anlage? */
  mist: boolean
}

/** Freie, unverschattete Lage, z. B. ein offener Platz oder ein Dach. */
export const OPEN_CONDITIONS = {
  skyViewFactor: 1,
  shade: 0,
  windFactor: 1,
  mist: false,
} as const

/** Alle Energieflüsse in W/m². Strahlung: positiv = Gewinn. H, LE, G: positiv = Verlust. */
export interface Fluxes {
  shortwaveAbsorbed: number
  longwaveNet: number
  netRadiation: number
  sensible: number
  latent: number
  ground: number
}

/** Ein Zeitpunkt der Tageskurve. */
export interface Sample {
  hour: number
  surfaceC: number
  airC: number
  fluxes: Fluxes
}

export interface DayResult {
  /** Tageskurve, ein Wert alle 10 Minuten (144 Werte). */
  samples: Sample[]
  maxC: number
  minC: number
  meanC: number
}

/** Rechenschritt in Sekunden. */
const TIME_STEP = 60
const STEPS_PER_DAY = SECONDS_PER_DAY / TIME_STEP
/** Alle so viele Rechenschritte wird ein Wert gespeichert (= alle 10 Minuten). */
const SAMPLE_EVERY = 10
export const SAMPLES_PER_HOUR = 3600 / (SAMPLE_EVERY * TIME_STEP)
/**
 * So viele Tage wird derselbe Tag wiederholt, bis sich ein stabiler
 * Tagesgang eingestellt hat. Nur der letzte Tag wird ausgegeben.
 */
const SIMULATED_DAYS = 6

/** Sprühnebel: Betriebszeit und Feuchteverfügbarkeit der benetzten Fläche. */
const MIST_START_HOUR = 10
const MIST_END_HOUR = 20
const MIST_MOISTURE = 0.6

/**
 * Wärmeübergangskoeffizient h in W/(m²·K) nach Jürges:  h = 5,7 + 3,8·u
 * Je stärker der Wind, desto mehr Wärme trägt die Luft fort.
 */
export function convectionCoefficient(windSpeed: number): number {
  return 5.7 + 3.8 * windSpeed
}

/**
 * Wärmekapazität C der aktiven Schicht in J/(m²·K) und Kopplung k nach unten
 * in W/(m²·K).
 *
 * Bei massivem Untergrund dringt die Tageswelle nur bis zur Tiefe
 *   d = √(κ·P/π)   mit κ = λ/C_vol, P = 24 h
 * ein. Diese Schicht speichert die Tageswärme: C = C_vol·d, k = λ/d.
 */
export function heatStorageOf(material: Material): { capacity: number; coupling: number } {
  const storage = material.storage
  if (storage.kind === 'layer') {
    return { capacity: storage.arealHeatCapacity, coupling: storage.deepCoupling }
  }
  const diffusivity = storage.conductivity / storage.volumetricHeatCapacity
  const dampingDepth = Math.sqrt((diffusivity * SECONDS_PER_DAY) / Math.PI)
  return {
    capacity: storage.volumetricHeatCapacity * dampingDepth,
    coupling: storage.conductivity / dampingDepth,
  }
}

/** Äußere Bedingungen zu einem Zeitpunkt. */
interface Forcing {
  airC: number
  /** Sonnenstrahlung K↓ in W/m². */
  shortwave: number
  /** Gegenstrahlung der Atmosphäre L↓ in W/m². */
  longwave: number
  /** Dampfdruck der Luft in Pa. */
  vapourPressure: number
}

function forcingAt(weather: Weather, hour: number, vapourPressure: number): Forcing {
  const airC = airTemperatureC(weather, hour)
  return {
    airC,
    shortwave: shortwaveDown(weather, hour),
    longwave: longwaveDown(airC),
    vapourPressure,
  }
}

/**
 * Die äußeren Bedingungen für jeden Rechenschritt eines Tages. Sie hängen
 * nur vom Wetter ab und werden deshalb je Wetter nur einmal berechnet und
 * dann für alle Zellen wiederverwendet.
 */
const forcingCache = new WeakMap<Weather, Forcing[]>()

function dailyForcing(weather: Weather): Forcing[] {
  let table = forcingCache.get(weather)
  if (!table) {
    const vapourPressure = airVapourPressure(weather)
    table = Array.from({ length: STEPS_PER_DAY }, (_, step) =>
      forcingAt(weather, (step * TIME_STEP) / 3600, vapourPressure),
    )
    forcingCache.set(weather, table)
  }
  return table
}

/** Die eigentliche Energiebilanz: alle Flüsse aus Material, Lage und äußeren Bedingungen. */
function fluxesFor(
  material: Material,
  coupling: number,
  conditions: CellConditions,
  h: number,
  forcing: Forcing,
  hour: number,
  surfaceC: number,
  deepC: number,
): Fluxes {
  // Strahlung: aufgenommenes Sonnenlicht und Bilanz der Wärmestrahlung.
  const shortwaveAbsorbed = (1 - material.albedo) * (1 - conditions.shade) * forcing.shortwave
  const emitted = STEFAN_BOLTZMANN * celsiusToKelvin(surfaceC) ** 4
  const longwaveNet =
    material.emissivity * conditions.skyViewFactor * (forcing.longwave - emitted)

  // Konvektion: Wärmeabgabe an die Luft.
  const sensible = h * (surfaceC - forcing.airC)

  // Verdunstung: nur wenn Wasser verfügbar ist und die Luft noch Dampf aufnimmt.
  const misting = conditions.mist && hour >= MIST_START_HOUR && hour < MIST_END_HOUR
  const moisture = misting
    ? Math.max(material.moistureAvailability, MIST_MOISTURE)
    : material.moistureAvailability
  const latent =
    moisture === 0
      ? 0
      : moisture *
        (h / PSYCHROMETRIC_CONSTANT) *
        Math.max(0, saturationVapourPressure(surfaceC) - forcing.vapourPressure)

  // Wärmeleitung in tiefere Schichten bzw. ins Gebäude.
  const ground = coupling * (surfaceC - deepC)

  return {
    shortwaveAbsorbed,
    longwaveNet,
    netRadiation: shortwaveAbsorbed + longwaveNet,
    sensible,
    latent,
    ground,
  }
}

/** Wärmeübergangskoeffizient einer Zelle, mit Windabschwächung und Blattflächen-Faktor. */
function exchangeCoefficient(material: Material, conditions: CellConditions, weather: Weather) {
  return (
    (material.exchangeFactor ?? 1) *
    convectionCoefficient(weather.windSpeed * conditions.windFactor)
  )
}

/**
 * Berechnet alle Energieflüsse einer Oberfläche zu einem Zeitpunkt.
 *
 * @param surfaceC aktuelle Oberflächentemperatur in °C
 * @param deepC    Temperatur unterhalb der aktiven Schicht in °C
 */
export function computeFluxes(
  conditions: CellConditions,
  weather: Weather,
  hour: number,
  surfaceC: number,
  deepC: number,
): Fluxes {
  const material = MATERIALS[conditions.surface]
  return fluxesFor(
    material,
    heatStorageOf(material).coupling,
    conditions,
    exchangeCoefficient(material, conditions, weather),
    forcingAt(weather, hour, airVapourPressure(weather)),
    hour,
    surfaceC,
    deepC,
  )
}

/**
 * Simuliert den Tagesgang der Oberflächentemperatur.
 *
 * Die Temperatur in der Tiefe wird (außer bei Dächern mit festem Innenraum)
 * auf das Tagesmittel der Oberfläche vom Vortag gesetzt. Im eingeschwungenen
 * Zustand fließt dann über 24 Stunden netto keine Wärme in den Boden:
 * Was tagsüber gespeichert wird, kommt nachts wieder heraus.
 */
export function simulateDay(conditions: CellConditions, weather: Weather): DayResult {
  const material = MATERIALS[conditions.surface]
  const { capacity, coupling } = heatStorageOf(material)
  const h = exchangeCoefficient(material, conditions, weather)
  const forcing = dailyForcing(weather)
  const fixedDeepC = material.storage.kind === 'layer' ? material.storage.deepTempC : undefined

  let surfaceC = forcing[0].airC
  let deepC = fixedDeepC ?? meanAirTemperatureC(weather)
  let samples: Sample[] = []
  let maxC = -Infinity
  let minC = Infinity
  let meanC = surfaceC

  for (let day = 0; day < SIMULATED_DAYS; day++) {
    const isLastDay = day === SIMULATED_DAYS - 1
    let sum = 0
    samples = []
    maxC = -Infinity
    minC = Infinity

    for (let step = 0; step < STEPS_PER_DAY; step++) {
      const hour = (step * TIME_STEP) / 3600
      const fluxes = fluxesFor(
        material, coupling, conditions, h, forcing[step], hour, surfaceC, deepC,
      )

      if (isLastDay && step % SAMPLE_EVERY === 0) {
        samples.push({ hour, surfaceC, airC: forcing[step].airC, fluxes })
      }
      sum += surfaceC
      if (surfaceC > maxC) maxC = surfaceC
      if (surfaceC < minC) minC = surfaceC

      // Explizites Euler-Verfahren: Temperaturänderung = Energieüberschuss / C.
      const surplus = fluxes.netRadiation - fluxes.sensible - fluxes.latent - fluxes.ground
      surfaceC += (surplus / capacity) * TIME_STEP
    }

    meanC = sum / STEPS_PER_DAY
    deepC = fixedDeepC ?? meanC
  }

  return { samples, maxC, minC, meanC }
}

/** Liest die Oberflächentemperatur zu einer Uhrzeit aus der Tageskurve ab. */
export function surfaceTempAt(result: DayResult, hour: number): number {
  const index = Math.round(hour * SAMPLES_PER_HOUR) % result.samples.length
  return result.samples[index].surfaceC
}
