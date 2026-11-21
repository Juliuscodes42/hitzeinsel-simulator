# Hitzeinsel-Simulator

Interaktive Web-App zur Simulation urbaner Hitzeinseln und von
Schwammstadt-Maßnahmen. Ein Jugend forscht-Projekt (Wettbewerbsrunde 2027).

## Starten

```bash
npm install
npm run dev
```

Tests laufen mit `npm test`. Meldet Windows PowerShell, dass Skripte
deaktiviert sind, stattdessen `npm.cmd test` bzw. `npm.cmd run dev` verwenden.

## Aufbau

| Ordner | Inhalt |
|---|---|
| `src/model` | Physik-Modell, unabhängig von der Oberfläche |
| `src/components` | Bausteine der Oberfläche |
| `src/data` | Materialwerte mit Quellen, Beispielorte |
| `docs/expertenfragen` | Fragen an Fachleute, E-Mail-Vorlage, Antworten |
| `docs/quellen.md` | Quellenliste für Formeln und Daten |
| `scripts/build-places.ts` | Erzeugt die Beispielorte samt Landsat-Messwerten neu (`node scripts/build-places.ts`) |

## Fahrplan

1. Projektgerüst und Veröffentlichung ✓
2. Physik-Modell (dynamische Energiebilanz) mit Tests ✓
3. Interaktives 20×20-Raster mit Reglern und Maßnahmen ✓
4. 24-Stunden-Diagramm, Kennzahlen, Formel-Fenster ✓
5. Echte Orte: Luftbild, OpenStreetMap, eigene Drohnenbilder ✓
6. Aktuelles Wetter als Startwerte ✓
7. Optimierer für Maßnahmen ✓
8. Vergleich mit Satelliten-Oberflächentemperaturen, Offline-Beispielorte ✓
9. Version 2 (siehe `docs/ideas/hitzeinsel-v2.md`):
   1. °C statt K, Meer und Wasserflächen erkennen ✓
   2. Wetter je Region: typischer Hitzetag und KOSTRA-Starkregen ✓
   3. Bilderkennung mit 2-m-Zellen, Lernen aus Beispielpunkten, Genauigkeit ✓
   4. Mehr Maßnahmen mit belegten Kosten
   5. Budget mit Folgekosten, Förderung und Zielvorgabe
10. Optional: KI-Erklärtext

## Raster korrigieren

OpenStreetMap kennt nicht jede Fläche. Im Schritt „Ausgangslage" unter „Flächen korrigieren" lässt sich ein Raster
nach dem Luftbild nachzeichnen und als Korrektur speichern. Die Korrektur gilt
zunächst nur im Browser dieses Geräts.

Damit sie für alle Besucher gilt: „Alle Korrekturen herunterladen", die Datei
`corrections.json` nach `src/data/corrections.json` kopieren (ersetzen) und
committen. Der Vergleich mit den Satellitenmessungen rechnet dann für diese
Orte zusätzlich mit dem korrigierten Raster.
