import { MATERIALS, SURFACE_TYPES, type SurfaceType } from '../data/materials.ts'
import { MEASURES, type MeasureId } from '../data/measures.ts'
import { MEASURE_COLORS, SURFACE_COLORS } from './colors.ts'

/** Was ein Klick auf eine Zelle bewirkt. null = nur ansehen. */
export type Brush =
  | { kind: 'surface'; surface: SurfaceType }
  | { kind: 'measure'; measure: MeasureId }
  | { kind: 'erase' }
  | null

interface BrushPaletteProps {
  /** Oberflächen (Korrektur des Ist-Zustands) oder Maßnahmen (Umbau). */
  mode: 'surfaces' | 'measures'
  brush: Brush
  onChange: (brush: Brush) => void
  /** Anzahl der von Hand veränderten Zellen. */
  paintedCount: number
  onClear: () => void
  /** Pinselgröße in Zellen (Radius); fehlt bei groben Rastern. */
  size?: number
  onSizeChange?: (size: number) => void
  /** Kantenlänge einer Zelle in Metern, für die Beschriftung der Pinselgröße. */
  cellSizeM?: number
}

/** Wählbare Pinselgrößen als Radius in Zellen. */
const BRUSH_SIZES = [0, 1, 2, 4]

/**
 * Auswahl des Pinsels. Die Farbfelder dienen zugleich als Legende.
 * Im Modus „Maßnahmen" wirkt der Pinsel nur dort, wo die Maßnahme möglich ist
 * (z. B. Gründach nur auf dunklen Dächern).
 */
export function BrushPalette({
  mode,
  brush,
  onChange,
  paintedCount,
  onClear,
  size,
  onSizeChange,
  cellSizeM = 10,
}: BrushPaletteProps) {
  const options =
    mode === 'surfaces'
      ? SURFACE_TYPES.map((surface) => ({
          key: surface,
          label: MATERIALS[surface].label,
          color: SURFACE_COLORS[surface],
          title: undefined as string | undefined,
          pressed: brush?.kind === 'surface' && brush.surface === surface,
          pick: (): Brush => ({ kind: 'surface', surface }),
        }))
      : MEASURES.map((measure) => ({
          key: measure.id,
          label: measure.label,
          color: MEASURE_COLORS[measure.id],
          title: measure.effect,
          pressed: brush?.kind === 'measure' && brush.measure === measure.id,
          pick: (): Brush => ({ kind: 'measure', measure: measure.id }),
        }))

  return (
    <div className="palette">
      {size !== undefined && onSizeChange && (
        <div className="brush-size">
          <span>Pinselgröße</span>
          <div className="toggle" role="group" aria-label="Pinselgröße">
            {BRUSH_SIZES.map((radius) => (
              <button
                key={radius}
                type="button"
                aria-pressed={size === radius}
                onClick={() => onSizeChange(radius)}
              >
                {(2 * radius + 1) * cellSizeM} m
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="palette-swatches" role="group" aria-label="Pinsel wählen">
        <button
          type="button"
          className="swatch"
          aria-pressed={brush === null}
          onClick={() => onChange(null)}
        >
          <span className="swatch-color swatch-look" aria-hidden="true" />
          Nur ansehen
        </button>
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            className="swatch"
            title={option.title}
            aria-pressed={option.pressed}
            onClick={() => onChange(option.pick())}
          >
            <span className="swatch-color" style={{ background: option.color }} aria-hidden="true" />
            {option.label}
          </button>
        ))}
        <button
          type="button"
          className="swatch"
          aria-pressed={brush?.kind === 'erase'}
          onClick={() => onChange({ kind: 'erase' })}
        >
          <span className="swatch-color swatch-erase" aria-hidden="true" />
          Radierer
        </button>
      </div>
      <p className="palette-status">
        {paintedCount === 0
          ? mode === 'measures'
            ? 'Maßnahme wählen, dann im Raster klicken oder ziehen. Sie wirkt nur auf geeigneten Flächen.'
            : 'Pinsel wählen, dann im Raster klicken oder ziehen.'
          : `${paintedCount} ${paintedCount === 1 ? 'Zelle' : 'Zellen'} von Hand geändert.`}{' '}
        {paintedCount > 0 && (
          <button type="button" className="link-button" onClick={onClear}>
            Alle zurücksetzen
          </button>
        )}
      </p>
    </div>
  )
}
