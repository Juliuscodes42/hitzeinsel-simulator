# Hitzeinsel-Simulator 2.0

Stand: 21.11.2026

## Problem Statement

Wie erkennt die App einen echten Ort so genau wie auf dem Luftbild und schlägt dazu belegte,
bezahlbare Maßnahmen vor, mit einem Wetter, das zur Region passt?

## Recommended Direction

**Bilderkennung statt 10-m-Kästchen.** Gebäude und Straßen kommen weiter aus OpenStreetMap,
weil sie dort zuverlässig sind. Vegetation, Wasser und offene Flächen erkennt die App aus den
Farben des Luftbilds (Grünindex, Blau, Helligkeit). Wo die Regeln unsicher sind, lernt ein
einfacher Klassifikator aus Beispielpunkten, die das Team markiert. Die Genauigkeit wird mit
eigenen Prüfpunkten gemessen (Trefferquote, Verwechslungstabelle). Gerechnet wird mit
2-m-Zellen (100 × 100), sichtbar ist nur eine glatte Farbfläche auf dem Foto, ohne Gitter.

**Wetter automatisch je Region.** Der typische Hitzetag ist das Mittel der heißesten Tage der
letzten 10 Sommer am Ort (Open-Meteo). Der Starkregen kommt aus KOSTRA-DWD, zum Beispiel ein
Regen von 1 Stunde, wie er etwa alle 30 Jahre vorkommt. Die Regler bleiben aufklappbar, um
Szenarien wie „Klimawandel +3 °C" durchzuspielen.

**Mehr Maßnahmen, ehrliches Budget.**

- Neue Maßnahmen: Photovoltaik-Dach über Parkplätzen, Sonnensegel oder Pergola, heller Belag,
  Retentions-Gründach, Baumrigole und Versickerungsmulde, Teich oder Wasserspiel, Zisterne.
- Kosten über 20 Jahre: Baukosten plus jährliche Pflege mal Jahre, abzüglich Förderung.
- Zwei Fragen statt einer: „Was bringt mein Budget?" und neu „Was kostet das Ziel mindestens?".
- Alle Kosten und Förderprogramme werden recherchiert und mit Quellen belegt.

**Kleinere Korrekturen.**

- Temperaturunterschiede werden in °C angezeigt. Im Formel-Fenster steht dazu, dass das
  dieselbe Zahl in K ist.
- Meer und Wasserflächen werden richtig erkannt.

Ursache für „Meer = Rasen": OpenStreetMap speichert das Meer nur als Küstenlinie, nicht als
Fläche. `rasterizeOsm` macht aus allem, was es nicht zuordnen kann, „Rasen (geschätzt)".

## Key Assumptions to Validate

- [ ] Die Bildpunkte des Esri-Luftbilds lassen sich im Browser auslesen (CORS), und die
      Nutzungsbedingungen erlauben das. Test: Bild in ein Canvas laden, `getImageData`
      aufrufen, Lizenz lesen. Wenn nicht, die amtlichen Luftbilder der Länder (DOP) nehmen.
- [ ] Die Farberkennung liegt mit Lernen aus Beispielpunkten bei mindestens etwa 80 %
      richtig. Test: etwa 100 Prüfpunkte je Beispielort von Hand markieren.
- [ ] Das Modell rechnet bei 2 m noch sinnvoll, obwohl benachbarte Zellen keine Wärme
      austauschen. Gegenmaßnahme: Nachbarschafts-Mittelung und Baumschatten auf
      Nachbarzellen. Test: erneuter Landsat-Vergleich.
- [ ] KOSTRA-DWD darf frei genutzt werden und lässt sich klein genug für den Browser
      aufbereiten. Test: Lizenz prüfen, ein Raster (60 min, 30 Jahre) als JSON ablegen.
- [ ] Für Kosten, Folgekosten und Förderung gibt es belegbare Werte. Test: Recherche mit
      Quellen in `docs/quellen.md`; Fehlendes mit Expertenfragen nachfragen.
- [ ] Ob es in Schleswig-Holstein eine Photovoltaik-Pflicht für große neue Parkplätze gibt,
      ist noch zu prüfen.

## MVP Scope

1. °C statt K; Meer und Wasserflächen richtig erkennen (Küstenlinie plus Bild).
2. Wetter automatisch: typischer Hitzetag und KOSTRA-Starkregen, Regler aufklappbar.
3. Bilderkennung mit 2-m-Zellen ohne sichtbares Gitter, Lernen aus Beispielpunkten,
   Messung der Genauigkeit.
4. Neue Maßnahmen mit belegten Kosten.
5. Budget mit Folgekosten, Förderung und der Frage „Was kostet das Ziel?".

## Not Doing (and Why)

- **Fertiges KI-Segmentierungsmodell:** für die Jury nicht erklärbar, macht die Seite schwer
  und ist für fremde Bilder trainiert.
- **3D-Schatten aus Gebäudehöhen und Luftströmung (Kaltluft):** Aufgabe von Fachprogrammen
  wie ENVI-met, nicht einer Browser-App.
- **Fassadenbegrünung:** Das 2D-Modell kennt keine Wände; die Wirkung wäre geraten.
- **Amtliche Daten je Bundesland einzeln einbinden:** zu viel Aufwand für zu wenig Gewinn.

## Open Questions

- Welche Wiederkehrzeit und Dauer soll der Starkregen haben (Vorschlag: 1 Stunde, alle
  30 Jahre)?
- Wie lang soll der Betrachtungszeitraum der Kosten sein (Vorschlag: 20 Jahre)?
- Förderung bundesweit oder für einen gewählten Ort (zum Beispiel Elmshorn)?
