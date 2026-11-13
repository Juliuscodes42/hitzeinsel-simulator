import { useId, type ChangeEvent } from 'react'
import type { ImageAlignment } from './alignment.ts'
import { formatPercent } from './format.ts'
import { Slider } from './Slider.tsx'

interface BackgroundControlsProps {
  /** Liegt gerade ein Bild unter dem Raster? */
  hasBackground: boolean
  /** Deckkraft der Zellenfarben über dem Bild (0–1). */
  cellOpacity: number
  onCellOpacityChange: (opacity: number) => void
  /** Ist das Bild ein selbst hochgeladenes? */
  hasCustomImage: boolean
  onCustomImage: (file: File | null) => void
  alignment: ImageAlignment
  onAlignmentChange: (alignment: ImageAlignment) => void
}

/**
 * Bild unter dem Raster: Deckkraft der Farben, eigenes Luft- oder
 * Drohnenbild hochladen und von Hand passend ausrichten.
 */
export function BackgroundControls({
  hasBackground,
  cellOpacity,
  onCellOpacityChange,
  hasCustomImage,
  onCustomImage,
  alignment,
  onAlignmentChange,
}: BackgroundControlsProps) {
  const fileId = useId()

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    onCustomImage(event.target.files?.[0] ?? null)
    event.target.value = '' // dieselbe Datei soll erneut wählbar sein
  }

  return (
    <div className="background-controls">
      {hasBackground && (
        <Slider
          label="Deckkraft der Farben"
          display={formatPercent(cellOpacity)}
          value={cellOpacity}
          min={0}
          max={1}
          step={0.05}
          hint="Niedrig = Bild sichtbar, hoch = Temperaturen oder Flächen sichtbar."
          onChange={onCellOpacityChange}
        />
      )}

      <div className="upload">
        <label htmlFor={fileId} className="button">
          Eigenes Luft- oder Drohnenbild laden
        </label>
        <input id={fileId} type="file" accept="image/*" className="sr-only" onChange={handleFile} />
        {hasCustomImage && (
          <button type="button" className="link-button" onClick={() => onCustomImage(null)}>
            Bild entfernen
          </button>
        )}
      </div>
      <p className="slider-hint">
        Das Bild bleibt auf diesem Gerät und wird nicht hochgeladen. Am besten senkrecht von
        oben aufnehmen. Die Flächen danach mit dem Pinsel nachzeichnen.
      </p>

      {hasCustomImage && (
        <div className="align-grid">
          <Slider
            label="Größe"
            display={formatPercent(alignment.scale)}
            value={alignment.scale}
            min={0.5}
            max={4}
            step={0.01}
            onChange={(scale) => onAlignmentChange({ ...alignment, scale })}
          />
          <Slider
            label="Drehung"
            display={`${alignment.rotation}°`}
            value={alignment.rotation}
            min={-180}
            max={180}
            step={1}
            onChange={(rotation) => onAlignmentChange({ ...alignment, rotation })}
          />
          <Slider
            label="Nach rechts schieben"
            display={`${alignment.offsetX} %`}
            value={alignment.offsetX}
            min={-100}
            max={100}
            step={1}
            onChange={(offsetX) => onAlignmentChange({ ...alignment, offsetX })}
          />
          <Slider
            label="Nach unten schieben"
            display={`${alignment.offsetY} %`}
            value={alignment.offsetY}
            min={-100}
            max={100}
            step={1}
            onChange={(offsetY) => onAlignmentChange({ ...alignment, offsetY })}
          />
        </div>
      )}
    </div>
  )
}
