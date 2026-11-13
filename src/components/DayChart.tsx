import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import type { CurvePoint } from '../model/grid.ts'
import { formatDelta, formatHour, formatTemp } from './format.ts'

interface DayChartProps {
  /** Tageskurve ohne Maßnahmen (Ist). */
  base: CurvePoint[]
  /** Tageskurve mit Maßnahmen (Soll). */
  improved: CurvePoint[]
  /** Im Raster gewählte Uhrzeit. */
  hour: number
  onHourChange: (hour: number) => void
  /** Uhrzeiten von Sonnenauf- und -untergang. */
  sunrise: number
  sunset: number
}

const MARGIN = { top: 12, right: 14, bottom: 28, left: 42 }
const HOUR_TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24]

/** Misst die Breite eines Elements, damit das Diagramm scharf in Pixelgröße zeichnet. */
function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  useEffect(() => {
    if (!ref.current) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}

/**
 * 24-Stunden-Diagramm der mittleren Oberflächentemperatur.
 * Zeigt, dass versiegelte Viertel nachts warm bleiben und Begrünung
 * die Abkühlung beschleunigt.
 */
export function DayChart({ base, improved, hour, onHourChange, sunrise, sunset }: DayChartProps) {
  const [wrapper, width] = useWidth()
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const height = Math.round(Math.min(320, Math.max(220, width * 0.45)))
  const plotWidth = Math.max(10, width - MARGIN.left - MARGIN.right)
  const plotHeight = height - MARGIN.top - MARGIN.bottom

  // Achsenbereich: auf volle 5 °C gerundet, damit die Skala beim Regeln ruhig bleibt.
  const values = [...base, ...improved].flatMap((point) => [point.surfaceC, point.airC])
  const yMin = Math.floor(Math.min(...values) / 5) * 5
  const yMax = Math.ceil(Math.max(...values) / 5) * 5
  const yStep = yMax - yMin > 30 ? 10 : 5
  const yTicks: number[] = []
  for (let tick = yMin; tick <= yMax; tick += yStep) yTicks.push(tick)

  // Auf schmalen Bildschirmen nur alle 6 Stunden beschriften, sonst überlappen die Zahlen.
  const hourTicks = width < 480 ? HOUR_TICKS.filter((tick) => tick % 6 === 0) : HOUR_TICKS

  const x = (h: number) => MARGIN.left + (h / 24) * plotWidth
  const y = (tempC: number) => MARGIN.top + (1 - (tempC - yMin) / (yMax - yMin)) * plotHeight

  /** Linie durch alle Punkte; der letzte Punkt wird bis 24 Uhr verlängert. */
  const path = (points: CurvePoint[], pick: (point: CurvePoint) => number) =>
    points
      .map((point, i) => `${i === 0 ? 'M' : 'L'}${x(point.hour).toFixed(1)},${y(pick(point)).toFixed(1)}`)
      .join(' ') + ` L${x(24).toFixed(1)},${y(pick(points[0])).toFixed(1)}`

  const indexAt = (event: PointerEvent<SVGSVGElement> | MouseEvent<SVGSVGElement>): number => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const h = ((event.clientX - bounds.left - MARGIN.left) / plotWidth) * 24
    return Math.min(base.length - 1, Math.max(0, Math.round((h / 24) * base.length)))
  }

  const hovered = hoverIndex === null ? null : hoverIndex
  const tooltipLeft = hovered === null ? 0 : x(base[hovered].hour)
  const tooltipOnLeft = tooltipLeft > width * 0.5

  return (
    <div className="chart">
      <ul className="chart-legend">
        <li>
          <span className="legend-line legend-ist" aria-hidden="true" />
          Ohne Maßnahmen (Ist)
        </li>
        <li>
          <span className="legend-line legend-soll" aria-hidden="true" />
          Mit Maßnahmen (Soll)
        </li>
        <li>
          <span className="legend-line legend-luft" aria-hidden="true" />
          Lufttemperatur
        </li>
        <li>
          <span className="legend-night" aria-hidden="true" />
          Nacht
        </li>
      </ul>

      <div ref={wrapper} className="chart-plot">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Liniendiagramm: mittlere Oberflächentemperatur des Viertels über 24 Stunden, ohne und mit Maßnahmen, dazu die Lufttemperatur. Die Werte stehen in der Tabelle darunter."
          onPointerMove={(event) => setHoverIndex(indexAt(event))}
          onPointerLeave={() => setHoverIndex(null)}
          onClick={(event) => onHourChange(Math.min(23.5, Math.round(base[indexAt(event)].hour * 2) / 2))}
        >
          {/* Nacht: vor Sonnenaufgang und nach Sonnenuntergang */}
          <rect className="chart-night" x={x(0)} y={MARGIN.top} width={x(sunrise) - x(0)} height={plotHeight} />
          <rect className="chart-night" x={x(sunset)} y={MARGIN.top} width={x(24) - x(sunset)} height={plotHeight} />

          {yTicks.map((tick) => (
            <g key={tick}>
              <line className="chart-grid" x1={x(0)} x2={x(24)} y1={y(tick)} y2={y(tick)} />
              <text className="chart-tick" x={MARGIN.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle">
                {tick}
              </text>
            </g>
          ))}
          <text className="chart-tick" x={4} y={MARGIN.top + 2} dominantBaseline="hanging">
            °C
          </text>
          {hourTicks.map((tick) => (
            <text
              key={tick}
              className="chart-tick"
              x={x(tick)}
              y={height - 8}
              textAnchor={tick === 24 ? 'end' : 'middle'}
            >
              {tick === 24 ? '24 Uhr' : tick}
            </text>
          ))}

          {/* Im Raster gewählte Uhrzeit */}
          <line className="chart-now" x1={x(hour)} x2={x(hour)} y1={MARGIN.top} y2={MARGIN.top + plotHeight} />

          <path className="chart-line line-luft" d={path(base, (point) => point.airC)} />
          <path className="chart-line line-ist" d={path(base, (point) => point.surfaceC)} />
          <path className="chart-line line-soll" d={path(improved, (point) => point.surfaceC)} />

          {hovered !== null && (
            <g>
              <line
                className="chart-crosshair"
                x1={tooltipLeft}
                x2={tooltipLeft}
                y1={MARGIN.top}
                y2={MARGIN.top + plotHeight}
              />
              <circle className="chart-dot dot-ist" cx={tooltipLeft} cy={y(base[hovered].surfaceC)} r={4.5} />
              <circle className="chart-dot dot-soll" cx={tooltipLeft} cy={y(improved[hovered].surfaceC)} r={4.5} />
            </g>
          )}
        </svg>

        {hovered !== null && (
          <div
            className="chart-tooltip"
            style={
              tooltipOnLeft
                ? { right: width - tooltipLeft + 12, top: MARGIN.top }
                : { left: tooltipLeft + 12, top: MARGIN.top }
            }
          >
            <strong>{formatHour(base[hovered].hour)} Uhr</strong>
            <span>
              <i className="legend-line legend-ist" aria-hidden="true" /> Ist{' '}
              <b>{formatTemp(base[hovered].surfaceC)}</b>
            </span>
            <span>
              <i className="legend-line legend-soll" aria-hidden="true" /> Soll{' '}
              <b>{formatTemp(improved[hovered].surfaceC)}</b>
            </span>
            <span>
              Unterschied <b>{formatDelta(improved[hovered].surfaceC - base[hovered].surfaceC)}</b>
            </span>
            <span>
              <i className="legend-line legend-luft" aria-hidden="true" /> Luft{' '}
              <b>{formatTemp(base[hovered].airC)}</b>
            </span>
          </div>
        )}
      </div>

      <details className="chart-table">
        <summary>Werte als Tabelle</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Uhrzeit</th>
                <th scope="col">Ist</th>
                <th scope="col">Soll</th>
                <th scope="col">Unterschied</th>
                <th scope="col">Luft</th>
              </tr>
            </thead>
            <tbody>
              {base
                .map((point, i) => ({ point, better: improved[i] }))
                .filter(({ point }) => Number.isInteger(point.hour))
                .map(({ point, better }) => (
                  <tr key={point.hour}>
                    <th scope="row">{formatHour(point.hour)}</th>
                    <td>{formatTemp(point.surfaceC)}</td>
                    <td>{formatTemp(better.surfaceC)}</td>
                    <td>{formatDelta(better.surfaceC - point.surfaceC)}</td>
                    <td>{formatTemp(point.airC)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
