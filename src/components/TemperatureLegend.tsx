import { TEMPERATURE_GRADIENT, TEMPERATURE_SCALE_MAX, TEMPERATURE_SCALE_MIN } from './colors.ts'

const TICKS = [20, 25, 30, 35, 40, 45, 50, 55]

/** Farbskala der Oberflächentemperatur. */
export function TemperatureLegend() {
  return (
    <div className="legend" aria-label="Farbskala der Oberflächentemperatur von 20 bis 55 °C">
      <div className="legend-bar" style={{ background: TEMPERATURE_GRADIENT }} />
      <div className="legend-ticks" aria-hidden="true">
        {TICKS.map((tick) => (
          <span
            key={tick}
            style={{
              left: `${
                ((tick - TEMPERATURE_SCALE_MIN) / (TEMPERATURE_SCALE_MAX - TEMPERATURE_SCALE_MIN)) *
                100
              }%`,
            }}
          >
            {tick === TEMPERATURE_SCALE_MAX ? `${tick}+` : tick}
          </span>
        ))}
      </div>
      <p className="legend-caption">Oberflächentemperatur in °C</p>
    </div>
  )
}
