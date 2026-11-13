import { shortwaveDown, type Weather } from '../model/atmosphere.ts'
import type { DistrictParams, Measures } from '../model/district.ts'
import { formatNumber, formatPercent } from './format.ts'
import { Slider } from './Slider.tsx'

/** Unterschied zwischen Tageshöchst- und Nachttiefstwert der Luft in K. */
const DAY_NIGHT_RANGE = 14

interface ControlPanelProps {
  weather: Weather
  onWeatherChange: (weather: Weather) => void
  /** Regenmenge eines Starkregens in mm. */
  rainMm: number
  onRainChange: (rainMm: number) => void
  district: DistrictParams
  onDistrictChange: (district: DistrictParams) => void
  measures: Measures
  onMeasuresChange: (measures: Measures) => void
  onResetMeasures: () => void
}

/** Alle Regler: Wetter, Stadtstruktur und Maßnahmen. */
export function ControlPanel({
  weather,
  onWeatherChange,
  rainMm,
  onRainChange,
  district,
  onDistrictChange,
  measures,
  onMeasuresChange,
  onResetMeasures,
}: ControlPanelProps) {
  const anyMeasure = Object.values(measures).some((share) => share > 0)
  // Gründach hat Vorrang vor Cool Roof, Bäume vor Entsiegelung (siehe district.ts).
  const coolRoofLimit = 1 - measures.greenRoofs
  const unsealingLimit = 1 - measures.trees

  const percentSlider = (
    label: string,
    key: keyof Measures,
    hint: string,
    limit = 1,
  ) => (
    <Slider
      label={label}
      display={formatPercent(Math.min(measures[key], limit))}
      value={measures[key]}
      min={0}
      max={1}
      step={0.05}
      hint={hint}
      onChange={(value) => onMeasuresChange({ ...measures, [key]: value })}
    />
  )

  return (
    <div className="controls">
      <section className="panel" aria-labelledby="wetter">
        <h2 id="wetter">Wetter</h2>
        <Slider
          label="Sonneneinstrahlung"
          display={`${Math.round(shortwaveDown(weather, 12))} W/m²`}
          value={weather.transmissivity}
          min={0.2}
          max={0.8}
          step={0.02}
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
          display={`${formatNumber(weather.tMaxC, 0)} °C`}
          value={weather.tMaxC}
          min={20}
          max={40}
          step={1}
          hint={`Nachts kühlt die Luft auf ${formatNumber(weather.tMinC, 0)} °C ab.`}
          onChange={(tMaxC) =>
            onWeatherChange({ ...weather, tMaxC, tMinC: tMaxC - DAY_NIGHT_RANGE })
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
      </section>

      <section className="panel" aria-labelledby="stadt">
        <h2 id="stadt">Stadtstruktur</h2>
        <Slider
          label="Versiegelungsgrad"
          display={formatPercent(district.sealing)}
          value={district.sealing}
          min={0}
          max={1}
          step={0.05}
          hint="Anteil der Höfe und Plätze, der gepflastert ist."
          onChange={(sealing) => onDistrictChange({ ...district, sealing })}
        />
        <Slider
          label="Bebauungsdichte"
          display={formatPercent(district.density)}
          value={district.density}
          min={0}
          max={0.8}
          step={0.05}
          hint="Anteil der Blockflächen mit Gebäuden."
          onChange={(density) => onDistrictChange({ ...district, density })}
        />
        <button
          type="button"
          className="button"
          onClick={() => onDistrictChange({ ...district, seed: district.seed + 1 })}
        >
          Anderes Viertel würfeln
        </button>
      </section>

      <section className="panel" aria-labelledby="massnahmen">
        <div className="panel-head">
          <h2 id="massnahmen">Maßnahmen</h2>
          <button
            type="button"
            className="link-button"
            onClick={onResetMeasures}
            disabled={!anyMeasure}
          >
            Zurücksetzen
          </button>
        </div>
        {percentSlider('Dachbegrünung', 'greenRoofs', 'Anteil der dunklen Dächer.')}
        {percentSlider(
          'Cool Roofs',
          'coolRoofs',
          'Heller Anstrich auf den übrigen Dächern.',
          coolRoofLimit,
        )}
        {percentSlider('Laubbäume', 'trees', 'Anteil der gepflasterten Höfe und Plätze.')}
        {percentSlider(
          'Entsiegelung',
          'unsealing',
          'Rasengitter statt Pflaster auf den übrigen Flächen.',
          unsealingLimit,
        )}
        {percentSlider('Sprühnebel', 'mist', 'Auf Straßen und Pflaster, 10 bis 20 Uhr.')}
      </section>
    </div>
  )
}
