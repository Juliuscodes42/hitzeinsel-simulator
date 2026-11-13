import { useId } from 'react'

interface SliderProps {
  label: string
  /** Angezeigter Wert mit Einheit, z. B. "2,0 m/s". */
  display: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  /** Kurze Erklärung unter dem Regler. */
  hint?: string
}

/** Ein beschrifteter Schieberegler mit Wertanzeige. */
export function Slider({ label, display, value, min, max, step, onChange, hint }: SliderProps) {
  const id = useId()
  return (
    <div className="slider">
      <div className="slider-head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{display}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {hint && (
        <p id={`${id}-hint`} className="slider-hint">
          {hint}
        </p>
      )}
    </div>
  )
}
