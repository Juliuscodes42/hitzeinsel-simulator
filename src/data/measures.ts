/**
 * Katalog der Kühlungs- und Schwammstadt-Maßnahmen.
 *
 * Jede Maßnahme sagt, wo sie möglich ist, was sie an einer Zelle ändert und
 * was sie kostet. Regler, Optimierer und Pinsel lesen alle aus diesem
 * Katalog. Eine neue Maßnahme braucht deshalb nur einen Eintrag hier.
 *
 * Kosten: Bau bzw. Einbau in Euro pro Quadratmeter umgebauter Fläche,
 * Pflege in Euro pro Quadratmeter und Jahr, Lebensdauer in Jahren.
 * Die Spannweiten stammen aus den Quellen in docs/kosten.md; der Standardwert
 * ist ein gerundeter mittlerer Wert daraus. „Belegt" heißt: aus mehreren
 * Quellen; „grob": nur eine Quelle oder sehr breite Spanne; „Annahme": eigene
 * Schätzung ohne passende Quelle.
 */

import type { GridCell } from '../model/grid.ts'
import { MATERIALS } from './materials.ts'

export type MeasureId =
  | 'greenRoof'
  | 'blueGreenRoof'
  | 'coolRoof'
  | 'cistern'
  | 'tree'
  | 'treeTrench'
  | 'unsealing'
  | 'swale'
  | 'pond'
  | 'coolPavement'
  | 'pvCanopy'
  | 'shadeSail'
  | 'mist'

/**
 * Wo eine Maßnahme möglich ist:
 *  - 'roof': dunkle Dächer
 *  - 'anyRoof': alle Dächer (Zisterne, zusätzlich zu anderen Dach-Maßnahmen)
 *  - 'square': versiegelte Höfe, Plätze und Parkplätze (keine Straßen)
 *  - 'sealed': versiegelter Boden einschließlich Straßen (zusätzlich, z. B. Sprühnebel)
 */
export type MeasureTarget = 'roof' | 'anyRoof' | 'square' | 'sealed'

export interface MeasureCost {
  /** Standardwert Bau in €/m². */
  build: number
  /** Spannweite aus den Quellen in €/m². */
  range: [number, number]
  /** Pflege und Betrieb in €/m² und Jahr. */
  maintenance: number
  /** Lebensdauer in Jahren, danach Erneuerung. */
  lifetime: number
  confidence: 'belegt' | 'grob' | 'Annahme'
  /** Kurze Begründung, wie der Wert zustande kommt. */
  note: string
}

export interface Measure {
  id: MeasureId
  label: string
  /** Wie die Maßnahme kühlt bzw. Wasser hält, in einem Satz. */
  effect: string
  target: MeasureTarget
  /**
   * true: ersetzt die Oberfläche (je Zelle höchstens eine solche Maßnahme).
   * false: kommt zusätzlich hinzu (Zisterne, Sprühnebel).
   */
  exclusive: boolean
  /** Zusätzlicher Regenwasserspeicher in Litern pro m² der Maßnahme. */
  storageL?: number
  /** Kühlt die Maßnahme? Reine Wasserspeicher (Zisterne) nicht. */
  cools: boolean
  cost: MeasureCost
  /** Die Zelle nach der Maßnahme. */
  apply: (cell: GridCell) => GridCell
}

/** Gleiche Zelle mit neuer Oberfläche, ohne Sprühnebel und Überdachung. */
const withSurface = (cell: GridCell, surface: GridCell['surface'], measure: MeasureId, extra: Partial<GridCell> = {}): GridCell => {
  const next: GridCell = { surface, mist: false, measure, ...extra }
  if (cell.street) next.street = true
  return next
}

