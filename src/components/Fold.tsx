import type { ReactNode } from 'react'

interface FoldProps {
  title: string
  /** Kurzer Zusatz rechts neben dem Titel, z. B. der aktuelle Stand. */
  note?: string
  /** Ist der Bereich beim ersten Anzeigen aufgeklappt? */
  defaultOpen?: boolean
  /** Bereiche mit gleichem Gruppennamen schließen sich gegenseitig. */
  group?: string
  /** Wird aufgerufen, wenn der Bereich auf- oder zugeklappt wird. */
  onToggle?: (open: boolean) => void
  children: ReactNode
}

/**
 * Aufklappbarer Bereich. Hält die Seite übersichtlich: Details sind da,
 * aber erst sichtbar, wenn man sie braucht.
 */
export function Fold({ title, note, defaultOpen = false, group, onToggle, children }: FoldProps) {
  return (
    <details
      className="fold"
      open={defaultOpen}
      name={group}
      onToggle={(event) => onToggle?.(event.currentTarget.open)}
    >
      <summary>
        <span className="fold-title">{title}</span>
        {note && <span className="fold-note">{note}</span>}
      </summary>
      <div className="fold-body">{children}</div>
    </details>
  )
}
