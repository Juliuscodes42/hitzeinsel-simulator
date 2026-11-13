/**
 * Wurzel-Komponente der App.
 * In Schritt 1 nur eine Startseite, die zeigt, dass Build und
 * Veröffentlichung funktionieren. Raster, Regler und Diagramme
 * folgen in den nächsten Schritten.
 */

const SCHRITTE: { titel: string; fertig: boolean }[] = [
  { titel: 'Projektgerüst und Veröffentlichung', fertig: true },
  { titel: 'Physik-Modell (Energiebilanz)', fertig: false },
  { titel: 'Interaktives Raster mit Maßnahmen', fertig: false },
  { titel: '24-Stunden-Diagramm und Kennzahlen', fertig: false },
  { titel: 'Echte Orte: Luftbild und OpenStreetMap', fertig: false },
  { titel: 'Aktuelles Wetter', fertig: false },
  { titel: 'Optimierer für Maßnahmen', fertig: false },
  { titel: 'Vergleich mit Satellitendaten', fertig: false },
]

export default function App() {
  return (
    <main className="startseite">
      <p className="kennung">Jugend forscht 2027</p>
      <h1>Hitzeinsel-Simulator</h1>
      <p className="untertitel">
        Wie heiß wird ein Stadtviertel – und was bringen Bäume, Gründächer und
        entsiegelte Flächen wirklich?
      </p>

      <section aria-labelledby="stand">
        <h2 id="stand">Stand der Entwicklung</h2>
        <ol className="schritte">
          {SCHRITTE.map((schritt) => (
            <li key={schritt.titel} className={schritt.fertig ? 'fertig' : ''}>
              <span aria-hidden="true">{schritt.fertig ? '✓' : '○'}</span>
              {schritt.titel}
              <span className="sr-only">
                {schritt.fertig ? ' – fertig' : ' – offen'}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
