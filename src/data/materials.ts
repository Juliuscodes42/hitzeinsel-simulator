/**
 * Oberflächentypen und ihre Materialwerte.
 *
 * Quellen (Literaturwerte, gerundet):
 *  - Albedo, Emissionsgrad, Wärmekapazität, Wärmeleitfähigkeit:
 *    T. R. Oke, "Boundary Layer Climates", 2. Aufl. 1987, Tab. 1.1, 2.1 und 7.4
 *  - Abflussbeiwerte: angelehnt an DIN 1986-100 (Spitzenabflussbeiwerte)
 *  - Feuchteverfügbarkeit: eigene Annahme auf Basis typischer Bowen-Verhältnisse
 *    (Oke 1987, Kap. 8). Diese Werte sollen mit Fachleuten abgestimmt werden.
 */

export type SurfaceType =
  | 'asphalt'
  | 'concrete'
  | 'permeable'
  | 'grass'
  | 'tree'
  | 'water'
  | 'roof'
  | 'coolRoof'
  | 'greenRoof'
  | 'coolPavement'
  | 'blueGreenRoof'

/**
 * Wie eine Oberfläche Wärme speichert.
 *  - 'ground': massiver Untergrund. Die wirksame Schichtdicke ergibt sich aus
 *    der Eindringtiefe der Tagestemperaturwelle (siehe energyBalance.ts).
 *  - 'layer': dünne Schicht mit fester Wärmekapazität (Dach, Blätterdach, Wasser).
 */
export type HeatStorage =
  | {
      kind: 'ground'
      /** Volumetrische Wärmekapazität in J/(m³·K). */
      volumetricHeatCapacity: number
      /** Wärmeleitfähigkeit in W/(m·K). */
      conductivity: number
    }
  | {
      kind: 'layer'
      /** Wärmekapazität pro Fläche in J/(m²·K). */
      arealHeatCapacity: number
      /** Wärmedurchgang nach unten in W/(m²·K), z. B. U-Wert des Dachs. */
      deepCoupling: number
      /** Feste Temperatur darunter in °C (Innenraum). Ohne Angabe: Tagesmittel. */
      deepTempC?: number
    }

export interface Material {
  /** Anzeigename. */
  label: string
  /** Anteil der Sonnenstrahlung, der reflektiert wird (0–1). */
  albedo: number
  /** Emissionsgrad für Wärmestrahlung (0–1). */
  emissivity: number
  /** Feuchteverfügbarkeit: 0 = trocken, 1 = offene Wasserfläche. */
  moistureAvailability: number
  /** Abflussbeiwert: Anteil des Starkregens, der oberflächlich abfließt (0–1). */
  runoffCoefficient: number
  storage: HeatStorage
  /** Liegt die Fläche auf einem Gebäude? */
  isRoof: boolean
  /**
   * Faktor für den Wärme- und Dampfaustausch mit der Luft (Standard 1).
   * Ein Blätterdach hat ein Vielfaches der Grundfläche als Blattfläche und
   * tauscht deshalb mehr aus als eine glatte Oberfläche.
   */
  exchangeFactor?: number
}

export const MATERIALS: Record<SurfaceType, Material> = {
  asphalt: {
    label: 'Asphalt',
    albedo: 0.1,
    emissivity: 0.95,
    moistureAvailability: 0,
    runoffCoefficient: 1.0,
    storage: { kind: 'ground', volumetricHeatCapacity: 1.94e6, conductivity: 0.75 },
    isRoof: false,
  },
  concrete: {
    label: 'Beton / Pflaster',
    albedo: 0.25,
    emissivity: 0.9,
    moistureAvailability: 0,
    runoffCoefficient: 0.9,
    storage: { kind: 'ground', volumetricHeatCapacity: 2.11e6, conductivity: 1.51 },
    isRoof: false,
  },
  permeable: {
    label: 'Entsiegelt (Rasengitter)',
    albedo: 0.2,
    emissivity: 0.93,
    moistureAvailability: 0.25,
    runoffCoefficient: 0.4,
    storage: { kind: 'ground', volumetricHeatCapacity: 2.0e6, conductivity: 1.3 },
    isRoof: false,
  },
  grass: {
    label: 'Rasen',
    albedo: 0.23,
    emissivity: 0.95,
    moistureAvailability: 0.5,
    runoffCoefficient: 0.2,
    storage: { kind: 'ground', volumetricHeatCapacity: 2.2e6, conductivity: 1.2 },
    isRoof: false,
  },
  tree: {
    label: 'Laubbaum',
    albedo: 0.17,
    emissivity: 0.97,
    moistureAvailability: 0.25,
    runoffCoefficient: 0.15,
    exchangeFactor: 3,
    storage: { kind: 'layer', arealHeatCapacity: 3.0e4, deepCoupling: 0 },
    isRoof: false,
  },
  water: {
    label: 'Wasser',
    albedo: 0.08,
    emissivity: 0.97,
    moistureAvailability: 1,
    runoffCoefficient: 0,
    storage: { kind: 'layer', arealHeatCapacity: 4.18e6, deepCoupling: 0 },
    isRoof: false,
  },
  roof: {
    label: 'Dach (dunkel)',
    albedo: 0.12,
    emissivity: 0.92,
    moistureAvailability: 0,
    runoffCoefficient: 1.0,
    storage: { kind: 'layer', arealHeatCapacity: 1.0e5, deepCoupling: 0.5, deepTempC: 22 },
    isRoof: true,
  },
  coolRoof: {
    label: 'Cool Roof (hell)',
    albedo: 0.7,
    emissivity: 0.9,
    moistureAvailability: 0,
    runoffCoefficient: 1.0,
    storage: { kind: 'layer', arealHeatCapacity: 1.0e5, deepCoupling: 0.5, deepTempC: 22 },
    isRoof: true,
  },
  greenRoof: {
    label: 'Gründach',
    albedo: 0.2,
    emissivity: 0.95,
    moistureAvailability: 0.4,
    runoffCoefficient: 0.5,
    storage: { kind: 'layer', arealHeatCapacity: 2.0e5, deepCoupling: 0.4, deepTempC: 22 },
    isRoof: true,
  },
  // Neue Oberflächen stehen am Ende, weil gespeicherte Raster die Reihenfolge nutzen.
  coolPavement: {
    // Heller, reflektierender Belag (Beschichtung auf Asphalt). Albedo neu etwa 0,3–0,45,
    // nach einigen Jahren geringer; hier ein mittlerer Wert (LBNL Heat Island Group).
    label: 'Heller Belag',
    albedo: 0.35,
    emissivity: 0.9,
    moistureAvailability: 0,
    runoffCoefficient: 0.9,
    storage: { kind: 'ground', volumetricHeatCapacity: 1.94e6, conductivity: 0.75 },
    isRoof: false,
  },
  blueGreenRoof: {
    // Gründach mit Wasserspeicher (Retentionsdach): 30–100 l/m² Speicher (Baunetz Wissen),
    // dadurch feuchter als ein normales Gründach und mit weniger Abfluss. Feuchte: Annahme.
    label: 'Retentions-Gründach',
    albedo: 0.2,
    emissivity: 0.95,
    moistureAvailability: 0.55,
    runoffCoefficient: 0.1,
    storage: { kind: 'layer', arealHeatCapacity: 3.0e5, deepCoupling: 0.4, deepTempC: 22 },
    isRoof: true,
  },
}

export const SURFACE_TYPES = Object.keys(MATERIALS) as SurfaceType[]
