# Analyse: Warum weicht das Modell von Landsat ab?

Stand: 21.11.2026. Alle Zahlen lassen sich mit den Skripten im Ordner `scripts/`
nachrechnen. Die Modellwerte stammen aus der App (Ergebnis → „Stimmt das Modell?").

## Ausgangslage

Verglichen werden 12 wolkenfreie Landsat-Aufnahmen (Oberflächentemperatur, Band ST_B10)
an vier Orten mit dem Modell zur Überflugzeit (etwa 10:50 Uhr Sonnenzeit).

| Kennzahl | OSM, 10 m | Bilderkennung, 2 m |
|---|---|---|
| Mittlere Abweichung (Betrag) | 4,2 °C | 4,1 °C |
| Richtung | ±0,0 °C | −1,2 °C |
| Fehler im Muster der Viertel | 1,4 °C | 1,1 °C |
| Wärmstes Viertel getroffen | 3 von 12 | 4 von 12 |

Nach Orten (Bilderkennung): Elmshorn +0,7 bis +2,4 °C, Köln −5,5 bis +1,3 °C,
Berlin +3,3 bis +4,8 °C (zu warm), Freiburg −7,0 bis −10,0 °C (zu kalt).

## Befund 1: Wolken am Nachmittag (behoben)

Das Modell nahm die Durchlässigkeit τ der Atmosphäre aus der Sonnenstrahlung des
ganzen Tages. Landsat misst aber nur bei klarem Himmel am Vormittag. Am 09.07.2023
war es in Köln vormittags klar und nachmittags bewölkt: τ im Tagesmittel 0,46, in
den Morgenstunden 0,61. Das Modell rechnete den Vormittag zu dunkel und damit zu kalt.

Seit dieser Version zählt für den Vergleich nur die Sonne bis zum Überflug
(`morningTransmissivity` in `src/model/observedWeather.ts`, eingetragen mit
`scripts/update-scene-sun.ts`). Wirkung: Köln am 09.07.2023 von −9,6 auf −5,5 °C,
mittlere Abweichung beider Raster um 0,7 °C kleiner.

Der Rest am 09.07.2023 passt dazu, dass auch die Lufttemperatur zur Überflugzeit
unterschätzt wird (gemessen 32,1 °C, Modell 29,7 °C).

## Befund 2: Grünflächen sind im Modell zu kühl (offen)

`scripts/analyse-landsat.ts` liest neben der Temperatur auch den Vegetationsindex
NDVI aus den Landsat-Reflexionsbändern und teilt die Bildpunkte im Umkreis von
1 km in drei Gruppen.

| Ort, Datum | Luft | Landsat grün (NDVI > 0,5) | Landsat mittel | Landsat versiegelt (NDVI < 0,2) | Modell Rasen / Baum |
|---|---|---|---|---|---|
| Elmshorn, 25.06.2026 | 26,4 °C | 35,7 °C | 38,0 °C | 38,7 °C | ca. 26–27 °C |
| Köln, 24.06.2026 | 30,7 °C | 45,3 °C | 46,7 °C | 47,6 °C | ca. 35 °C |
| Berlin, 30.07.2026 | 32,3 °C | 38,6 °C | 40,9 °C | 41,0 °C | ca. 30–32 °C |
| Freiburg, 25.06.2026 | 33,7 °C | 46,1 °C | 48,3 °C | 51,2 °C | ca. 31–32 °C |

Was das zeigt:

- Die Freiburger Flächen waren an den Aufnahmetagen grün (NDVI 0,56 bis 0,63 im
  Ausschnitt), also nicht vertrocknet. Trotzdem misst Landsat dort 44 bis 47 °C.
- Laut Landsat sind grüne Flächen am Vormittag 6 bis 13 °C wärmer als die Luft.
  Im Modell sind Rasen und Baumkronen etwa so warm wie die Luft. Das erklärt den
  größten Teil der Abweichung in Freiburg, wo 70 % der Fläche grün sind.
- Landsat misst zwischen grünen und versiegelten Flächen nur 2 bis 5 °C Unterschied.
  Im Modell liegen zwischen Rasen (rund 31 °C) und dunklem Dach (rund 54 °C) über
  20 °C.

Vorsicht bei der Deutung: Landsat misst die Wärme mit etwa 100 m Auflösung. Auch ein
„grüner" Bildpunkt enthält Dächer und Wege, und versiegelte Bildpunkte enthalten
Bäume. Das gleicht die Gruppen an. Ein Teil des Unterschieds ist also Messtechnik,
nicht Modellfehler. Wie groß dieser Teil ist, lässt sich mit Landsat allein nicht
klären (Frage F5 an die Fachleute).

## Befund 3: Berlin ist im Modell zu warm (offen)

Am Potsdamer Platz rechnet das Modell 3 bis 5 °C zu warm. Wahrscheinliche Ursache:
Hochhäuser werfen am Vormittag lange Schatten auf Straßen und Plätze. Das Modell
kennt keine Gebäudehöhen und setzt Schatten nur pauschal aus der Bebauungsdichte an
(Frage B3). Auch die Dächer sind im Modell mit über 50 °C sehr heiß; viele Dächer
dort sind hell, begrünt oder verglast.

## Wie empfindlich ist das Ergebnis?

Probeweise geänderte Annahmen (nur zum Verstehen, nicht übernommen):

| Annahme | Mittlere Abweichung | Freiburg |
|---|---|---|
| wie in der App | 4,1 °C | −6,9 bis −9,9 °C |
| Rasen trocken (Feuchte 0,5 → 0,15) | 3,6 °C | −4,4 bis −6,7 °C |
| Bäume trockener (0,25 → 0,15) | 4,1 °C | −6,4 bis −9,3 °C |
| Baumkronen tauschen weniger Wärme aus (Faktor 3 → 1,5) | 4,2 °C | −5,8 bis −8,9 °C |

Keine einzelne Annahme erklärt die Abweichung. Trockener Rasen hilft in Freiburg,
macht Elmshorn aber etwas schlechter. Wir ändern die Werte deshalb nicht, bis
Literatur oder Fachleute einen besseren Wert begründen (Fragen A1, A3, F4). Sonst
würde das Modell nur an die vier Orte angepasst und der Vergleich bewiese nichts
mehr.

## Ergebnis in einem Satz

Die Bilderkennung verbessert die Verteilung warmer und kühler Bereiche (Musterfehler
1,4 → 1,1 °C). Die großen verbleibenden Abweichungen kommen aus der Physik des
Modells: Grünflächen sind zu kühl, und Gebäudeschatten fehlen.
