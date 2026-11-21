import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { SurfaceType } from '../data/materials.ts'
import { surfaceTempAt } from '../model/energyBalance.ts'
import type { CityGrid, GridCell, GridResult } from '../model/grid.ts'
import { SURFACE_COLORS, temperatureColor } from './colors.ts'

/**
 * Ansichten des Rasters:
 *  - 'aerial': Luftbild klar sichtbar, nur umgebaute Zellen farbig darüber
 *  - 'temperature': Oberflächentemperatur als Farbe
 *  - 'surface': Oberflächentyp als Farbe
 */
export type ViewMode = 'aerial' | 'temperature' | 'surface'

/** Bild, das unter dem Raster liegt (Luftbild oder eigenes Foto). */
export interface GridBackground {
  url: string
  scale: number
  offsetX: number
  offsetY: number
  rotation: number
}

/** Markierter Punkt für die Bilderkennung. */
export interface GridMarker {
  index: number
  surface: SurfaceType
  /** Beispiel zum Lernen (gefüllt) oder Prüfpunkt (Ring). */
  kind: 'training' | 'check'
}

interface CityGridViewProps {
  grid: CityGrid
  result: GridResult
  /** Uhrzeit, deren Temperaturen angezeigt werden. */
  hour: number
  view: ViewMode
  background: GridBackground | null
  /** Zellen des Ist-Zustands, um in der Luftbild-Ansicht Umbauten zu erkennen. */
  baseCells: GridCell[]
  /** Deckkraft der Zellenfarben über dem Bild (0–1). */
  cellOpacity: number
  /** Ist ein Pinsel oder eine Markierung gewählt? Dann wirkt Klicken und Ziehen. */
  painting: boolean
  onPaint: (index: number) => void
  onInspect: (index: number | null) => void
  markers?: GridMarker[]
}

/** Auflösung der Zeichenfläche in Bildpunkten (wird per CSS auf die Breite skaliert). */
const CANVAS_SIZE = 1000

/**
 * Das Stadtraster, gezeichnet auf ein Canvas. So bleibt es auch mit
 * 10 000 Zellen flüssig, und es braucht kein sichtbares Gitter.
 *
 * Maus und Finger malen durch Klicken und Ziehen. Mit der Tastatur bewegt
 * man einen Rahmen mit den Pfeiltasten und malt mit Enter oder Leertaste.
 */
