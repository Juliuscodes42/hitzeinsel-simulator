/**
 * Kosten einer Maßnahme über einen Zeitraum (Lebenszykluskosten).
 *
 * Für jeden Quadratmeter umgebauter Fläche:
 *
 *   Kosten = Bau · (1 − Förderquote) · Anzahl Bauten im Zeitraum
 *          + Pflege pro Jahr · Jahre
 *          − Einsparungen pro Jahr · Jahre
 *
 * „Anzahl Bauten" berücksichtigt, dass z. B. ein Cool-Roof-Anstrich nach
 * 10 Jahren erneuert werden muss. Einsparungen sind Strom aus Solardächern
 * und die gesparte Niederschlagswassergebühr, wenn weniger Regen in den
 * Kanal fließt. Zinsen und Preissteigerung werden nicht berücksichtigt.
 */

import { MATERIALS } from '../data/materials.ts'
import { MEASURES, MEASURE_BY_ID, type MeasureId } from '../data/measures.ts'

export interface CostSettings {
  /** 'build' = nur Baukosten, 'lifecycle' = Kosten über den Zeitraum. */
  basis: 'build' | 'lifecycle'
  /** Betrachtungszeitraum in Jahren. */
  years: number
  /** Baukosten in €/m² je Maßnahme (aus dem Katalog, änderbar). */
  build: Record<MeasureId, number>
  /** Förderquote je Maßnahme (0–1). */
  funding: Record<MeasureId, number>
  /** Wert des Solarstroms in €/kWh (Einspeisung bis Eigenverbrauch). */
  electricityPrice: number
  /** Niederschlagswassergebühr in € je m² angeschlossener Fläche und Jahr. */
  rainFee: number
}

/**
 * Stromertrag eines Solardachs über einem Parkplatz in kWh je m² und Jahr:
 * etwa 0,18 kWp je m² überdachter Fläche und 950 kWh je kWp (eigene Annahme
 * nach üblichen Werten von 900–1.050 kWh/kWp in Deutschland).
 */
export const PV_YIELD_KWH_PER_M2 = 0.18 * 950

const zeroFor = (): Record<MeasureId, number> =>
  Object.fromEntries(MEASURES.map((measure) => [measure.id, 0])) as Record<MeasureId, number>

export const DEFAULT_COST_SETTINGS: CostSettings = {
  basis: 'lifecycle',
  years: 20,
  build: Object.fromEntries(MEASURES.map((measure) => [measure.id, measure.cost.build])) as Record<
    MeasureId,
    number
  >,
  funding: zeroFor(),
  // Mittel aus Einspeisung (etwa 0,07 €/kWh) und Eigenverbrauch (über 0,20 €/kWh): Annahme.
  electricityPrice: 0.1,
  // Bremen 0,83, Münster 0,95, Dortmund 1,80 €/m² und Jahr.
  rainFee: 1,
}

/** Fördervorlagen, die sich mit einem Klick setzen lassen. */
export const FUNDING_PRESETS: { id: string; label: string; hint: string; shares: Partial<Record<MeasureId, number>> }[] = [
  {
    id: 'none',
    label: 'Ohne Förderung',
    hint: 'Alle Kosten trägt der Eigentümer.',
    shares: {},
  },
  {
    id: 'municipal',
    label: 'Stadt mit KfW 444',
    hint: 'Kommune nutzt „Natürlicher Klimaschutz in Kommunen" (KfW 444, 80 % für Grün, Bäume und Entsiegelung) und ein Gründach-Programm mit 50 %.',
    shares: {
      tree: 0.8,
      treeTrench: 0.8,
      unsealing: 0.8,
      swale: 0.8,
      pond: 0.8,
      greenRoof: 0.5,
      blueGreenRoof: 0.5,
    },
  },
  {
    id: 'private',
    label: 'Privat mit Gründach-Zuschuss',
    hint: 'Gründach-Programm der Stadt mit 50 % (z. B. Lübeck, Frankfurt; Hamburg 60 %).',
    shares: { greenRoof: 0.5, blueGreenRoof: 0.5 },
  },
]

/** Förderquoten einer Vorlage. */
export function fundingFor(presetId: string): Record<MeasureId, number> {
  const preset = FUNDING_PRESETS.find((candidate) => candidate.id === presetId)
  return { ...zeroFor(), ...(preset?.shares ?? {}) }
}

/** Aufschlüsselung der Kosten einer Maßnahme je m² über den Zeitraum. */
export interface CostBreakdown {
  /** Baukosten nach Förderung, alle Bauten im Zeitraum zusammen. */
  build: number
  /** So oft wird im Zeitraum gebaut bzw. erneuert. */
  builds: number
  maintenance: number
  savings: number
  /** Summe; kann negativ sein, wenn sich die Maßnahme selbst bezahlt. */
  total: number
}

/** Jährliche Einsparung je m² in Euro. */
export function yearlySavings(id: MeasureId, settings: CostSettings): number {
  const measure = MEASURE_BY_ID[id]
  let savings = 0
  if (id === 'pvCanopy') savings += PV_YIELD_KWH_PER_M2 * settings.electricityPrice
  // Weniger Abfluss in den Kanal senkt die Gebühr. Speicher (Mulde, Rigole,
  // Zisterne) koppeln ihre Fläche ganz ab.
  const onRoof = measure.target === 'roof' || measure.target === 'anyRoof'
  // Ausgangsfläche: dunkles Dach bzw. Pflaster (Abflussbeiwert 1,0 bzw. 0,9).
  const before = { surface: onRoof ? 'roof' : 'concrete', mist: false } as const
  const after = measure.storageL ? 0 : MATERIALS[measure.apply(before).surface].runoffCoefficient
  savings += settings.rainFee * Math.max(0, MATERIALS[before.surface].runoffCoefficient - after)
  return savings
}

/** Kosten je m² über den Zeitraum, aufgeschlüsselt. */
export function costBreakdown(id: MeasureId, settings: CostSettings): CostBreakdown {
  const measure = MEASURE_BY_ID[id]
  const net = settings.build[id] * (1 - settings.funding[id])
  if (settings.basis === 'build') {
    return { build: net, builds: 1, maintenance: 0, savings: 0, total: net }
  }
  const builds = Math.max(1, Math.ceil(settings.years / measure.cost.lifetime))
  const maintenance = measure.cost.maintenance * settings.years
  const savings = yearlySavings(id, settings) * settings.years
  return {
    build: net * builds,
    builds,
    maintenance,
    savings,
    total: net * builds + maintenance - savings,
  }
}

/**
 * Kosten je m² für den Optimierer. Er braucht positive Kosten; eine
 * Maßnahme, die sich selbst bezahlt, zählt deshalb mit 1 €/m².
 */
export function costTable(settings: CostSettings): Record<MeasureId, number> {
  return Object.fromEntries(
    MEASURES.map((measure) => [measure.id, Math.max(1, costBreakdown(measure.id, settings).total)]),
  ) as Record<MeasureId, number>
}
