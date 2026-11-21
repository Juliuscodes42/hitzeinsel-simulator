# Quellen

Stand: November 2026. Vor der Abgabe bitte jede Quelle selbst nachschlagen und
Seitenzahlen bzw. Abrufdatum ergänzen. Mit „prüfen" markierte Angaben wurden
aus dem Gedächtnis eingetragen und sind noch nicht am Original kontrolliert.

## Physik und Formeln

| Wofür | Quelle | Verwendet in |
|---|---|---|
| Energiebilanz von Oberflächen, Albedo, Emissionsgrad, Wärmekapazität, Wärmeleitfähigkeit, Eindringtiefe der Tageswelle | T. R. Oke: *Boundary Layer Climates*, 2. Auflage, Routledge, 1987 (Tabellen 1.1, 2.1, 7.4: prüfen) | `src/data/materials.ts`, `src/model/energyBalance.ts` |
| Stadtklima allgemein, Hitzeinsel, Himmelssichtfaktor | T. R. Oke, G. Mills, A. Christen, J. A. Voogt: *Urban Climates*, Cambridge University Press, 2017 | Hintergrund |
| Gegenstrahlung der Atmosphäre bei klarem Himmel, L↓ = 5,31·10⁻¹³·T⁶ | W. C. Swinbank: Long-wave radiation from clear skies. *Quarterly Journal of the Royal Meteorological Society* 89, 1963, S. 339–348 (prüfen) | `src/model/atmosphere.ts` |
| Wärmeübergang bei Wind, h = 5,7 + 3,8·u | W. Jürges: Der Wärmeübergang an einer ebenen Wand. *Beihefte zum Gesundheits-Ingenieur*, Reihe 1, Nr. 19, 1924 (prüfen; häufig zitiert nach McAdams: *Heat Transmission*) | `src/model/energyBalance.ts` |
| Sättigungsdampfdruck (Magnus-Formel, Koeffizienten 17,625 und 243,04 °C) | O. A. Alduchov, R. E. Eskridge: Improved Magnus form approximation of saturation vapor pressure. *Journal of Applied Meteorology* 35, 1996, S. 601–609 (prüfen) | `src/model/atmosphere.ts` |
| Stefan-Boltzmann-Konstante, Solarkonstante 1361 W/m² | CODATA 2018; G. Kopp, J. L. Lean: A new, lower value of total solar irradiance. *Geophysical Research Letters* 38, 2011 | `src/model/constants.ts` |
| Sonnenstand (Deklination, Stundenwinkel) | J. A. Duffie, W. A. Beckman: *Solar Engineering of Thermal Processes*, Wiley (Formel von Cooper für die Deklination) | `src/model/atmosphere.ts` |
| Abflussbeiwerte | DIN 1986-100: Entwässerungsanlagen für Gebäude und Grundstücke, Tabelle der Abflussbeiwerte (Werte in der App nur angelehnt: prüfen) | `src/data/materials.ts`, `src/model/water.ts` |
| Rucksackproblem mit Auswahlgruppen, Greedy-Verfahren | H. Kellerer, U. Pferschy, D. Pisinger: *Knapsack Problems*, Springer, 2004, Kapitel 11 (prüfen) | `src/model/optimizer.ts` |

## Daten

| Daten | Quelle und Lizenz | Verwendet in |
|---|---|---|
| Gebäude, Straßen, Flächennutzung, Bäume | © OpenStreetMap-Mitwirkende, Open Database License (ODbL), abgefragt über die Overpass API | `src/data/places.ts`, `src/model/osm.ts` |
| Ortssuche | Nominatim (OpenStreetMap) | `src/data/places.ts` |
| Luftbilder für die Bilderkennung | Amtliche Digitale Orthophotos (DOP, meist 20 cm) der 16 Landesvermessungen, als WMS abgerufen. Lizenzen laut Diensten: CC BY 4.0 (SH, NI, BY, TH, HB), dl-de/by-2-0 (HH, BB, BW, RP, SN, ST), dl-de/zero-2-0 (NW, BE), frei mit Quellenangabe (HE, MV, SL). Liste und Quellenvermerke in `src/data/aerialImagery.ts`, geprüft am 21.11.2026. | `src/data/aerialImagery.ts` |
| Luftbild in der Ortssuche (nur Anzeige) | Esri World Imagery (Esri, Maxar, Earthstar Geographics). Wird nur angezeigt, nicht ausgewertet. Die Esri-Bedingungen erlauben Daten nur „mit den Produkten, für die Esri sie bereitstellt"; für die Auswertung wird deshalb nur das amtliche Luftbild verwendet. Für die Anzeige noch zu klären. | `src/components/PlacePicker.tsx` |
| Wetter (Vorhersage und Archiv/Reanalyse ERA5) | Open-Meteo.com, Lizenz CC BY 4.0. P. Zippenfenig: Open-Meteo.com Weather API, Zenodo, 2023 | `src/data/weatherService.ts` |
| Typischer Hitzetag | Open-Meteo-Archiv (ERA5), Tageswerte der letzten 10 Sommer (Juni bis August). Eigenes Verfahren: Mittel der 3 heißesten Tage je Sommer. Für die Beispielorte vorab berechnet mit `scripts/build-heat-days.ts`. | `src/model/heatDay.ts`, `src/data/regionalWeather.ts` |
| Starkregen | KOSTRA-DWD-2020, Deutscher Wetterdienst, Dauerstufe 60 Minuten, Wiederkehrzeiten 5, 30 und 100 Jahre, 5-km-Raster (ETRS89-LAEA). Lizenz CC BY 4.0 (dwd.de/copyright). Aufbereitet mit `scripts/build-kostra.py`. | `src/model/heavyRain.ts`, `src/data/kostra.json` |
| Oberflächentemperatur aus dem All | Landsat 8/9 Collection 2 Level-2 Surface Temperature (Band ST_B10), U.S. Geological Survey, gemeinfrei. Abgerufen über den Microsoft Planetary Computer. | `scripts/build-places.ts`, `src/model/validation.ts` |

## Eigene Annahmen ohne Quelle

Diese Werte stammen nicht aus der Literatur. Sie stehen im
[Fragenkatalog](expertenfragen/fragenkatalog.md) und sollen mit Fachleuten
abgestimmt werden.

- Feuchteverfügbarkeit m der Oberflächen (Fragen A1–A4)
- Wirkung der Bebauungsdichte auf Himmelssicht, Schatten und Wind (B1–B3)
- Sprühnebel als „feuchte Fläche" von 10 bis 20 Uhr (D1)
- Kosten der Maßnahmen je Quadratmeter (D3)
- Schätzung der Oberfläche aus der Flächennutzung, wo OpenStreetMap nichts Genaues weiß

## Software

React, TypeScript, Vite, Vitest, Leaflet (Karte), geotiff.js und proj4 (nur
im Skript für die Beispielorte). Alle unter freien Lizenzen (MIT, BSD, ISC).
