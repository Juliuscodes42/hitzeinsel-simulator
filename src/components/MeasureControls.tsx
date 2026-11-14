import type { Measures } from '../model/district.ts'
import { formatPercent } from './format.ts'
import { Slider } from './Slider.tsx'

interface MeasureControlsProps {
  measures: Measures
  onMeasuresChange: (measures: Measures) => void
}

/** Regler für die fünf Maßnahmen, jeweils als Anteil der geeigneten Flächen. */
export function MeasureControls({ measures, onMeasuresChange }: MeasureControlsProps) {
  // Gründach hat Vorrang vor Cool Roof, Bäume vor Entsiegelung (siehe district.ts).
  const coolRoofLimit = 1 - measures.greenRoofs
  const unsealingLimit = 1 - measures.trees

  const percentSlider = (label: string, key: keyof Measures, hint: string, limit = 1) => (
    <Slider
      label={label}
      display={formatPercent(Math.min(measures[key], limit))}
      value={measures[key]}
      min={0}
      max={1}
      step={0.05}
      hint={hint}
      onChange={(value) => onMeasuresChange({ ...measures, [key]: value })}
    />
  )

  return (
    <>
      {percentSlider('Dachbegrünung', 'greenRoofs', 'Anteil der dunklen Dächer.')}
      {percentSlider('Cool Roofs', 'coolRoofs', 'Heller Anstrich auf den übrigen Dächern.', coolRoofLimit)}
      {percentSlider('Laubbäume', 'trees', 'Anteil der versiegelten Höfe, Plätze und Parkplätze.')}
      {percentSlider(
        'Entsiegelung',
        'unsealing',
        'Rasengitter statt Pflaster oder Asphalt auf den übrigen Flächen.',
        unsealingLimit,
      )}
      {percentSlider('Sprühnebel', 'mist', 'Auf Straßen und Pflaster, 10 bis 20 Uhr.')}
    </>
  )
}
