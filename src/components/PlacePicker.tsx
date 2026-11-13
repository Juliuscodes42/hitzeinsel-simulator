import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  IMAGERY_ATTRIBUTION,
  IMAGERY_TILE_URL,
  aerialImageUrl,
  fetchOsm,
  searchPlaces,
  type Place,
  type PlaceHit,
} from '../data/places.ts'
import { EXAMPLE_PLACES, type ExamplePlace } from '../data/examplePlaces.ts'
import { rasterizeOsm, squareAround, type BBox } from '../model/osm.ts'

interface PlacePickerProps {
  onLoaded: (place: Place) => void
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
export function PlacePicker({ onLoaded }: PlacePickerProps) {
  const mapElement = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<PlaceHit[]>([])
  const [placeName, setPlaceName] = useState('')
  const [status, setStatus] = useState<{ kind: 'idle' | 'busy' | 'error'; text: string }>({
    kind: 'idle',
    text: 'Karte verschieben, bis der gelbe Rahmen die gewünschte Fläche zeigt.',
  })

  useEffect(() => {
    if (!mapElement.current) return
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
  }, [])

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

  const loadExample = (example: ExamplePlace) => {
    map.current?.setView([example.lat, example.lon], 18)
    setPlaceName(example.name)
    setHits([])
    onLoaded(example)
    setStatus({ kind: 'idle', text: `Beispielort „${example.name}" geladen.` })
  }

  const handleLoad = async () => {
    const center = map.current?.getCenter()
    if (!center) return
    setStatus({
      kind: 'busy',
      text: 'Lade Daten aus OpenStreetMap … Das kann bis zu einer Minute dauern.',
    })
    try {
      const bbox = squareAround(center.lat, center.lng, AREA_SIZE_M)
      const { grid, guessedShare } = rasterizeOsm(await fetchOsm(bbox), bbox)
      onLoaded({
        name: placeName || `${center.lat.toFixed(4)}° N, ${center.lng.toFixed(4)}° O`,
        bbox,
        grid,
        guessedShare,
        imageUrl: aerialImageUrl(bbox),
      })
      setStatus({ kind: 'idle', text: 'Ausschnitt geladen. Das Raster darunter zeigt jetzt diesen Ort.' })
    } catch (error) {
      setStatus({ kind: 'error', text: String(error instanceof Error ? error.message : error) })
    }
  }

  return (
    <div className="place-picker">
      <div className="place-examples">
        <span>Beispielorte (auch ohne Internet):</span>
        {EXAMPLE_PLACES.map((example) => (
          <button key={example.id} type="button" className="button" onClick={() => loadExample(example)}>
            {example.name}
          </button>
        ))}
      </div>

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

      <div ref={mapElement} className="place-map" aria-label="Luftbild-Karte zur Auswahl des Ausschnitts" />

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
  )
}
