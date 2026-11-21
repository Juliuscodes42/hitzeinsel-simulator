# Fragenkatalog

Zu jeder Frage steht, welche Stelle im Code sie betrifft und welchen Wert wir
im Moment verwenden. Status: offen / angefragt / beantwortet.

## A. Verdunstung von Grünflächen

Betrifft `moistureAvailability` in `src/data/materials.ts`. Wir rechnen
LE = m · (h/γ) · (e_s(T) − e_Luft) mit einer Feuchteverfügbarkeit m zwischen
0 (trocken) und 1 (Wasserfläche).

| Nr. | Frage | Unser Wert | Status |
|---|---|---|---|
| A1 | Welche Feuchteverfügbarkeit ist für einen normal bewässerten Stadtrasen an einem heißen Sommertag realistisch? Und für einen ausgetrockneten Rasen nach zwei Wochen ohne Regen? | m = 0,5 | offen |
| A2 | Ein extensives Gründach (ca. 10 cm Substrat, Sedum) trocknet schnell aus. Wie viel kühlt es an einem Hitzetag wirklich noch durch Verdunstung? | m = 0,4 | offen |
| A3 | Wie viel Wasser verdunstet ein ausgewachsener Stadtbaum (z. B. Linde) an einem heißen Tag pro Quadratmeter Kronenfläche? | ergibt sich aus m = 0,25 und Faktor 3 für die Blattfläche | offen |
| A4 | Ist es vertretbar, Rasengittersteine mit etwa der halben Verdunstung eines Rasens anzusetzen? | m = 0,25 | offen |

## B. Wirkung der Bebauung

Betrifft die drei Faustformeln in `src/model/grid.ts`. d ist der Anteil der
Gebäudezellen im Umkreis von 20 m um eine Bodenzelle.

| Nr. | Frage | Unser Wert | Status |
|---|---|---|---|
| B1 | Wir schätzen den Himmelssichtfaktor mit ψ = 1 − 0,6·d. Gibt es eine einfache, belegte Näherung aus Bebauungsdichte oder Gebäudehöhe? | ψ = 1 − 0,6·d | offen |
| B2 | Wie stark sinkt die Windgeschwindigkeit in Bodennähe in dichter Bebauung gegenüber freiem Gelände? | u·(1 − 0,6·d) | offen |
| B3 | Wir rechnen ohne Gebäudehöhen und ohne Sonnenstand-abhängigen Schatten (pauschal s = 0,5·d). Wie groß ist der Fehler, den wir dadurch etwa machen? | s = 0,5·d | offen |
| B4 | Ab welcher Gebietsgröße darf man Oberflächen einzeln berechnen, ohne den Wärmeaustausch zwischen Nachbarflächen über die Luft zu berücksichtigen? Unsere Zellen sind 10 m × 10 m. | kein Austausch | offen |

## C. Wärmeübergang und Speicherung

Betrifft `src/model/energyBalance.ts`.

| Nr. | Frage | Unser Wert | Status |
|---|---|---|---|
| C1 | Wir verwenden für die Konvektion h = 5,7 + 3,8·u (Jürges). Ist das für Stadtoberflächen noch üblich oder gibt es eine bessere einfache Formel? | h = 5,7 + 3,8·u | offen |
| C2 | Wir speichern Wärme nur in einer Schicht mit der Dicke der Eindringtiefe der Tageswelle (bei Asphalt ca. 10 cm). Reicht das, um die nächtliche Wärmeabgabe richtig zu treffen? | eine Schicht | offen |
| C3 | Für die Gegenstrahlung der Atmosphäre nutzen wir die Formel von Swinbank (nur klarer Himmel). Wie sollten wir Bewölkung einfach berücksichtigen? | L↓ = 5,31·10⁻¹³·T⁶ | offen |

## D. Maßnahmen

| Nr. | Frage | Unser Wert | Status |
|---|---|---|---|
| D1 | Wie stark kühlen Sprühnebel-Anlagen auf Plätzen in der Praxis, und wie viel Wasser brauchen sie pro Stunde und Quadratmeter? | Fläche gilt 10–20 Uhr als feucht (m = 0,6), kein Wasserverbrauch | offen |
| D2 | Welche Albedo hat ein Cool Roof nach einigen Jahren Verschmutzung noch? | 0,70 (neu) | offen |
| D3 | Was kosten die Maßnahmen bei Ihnen ungefähr pro Quadratmeter? Unsere Richtwerte aus Ratgebern stehen in `docs/kosten.md`; am unsichersten sind Sonnensegel, heller Belag, Retentionsdach und Sprühnebel. | Werte aus `docs/kosten.md` | offen |
| D4 | Wie viel Sonne lassen Sonnensegel und Solardächer über Parkplätzen durch, und wie stark kühlen sie den Boden darunter? | Segel 20 %, Solardach 5 % | offen |

## E. Regenwasser

Betrifft `runoffCoefficient` in `src/data/materials.ts` und `src/model/water.ts`.

| Nr. | Frage | Unser Wert | Status |
|---|---|---|---|
| E1 | Welche Abflussbeiwerte sind bei einem Starkregen (z. B. 40 mm in einer Stunde) für Asphalt, Pflaster, Rasengitter, Rasen und extensives Gründach anzusetzen? | 1,0 / 0,9 / 0,4 / 0,2 / 0,5 | offen |
| E2 | Mit welcher Regenmenge rechnet unsere Stadt bei der Bemessung für Starkregen? | KOSTRA-DWD-2020, 1 Stunde, 30 Jahre | offen |
| E3 | Wie hoch ist die Niederschlagswassergebühr in Elmshorn, und welche Förderprogramme (Gründach, Entsiegelung, Bäume) gibt es für Schulen oder Privatleute? | 1 €/m²·a, Förderung nach Vorlage | offen |

## F. Überprüfung des Modells

| Nr. | Frage | Status |
|---|---|---|
| F1 | Gibt es für unsere Stadt oder Region Messungen der Oberflächentemperatur (Thermalbefliegung, Messfahrten, Stadtklimaanalyse), die wir zum Vergleich nutzen dürfen? | offen |
| F2 | Landsat liefert Oberflächentemperaturen mit 100 m Auflösung am Vormittag. Ist das ein sinnvoller Vergleich für ein Modell mit 10-m-Zellen, und worauf müssen wir achten? | offen |
| F3 | Welche Abweichung zwischen einem so einfachen Modell und Messungen gilt in der Stadtklimatologie als akzeptabel? | offen |
| F4 | Landsat misst an heißen Tagen um 10:30 Uhr auf grünen Flächen (NDVI über 0,5) 6 bis 13 °C mehr als die Lufttemperatur, unser Modell nur etwa so viel wie die Luft. Ist der Satellitenwert für Rasen und Baumkronen realistisch, oder ist er durch Mischpixel (100 m) und Emissionsgrad verfälscht? Siehe `docs/analyse-landsat.md`. | offen |
| F5 | Zwischen grünen und versiegelten Flächen misst Landsat nur 2 bis 5 °C Unterschied, unser Modell rechnet zwischen Rasen und dunklem Dach rund 20 °C. Wie groß ist der Unterschied bei 2 m Auflösung (z. B. Thermalkamera) wirklich? | offen |
