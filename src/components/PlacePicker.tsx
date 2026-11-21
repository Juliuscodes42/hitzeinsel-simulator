import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  IMAGERY_ATTRIBUTION,
  IMAGERY_TILE_URL,
  searchPlaces,
  type Place,
  type PlaceHit,
} from '../data/places.ts'
import { EXAMPLE_PLACES, type ExamplePlace } from '../data/examplePlaces.ts'
import { loadPlace, type PlaceRequest } from '../data/placeLoader.ts'
import { squareAround, type BBox } from '../model/osm.ts'

interface PlacePickerProps {
  onLoaded: (place: Place) => void
  /** Erfundenes Beispielviertel statt eines echten Orts verwenden. */
  onDistrict: () => void
}

/** Kantenlänge des Ausschnitts in Metern (20 Zellen à 10 m). */
const AREA_SIZE_M = 200
/** Startansicht: Elmshorn. */
const START: [number, number] = [53.7536, 9.6526]

const toBounds = (bbox: BBox): L.LatLngBoundsExpression => [
  [bbox.south, bbox.west],
  [bbox.north, bbox.east],
]

/**
 * Ort suchen, Ausschnitt auf dem Luftbild wählen und als Raster laden.
 * Der gelbe Rahmen in der Kartenmitte zeigt die 200 m × 200 m, die geladen werden.
 */
