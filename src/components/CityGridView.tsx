import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { MATERIALS } from '../data/materials.ts'
import { surfaceTempAt } from '../model/energyBalance.ts'
import type { CityGrid, GridResult } from '../model/grid.ts'
import { SURFACE_COLORS, temperatureColor } from './colors.ts'
import { formatTemp } from './format.ts'

export type ViewMode = 'temperature' | 'surface'

/** Bild, das unter dem Raster liegt (Luftbild oder eigenes Foto). */
export interface GridBackground {
  url: string
  scale: number
  offsetX: number
  offsetY: number
  rotation: number
}

interface CityGridViewProps {
  grid: CityGrid
  result: GridResult
  /** Uhrzeit, deren Temperaturen angezeigt werden. */
  hour: number
  view: ViewMode
  background: GridBackground | null
  /** Deckkraft der Zellenfarben über dem Bild (0–1). */
  cellOpacity: number
  /** Ist ein Pinsel gewählt? Dann malt Klicken und Ziehen. */
  painting: boolean
  onPaint: (index: number) => void
  onInspect: (index: number | null) => void
}

/**
 * Das Stadtraster. Jede Zelle ist eine Schaltfläche:
 * Maus und Finger malen durch Klicken und Ziehen, die Tastatur bewegt sich
 * mit den Pfeiltasten und malt mit Enter oder Leertaste.
 */
export function CityGridView({
  grid,
  result,
  hour,
  view,
  background,
  cellOpacity,
  painting,
  onPaint,
  onInspect,
}: CityGridViewProps) {
  const container = useRef<HTMLDivElement>(null)
  const [focusIndex, setFocusIndex] = useState(0)
  const dragging = useRef(false)

  /** Findet die Zelle unter dem Zeiger (funktioniert auch beim Wischen mit dem Finger). */
  const indexAt = (event: PointerEvent): number | null => {
    const element = document.elementFromPoint(event.clientX, event.clientY)
    const cell = element?.closest<HTMLElement>('[data-index]')
    if (!cell || !container.current?.contains(cell)) return null
    return Number(cell.dataset.index)
  }

  const handlePointerDown = (event: PointerEvent) => {
    const index = indexAt(event)
    if (index === null) return
    setFocusIndex(index)
    if (!painting) return
    dragging.current = true
    onPaint(index)
  }

  const handlePointerMove = (event: PointerEvent) => {
    const index = indexAt(event)
    onInspect(index)
    if (dragging.current && painting && index !== null) onPaint(index)
  }

  const stopDragging = () => {
    dragging.current = false
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -grid.width,
      ArrowDown: grid.width,
    }
    const move = moves[event.key]
    if (move === undefined) return
    const next = focusIndex + move
    const sameRow = Math.floor(next / grid.width) === Math.floor(focusIndex / grid.width)
    const horizontal = Math.abs(move) === 1
    if (next < 0 || next >= grid.cells.length || (horizontal && !sameRow)) return
    event.preventDefault()
    setFocusIndex(next)
    container.current?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.focus()
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
          style={{
            transform: `translate(${background.offsetX}%, ${background.offsetY}%) rotate(${background.rotation}deg) scale(${background.scale})`,
          }}
        />
      )}
    <div
      ref={container}
      className={`city-grid${painting ? ' is-painting' : ''}${background ? ' has-background' : ''}`}
      style={{
        gridTemplateColumns: `repeat(${grid.width}, 1fr)`,
        ['--cell-opacity' as string]: background ? cellOpacity : 1,
      }}
      role="group"
      aria-label="Stadtraster. Mit den Pfeiltasten bewegen, mit Enter malen."
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onPointerLeave={() => {
        stopDragging()
        onInspect(null)
      }}
      onKeyDown={handleKeyDown}
    >
      {grid.cells.map((cell, index) => {
        const tempC = surfaceTempAt(result.cells[index], hour)
        const row = Math.floor(index / grid.width) + 1
        const column = (index % grid.width) + 1
        const label = MATERIALS[cell.surface].label
        return (
          <button
            key={index}
            type="button"
            data-index={index}
            className={`cell${cell.mist ? ' has-mist' : ''}`}
            style={{
              background:
                view === 'temperature' ? temperatureColor(tempC) : SURFACE_COLORS[cell.surface],
            }}
            tabIndex={index === focusIndex ? 0 : -1}
            aria-label={`Zeile ${row}, Spalte ${column}: ${label}${
              cell.mist ? ' mit Sprühnebel' : ''
            }, ${formatTemp(tempC)}`}
            onFocus={() => {
              setFocusIndex(index)
              onInspect(index)
            }}
            // Mausklicks malen schon über pointerdown; hier nur die Tastatur (detail === 0).
            onClick={(event) => {
              if (painting && event.detail === 0) onPaint(index)
            }}
          />
        )
      })}
    </div>
    </div>
  )
}
