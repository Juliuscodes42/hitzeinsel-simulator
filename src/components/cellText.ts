import { MATERIALS } from '../data/materials.ts'
import { MEASURE_BY_ID } from '../data/measures.ts'
import type { GridCell } from '../model/grid.ts'

/** Kurze Beschreibung einer Zelle, z. B. „Asphalt unter Solardach, mit Sprühnebel". */
export function describeCell(cell: GridCell): string {
  const base =
    cell.measure && MEASURE_BY_ID[cell.measure].exclusive && !cell.cover
      ? MEASURE_BY_ID[cell.measure].label
      : MATERIALS[cell.surface].label
  const parts = [base]
  if (cell.cover === 'pv') parts[0] += ' unter Solardach'
  if (cell.cover === 'sail') parts[0] += ' unter Sonnensegel'
  if (cell.cistern) parts.push('mit Zisterne')
  if (cell.mist) parts.push('mit Sprühnebel')
  return parts.join(', ')
}
