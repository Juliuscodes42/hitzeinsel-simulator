import { useEffect, useRef, type ReactNode } from 'react'
import { MATERIALS, SURFACE_TYPES, type SurfaceType } from '../data/materials.ts'
import { type Weather } from '../model/atmosphere.ts'
import { OPEN_CONDITIONS, simulateDay } from '../model/energyBalance.ts'
import { formatHour, formatNumber } from './format.ts'

interface FormulaDialogProps {
  open: boolean
  onClose: () => void
  weather: Weather
  hour: number
}

/** Oberflächen, deren Energieflüsse als Rechenbeispiel gezeigt werden. */
const EXAMPLES: SurfaceType[] = ['asphalt', 'grass', 'roof', 'greenRoof']

function Formula({ children }: { children: ReactNode }) {
  return <p className="formula">{children}</p>
}

/**
 * Erklärt der Jury, was das Modell rechnet: Formeln, Bedeutung der Größen,
 * ein Rechenbeispiel mit den aktuellen Reglerwerten, Materialwerte und Grenzen.
 */
export function FormulaDialog({ open, onClose, weather, hour }: FormulaDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])

  const sampleIndex = Math.round(hour * 6)

  return (
    <dialog ref={dialog} className="dialog" aria-labelledby="formeln-titel" onClose={onClose}>
      <div className="dialog-head">
        <h2 id="formeln-titel">So rechnet das Modell</h2>
        <button type="button" className="button" onClick={onClose}>
          Schließen
        </button>
      </div>

      {open && (
        <div className="dialog-body">
          <p>
            Jede Zelle des Rasters ist eine Fläche von 10 m × 10 m. Für jede Minute des Tages
            wird berechnet, wie viel Energie die Fläche gewinnt und verliert. Der Überschuss
            erwärmt sie, ein Defizit kühlt sie ab.
          </p>

          <h3>1. Energiebilanz</h3>
          <Formula>
            C · dT/dt = Q* − H − LE − G
          </Formula>
          <p>
            T ist die Oberflächentemperatur, C die Wärmekapazität der obersten Schicht. Die vier
            Flüsse rechts (in W/m²) werden unten einzeln erklärt. Gerechnet wird in Schritten
            von 60 Sekunden (Euler-Verfahren). Derselbe Tag wird sechsmal wiederholt, bis sich
            ein stabiler Tagesgang eingestellt hat.
          </p>

          <h3>2. Strahlungsbilanz Q* (Stefan-Boltzmann, Albedo)</h3>
          <Formula>
            Q* = (1 − α) · (1 − s) · K↓ + ε · ψ · (L↓ − σ · T⁴)
          </Formula>
          <ul>
            <li>
              <b>α</b> Albedo: Anteil des Sonnenlichts, der reflektiert wird. Asphalt 0,10, Cool
              Roof 0,70.
            </li>
            <li>
              <b>K↓</b> Sonnenstrahlung: K↓ = S₀ · τ · sin h, mit Solarkonstante S₀ = 1361 W/m²,
              Durchlässigkeit τ der Atmosphäre und Sonnenhöhe h.
            </li>
            <li>
              <b>σ · T⁴</b> Stefan-Boltzmann-Gesetz: Jede Fläche strahlt Wärme ab, und zwar mit
              der vierten Potenz ihrer Temperatur in Kelvin. σ = 5,67 · 10⁻⁸ W/(m² · K⁴), ε ist
              der Emissionsgrad.
            </li>
            <li>
              <b>L↓</b> Gegenstrahlung der Atmosphäre nach Swinbank: L↓ = 5,31 · 10⁻¹³ · T_Luft⁶.
            </li>
            <li>
              <b>s</b> Schatten und <b>ψ</b> Himmelssichtfaktor: Zwischen Gebäuden kommt weniger
              Sonne an, aber die Fläche kann nachts auch weniger Wärme in den Himmel abstrahlen.
            </li>
          </ul>

          <h3>3. Konvektive Kühlung H</h3>
          <Formula>
            H = h · (T − T_Luft) &nbsp; mit &nbsp; h = 5,7 + 3,8 · u
          </Formula>
          <p>
            Die Luft trägt Wärme fort. Der Wärmeübergangskoeffizient h wächst mit der
            Windgeschwindigkeit u (Formel nach Jürges). Zwischen Gebäuden ist der Wind schwächer.
          </p>

          <h3>4. Verdunstung LE (Evapotranspiration)</h3>
          <Formula>
            LE = m · (h / γ) · (e_s(T) − e_Luft)
          </Formula>
          <p>
            Wasser, das verdunstet, entzieht der Fläche Wärme. m ist die Feuchteverfügbarkeit
            (Asphalt 0, Rasen 0,5, Wasser 1), γ = 66 Pa/K die Psychrometerkonstante, e_s der
            Sättigungsdampfdruck nach der Magnus-Formel und e_Luft der Dampfdruck der Luft.
            Deshalb bleiben Rasen, Bäume und Gründächer tagsüber viel kühler.
          </p>

          <h3>5. Wärmespeicherung G und nächtlicher Hitzestau</h3>
          <Formula>
            G = k · (T − T_tief) &nbsp; mit &nbsp; d = √(κ · P / π), &nbsp; C = C_vol · d, &nbsp; k = λ / d
          </Formula>
          <p>
            Die Tageswärme dringt nur bis zur Tiefe d in den Boden ein (bei Asphalt rund 10 cm).
            Diese Schicht speichert tagsüber Wärme und gibt sie nachts wieder ab. Stoffe mit
            hoher Wärmekapazität wie Asphalt und Beton bleiben deshalb nachts warm. κ = λ / C_vol
            ist die Temperaturleitfähigkeit, P = 24 h.
          </p>

          <h3>6. Regenrückhalt</h3>
          <Formula>
            V = (1 − ψ_A) · N · A
          </Formula>
          <p>
            Vom Niederschlag N (in mm = Liter pro m²) fließt der Anteil ψ_A (Abflussbeiwert)
            oberflächlich ab. Der Rest wird auf der Fläche A zurückgehalten.
          </p>

          <h3>7. Optimierer</h3>
          <p>
            Für jede Fläche wird berechnet, um wie viel Kelvin jede mögliche Maßnahme sie abkühlt
            und was das kostet. Das Budget wird dann in der Reihenfolge „meiste Kühlung pro Euro
            zuerst" ausgegeben (Greedy-Verfahren für ein Rucksackproblem). Weil das Modell
            Nachbarflächen nicht koppelt, hängt der Nutzen einer Maßnahme nur von ihrer eigenen
            Fläche ab. Die Kosten je Quadratmeter sind grobe eigene Annahmen.
          </p>

          <h3>Rechenbeispiel: Energieflüsse um {formatHour(hour)} Uhr</h3>
          <p>Freie, unverschattete Fläche mit den aktuellen Wetter-Reglern. Werte in W/m².</p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Fläche</th>
                  <th scope="col">T in °C</th>
                  <th scope="col">Q*</th>
                  <th scope="col">H</th>
                  <th scope="col">LE</th>
                  <th scope="col">G</th>
                  <th scope="col">Rest</th>
                </tr>
              </thead>
              <tbody>
                {EXAMPLES.map((surface) => {
                  const sample = simulateDay({ ...OPEN_CONDITIONS, surface }, weather).samples[
                    sampleIndex
                  ]
                  const { netRadiation, sensible, latent, ground } = sample.fluxes
                  return (
                    <tr key={surface}>
                      <th scope="row">{MATERIALS[surface].label}</th>
                      <td>{formatNumber(sample.surfaceC)}</td>
                      <td>{formatNumber(netRadiation, 0)}</td>
                      <td>{formatNumber(sensible, 0)}</td>
                      <td>{formatNumber(latent, 0)}</td>
                      <td>{formatNumber(ground, 0)}</td>
                      <td>{formatNumber(netRadiation - sensible - latent - ground, 0)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="note">
            „Rest" ist der Überschuss, der die Fläche in diesem Moment erwärmt (positiv) oder
            abkühlt (negativ).
          </p>

          <h3>Materialwerte</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Fläche</th>
                  <th scope="col">Albedo α</th>
                  <th scope="col">Emissionsgrad ε</th>
                  <th scope="col">Feuchte m</th>
                  <th scope="col">Abfluss ψ_A</th>
                </tr>
              </thead>
              <tbody>
                {SURFACE_TYPES.map((surface) => {
                  const material = MATERIALS[surface]
                  return (
                    <tr key={surface}>
                      <th scope="row">{material.label}</th>
                      <td>{formatNumber(material.albedo, 2)}</td>
                      <td>{formatNumber(material.emissivity, 2)}</td>
                      <td>{formatNumber(material.moistureAvailability, 2)}</td>
                      <td>{formatNumber(material.runoffCoefficient, 2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="note">
            Albedo, Emissionsgrad, Wärmekapazität und Wärmeleitfähigkeit nach T. R. Oke,
            „Boundary Layer Climates" (1987). Abflussbeiwerte angelehnt an DIN 1986-100. Die
            Feuchteverfügbarkeit ist eine eigene Annahme.
          </p>

          <h3>Grenzen des Modells</h3>
          <ul>
            <li>Keine Strömungssimulation: Nachbarflächen tauschen über die Luft keine Wärme aus.</li>
            <li>
              Schatten, Wind und Himmelssicht zwischen Gebäuden folgen einfachen Faustformeln aus
              der Bebauungsdichte, ohne Gebäudehöhen.
            </li>
            <li>Bäume zählen als eigene Fläche und beschatten ihre Nachbarzellen nicht.</li>
            <li>Gerechnet wird ein wolkenloser oder gleichmäßig bewölkter Tag ohne Regen.</li>
            <li>
              Das Modell eignet sich für Vergleiche (vorher und nachher), nicht für gradgenaue
              Vorhersagen.
            </li>
          </ul>
        </div>
      )}
    </dialog>
  )
}
