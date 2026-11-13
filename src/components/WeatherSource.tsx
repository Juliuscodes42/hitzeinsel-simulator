import { useState } from 'react'
import {
  WEATHER_ATTRIBUTION,
  fetchHottestSummerDay,
  fetchToday,
  lastCompleteSummer,
} from '../data/weatherService.ts'
import type { Weather } from '../model/atmosphere.ts'
import { weatherFromObservation, type DayObservation } from '../model/observedWeather.ts'

/** Ort, für den Wetterdaten geholt werden. */
export interface WeatherLocation {
  name: string
  lat: number
  lon: number
}

interface WeatherSourceProps {
  location: WeatherLocation
  /** Beschreibung des geladenen Wetters, null = Standardtag. */
  label: string | null
  onLoaded: (weather: Weather, label: string) => void
  onReset: () => void
}

const formatDate = (date: string): string => {
  const [year, month, day] = date.split('-')
  return `${day}.${month}.${year}`
}

/**
 * Holt echtes Wetter für den gewählten Ort und stellt die Regler darauf ein:
 * entweder den heutigen Tag oder den heißesten Tag des letzten Sommers.
 */
export function WeatherSource({ location, label, onLoaded, onReset }: WeatherSourceProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const summer = lastCompleteSummer()

  const load = async (fetchDay: () => Promise<DayObservation>, describe: (date: string) => string) => {
    setBusy(true)
    setError(null)
    try {
      const observation = await fetchDay()
      onLoaded(
        weatherFromObservation(observation, location.lat),
        `${describe(formatDate(observation.date))} in ${location.name}`,
      )
    } catch (problem) {
      setError(
        problem instanceof Error && problem.name !== 'TimeoutError'
          ? problem.message
          : 'Der Wetterdienst antwortet nicht. Bitte später noch einmal versuchen.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="weather-source">
      <div className="weather-buttons">
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={() => load(() => fetchToday(location.lat, location.lon), (date) => `Heute (${date})`)}
        >
          Wetter von heute
        </button>
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={() =>
            load(
              () => fetchHottestSummerDay(location.lat, location.lon, summer),
              (date) => `Heißester Sommertag ${summer} (${date})`,
            )
          }
        >
          Heißester Tag {summer}
        </button>
      </div>
      <p className={`slider-hint${error ? ' is-error' : ''}`} role="status">
        {busy
          ? 'Lade Wetterdaten …'
          : (error ??
            (label
              ? `${label}. ${WEATHER_ATTRIBUTION}`
              : `Standardtag: heißer, klarer Julitag. Oder echtes Wetter für ${location.name} laden.`))}{' '}
        {label && !busy && (
          <button type="button" className="link-button" onClick={onReset}>
            Standardtag
          </button>
        )}
      </p>
    </div>
  )
}
