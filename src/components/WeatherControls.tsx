import { shortwaveDown, type Weather } from '../model/atmosphere.ts'
import { RETURN_PERIODS, type ReturnPeriod } from '../model/heavyRain.ts'
import { WEATHER_LIMITS } from '../model/observedWeather.ts'
import { KOSTRA_ATTRIBUTION } from '../data/regionalWeather.ts'
import { formatNumber } from './format.ts'
import { Slider } from './Slider.tsx'
import { WeatherSource, type WeatherLocation } from './WeatherSource.tsx'

interface WeatherControlsProps {
  weather: Weather
  onWeatherChange: (weather: Weather) => void
  /** Ort, für den echtes Wetter geladen werden kann. */
  weatherLocation: WeatherLocation
  /** Beschreibung des geladenen Wetters, null = Standardtag. */
  weatherLabel: string | null
  onWeatherLoaded: (weather: Weather, label: string) => void
  onWeatherReset: () => void
  /** Liegt der typische Hitzetag der Region vor? */
  typicalAvailable: boolean
  onTypical: () => void
  /** Konnte das Wetter der Region nicht geladen werden? */
  regionalError: boolean
  /** Regenmenge eines Starkregens in mm. */
  rainMm: number
  onRainChange: (rainMm: number) => void
  /** Starkregen der Region (KOSTRA) je Wiederkehrzeit. */
  regionalRain: Partial<Record<ReturnPeriod, number>>
  rainPeriod: ReturnPeriod
  onRainPeriodChange: (period: ReturnPeriod) => void
}

/** Wetter des simulierten Tags: echtes Wetter laden oder von Hand einstellen. */
export function WeatherControls({
  weather,
  onWeatherChange,
  weatherLocation,
  weatherLabel,
  onWeatherLoaded,
  onWeatherReset,
  typicalAvailable,
  onTypical,
  regionalError,
  rainMm,
  onRainChange,
  regionalRain,
  rainPeriod,
  onRainPeriodChange,
}: WeatherControlsProps) {
  const hasRegionalRain = RETURN_PERIODS.some((period) => regionalRain[period] !== undefined)
  const rainMatchesRegion = regionalRain[rainPeriod] === rainMm
  return (
    <>
      <WeatherSource
        location={weatherLocation}
        label={weatherLabel}
        onLoaded={onWeatherLoaded}
        onReset={onWeatherReset}
        typicalAvailable={typicalAvailable}
        onTypical={onTypical}
      />
      {regionalError && (
        <p className="slider-hint is-error" role="status">
          Das Wetter der Region konnte nicht geladen werden. Gerechnet wird mit einem
          Standardtag.
        </p>
      )}
      <Slider
        label="Sonneneinstrahlung"
        display={`${Math.round(shortwaveDown(weather, 12))} W/m²`}
        value={weather.transmissivity}
        min={WEATHER_LIMITS.transmissivity.min}
        max={WEATHER_LIMITS.transmissivity.max}
        step={0.01}
        hint="Mittagswert. Niedrig = bewölkt, hoch = wolkenlos."
        onChange={(transmissivity) => onWeatherChange({ ...weather, transmissivity })}
      />
      <Slider
        label="Windgeschwindigkeit"
        display={`${formatNumber(weather.windSpeed)} m/s`}
        value={weather.windSpeed}
        min={0}
        max={10}
        step={0.5}
        onChange={(windSpeed) => onWeatherChange({ ...weather, windSpeed })}
      />
      <Slider
        label="Höchste Lufttemperatur"
        display={`${formatNumber(weather.tMaxC)} °C`}
        value={weather.tMaxC}
        min={WEATHER_LIMITS.tMaxC.min}
        max={WEATHER_LIMITS.tMaxC.max}
        step={0.5}
        hint={`Nachts kühlt die Luft auf ${formatNumber(weather.tMinC)} °C ab.`}
        onChange={(tMaxC) =>
          // Der Abstand zwischen Tag und Nacht bleibt beim Verschieben erhalten.
          onWeatherChange({ ...weather, tMaxC, tMinC: tMaxC - (weather.tMaxC - weather.tMinC) })
        }
      />
      <Slider
        label="Starkregen in einer Stunde"
        display={`${formatNumber(rainMm, 0)} mm`}
        value={rainMm}
        min={10}
        max={100}
        step={1}
        hint={
          hasRegionalRain && rainMatchesRegion
            ? `So viel Regen fällt hier in einer Stunde etwa einmal in ${rainPeriod} Jahren. Bestimmt nur den Regenrückhalt.`
            : 'Regenmenge eines Gewitters. Bestimmt nur den Regenrückhalt.'
        }
        onChange={onRainChange}
      />
      {hasRegionalRain && (
        <div className="rain-periods">
          <div className="toggle" role="group" aria-label="Wie selten ist der Starkregen?">
            {RETURN_PERIODS.map((period) => (
              <button
                key={period}
                type="button"
                aria-pressed={rainMatchesRegion && rainPeriod === period}
                disabled={regionalRain[period] === undefined}
                onClick={() => onRainPeriodChange(period)}
              >
                alle {period} Jahre
              </button>
            ))}
          </div>
          <p className="slider-hint">{KOSTRA_ATTRIBUTION}</p>
        </div>
      )}
    </>
  )
}
