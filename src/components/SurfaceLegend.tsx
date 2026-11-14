import { MATERIALS, SURFACE_TYPES } from '../data/materials.ts'
import { SURFACE_COLORS } from './colors.ts'

/** Legende der Flächenansicht: welche Farbe für welche Oberfläche steht. */
export function SurfaceLegend() {
  return (
    <ul className="surface-legend" aria-label="Farben der Flächen">
      {SURFACE_TYPES.map((surface) => (
        <li key={surface}>
          <span style={{ background: SURFACE_COLORS[surface] }} aria-hidden="true" />
          {MATERIALS[surface].label}
        </li>
      ))}
    </ul>
  )
}
