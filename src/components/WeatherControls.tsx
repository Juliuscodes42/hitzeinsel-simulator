import { shortwaveDown, type Weather } from '../model/atmosphere.ts'
import { WEATHER_LIMITS } from '../model/observedWeather.ts'
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
  /** Regenmenge eines Starkregens in mm. */
  rainMm: number
  onRainChange: (rainMm: number) => void
}

/** Wetter des simulierten Tags: echtes Wetter laden oder von Hand einstellen. */
export function WeatherControls({
  weather,
  onWeatherChange,
  weatherLocation,
  weatherLabel,
  onWeatherLoaded,
  onWeatherReset,
  rainMm,
  onRainChange,
}: WeatherControlsProps) {
  return (
    <>
      <WeatherSource
        location={weatherLocation}
        label={weatherLabel}
        onLoaded={onWeatherLoaded}
        onReset={onWeatherReset}
      />
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
        label="Starkregen"
        display={`${formatNumber(rainMm, 0)} mm`}
        value={rainMm}
        min={10}
        max={100}
        step={5}
        hint="Regenmenge eines Gewitters. Bestimmt nur den Regenrückhalt."
        onChange={onRainChange}
      />
    </>
  )
}