export const MEASURES: Measure[] = [
  {
    id: 'greenRoof',
    label: 'Gründach',
    effect: 'Pflanzen verdunsten Wasser und heizen sich weniger auf; hält etwa die Hälfte des Starkregens zurück.',
    target: 'roof',
    exclusive: true,
    cools: true,
    cost: {
      build: 45,
      range: [30, 70],
      maintenance: 1,
      lifetime: 40,
      confidence: 'belegt',
      note: 'Extensiv: 30–70 €/m² (mehrere Quellen), Pflege 0,5–2 €/m²·a (HLNUG).',
    },
    apply: (cell) => withSurface(cell, 'greenRoof', 'greenRoof'),
  },
  {
    id: 'blueGreenRoof',
    label: 'Retentions-Gründach',
    effect: 'Gründach mit Wasserspeicher darunter: bleibt länger feucht und hält fast den ganzen Starkregen zurück.',
    target: 'roof',
    exclusive: true,
    storageL: 30,
    cools: true,
    cost: {
      build: 80,
      range: [60, 140],
      maintenance: 1.5,
      lifetime: 40,
      confidence: 'grob',
      note: 'Gründach 30–70 €/m² plus Retentionselement ab 30 €/m² (Herstellerangabe Optigrün); keine neutrale Kostenstudie gefunden.',
    },
    apply: (cell) => withSurface(cell, 'blueGreenRoof', 'blueGreenRoof', { storageL: 30 }),
  },
  {
    id: 'coolRoof',
    label: 'Cool Roof',
    effect: 'Heller Anstrich wirft den größten Teil des Sonnenlichts zurück.',
    target: 'roof',
    exclusive: true,
    cools: true,
    cost: {
      build: 35,
      range: [20, 60],
      maintenance: 0,
      lifetime: 10,
      confidence: 'grob',
      note: 'Dachbeschichtungen 20–60 €/m² (Anbieterangaben), Haltbarkeit 5–10 Jahre; Albedo sinkt durch Verschmutzung.',
    },
    apply: (cell) => withSurface(cell, 'coolRoof', 'coolRoof'),
  },
  {
    id: 'cistern',
    label: 'Zisterne',
    effect: 'Sammelt Regen vom Dach in einem Tank (5 m³ je 100 m² Dach); kühlt selbst nicht.',
    target: 'anyRoof',
    exclusive: false,
    storageL: 50,
    cools: false,
    cost: {
      build: 55,
      range: [30, 100],
      maintenance: 0.5,
      lifetime: 30,
      confidence: 'belegt',
      note: '5-m³-Zisterne mit Einbau 3.000–8.000 € (mehrere Ratgeber), umgelegt auf 100 m² Dach.',
    },
    apply: (cell) => ({ ...cell, storageL: (cell.storageL ?? 0) + 50, cistern: true }),
  },
  {
    id: 'tree',
    label: 'Laubbäume',
    effect: 'Krone spendet Schatten und verdunstet Wasser.',
    target: 'square',
    exclusive: true,
    cools: true,
    cost: {
      build: 120,
      range: [60, 180],
      maintenance: 2,
      lifetime: 60,
      confidence: 'belegt',
      note: 'Pflanzung mit Standort und 3 Jahren Pflege 2.500–4.500 € je Baum (Münster, Nürnberg), Pflege etwa 60 € je Baum und Jahr (Koblenz); bezogen auf rund 30 m² Krone.',
    },
    apply: (cell) => withSurface(cell, 'tree', 'tree'),
  },
  {
    id: 'treeTrench',
    label: 'Baum mit Rigole',
    effect: 'Baum mit unterirdischem Speicher, der Regen von der Umgebung aufnimmt und den Baum versorgt.',
    target: 'square',
    exclusive: true,
    storageL: 150,
    cools: true,
    cost: {
      build: 220,
      range: [150, 320],
      maintenance: 3,
      lifetime: 50,
      confidence: 'grob',
      note: 'Speicher 350–600 €/m³ plus Pflanzung 800–2.000 € (Praxishilfe Koblenz), angenommen 4,5 m³ Speicher je Baum und 30 m² Krone.',
    },
    apply: (cell) => withSurface(cell, 'tree', 'treeTrench', { storageL: 150 }),
  },
  {
    id: 'unsealing',
    label: 'Entsiegelung',
    effect: 'Rasengitter statt Pflaster: Regen versickert, der Boden bleibt etwas feuchter.',
    target: 'square',
    exclusive: true,
    cools: true,
    cost: {
      build: 80,
      range: [55, 150],
      maintenance: 0.5,
      lifetime: 30,
      confidence: 'belegt',
      note: 'Rasengitter verlegt ab 55 €/m², mit Aushub und Entsorgung 80–150 €/m² (Ratgeber, Forum).',
    },
    apply: (cell) => withSurface(cell, 'permeable', 'unsealing'),
  },
  {
    id: 'swale',
    label: 'Versickerungsmulde',
    effect: 'Flache Rasenmulde, in der Regen der Umgebung versickert (30 cm tief).',
    target: 'square',
    exclusive: true,
    storageL: 300,
    cools: true,
    cost: {
      build: 75,
      range: [45, 110],
      maintenance: 1,
      lifetime: 40,
      confidence: 'grob',
      note: 'Mulde 35–60 €/m² (Praxishilfe Koblenz) plus Entsiegelung des Pflasters.',
    },
    apply: (cell) => withSurface(cell, 'grass', 'swale', { storageL: 300 }),
  },
  {
    id: 'pond',
    label: 'Wasserbecken',
    effect: 'Offenes Wasser verdunstet und speichert Wärme, heizt sich tagsüber kaum auf.',
    target: 'square',
    exclusive: true,
    storageL: 100,
    cools: true,
    cost: {
      build: 200,
      range: [100, 300],
      maintenance: 3,
      lifetime: 30,
      confidence: 'grob',
      note: 'Folienteich 100–300 €/m² (Fachbetriebe laut Vermittlungsportal); Pflege eigene Annahme.',
    },
    apply: (cell) => withSurface(cell, 'water', 'pond', { storageL: 100 }),
  },
  {
    id: 'coolPavement',
    label: 'Heller Belag',
    effect: 'Helle Beschichtung auf Asphalt oder Pflaster wirft mehr Sonnenlicht zurück.',
    target: 'square',
    exclusive: true,
    cools: true,
    cost: {
      build: 15,
      range: [5, 40],
      maintenance: 0,
      lifetime: 7,
      confidence: 'grob',
      note: 'USA: etwa 1–13 $/m² je nach Untergrund (Wikipedia, LBNL); deutsche Preise nicht gefunden. Muss alle paar Jahre erneuert werden.',
    },
    apply: (cell) => withSurface(cell, 'coolPavement', 'coolPavement'),
  },
  {
    id: 'pvCanopy',
    label: 'Solardach über Parkplatz',
    effect: 'Photovoltaik-Überdachung beschattet den Boden fast vollständig und erzeugt Strom.',
    target: 'square',
    exclusive: true,
    cools: true,
    cost: {
      build: 400,
      range: [240, 640],
      maintenance: 3,
      lifetime: 25,
      confidence: 'grob',
      note: '3.000–8.000 € je Stellplatz (Ratgeber, gewerbliche Anlagen), ein Stellplatz etwa 12,5 m². Stromertrag ist hier noch nicht gegengerechnet.',
    },
    apply: (cell) => ({ ...cell, mist: false, cover: 'pv', measure: 'pvCanopy' }),
  },
  {
    id: 'shadeSail',
    label: 'Sonnensegel',
    effect: 'Gespanntes Tuch beschattet Plätze, lässt aber Luft und etwas Licht durch.',
    target: 'square',
    exclusive: true,
    cools: true,
    cost: {
      build: 150,
      range: [30, 1200],
      maintenance: 2,
      lifetime: 10,
      confidence: 'Annahme',
      note: 'Sehr breite Spanne: 30–80 €/m² für Gartensegel, 900–1.200 €/m² für feste Schattenbauwerke (UBA, Projekt U°CA). Der Standardwert ist eine eigene Annahme für ein öffentliches Segel.',
    },
    apply: (cell) => ({ ...cell, mist: false, cover: 'sail', measure: 'shadeSail' }),
  },
  {
    id: 'mist',
    label: 'Sprühnebel',
    effect: 'Feine Wassertropfen verdunsten auf Straßen und Plätzen (10 bis 20 Uhr).',
    target: 'sealed',
    exclusive: false,
    cools: true,
    cost: {
      build: 50,
      range: [20, 100],
      maintenance: 2,
      lifetime: 10,
      confidence: 'Annahme',
      note: 'Keine Kostenquelle gefunden. Verbrauch laut Wiesbaden etwa 100 l Wasser und 0,6 kWh je Anlage und Tag.',
    },
    apply: (cell) => ({ ...cell, mist: true }),
  },
]

export const MEASURE_BY_ID = Object.fromEntries(MEASURES.map((measure) => [measure.id, measure])) as Record<
  MeasureId,
  Measure
>

/** Ist die Zelle für diese Art von Maßnahme geeignet (im Ausgangszustand)? */
export function fitsTarget(cell: GridCell, target: MeasureTarget): boolean {
  if (target === 'roof') return cell.surface === 'roof' && !cell.measure
  if (target === 'anyRoof') return MATERIALS[cell.surface].isRoof && !cell.cistern
  const sealed = (cell.surface === 'asphalt' || cell.surface === 'concrete') && !cell.cover
  if (target === 'square') return sealed && !cell.street && !cell.measure
  return sealed && !cell.mist
}

/** Kann diese Maßnahme auf der Zelle umgesetzt werden? */
export const canApply = (cell: GridCell, measure: Measure): boolean => fitsTarget(cell, measure.target)
