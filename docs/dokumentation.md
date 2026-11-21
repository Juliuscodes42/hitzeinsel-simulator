# Hitzeinsel-Simulator – Projektdokumentation

Jugend forscht 2027 · Fachgebiet: *[eintragen, z. B. Geo- und Raumwissenschaften]*

Stand: 21.11.2026 · App: https://juliuscodes42.github.io/hitzeinsel-simulator/ ·
Code: https://github.com/Juliuscodes42/hitzeinsel-simulator

> **Wozu dieses Dokument da ist.** Es beschreibt das ganze Projekt: was die App kann, wie
> sie rechnet, welche Probleme aufgetaucht sind, wie wir sie gelöst haben und warum. Es ist
> nach dem Aufbau einer Jugend-forscht-Arbeit gegliedert (Kurzfassung, Einleitung,
> Vorgehensweise, Ergebnisse, Diskussion, Fazit, Quellen, Unterstützung). Die schriftliche
> Arbeit darf höchstens 15 Seiten haben; dieses Dokument ist länger und dient als
> Materialsammlung, aus der ihr die Arbeit schreibt. Stellen in *[eckigen Klammern kursiv]*
> müsst ihr selbst ausfüllen.

---

## Inhalt

1. [Kurzfassung](#1-kurzfassung)
2. [Einleitung: Motivation und Fragestellung](#2-einleitung-motivation-und-fragestellung)
3. [Fachlicher Hintergrund](#3-fachlicher-hintergrund)
4. [Vorgehensweise, Materialien und Methoden](#4-vorgehensweise-materialien-und-methoden)
5. [Projektverlauf](#5-projektverlauf)
6. [Probleme und wie wir sie gelöst haben](#6-probleme-und-wie-wir-sie-gelöst-haben)
7. [Wichtige Entscheidungen und ihre Gründe](#7-wichtige-entscheidungen-und-ihre-gründe)
8. [Ergebnisse](#8-ergebnisse)
9. [Diskussion: Was das Modell kann und was nicht](#9-diskussion-was-das-modell-kann-und-was-nicht)
10. [Fazit und Ausblick](#10-fazit-und-ausblick)
11. [Quellen](#11-quellen)
12. [Unterstützungsleistungen](#12-unterstützungsleistungen)
13. [Anhang](#13-anhang)

---

## 1. Kurzfassung

Im Sommer werden Städte deutlich wärmer als ihr Umland, vor allem dort, wo Asphalt, Beton und
dunkle Dächer viel Sonne aufnehmen und kaum Pflanzen Wasser verdunsten. Gleichzeitig fließt
bei Starkregen das Wasser von versiegelten Flächen sofort in die Kanalisation. Wir haben eine
Web-App entwickelt, mit der man für einen echten Ort in Deutschland ausprobieren kann, wie
stark Maßnahmen wie Gründächer, Bäume, Entsiegelung oder Solardächer über Parkplätzen die
Oberflächen abkühlen, wie viel Regenwasser sie zurückhalten und was sie über 20 Jahre kosten.

Die App erkennt die Oberflächen eines 200 m × 200 m großen Ausschnitts selbst: Gebäude und
Straßen aus OpenStreetMap, alles andere aus den Farben des amtlichen Luftbilds, auf 2 m genau.
Für jede der 10.000 Flächen rechnet sie minütlich eine physikalische Energiebilanz
(Sonnenstrahlung, Wärmestrahlung, Wind, Verdunstung, Wärmespeicher) über einen ganzen Tag.
Das Wetter stellt sie automatisch auf einen typischen Hitzetag der Region ein, den Starkregen
auf die amtlichen Werte des Deutschen Wetterdienstes. Ein Optimierer schlägt vor, welche
Maßnahmen bei gegebenem Budget am meisten kühlen oder was ein Kühlungsziel mindestens kostet,
mit Pflege, Erneuerung, Förderung und Einsparungen.

Um zu prüfen, ob das Modell stimmt, haben wir es mit 12 Satellitenmessungen (Landsat) an vier
Orten verglichen. Die mittlere Abweichung liegt bei 4,1 °C; die Verteilung warmer und kühler
Bereiche trifft das Modell mit der Bilderkennung besser als mit OpenStreetMap allein
(Musterfehler 1,1 statt 1,4 °C). Die größten Abweichungen haben wir auf zwei Ursachen
zurückgeführt (zu kühle Grünflächen, fehlende Hochhausschatten) und als Fragen an Fachleute
formuliert, statt das Modell an die Messungen anzupassen.

---

## 2. Einleitung: Motivation und Fragestellung

### 2.1 Motivation

*[Hier eure eigene Geschichte: Warum interessiert euch das Thema? Zum Beispiel der Parkplatz
der Elsa-Brändström-Schule in Elmshorn im Sommer, Hitzetage in den letzten Jahren,
Überflutungen nach Gewittern.]*

Hitzeinseln sind ein Gesundheitsproblem: An heißen Tagen steigt die Zahl der Todesfälle, und
nachts kühlen versiegelte Viertel kaum ab. Städte planen deshalb „Schwammstädte“, die
Regenwasser speichern und verdunsten lassen, statt es abzuleiten. Welche Maßnahme an welchem
Ort wie viel bringt und was sie kostet, ist für Laien aber schwer abzuschätzen. Fachprogramme
wie ENVI-met sind teuer, langsam und brauchen Expertenwissen.

### 2.2 Fragestellung

> Wie stark können Maßnahmen der Schwammstadt die Oberflächentemperatur und den Regenabfluss
> eines echten Stadtausschnitts senken, und welche Kombination ist für ein gegebenes Budget
> am wirksamsten?

Daraus ergeben sich Teilfragen:

1. Lässt sich die Oberflächentemperatur mit einer einfachen, erklärbaren Energiebilanz so
   berechnen, dass sie zu Satellitenmessungen passt?
2. Kann eine App die Oberflächen eines Ortes aus frei verfügbaren Daten selbst erkennen, und
   wie genau?
3. Welche Maßnahmen kühlen am meisten pro Euro, wenn man Folgekosten und Förderung mitrechnet?

### 2.3 Ziel

Eine kostenlose Web-App, die im Browser läuft, ohne Anmeldung und ohne Server, für jeden Ort in
Deutschland. Sie soll für Schüler, Besucher und Jury verständlich sein und ihre Formeln offen
zeigen.

---

## 3. Fachlicher Hintergrund

### 3.1 Die städtische Wärmeinsel

Eine Oberfläche wird warm, wenn sie mehr Energie aufnimmt, als sie abgibt. Drei Eigenschaften
entscheiden:

- **Albedo α:** Wie viel Sonnenlicht wird zurückgeworfen? Asphalt 0,10, Cool Roof 0,70.
- **Verdunstung:** Pflanzen und Wasser verbrauchen Energie, um Wasser zu verdunsten. Das kühlt
  wie Schwitzen.
- **Wärmespeicher:** Asphalt und Beton speichern die Tageswärme und geben sie nachts ab. Das
  ist der nächtliche Hitzestau.

In Städten kommen Gebäude hinzu: Sie beschatten den Boden, bremsen den Wind und verdecken den
Himmel, sodass Wärmestrahlung schlechter entweicht.

### 3.2 Die Energiebilanz

Für jede Fläche gilt in jeder Minute:

    C · dT/dt = Q* − H − LE − G

| Zeichen | Bedeutung | Formel im Modell |
|---|---|---|
| Q* | Strahlungsbilanz | (1 − α)·(1 − s)·K↓ + ε·ψ·(L↓ − σ·T⁴) |
| H | fühlbare Wärme an die Luft (Konvektion) | h·(T − T_Luft), h = 5,7 + 3,8·u |
| LE | Verdunstung | m·(h/γ)·(e_s(T) − e_Luft) |
| G | Wärmeleitung in den Untergrund | k·(T − T_tief) |
| C | Wärmekapazität der obersten Schicht | aus Materialwerten |

K↓ ist die Sonnenstrahlung, L↓ die Wärmestrahlung der Atmosphäre (Swinbank), σ die
Stefan-Boltzmann-Konstante, s der Schattenanteil, ψ der sichtbare Himmel, u der Wind, m die
Feuchteverfügbarkeit (0 = trocken, 1 = Wasser), γ die Psychrometerkonstante und e_s der
Sättigungsdampfdruck (Magnus-Formel). Alle Formeln stehen mit Rechenbeispiel auch in der App
unter „Formeln und Annahmen“.

### 3.3 Schwammstadt

Eine Schwammstadt hält Regen dort, wo er fällt: Gründächer, Mulden, Rigolen (unterirdische
Speicher), Zisternen und entsiegelte Flächen nehmen Wasser auf. Das entlastet die Kanalisation
bei Starkregen und liefert Wasser für Pflanzen, die dann wieder kühlen.

Wie viel Regen abfließt, hängt vom **Abflussbeiwert** ab: Asphalt 1,0 (alles fließt ab),
Pflaster 0,9, Rasengitter 0,4, Rasen 0,2, Gründach 0,5, Retentions-Gründach 0,1.

---

## 4. Vorgehensweise, Materialien und Methoden

### 4.1 Werkzeuge

| Was | Womit | Warum |
|---|---|---|
| Programmiersprache | TypeScript | findet viele Fehler schon beim Schreiben |
| Oberfläche | React 19, Vite | verbreitet, schnell, kostenlos |
| Tests | Vitest | jede Formel wird automatisch geprüft |
| Veröffentlichung | GitHub Pages | kostenlos, aktualisiert sich bei jeder Änderung |
| Karte | Leaflet | freie Kartenbibliothek |

Alle Daten und Dienste sind kostenlos und brauchen keinen Schlüssel. Alles rechnet im Browser
des Besuchers; es gibt keinen eigenen Server.

### 4.2 Datenquellen

| Daten | Quelle | Lizenz |
|---|---|---|
| Gebäude, Straßen, Gewässer, Parkplätze, Bäume | OpenStreetMap (Overpass API) | ODbL |
| Luftbild für die Bilderkennung | Digitale Orthophotos der 16 Landesvermessungen, meist 20 cm pro Bildpunkt | CC BY 4.0, dl-de/by bzw. dl-de/zero |
| Wetter (heute, Archiv der letzten Sommer) | Open-Meteo (ERA5-Reanalyse) | CC BY 4.0 |
| Starkregen | KOSTRA-DWD-2020, Deutscher Wetterdienst | CC BY 4.0 |
| Oberflächentemperatur zur Überprüfung | Landsat 8/9, Band ST_B10 (USGS) | gemeinfrei |
| Materialwerte | Fachliteratur, vor allem Oke: *Boundary Layer Climates* | – |
| Kosten | 31 Quellen, siehe [kosten.md](kosten.md) | – |

### 4.3 Ablauf in der App

Die App führt in vier Schritten durch die Arbeit:

1. **Ort:** einen von vier Beispielorten wählen (Elmshorn, Köln Neumarkt, Berlin Potsdamer
   Platz, Freiburg Vauban) oder einen eigenen Ausschnitt auf der Karte suchen.
2. **Ausgangslage:** Die App zeigt die erkannten Flächen auf dem Luftbild und die Temperaturen
   heute. Hier kann man Flächen korrigieren, der Erkennung Beispiele beibringen, ihre
   Genauigkeit messen und das Wetter ändern.
3. **Maßnahmen:** Vorschlag berechnen lassen, Anteile mit Reglern einstellen oder einzelne
   Flächen mit dem Pinsel umbauen.
4. **Ergebnis:** Kennzahlen, 24-Stunden-Diagramm, Temperaturkarte, Vergleich mit
   Satellitenmessungen und die Formeln.

### 4.4 Das physikalische Modell

- Jede Fläche wird einzeln mit der Energiebilanz aus 3.2 berechnet, in Schritten von
  1 Minute. Damit die Wärmespeicher eingeschwungen sind, rechnet das Modell 6 gleiche Tage
  hintereinander und zeigt den letzten.
- **Gebäude in der Nähe:** Für jede Bodenfläche zählt das Modell, wie viel der Umgebung im
  Umkreis von 20 m bebaut ist (Bebauungsdichte d). Daraus folgen Himmelssicht
  ψ = 1 − 0,6·d, Wind u·(1 − 0,6·d) und Schatten s = 0,5·d. Das sind eigene Faustformeln
  (Fragen B1–B3 an Fachleute).
- **Bäume** haben eine dünne Blätterschicht mit wenig Wärmespeicher, Wasser einen sehr großen.
- **Überdachungen** (Solardach, Sonnensegel) lassen 5 % bzw. 20 % der Sonne durch und
  verdecken 70 % des Himmels.
- **Regenrückhalt:** Regen mal (1 − Abflussbeiwert) je Fläche, plus Speicher von Mulden,
  Rigolen, Zisternen und Retentionsdächern, bis sie voll sind.
- **Rechenzeit:** Gleiche Flächen werden nur einmal gerechnet (Zwischenspeicher nach Oberfläche,
  Schatten und Himmelssicht). So bleiben 10.000 Flächen flüssig.

### 4.5 Die Bilderkennung

Ziel: aus dem Luftbild für jede 2-m-Zelle die Oberfläche bestimmen.

1. **Luftbild laden:** Die App erkennt mit der Ortssuche (Nominatim), in welchem Bundesland der
   Ort liegt, und lädt dort das amtliche Luftbild (1000 × 1000 Bildpunkte für 200 m, also
   20 cm pro Bildpunkt).
2. **Merkmale je Zelle:** Aus den 10 × 10 Bildpunkten jeder Zelle berechnet sie Rot, Grün,
   Blau, Helligkeit, Unruhe (Streuung der Helligkeit) und den Grünindex
   ExG = (2·G − R − B) / (R + G + B) sowie den Anteil grüner Bildpunkte.
3. **Vorwissen aus OpenStreetMap:** Gebäude, Straßen und Gewässer kommen aus OpenStreetMap,
   weil ein dunkles Dach und Asphalt im Bild fast gleich aussehen.
4. **Regeln für den Rest:** grün → Pflanze; dunkel oder unruhig → Baum, sonst Rasen;
   rötlich-gelb → Sand oder Kies; dunkelgrau → Asphalt; hellgrau → Pflaster. Grüne Dächer
   gelten als Gründach, sehr helle als Cool Roof.
5. **Glätten:** Einzelne Ausreißerzellen werden an ihre Nachbarn angeglichen, Baumkronen über
   ein 5 × 5-Fenster zusammengefasst.
6. **Lernen aus Beispielen (k-nächste Nachbarn):** Das Team klickt Stellen an und sagt, was
   dort liegt. Jede Zelle bekommt dann die Oberfläche der 5 Beispiele mit den ähnlichsten
   Merkmalen. Das Lernen entscheidet nur zwischen Oberflächen, für die es Beispiele gibt.
7. **Genauigkeit messen:** Prüfpunkte werden getrennt gesetzt und fließen nie ins Lernen ein.
   Ab 10 Prüfpunkten zeigt die App die Trefferquote von OpenStreetMap allein, den Regeln und
   dem Lernen sowie eine Verwechslungstabelle.

### 4.6 Wetter je Region

- **Typischer Hitzetag:** Für jeden der letzten 10 Sommer (Juni bis August) nimmt die App die
  3 heißesten Tage am Ort, zusammen 30 Tage. Ihr Mittel ergibt Höchst- und Tiefsttemperatur,
  Sonne, Wind und Luftfeuchte.
- **Starkregen:** Regenmenge in 60 Minuten, wie sie statistisch alle 5, 30 oder 100 Jahre
  vorkommt, aus dem 5-km-Raster von KOSTRA-DWD-2020. Die Umrechnung der Koordinaten in das
  Kartennetz des DWD (ETRS89-LAEA) haben wir selbst programmiert und mit der Bibliothek proj4
  geprüft.
- Alle Regler bleiben aufklappbar, um Szenarien wie „Klimawandel +3 °C“ durchzuspielen.

### 4.7 Maßnahmen und Kosten

13 Maßnahmen, jede mit Wirkung im Modell, Baukosten mit Spannweite, Pflegekosten pro Jahr,
Lebensdauer und einer Angabe, wie verlässlich die Kosten belegt sind:

| Bereich | Maßnahmen |
|---|---|
| Dächer | Gründach, Retentions-Gründach, Cool Roof, Zisterne |
| Höfe, Plätze, Parkplätze | Laubbäume, Baum mit Rigole, Entsiegelung, Versickerungsmulde, Wasserbecken, heller Belag, Solardach über Parkplatz, Sonnensegel |
| Straßen und Plätze | Sprühnebel |

Kosten über einen Zeitraum (Standard 20 Jahre), je Quadratmeter:

    Kosten = Bau · (1 − Förderquote) · Anzahl Bauten + Pflege · Jahre − Einsparung · Jahre

- **Anzahl Bauten:** Ein Cool-Roof-Anstrich hält etwa 10 Jahre und wird in 20 Jahren zweimal
  bezahlt.
- **Einsparungen:** Strom aus Solardächern (Annahme 0,18 kWp/m², 950 kWh/kWp, 10 ct/kWh) und
  weniger Niederschlagswassergebühr (1 €/m² und Jahr mal weniger Abfluss).
- **Förderung:** drei Vorlagen (ohne, Stadt mit KfW 444, privat mit Gründach-Zuschuss); jede
  Quote ist einzeln änderbar.
- Zinsen und Preissteigerung sind nicht eingerechnet.

### 4.8 Der Optimierer

Für jede Fläche und jede passende Maßnahme berechnet er die Kühlung und die Kosten. Dann wählt
er nach dem besten Verhältnis von Kühlung zu Kosten aus, bis das Budget aufgebraucht ist
(Greedy-Verfahren für das Rucksackproblem mit Auswahlgruppen: je Fläche höchstens eine
Maßnahme). Zwei Fragen sind möglich:

- **Budget:** Was bringt mein Geld am meisten?
- **Ziel:** Was kostet zum Beispiel −1 °C mindestens? Er sagt auch, wie viel Kühlung höchstens
  möglich ist.

Wählbar ist, wofür optimiert wird: Mittel über 24 Stunden, Nachmittagshitze (15 Uhr) oder
nächtlicher Hitzestau (4 Uhr).

### 4.9 Überprüfung mit Satellitenmessungen

Landsat 8 und 9 messen aus dem All die Oberflächentemperatur mit 100 m Auflösung, gegen
10:50 Uhr Sonnenzeit. Wir haben je Ort drei wolkenfreie Aufnahmen heißer Sommertage
(2023–2026) ausgewählt, zusammen 12. Für jeden Tag rechnet das Modell mit dem echten Wetter
dieses Tages. Verglichen werden:

- **Mittlere Abweichung:** Betrag von Modell minus Messung, gemittelt.
- **Richtung:** Ist das Modell im Mittel zu warm oder zu kalt?
- **Musterfehler:** Der Ausschnitt wird in vier Viertel geteilt. Von jedem Viertel wird der
  Mittelwert des Ausschnitts abgezogen. So zählt nur, ob warme und kühle Bereiche richtig
  verteilt sind, nicht ob alles zu warm ist.
- **Wärmstes Viertel getroffen:** in wie vielen Aufnahmen das Modell das wärmste Viertel
  richtig findet. Zufall wäre 3 von 12.

### 4.10 Qualitätssicherung

- 116 automatische Tests, formuliert als deutsche Sätze, zum Beispiel „Rasen bleibt mittags
  mindestens 10 K kühler als Asphalt“ oder „mehr Speicher als Regen hält höchstens den ganzen
  Regen zurück“.
- Jede Änderung wird vor der Veröffentlichung mit Lint, Tests und Build geprüft.
- Neue Funktionen haben wir zusätzlich im Browser durchgeklickt.
- **Fragen an Fachleute:** Alle Werte, die wir schätzen mussten, stehen mit Code-Stelle im
  [Fragenkatalog](expertenfragen/fragenkatalog.md) (23 Fragen in sechs Themen), dazu eine
  E-Mail-Vorlage.

---

## 5. Projektverlauf

### Version 1 (13. und 14.11.2026)

| Schritt | Was entstanden ist | Prüfung |
|---|---|---|
| 1 | Projektgerüst, öffentliches Repository, automatische Veröffentlichung | Seite erreichbar |
| 2 | Physik-Modell mit 25 Tests | Asphalt mittags heißer als Rasen, nachts wärmer |
| 3 | Stadtraster 20 × 20 mit Reglern, 5 Maßnahmen, Pinsel; Fragenkatalog | Regler ändern Farben sofort |
| 4 | 24-Stunden-Diagramm, Regenrückhalt, Albedo, Formel-Fenster | „versiegelt“ liegt nachts über „begrünt“ |
| 5 | Echte Orte: Ortssuche, Luftbild, Raster aus OpenStreetMap, eigenes Drohnenbild | Schulgebäude liegen passgenau auf dem Luftbild |
| 6 | Wetter von Open-Meteo: heute und heißester Sommertag | Werte wie in einer Wetter-App |
| 7 | Optimierer mit Budget | kühlt mindestens 20 % stärker als zufällige Verteilungen |
| 8 | Vier Beispielorte ohne Internet, Vergleich mit Landsat, Quellenliste | Abweichung steht als Zahl in der App |
| – | Korrekturen speichern, Luftbild-Ansicht, geführter Ablauf in vier Schritten | im Browser durchgeklickt |

### Version 2 (21.11.2026)

Nach Version 1 haben wir die App kritisch angesehen und sechs Änderungen beschlossen
(Ideenpapier: [ideas/hitzeinsel-v2.md](ideas/hitzeinsel-v2.md)):

| Schritt | Was entstanden ist |
|---|---|
| 1 | Unterschiede in °C; Meer, Watt, Flüsse und Strände richtig erkennen |
| 2 | Wetter je Region: typischer Hitzetag und Starkregen aus KOSTRA-DWD-2020 |
| 3 | Bilderkennung: amtliche Luftbilder, 2-m-Zellen ohne Gitter, Lernen aus Beispielpunkten, Genauigkeit messen |
| – | Landsat-Vergleich mit beiden Rastern, Ursachenanalyse ([analyse-landsat.md](analyse-landsat.md)) |
| 4 | 13 Maßnahmen statt 5 mit recherchierten Kosten ([kosten.md](kosten.md)) |
| 5 | Optimierer mit Kosten über Jahre, Förderung, Einsparungen und Zielvorgabe |

---

## 6. Probleme und wie wir sie gelöst haben

Hier stehen die wichtigsten Probleme in der Reihenfolge, in der sie aufgetaucht sind. Jedes
Problem hat uns etwas über Daten, Physik oder Bedienung gelehrt.

### 6.1 Daten und Erkennung

**Problem: OpenStreetMap kennt nicht jede Fläche.**
- *Beobachtung:* An der Elsa-Brändström-Schule waren 39 % der Zellen geschätzt. OpenStreetMap
  kennt dort nur „Schulgelände“, das Programm nahm pauschal Pflaster an, obwohl auf dem Luftbild
  Bäume stehen. In Freiburg wurden 214 von 400 Zellen zu „Rasen (geschätzt)“, obwohl Vauban
  dicht bebaut ist.
- *Erste Lösung (Version 1):* Flächen mit dem Pinsel nach dem Luftbild korrigieren und
  speichern.
- *Endgültige Lösung (Version 2):* die Bilderkennung aus 4.5.
- *Warum:* Von Hand korrigieren ist mühsam und hängt davon ab, wer korrigiert. Die
  Bilderkennung ist für jeden Ort gleich und ihre Genauigkeit lässt sich messen.

**Problem: Das Meer wurde als Rasen angezeigt.**
- *Ursache:* OpenStreetMap speichert das Meer nicht als Fläche, sondern nur als Küstenlinie.
  Unser Programm machte aus allem, was es nicht zuordnen konnte, „Rasen (geschätzt)“. Dasselbe
  passierte mit großen Seen, deren Umriss aus mehreren Stücken besteht.
- *Lösung:* Die App wertet die Küstenlinie aus. Nach den Regeln von OpenStreetMap liegt das Land
  links der Linie, das Meer rechts. Umrisse aus mehreren Stücken werden zusammengesetzt; Bäche
  und Gräben, die nur als Linie eingetragen sind, bekommen eine passende Breite. Watt zählt als
  Wasser, Strand als offener Boden.
- *Geprüft:* mit 7 Tests (Landzunge, Küste aus mehreren Stücken) und am Ostseestrand in
  Schönhagen.

**Problem: 10-m-Kästchen sind zu grob, und das Gitter stört.**
- *Beobachtung:* Ein Baum, ein schmaler Weg oder eine Parkplatzreihe verschwinden in einer
  10-m-Zelle. Das Gitter verdeckte das Luftbild.
- *Lösung:* 2-m-Zellen (100 × 100 statt 20 × 20), gezeichnet auf einer Zeichenfläche (Canvas)
  ohne Linien.
- *Neues Problem dabei:* Bei halber Deckkraft überlappten sich benachbarte Rechtecke um
  Bruchteile eines Bildpunkts, und es entstanden dunkle Linien. Jetzt werden alle Rechtecke auf
  ganze Bildpunkte gerundet, ohne Lücke und ohne Überlappung.

**Problem: Wir durften das Luftbild vermutlich gar nicht auswerten.**
- *Ursache:* Das Luftbild kam zuerst von Esri World Imagery. Deren Bedingungen erlauben die
  Bilddaten nur „mit den Produkten, für die Esri sie bereitstellt“. Bildpunkte selbst auszuwerten
  ist damit sehr wahrscheinlich nicht erlaubt.
- *Lösung:* Die App nutzt jetzt die amtlichen Luftbilder (DOP) der 16 Landesvermessungen. Alle
  sind kostenlos und offen lizenziert. Wir haben alle 16 Dienste getestet. Esri zeigt nur noch die
  Karte in der Ortssuche an.
- *Warum das wichtig ist:* Eine Jury fragt nach Lizenzen. Die amtlichen Bilder sind außerdem
  meist schärfer und aktueller.
- *Rest-Problem:* Vier Länder (SH, NW, BY, ST) erlauben das Auslesen der Bildpunkte nur von
  Seiten mit `https`. Auf dem eigenen Rechner (`http://localhost`) fehlt dort das Bild; auf der
  veröffentlichten Seite funktioniert es.

**Problem: Das Lernen machte Bäume zu Pflaster.**
- *Beobachtung:* Mit Beispielen nur für Asphalt und Beton ordnete das Lernverfahren jede Zelle
  einer dieser beiden Klassen zu, auch Bäume.
- *Ursache:* k-nächste Nachbarn wählt immer unter den Klassen, die es kennt.
- *Lösung:* Das Lernen entscheidet nur zwischen Oberflächen, für die es Beispiele gibt, oder wenn
  ein Beispiel sehr ähnlich ist. Sonst bleibt die Regel-Erkennung. Dafür gibt es einen Test.

**Problem: Regler-Maßnahmen sahen aus wie Salz und Pfeffer.**
- *Beobachtung:* „30 % Gründach“ verteilte sich bei 2-m-Zellen auf einzelne verstreute
  Zellen.
- *Lösung:* Maßnahmen werden in 10-m-Flecken vergeben. Das sieht aus wie echte Umbauten und
  ist physikalisch sinnvoller, weil eine Maßnahme selten nur 4 m² groß ist.

### 6.2 Wetter

**Problem: Ein einzelner „heißester Tag“ ist Zufall.**
- *Beobachtung:* In Version 1 konnte man den heißesten Tag des letzten Sommers laden. Ein
  einzelner Tag kann Wolken oder starken Wind haben (Elmshorn, 30.07.2026: 36,6 °C, aber nur
  621 W/m² Sonne mittags).
- *Lösung:* der typische Hitzetag aus 30 Tagen in 10 Sommern.
- *Warum:* So wird der Vergleich zwischen Orten fair, und das Ergebnis hängt nicht von einem
  einzelnen Jahr ab.

**Problem: Open-Meteo unterschätzt kurze Gewitter.**
- *Ursache:* Wettermodelle mitteln über große Flächen und Stunden.
- *Lösung:* amtliche Starkregenwerte KOSTRA-DWD-2020, mit denen auch Städte ihre Kanäle bemessen.
  Die Daten für ganz Deutschland sind gepackt nur 11 KB groß.

**Problem: Wolken am Nachmittag verfälschten den Satellitenvergleich.**
- *Beobachtung:* Köln am 09.07.2023 war im Modell fast 10 °C zu kalt.
- *Ursache:* Das Modell berechnete die Durchlässigkeit der Atmosphäre aus der Sonne des ganzen
  Tages (τ = 0,46). Der Vormittag war aber klar (τ = 0,61), nachmittags kamen Wolken. Landsat
  misst am Vormittag.
- *Lösung:* Für den Vergleich zählt nur die Sonne bis zum Überflug. Köln verbesserte sich von
  −9,6 auf −5,5 °C, die mittlere Abweichung beider Raster sank um 0,7 °C.
- *Warum das keine „Anpassung an die Messung“ ist:* Wir haben keinen Modellwert verändert,
  sondern einen Fehler in den Eingangsdaten behoben. Das Modell bekommt jetzt das Wetter, das
  zur Messzeit wirklich herrschte.

### 6.3 Physik und Darstellung

**Problem: „Kelvin ist falsch.“**
- *Klärung:* Für Temperaturunterschiede ist K physikalisch richtig, und 1 K Unterschied ist
  genau 1 °C Unterschied. Für Besucher ist „−3,1 °C“ aber verständlicher.
- *Lösung:* Überall stehen jetzt °C. Im Formel-Fenster steht, dass in den Formeln mit Kelvin
  gerechnet wird. Einheiten wie W/(m²·K⁴) bleiben, weil sie dort richtig sind.

**Problem: Albedo ändert sich bei Begrünung kaum.**
- *Beobachtung:* Mit vielen Bäumen und Rasen blieb die mittlere Albedo bei 0,17.
- *Klärung:* Kein Fehler. Pflanzen sind kaum heller als Pflaster; sie kühlen durch Verdunstung.
  Nur Cool Roofs heben die Albedo deutlich. Das ist ein guter Punkt für die Jury.

### 6.4 Bedienung

**Problem: Die Seite war unübersichtlich.**
- *Beobachtung:* Alle Regler standen gleichzeitig in einer langen Spalte.
- *Lösung:* der geführte Ablauf in vier Schritten (Ort → Ausgangslage → Maßnahmen →
  Ergebnis). Selten gebrauchte Einstellungen sind zugeklappt.

**Problem: Korrekturen und Umbauten wurden vermischt.**
- *Beobachtung:* Ein übernommener Vorschlag des Optimierers erschien in Schritt 2 als
  „1500 gemalte Zellen“, also als Korrektur des Ist-Zustands.
- *Lösung:* Korrekturen (Schritt 2) ändern den Ist-Zustand, Umbauten (Schritt 3) den
  Soll-Zustand. Beides wird getrennt gespeichert.

**Problem: Die OpenStreetMap-Server sind oft überlastet.**
- *Beobachtung:* Ein Ausschnitt brauchte im Test einmal über 40 Sekunden.
- *Lösung:* Die App fragt drei Server zeitversetzt und speichert jeden geladenen Ausschnitt im
  Browser (danach in wenigen Millisekunden da). Die vier Beispielorte sind fest eingebaut und
  laufen auch ohne Internet, wichtig für den Wettbewerbsstand.

### 6.5 Kosten

**Problem: Die ersten Kosten waren Schätzungen und bestimmten das Ergebnis.**
- *Beobachtung:* In Version 1 schlug der Optimierer tagsüber fast nur Cool Roofs vor, vor allem
  weil wir sie mit 25 €/m² angesetzt hatten.
- *Lösung:* Kosten für alle 13 Maßnahmen recherchiert, mit Spannweite und Verlässlichkeit
  („belegt“, „grob“, „Annahme“); dazu Pflege, Lebensdauer und Förderung.
- *Warum:* Ein Cool Roof ist billig, muss aber alle 10 Jahre erneuert werden; ein Gründach
  kostet mehr, hält aber 40 Jahre und wird gefördert. Erst über 20 Jahre gerechnet sieht man,
  was wirklich günstig ist.

**Problem: Das Solardach bekam eine falsche Einsparung.**
- *Beobachtung:* Der Optimierer rechnete dem Solardach eine gesparte Regenwassergebühr an, als
  würde die Fläche darunter entsiegelt.
- *Lösung:* Die Einsparung wird jetzt aus dem Abfluss vor und nach dem Umbau berechnet; unter
  einem Solardach bleibt der Asphalt, also keine Gebührenersparnis. Ein Test sichert das ab.

---

## 7. Wichtige Entscheidungen und ihre Gründe

Für jede größere Entscheidung haben wir Alternativen abgewogen.

### E1: Eigenes Physik-Modell statt Fachprogramm

- **Entscheidung:** eine eigene, vereinfachte Energiebilanz je Fläche.
- **Alternativen:** ENVI-met oder ähnliche Strömungsmodelle.
- **Warum:** Fachprogramme sind teuer, rechnen Stunden und laufen nicht im Browser. Unser
  Modell rechnet in Sekundenbruchteilen und jede Formel ist erklärbar.
- **Preis:** kein Wärmeaustausch zwischen Nachbarflächen, keine Gebäudehöhen, kein
  sonnenstandabhängiger Schatten. Das Modell eignet sich für Vergleiche (vorher/nachher), nicht
  für gradgenaue Vorhersagen.

### E2: Bilderkennung mit Regeln und eigenem Lernen statt fertiger KI

- **Entscheidung:** Farbregeln plus k-nächste Nachbarn aus selbst gesetzten Beispielen.
- **Alternativen:**

  | Weg | Vorteil | Nachteil |
  |---|---|---|
  | Fertiges KI-Segmentierungsmodell | erkennt viel | groß, nicht erklärbar, für fremde Bilder trainiert |
  | Amtliche Versiegelungskarten | genau | je Bundesland anders, oft nur 10 m fein |
  | Nur OpenStreetMap | einfach | große Lücken (siehe 6.1) |

- **Warum:** Jeder Schritt lässt sich der Jury erklären, die App bleibt klein, und die
  Genauigkeit wird mit eigenen Prüfpunkten gemessen. Das ist ein eigener Forschungsteil.

### E3: Amtliche Luftbilder statt Esri

- **Entscheidung:** DOP der 16 Länder.
- **Warum:** offene Lizenzen, schärfer, aktueller (siehe 6.1). Im Ideenpapier hatten wir
  „Daten je Bundesland einbinden“ zuerst als zu aufwendig ausgeschlossen. Am Ende war es eine
  Liste mit 16 Adressen und hat das Lizenzproblem gelöst.

### E4: Typischer Hitzetag statt eines bestimmten Tags

- **Warum:** vergleichbar zwischen Orten, unabhängig von einem einzelnen Jahr (siehe 6.2).
  Die Regler bleiben für eigene Szenarien.

### E5: Das Modell wird nicht an Landsat angepasst

- **Entscheidung:** Auch wenn das Modell in Freiburg 7 bis 10 °C zu kalt ist, ändern wir keine
  Werte, nur damit die Zahlen besser aussehen.
- **Warum:** Würden wir die Werte an die vier Orte anpassen, bewiese der Vergleich nichts
  mehr. Stattdessen haben wir untersucht, woran es liegt (Kapitel 8.3), probeweise Werte
  geändert, um die Empfindlichkeit zu verstehen, und die offenen Werte als Fragen an Fachleute
  formuliert (A1, A3, F4, F5). Ändern wollen wir sie erst, wenn Literatur oder Fachleute einen
  besseren Wert begründen.
- **Gleiche Regel für Korrekturen:** Flächen nur nach dem Luftbild korrigieren, nie so lange,
  bis die Abweichung klein ist.

### E6: Kosten über 20 Jahre mit Förderung, Ziel statt nur Budget

- **Warum:** Städte entscheiden über Jahrzehnte und mit Fördergeld. Die Frage „Was kostet
  −1 °C mindestens?“ ist für eine Stadt oft wichtiger als „Was bringen 150.000 €?“.
- **Förderung als Vorlagen:** Förderprogramme sind von Stadt zu Stadt verschieden. Wir haben
  drei allgemeine Vorlagen gebaut, statt die Programme einer Stadt fest einzubauen.

### E7: Keine KI für Erklärtexte

- **Warum:** Die Vorschläge rechnet der eigene Optimierer aus; das ist reproduzierbar und
  Eigenleistung. Ein Sprachmodell würde nur umformulieren. Die Erklärtexte entstehen aus
  Textbausteinen.

### E8: Bewusst nicht gemacht

- **3D-Schatten und Luftströmung (Kaltluft):** Aufgabe von Fachprogrammen.
- **Fassadenbegrünung:** Das 2D-Modell kennt keine Wände; die Wirkung wäre geraten.

---

## 8. Ergebnisse

### 8.1 Temperaturen der Oberflächen

Standardtag Elmshorn (Luft 17 bis 31 °C, Wind 2 m/s, klarer Himmel), freie Fläche ohne
Gebäude in der Nähe:

| Oberfläche | Höchstwert | 4 Uhr nachts |
|---|---|---|
| Dach (dunkel) | 59,8 °C | 13,5 °C |
| Asphalt | 53,3 °C | 20,1 °C |
| Beton / Pflaster | 46,2 °C | 22,1 °C |
| Heller Belag | 45,8 °C | 19,2 °C |
| Rasengitter (entsiegelt) | 38,9 °C | 18,3 °C |
| Cool Roof | 38,2 °C | 13,6 °C |
| Gründach | 38,1 °C | 14,3 °C |
| Retentions-Gründach | 35,2 °C | 15,1 °C |
| Rasen | 34,2 °C | 17,1 °C |
| Laubbaum | 32,8 °C | 15,4 °C |
| Wasser | 25,6 °C | 22,6 °C |

Was man daran sieht:

- **Hitzestau:** Asphalt und Beton sind um 4 Uhr 3 bis 5 °C wärmer als Rasen, weil sie
  Tageswärme speichern. Das ergibt sich aus der Rechnung selbst, wir haben es nicht vorgegeben.
- **Dächer kühlen nachts stark ab**, weil sie dünn sind und frei zum Himmel abstrahlen.
- **Wasser** ist mittags am kühlsten, nachts aber eine der wärmsten Flächen.

### 8.2 Wetter der Beispielorte

| Ort | Typischer Hitzetag: Höchst | Nacht |
|---|---|---|
| Elmshorn | 31,7 °C | 17,1 °C |
| Freiburg | 33,8 °C | 19,0 °C |
| Köln | 34,7 °C | 19,5 °C |
| Berlin | 34,8 °C | 19,7 °C |

Starkregen (60 Minuten, KOSTRA-DWD-2020): Berlin 38 mm (alle 30 Jahre) bzw. 49 mm (alle
100 Jahre).

### 8.3 Vergleich mit Satellitenmessungen

12 Landsat-Aufnahmen an vier Orten:

| Kennzahl | Version 1 (OSM, 10 m) | OSM, 10 m, mit Morgensonne | Bilderkennung, 2 m, mit Morgensonne |
|---|---|---|---|
| Mittlere Abweichung (Betrag) | 4,9 °C | 4,2 °C | 4,1 °C |
| Richtung | −0,3 °C | ±0,0 °C | −1,2 °C |
| Musterfehler | 1,4 °C | 1,4 °C | 1,1 °C |
| Wärmstes Viertel getroffen | 3 von 12 | 3 von 12 | 4 von 12 |

Nach Orten (Bilderkennung): Elmshorn +0,7 bis +2,4 °C, Köln −5,5 bis +1,3 °C, Berlin
+3,3 bis +4,8 °C, Freiburg −7,0 bis −10,0 °C.

**Deutung:**

1. Die Bilderkennung verbessert vor allem die **Verteilung** warmer und kühler Bereiche
   (Musterfehler 1,4 → 1,1 °C). In Elmshorn sinkt die Abweichung deutlich.
2. Die großen Abweichungen kommen **nicht von den Flächen, sondern aus der Physik**:
   - **Grünflächen sind im Modell zu kühl.** Landsat misst auf grünen Flächen (NDVI über 0,5)
     am Vormittag 6 bis 13 °C mehr als die Lufttemperatur, das Modell etwa Lufttemperatur.
     Zwischen grünen und versiegelten Flächen misst Landsat nur 2 bis 5 °C Unterschied, das
     Modell über 20 °C. Ein Teil davon ist Messtechnik: Ein 100-m-Bildpunkt mischt Dächer und
     Bäume.
   - **In Berlin fehlen Hochhausschatten.** Das Modell kennt keine Gebäudehöhen.
3. Keine einzelne Annahme erklärt die Abweichung. Trockener Rasen verbessert Freiburg,
   verschlechtert aber Elmshorn (Details in [analyse-landsat.md](analyse-landsat.md)).

### 8.4 Genauigkeit der Bilderkennung

*[Noch offen: Hier kommen eure Messwerte hin. Setzt je Beispielort etwa 100 Prüfpunkte nach dem
Luftbild (Schritt „Ausgangslage“ → „Erkennung prüfen und verbessern“) und übernehmt die Tabelle
„OSM / Regeln / gelernt“ mit Trefferquote und Verwechslungen. Ziel aus dem Ideenpapier: etwa
80 % richtig.]*

Was wir schon sehen, ohne Prüfpunkte:

- **Köln:** Der Platz in der Mitte ist gepflastert; OpenStreetMap hielt ihn für Rasen.
- **Freiburg:** Die Gründächer in Vauban und das Rasengleis der Straßenbahn werden erkannt.
- **Elmshorn:** versiegelt sind 40 % statt der vorher geschätzten 63 %.

### 8.5 Optimierer und Kosten

Beispiel Berlin Potsdamer Platz, typischer Hitzetag, Ziel „Mittel über 24 Stunden“, Kosten über
20 Jahre:

| Frage | Ergebnis |
|---|---|
| Budget 150.000 €, ohne Förderung | −0,67 °C |
| Was kostet −1 °C, ohne Förderung? | 224.180 €, vor allem Gründächer |
| Was kostet −1 °C, Vorlage „Stadt mit KfW 444“? | 62.424 €, vor allem Versickerungsmulden |
| Größte mögliche Kühlung | −9,2 °C |

**Erkenntnis:** Die Förderung verändert nicht nur den Preis, sondern auch, welche Maßnahmen am
besten sind. Mulden werden stark gefördert und sparen Regenwassergebühr; ohne Förderung sind
Gründächer günstiger pro Grad.

Beim Solardach über dem Parkplatz zeigt sich der Wert der Lebenszykluskosten: Es kostet beim
Bau rund 400 €/m², spart in 20 Jahren aber etwa 340 €/m² Strom (bei 10 ct/kWh), unterm Strich
also rund 120 €/m².

---

## 9. Diskussion: Was das Modell kann und was nicht

### 9.1 Stärken

- Läuft für jeden Ort in Deutschland, kostenlos und ohne Anmeldung im Browser.
- Jede Formel und jeder Wert ist offen gelegt und mit Quelle oder als Annahme gekennzeichnet.
- Erkennt Flächen auf 2 m genau und misst die eigene Genauigkeit.
- Wurde an echten Messungen geprüft, und die Abweichungen sind erklärt statt versteckt.
- Rechnet Kosten so, wie eine Stadt entscheidet: über Jahre, mit Förderung.

### 9.2 Grenzen

| Grenze | Folge | Was wir tun |
|---|---|---|
| Flächen tauschen keine Wärme über die Luft aus | ein Baum kühlt nicht den Nachbarn | Frage B4 |
| Keine Gebäudehöhen, Schatten nur pauschal | hohe Bebauung zu warm (Berlin) | Frage B3 |
| Feuchte der Grünflächen geschätzt | Grünflächen vermutlich zu kühl | Fragen A1–A3, F4 |
| Oberflächentemperatur ≠ gefühlte Temperatur | ein kühles Dach hilft dem Fußgänger kaum | in der App erklärt |
| Wetterdaten über ca. 10 km gemittelt | Stadtmitte an Hitzetagen 1–2 °C wärmer | Hinweis in der App |
| Speicher fangen den Abfluss der ganzen Umgebung auf | in Wirklichkeit muss das Wasser hingeleitet werden | in kosten.md erklärt |
| Kosten sind Richtwerte, einige nur Annahmen | Optimierer-Ergebnis hängt davon ab | Spannweiten, Frage D3 |
| Keine Zinsen und Preissteigerung | Langlebiges eher etwas zu teuer | in der App erklärt |
| Förderquote KfW 444 widersprüchlich (KfW 80 %, Ministerium „bis zu 50 %“) | Vorlage evtl. zu günstig | in kosten.md vermerkt |
| Nur Städte können KfW 444 beantragen | gilt nicht für Schule oder Privatleute | Vorlage „Privat“ |

### 9.3 Fehlerquellen beim Satellitenvergleich

- Landsat misst mit 100 m Auflösung; ein Bildpunkt mischt viele Oberflächen.
- Luftbild und Landsat-Aufnahme stammen nicht vom selben Tag.
- Das Wetter kommt aus einer Reanalyse, nicht von einer Station am Ort.
- Vier Orte und 12 Aufnahmen sind eine kleine Stichprobe.

---

## 10. Fazit und Ausblick

### 10.1 Antworten auf die Teilfragen

1. **Energiebilanz und Messung:** Ein einfaches Modell trifft die Größenordnung und die
   Unterschiede zwischen Oberflächen. Gegenüber Landsat weicht es im Mittel um rund 4 °C ab;
   die Ursachen kennen wir (Grünflächen, Gebäudeschatten). Für Vergleiche „vorher/nachher“ ist
   es brauchbar, für gradgenaue Vorhersagen nicht.
2. **Flächenerkennung:** Mit amtlichen Luftbildern, Farbregeln und eigenem Lernen erkennt die
   App Flächen auf 2 m. Die Verteilung warmer und kühler Bereiche wird dadurch messbar besser.
   *[Trefferquote aus 8.4 ergänzen.]*
3. **Kühlung pro Euro:** Welche Maßnahme am günstigsten ist, hängt stark von Förderung und
   Betrachtungszeitraum ab. Billige, kurzlebige Maßnahmen (Cool Roof) verlieren über 20 Jahre an
   Vorsprung, geförderte Maßnahmen zur Regenwasserversickerung gewinnen.

### 10.2 Was noch zu tun ist

- [ ] Je Beispielort etwa 100 Prüfpunkte setzen und die Genauigkeit messen (8.4).
- [ ] E-Mails an Fachleute schicken (Vorlage in [expertenfragen](expertenfragen/README.md));
      offen sind vor allem A1, A3, B3, D3, D4, E3, F4, F5.
- [ ] Quellen mit „prüfen“ in [quellen.md](quellen.md) am Original nachschlagen.
- [ ] Niederschlagswassergebühr und Förderprogramme in Elmshorn erfragen (E3).
- [ ] Die App auf Handy-Breite durchklicken.

### 10.3 Ideen für später

- Eigene Messungen mit einer Wärmebildkamera auf dem Schulparkplatz, vorher und nachher.
- Gebäudehöhen aus OpenStreetMap für sonnenstandabhängigen Schatten.
- Wärmeaustausch zwischen Nachbarflächen über die Luft.
- Ein Ziel „nur Bodenflächen“ im Optimierer (wo Menschen sich aufhalten).

---

## 11. Quellen

Alle Quellen mit Verwendungsstelle stehen in [quellen.md](quellen.md), die Kostenquellen
(31 Stück) in [kosten.md](kosten.md). Die wichtigsten:

- T. R. Oke: *Boundary Layer Climates*, 2. Auflage, Routledge, 1987.
- T. R. Oke, G. Mills, A. Christen, J. A. Voogt: *Urban Climates*, Cambridge University Press,
  2017.
- W. C. Swinbank: Long-wave radiation from clear skies. *QJRMS* 89, 1963.
- Deutscher Wetterdienst: KOSTRA-DWD-2020.
- U.S. Geological Survey: Landsat 8/9 Collection 2 Level-2 Surface Temperature.
- OpenStreetMap-Mitwirkende; Open-Meteo.com; Digitale Orthophotos der Landesvermessungen.

---

## 12. Unterstützungsleistungen

Jugend forscht verlangt, dass ihr angebt, wer euch wie geholfen hat.

- **KI-Assistent:** Der Programmcode, die Recherche zu Kosten und Datenquellen und Entwürfe der
  Dokumentation sind mit dem KI-Assistenten Claude (Anthropic) entstanden. *[Beschreibt hier
  ehrlich, was ihr selbst gemacht habt: zum Beispiel Idee und Fragestellung, Auswahl der Orte,
  Entscheidungen bei jeder Abwägung, Prüfen im Browser, Prüfpunkte setzen, Kontakt zu
  Fachleuten, Deutung der Ergebnisse.]*
- **Fachleute:** *[Wer hat geantwortet, und was hat sich dadurch geändert?]*
- **Betreuung:** *[Lehrkraft, Schule]*
- **Daten:** siehe Quellen; alle frei nutzbar.

---

## 13. Anhang

### 13.1 Wo was im Code steht

| Ordner / Datei | Inhalt |
|---|---|
| `src/model/energyBalance.ts` | Energiebilanz je Fläche |
| `src/model/atmosphere.ts` | Sonnenstand, Strahlung, Luftfeuchte |
| `src/model/grid.ts` | Raster, Bebauungsdichte, Schatten |
| `src/model/water.ts` | Regenrückhalt |
| `src/model/osm.ts` | OpenStreetMap in Raster umwandeln, Küstenlinie |
| `src/model/recognition.ts` | Bilderkennung nach Regeln |
| `src/model/learning.ts` | Lernen aus Beispielen, Genauigkeit |
| `src/model/heatDay.ts`, `heavyRain.ts` | typischer Hitzetag, Starkregen |
| `src/model/optimizer.ts`, `costs.ts` | Optimierer, Kosten über Jahre |
| `src/model/validation.ts` | Vergleich mit Landsat |
| `src/data/materials.ts` | Materialwerte mit Quellen |
| `src/data/measures.ts` | Katalog der 13 Maßnahmen |
| `scripts/` | Skripte, die Beispielorte, Hitzetage, KOSTRA-Daten und die Landsat-Analyse erzeugen |
| `*.test.ts` | automatische Tests |

### 13.2 Selbst starten

```
npm install
npm run dev
npm test
```

In Windows PowerShell stattdessen `npm.cmd run dev` und `npm.cmd test`.

### 13.3 Weitere Dokumente

- [Ideenpapier Version 2](ideas/hitzeinsel-v2.md)
- [Analyse der Landsat-Abweichungen](analyse-landsat.md)
- [Kosten und Förderung](kosten.md)
- [Quellen](quellen.md)
- [Fragen an Fachleute](expertenfragen/fragenkatalog.md)
