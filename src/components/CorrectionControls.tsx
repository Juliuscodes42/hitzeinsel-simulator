import { useId, useState, type ChangeEvent } from 'react'
import { isBundled, parseCorrections, type Corrections } from '../data/corrections.ts'

interface CorrectionControlsProps {
  /** Kennung des geladenen Orts. */
  placeKey: string
  corrections: Corrections
  /** Gibt es gemalte Zellen, die noch nicht gespeichert sind? */
  hasUnsavedChanges: boolean
  onSave: () => void
  onRestoreOriginal: () => void
  onImport: (corrections: Corrections) => void
}

const formatDate = (date: string): string => date.split('-').reverse().join('.')

/**
 * Korrigiertes Raster eines Orts speichern, zurücksetzen und als Datei
 * weitergeben. Gespeicherte Korrekturen fließen in den Vergleich mit den
 * Satellitenmessungen ein.
 */
export function CorrectionControls({
  placeKey,
  corrections,
  hasUnsavedChanges,
  onSave,
  onRestoreOriginal,
  onImport,
}: CorrectionControlsProps) {
  const fileId = useId()
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const current = corrections[placeKey]
  const count = Object.keys(corrections).length

  const download = () => {
    const blob = new Blob([JSON.stringify(corrections, null, 1) + '\n'], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'corrections.json'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const imported = parseCorrections(await file.text())
      onImport(imported)
      setMessage({ text: `${Object.keys(imported).length} Korrektur(en) geladen.`, error: false })
    } catch (problem) {
      setMessage({ text: problem instanceof Error ? problem.message : String(problem), error: true })
    }
  }

  return (
    <div className="corrections">
      <h3>Raster korrigieren</h3>
      <p className="slider-hint">
        {current
          ? `Für diesen Ort ist ein korrigiertes Raster vom ${formatDate(current.savedAt)} aktiv${
              isBundled(placeKey) ? ' (fest im Projekt hinterlegt)' : ' (nur auf diesem Gerät)'
            }.`
          : 'Dieser Ort zeigt das unveränderte Raster aus OpenStreetMap.'}{' '}
        Vorgehen: Deckkraft senken, falsche Zellen mit dem Pinsel nachzeichnen, dann speichern.
        Die Maßnahmen-Regler werden nicht mitgespeichert.
      </p>
      <div className="corrections-buttons">
        <button
          type="button"
          className="button button-primary"
          onClick={() => {
            onSave()
            setMessage({ text: 'Korrektur gespeichert. Der Vergleich unten rechnet jetzt damit.', error: false })
          }}
          disabled={!hasUnsavedChanges}
        >
          Gemalte Zellen als Korrektur speichern
        </button>
        <button type="button" className="button" onClick={onRestoreOriginal} disabled={!current}>
          OpenStreetMap-Original wiederherstellen
        </button>
        <button type="button" className="button" onClick={download} disabled={count === 0}>
          Alle Korrekturen herunterladen
        </button>
        <label htmlFor={fileId} className="button">
          Korrektur-Datei laden
        </label>
        <input
          id={fileId}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={handleFile}
        />
      </div>
      {message && (
        <p className={`slider-hint${message.error ? ' is-error' : ''}`} role="status">
          {message.text}
        </p>
      )}
    </div>
  )
}
