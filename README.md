# Hitzeinsel-Simulator

Interaktive Web-App zur Simulation urbaner Hitzeinseln und von
Schwammstadt-Maßnahmen. Ein Jugend forscht-Projekt (Wettbewerbsrunde 2027).

## Starten

```bash
npm install
npm run dev
```

## Aufbau

| Ordner | Inhalt |
|---|---|
| `src/model` | Physik-Modell, unabhängig von der Oberfläche |
| `src/components` | Bausteine der Oberfläche |
| `src/data` | Materialwerte mit Quellen, Beispielorte |

## Fahrplan

1. Projektgerüst und Veröffentlichung ✓
2. Physik-Modell (dynamische Energiebilanz) mit Tests
3. Interaktives 20×20-Raster mit Reglern und Maßnahmen
4. 24-Stunden-Diagramm, Kennzahlen, Formel-Fenster
5. Echte Orte: Luftbild, OpenStreetMap, eigene Drohnenbilder
6. Aktuelles Wetter als Startwerte
7. Optimierer für Maßnahmen
8. Vergleich mit Satelliten-Oberflächentemperaturen, Offline-Beispielorte
9. Optional: KI-Erklärtext
