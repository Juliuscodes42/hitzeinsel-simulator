import { MEASURES, type MeasureTarget } from '../data/measures.ts'
import type { Measures } from '../model/district.ts'
import { Fold } from './Fold.tsx'
import { formatEuro, formatPercent } from './format.ts'
import { Slider } from './Slider.tsx'

interface MeasureControlsProps {
  measures: Measures
  onMeasuresChange: (measures: Measures) => void
}

/** Bereiche, in denen die Regler zusammengefasst sind. */
const GROUPS: { title: string; targets: MeasureTarget[]; hint: string }[] = [
  {
    title: 'Dächer',
    targets: ['roof', 'anyRoof'],
    hint: 'Gründach, Retentions-Gründach und Cool Roof teilen sich die dunklen Dächer, in dieser Reihenfolge. Zisternen kommen zusätzlich auf jedes Dach.',
  },
  {
    title: 'Höfe, Plätze und Parkplätze',
    targets: ['square'],
    hint: 'Die Maßnahmen teilen sich die versiegelten Flächen ohne Straßen, in dieser Reihenfolge. Zusammen höchstens 100 %.',
  },
  {
    title: 'Straßen und Plätze',
    targets: ['sealed'],
    hint: 'Sprühnebel kommt zusätzlich auf den Belag, der danach noch versiegelt ist.',
  },
]

/** Regler für alle Maßnahmen aus dem Katalog, als Anteil der geeigneten Flächen. */
export function MeasureControls({ measures, onMeasuresChange }: MeasureControlsProps) {
  return (
    <>
      {GROUPS.map((group) => {
        const list = MEASURES.filter((measure) => group.targets.includes(measure.target))
        const active = list.filter((measure) => measures[measure.id] > 0).length
        let used = 0
        return (
          <Fold
            key={group.title}
            title={group.title}
            note={active > 0 ? `${active} Maßnahme${active === 1 ? '' : 'n'} aktiv` : undefined}
          >
            <p className="slider-hint">{group.hint}</p>
            {list.map((measure) => {
              // Bei geteilten Flächen bleibt für spätere Maßnahmen nur der Rest.
              const shared = measure.exclusive
              const limit = shared ? Math.max(0, 1 - used) : 1
              const shown = Math.min(measures[measure.id], limit)
              if (shared) used += shown
              return (
                <Slider
                  key={measure.id}
                  label={measure.label}
                  display={formatPercent(shown)}
                  value={measures[measure.id]}
                  min={0}
                  max={1}
                  step={0.05}
                  hint={`${measure.effect} Etwa ${formatEuro(measure.cost.build)} pro m².`}
                  onChange={(value) => onMeasuresChange({ ...measures, [measure.id]: value })}
                />
              )
            })}
          </Fold>
        )
      })}
    </>
  )
}