export function PlacePicker({ onLoaded, onDistrict }: PlacePickerProps) {
  const mapElement = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  // Die Karte wird erst angelegt, wenn die Suche aufgeklappt ist.
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<PlaceHit[]>([])
  const [placeName, setPlaceName] = useState('')
  const [status, setStatus] = useState<{ kind: 'idle' | 'busy' | 'error'; text: string }>({
    kind: 'idle',
    text: 'Karte verschieben, bis der gelbe Rahmen die gewünschte Fläche zeigt.',
  })

  useEffect(() => {
    if (!searchOpen || !mapElement.current) return
    const instance = L.map(mapElement.current, { center: START, zoom: 17, maxZoom: 19 })
    L.tileLayer(IMAGERY_TILE_URL, { maxZoom: 19, attribution: IMAGERY_ATTRIBUTION }).addTo(instance)

    const frameAt = (center: L.LatLng) => toBounds(squareAround(center.lat, center.lng, AREA_SIZE_M))
    const frame = L.rectangle(frameAt(instance.getCenter()), {
      color: '#ffd400',
      weight: 2,
      fill: false,
      interactive: false,
    }).addTo(instance)
    instance.on('move', () => frame.setBounds(frameAt(instance.getCenter())))

    map.current = instance
    return () => {
      instance.remove()
      map.current = null
    }
  }, [searchOpen])

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault()
    if (!query.trim()) return
    setStatus({ kind: 'busy', text: 'Suche läuft …' })
    try {
      const found = await searchPlaces(query.trim())
      setHits(found)
      if (found.length === 0) {
        setStatus({ kind: 'error', text: 'Nichts gefunden. Bitte Ort oder Adresse genauer angeben.' })
      } else {
        goTo(found[0])
      }
    } catch (error) {
      setStatus({ kind: 'error', text: `Suche fehlgeschlagen: ${String(error)}` })
    }
  }

  const goTo = (hit: PlaceHit) => {
    map.current?.setView([hit.lat, hit.lon], 18)
    setPlaceName(hit.name.split(',').slice(0, 2).join(','))
    setStatus({ kind: 'idle', text: 'Rahmen bei Bedarf verschieben, dann „Ausschnitt laden".' })
  }

  /** Lädt einen Ort mit Bilderkennung und meldet den Fortschritt. */
  const load = async (request: PlaceRequest) => {
    setStatus({ kind: 'busy', text: 'Lade …' })
    try {
      const place = await loadPlace(request, (text) => setStatus({ kind: 'busy', text }))
      setStatus({ kind: 'idle', text: `„${place.name}" geladen.` })
      onLoaded(place)
    } catch (error) {
      setStatus({ kind: 'error', text: String(error instanceof Error ? error.message : error) })
    }
  }

  const loadExample = (example: ExamplePlace) => {
    map.current?.setView([example.lat, example.lon], 18)
    setPlaceName(example.name)
    setHits([])
    void load({ id: example.id, name: example.name, bbox: example.bbox })
  }

  const handleLoad = () => {
    const center = map.current?.getCenter()
    if (!center) return
    void load({
      name: placeName || `${center.lat.toFixed(4)}° N, ${center.lng.toFixed(4)}° O`,
      bbox: squareAround(center.lat, center.lng, AREA_SIZE_M),
    })
  }

  return (
    <div className="place-picker">
      <section className="choice" aria-labelledby="wahl-beispiel">
        <h3 id="wahl-beispiel">Beispielort nehmen</h3>
        <p className="slider-hint">
          Vier vorbereitete Orte mit Satellitenmessung. Sie laden in wenigen Sekunden. Ohne
          Internet fehlt das Luftbild, dann rechnet die App nur mit OpenStreetMap.
        </p>
        <div className="choice-cards">
          {EXAMPLE_PLACES.map((example) => (
            <button
              key={example.id}
              type="button"
              className="choice-card"
              disabled={status.kind === 'busy'}
              onClick={() => loadExample(example)}
            >
              {example.name}
            </button>
          ))}
        </div>
        {!searchOpen && status.kind !== 'idle' && (
          <p className={`place-status${status.kind === 'error' ? ' is-error' : ''}`} role="status">
            {status.text}
          </p>
        )}
      </section>

      <details
        className="fold"
        onToggle={(event) => setSearchOpen(event.currentTarget.open)}
      >
        <summary>
          <span className="fold-title">Eigenen Ort in Deutschland suchen</span>
          <span className="fold-note">Schule, Parkplatz, Straße …</span>
        </summary>
        <div className="fold-body">
          <p className="slider-hint">
            Der gelbe Rahmen zeigt 200 m × 200 m. Gebäude, Straßen, Parkplätze und Grünflächen
            kommen aus OpenStreetMap.
          </p>
          <form className="place-search" onSubmit={handleSearch} role="search">
            <label htmlFor="ortssuche" className="sr-only">
              Ort oder Adresse in Deutschland
            </label>
            <input
              id="ortssuche"
              type="search"
              value={query}
              placeholder="Ort oder Adresse, z. B. Schulstraße Elmshorn"
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="submit" className="button" disabled={status.kind === 'busy'}>
              Suchen
            </button>
          </form>

          {hits.length > 1 && (
            <ul className="place-hits">
              {hits.map((hit) => (
                <li key={`${hit.lat},${hit.lon}`}>
                  <button type="button" className="link-button" onClick={() => goTo(hit)}>
                    {hit.name}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {searchOpen && (
            <div
              ref={mapElement}
              className="place-map"
              aria-label="Luftbild-Karte zur Auswahl des Ausschnitts"
            />
          )}

          <div className="place-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={handleLoad}
              disabled={status.kind === 'busy'}
            >
              Ausschnitt laden
            </button>
            <p className={`place-status${status.kind === 'error' ? ' is-error' : ''}`} role="status">
              {status.text}
            </p>
          </div>
        </div>
      </details>

      <section className="choice" aria-labelledby="wahl-viertel">
        <h3 id="wahl-viertel">Ohne echten Ort ausprobieren</h3>
        <p className="slider-hint">
          Ein erfundenes Viertel, bei dem sich Versiegelung und Bebauungsdichte frei einstellen
          lassen.
        </p>
        <div>
          <button type="button" className="button" onClick={onDistrict}>
            Erfundenes Beispielviertel nehmen
          </button>
        </div>
      </section>
    </div>
  )
}