export function CityGridView({
  grid,
  result,
  hour,
  view,
  background,
  baseCells,
  cellOpacity,
  painting,
  onPaint,
  onInspect,
  markers = [],
}: CityGridViewProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [cursor, setCursor] = useState<number | null>(null)
  const [keyboard, setKeyboard] = useState(false)
  const dragging = useRef(false)

  // Zeichnen, wann immer sich etwas Sichtbares ändert.
  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (!context) return
    const { width, height, cells } = grid
    const cw = CANVAS_SIZE / width
    const ch = CANVAS_SIZE / height
    context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    const overImage = background !== null
    context.globalAlpha = view === 'aerial' ? 0.82 : overImage ? cellOpacity : 1
    for (let index = 0; index < cells.length; index++) {
      const cell = cells[index]
      const base = baseCells[index]
      const changed = !base || base.surface !== cell.surface || base.mist !== cell.mist
      if (view === 'aerial' && !changed) continue
      context.fillStyle =
        view === 'temperature'
          ? temperatureColor(surfaceTempAt(result.cells[index], hour))
          : SURFACE_COLORS[cell.surface]
      const x = index % width
      const y = Math.floor(index / width)
      // Auf ganze Bildpunkte gerundet, ohne Lücken und ohne Überlappung
      // (Überlappungen wären bei halber Deckkraft als dunkle Linien zu sehen).
      const x0 = Math.round(x * cw)
      const y0 = Math.round(y * ch)
      context.fillRect(x0, y0, Math.round((x + 1) * cw) - x0, Math.round((y + 1) * ch) - y0)
    }
    context.globalAlpha = 1

    // Grobe Raster (Beispielviertel, 10-m-Zellen) bekommen feine Linien zur Orientierung.
    if (width <= 30 && !overImage) {
      context.strokeStyle = 'rgb(0 0 0 / 0.35)'
      context.lineWidth = 1
      context.beginPath()
      for (let i = 1; i < width; i++) {
        context.moveTo(i * cw, 0)
        context.lineTo(i * cw, CANVAS_SIZE)
      }
      for (let i = 1; i < height; i++) {
        context.moveTo(0, i * ch)
        context.lineTo(CANVAS_SIZE, i * ch)
      }
      context.stroke()
    }

    // Sprühnebel: heller Punkt in der Zellenmitte.
    const mistRadius = Math.max(2, Math.min(cw, ch) * 0.2)
    context.fillStyle = '#d8f1ff'
    context.strokeStyle = '#2a6f9c'
    context.lineWidth = 1
    for (let index = 0; index < cells.length; index++) {
      if (!cells[index].mist) continue
      if (cw < 8 && (index % 2 === 1 || Math.floor(index / width) % 2 === 1)) continue
      const x = ((index % width) + 0.5) * cw
      const y = (Math.floor(index / width) + 0.5) * ch
      context.beginPath()
      context.arc(x, y, mistRadius, 0, Math.PI * 2)
      context.fill()
      context.stroke()
    }

    // Markierte Punkte der Bilderkennung.
    const markerRadius = Math.max(13, Math.min(cw, ch) * 0.45)
    for (const marker of markers) {
      const x = ((marker.index % width) + 0.5) * cw
      const y = (Math.floor(marker.index / width) + 0.5) * ch
      context.beginPath()
      context.arc(x, y, markerRadius, 0, Math.PI * 2)
      context.lineWidth = 3
      context.strokeStyle = '#ffffff'
      if (marker.kind === 'training') {
        context.fillStyle = SURFACE_COLORS[marker.surface]
        context.fill()
        context.stroke()
      } else {
        context.stroke()
        context.lineWidth = 2
        context.strokeStyle = SURFACE_COLORS[marker.surface]
        context.beginPath()
        context.arc(x, y, markerRadius - 2.5, 0, Math.PI * 2)
        context.stroke()
      }
    }

    // Rahmen um die Zelle unter dem Zeiger bzw. der Tastatur.
    if (cursor !== null && cursor < cells.length) {
      const x = cursor % width
      const y = Math.floor(cursor / width)
      context.lineWidth = keyboard ? 4 : 2
      context.strokeStyle = '#ffffff'
      context.strokeRect(x * cw + 1, y * ch + 1, Math.max(cw - 2, 3), Math.max(ch - 2, 3))
    }
  }, [grid, result, hour, view, background, baseCells, cellOpacity, markers, cursor, keyboard])

  /** Zelle unter dem Zeiger. */
  const indexAt = (event: PointerEvent): number | null => {
    const rect = canvas.current?.getBoundingClientRect()
    if (!rect) return null
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * grid.width)
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * grid.height)
    if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return null
    return y * grid.width + x
  }

  const handlePointerDown = (event: PointerEvent) => {
    const index = indexAt(event)
    if (index === null) return
    setKeyboard(false)
    setCursor(index)
    onInspect(index)
    if (!painting) return
    dragging.current = true
    event.currentTarget.setPointerCapture?.(event.pointerId)
    onPaint(index)
  }

  const handlePointerMove = (event: PointerEvent) => {
    const index = indexAt(event)
    setKeyboard(false)
    setCursor(index)
    onInspect(index)
    if (dragging.current && painting && index !== null) onPaint(index)
  }

  const stopDragging = () => {
    dragging.current = false
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    const current = cursor ?? Math.floor(grid.height / 2) * grid.width + Math.floor(grid.width / 2)
    if ((event.key === 'Enter' || event.key === ' ') && painting) {
      event.preventDefault()
      onPaint(current)
      return
    }
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -grid.width,
      ArrowDown: grid.width,
    }
    const move = moves[event.key]
    if (move === undefined) return
    // Mit gedrückter Umschalttaste in größeren Schritten.
    const steps = event.shiftKey ? Math.max(1, Math.round(grid.width / 10)) : 1
    let next = current
    for (let i = 0; i < steps; i++) {
      const candidate = next + move
      const sameRow = Math.floor(candidate / grid.width) === Math.floor(next / grid.width)
      if (candidate < 0 || candidate >= grid.cells.length || (Math.abs(move) === 1 && !sameRow)) break
      next = candidate
    }
    event.preventDefault()
    setKeyboard(true)
    setCursor(next)
    onInspect(next)
  }

  return (
    <div className="city-grid-wrap">
      {background && (
        <img
          key={background.url}
          className="city-grid-bg"
          // Ohne Internet fehlt das Luftbild: dann einfach ausblenden.
          onError={(event) => (event.currentTarget.style.visibility = 'hidden')}
          src={background.url}
          alt=""
          draggable={false}
          crossOrigin="anonymous"
          style={{
            transform: `translate(${background.offsetX}%, ${background.offsetY}%) rotate(${background.rotation}deg) scale(${background.scale})`,
          }}
        />
      )}
      <canvas
        ref={canvas}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className={`city-grid${painting ? ' is-painting' : ''}`}
        tabIndex={0}
        role="img"
        aria-label={`Stadtraster mit ${grid.width} × ${grid.height} Zellen à ${grid.cellSizeM} m. Mit den Pfeiltasten bewegen${
          painting ? ', mit Enter malen' : ''
        }. Die Werte der gewählten Zelle stehen unter dem Raster.`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onPointerLeave={() => {
          stopDragging()
          if (!keyboard) {
            setCursor(null)
            onInspect(null)
          }
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => setKeyboard(false)}
      />
    </div>
  )
}
