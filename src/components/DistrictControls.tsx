import type { DistrictParams } from '../model/district.ts'
import { formatPercent } from './format.ts'
import { Slider } from './Slider.tsx'

interface DistrictControlsProps {
  district: DistrictParams
  onDistrictChange: (district: DistrictParams) => void
}

/** Aufbau des erfundenen Beispielviertels: Versiegelung, Dichte, neu würfeln. */
export function DistrictControls({ district, onDistrictChange }: DistrictControlsProps) {
  return (
    <>
      <Slider
        label="Versiegelungsgrad"
        display={formatPercent(district.sealing)}
        value={district.sealing}
        min={0}
        max={1}
        step={0.05}
        hint="Anteil der Höfe und Plätze, der gepflastert ist."
        onChange={(sealing) => onDistrictChange({ ...district, sealing })}
      />
      <Slider
        label="Bebauungsdichte"
        display={formatPercent(district.density)}
        value={district.density}
        min={0}
        max={0.8}
        step={0.05}
        hint="Anteil der Blockflächen mit Gebäuden."
        onChange={(density) => onDistrictChange({ ...district, density })}
      />
      <div>
        <button
          type="button"
          className="button"
          onClick={() => onDistrictChange({ ...district, seed: district.seed + 1 })}
        >
          Anderes Viertel würfeln
        </button>
      </div>
    </>
  )
}
