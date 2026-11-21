import { MATERIALS, SURFACE_TYPES, type SurfaceType } from '../data/materials.ts'
import { SURFACE_COLORS } from './colors.ts'

/** Was ein Klick auf eine Zelle bewirkt. null = nur ansehen. */
export type Brush =
  | { kind: 'surface'; surface: SurfaceType }
  | { kind: 'mist' }
  | { kind: 'erase' }
  | null

interface BrushPaletteProps {
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

const isSurface = (brush: Brush, surface: SurfaceType): boolean =>
  brush?.kind === 'surface' && brush.surface === surface

/**
 * Auswahl des Pinsels. Die Farbfelder dienen zugleich als Legende
 * für die Flächenansicht.
 */
export function BrushPalette({
  brush,
  onChange,
  paintedCount,
  onClear,
  size,
  onSizeChange,
  cellSizeM = 10,
}: BrushPaletteProps) {
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
        {SURFACE_TYPES.map((surface) => (
          <button
            key={surface}
            type="button"
            className="swatch"
            aria-pressed={isSurface(brush, surface)}
            onClick={() => onChange({ kind: 'surface', surface })}
          >
            <span
              className="swatch-color"
              style={{ background: SURFACE_COLORS[surface] }}
              aria-hidden="true"
            />
            {MATERIALS[surface].label}
          </button>
        ))}
        <button
          type="button"
          className="swatch"
          aria-pressed={brush?.kind === 'mist'}
          onClick={() => onChange({ kind: 'mist' })}
        >
          <span className="swatch-color swatch-mist" aria-hidden="true" />
          Sprühnebel
        </button>
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
          ? 'Pinsel wählen, dann im Raster klicken oder ziehen.'
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
