import { STEPS } from './steps.ts'

interface StepperProps {
  /** Aktueller Schritt, 0 = erster. */
  step: number
  onStep: (step: number) => void
}

/** Fortschrittsleiste: zeigt, wo man ist, und erlaubt Sprünge zwischen den Schritten. */
export function Stepper({ step, onStep }: StepperProps) {
  return (
    <nav aria-label="Schritte">
      <ol className="stepper">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              className={`step${index < step ? ' is-done' : ''}`}
              aria-current={index === step ? 'step' : undefined}
              onClick={() => onStep(index)}
            >
              <span className="step-number" aria-hidden="true">
                {index < step ? '✓' : index + 1}
              </span>
              <span className="step-label">
                <span className="sr-only">Schritt {index + 1}: </span>
                {label}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}
