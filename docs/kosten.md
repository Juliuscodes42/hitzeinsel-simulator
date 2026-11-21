# Kosten und Kennwerte der Maßnahmen

Stand: 21.11.2026. Die Werte stehen im Code in `src/data/measures.ts`. Alle Preise sind
Richtwerte für Bau bzw. Einbau in Euro pro Quadratmeter umgebauter Fläche, brutto, ohne
Förderung. Sie schwanken je nach Ort, Untergrund und Größe stark.

**Verlässlichkeit:** „belegt“ = mehrere unabhängige Quellen in ähnlicher Höhe;
„grob“ = nur eine Quelle, Herstellerangabe oder sehr breite Spanne;
„Annahme“ = keine passende Quelle gefunden, eigene Schätzung.

| Maßnahme | Bau €/m² (Spanne) | Pflege €/m²·Jahr | Lebensdauer | Verlässlichkeit | Wie der Wert entsteht |
|---|---|---|---|---|---|
| Gründach (extensiv) | 45 (30–70) | 1 | 40 Jahre | belegt | 30–70 €/m² [1][2][3], Pflege 0,5–2 €/m² [3] |
| Retentions-Gründach | 80 (60–140) | 1,5 | 40 Jahre | grob | Gründach plus Retentionselement ab 30 €/m² (Hersteller) [4]; Speicher 30–100 l/m² [5] |
| Cool Roof | 35 (20–60) | 0 | 10 Jahre | grob | Dachbeschichtungen 20–60 €/m², Haltbarkeit 5–10 Jahre [6] |
| Zisterne | 55 (30–100) | 0,5 | 30 Jahre | belegt | 5-m³-Zisterne mit Einbau 3.000–8.000 € [7][8], auf 100 m² Dach umgelegt |
| Laubbaum | 120 (60–180) | 2 | 60 Jahre | belegt | 2.500–4.500 € je Baum mit Standort und 3 Jahren Pflege [9][10], Pflege rund 60 € je Baum und Jahr [11]; gerechnet mit 30 m² Krone |
| Baum mit Rigole | 220 (150–320) | 3 | 50 Jahre | grob | Speicher 350–600 €/m³, Pflanzung 800–2.000 € [11]; angenommen 4,5 m³ Speicher je Baum |
| Entsiegelung (Rasengitter) | 80 (55–150) | 0,5 | 30 Jahre | belegt | Rasengitter verlegt ab 55 €/m² [12], mit Aushub und Entsorgung 80–150 €/m² [13] |
| Versickerungsmulde | 75 (45–110) | 1 | 40 Jahre | grob | Mulde 35–60 €/m² [14] plus Aufbruch des Pflasters |
| Wasserbecken | 200 (100–300) | 3 | 30 Jahre | grob | Folienteich durch Fachbetrieb 100–300 €/m² [15]; Pflege geschätzt |
| Heller Belag | 15 (5–40) | 0 | 7 Jahre | grob | USA: etwa 1–13 $/m² je nach Straße [16]; deutsche Preise nicht gefunden |
| Solardach über Parkplatz | 400 (240–640) | 3 | 25 Jahre | grob | 3.000–8.000 € je Stellplatz (gewerblich) [17], 12,5 m² je Stellplatz; Stromertrag nicht gegengerechnet |
| Sonnensegel | 150 (30–1.200) | 2 | 10 Jahre | Annahme | 30–80 €/m² für Gartensegel [18], 900–1.200 €/m² für feste Schattenbauwerke [19] |
| Sprühnebel | 50 (20–100) | 2 | 10 Jahre | Annahme | keine Kostenquelle; Verbrauch etwa 100 l Wasser und 0,6 kWh je Anlage und Tag [20] |

## Physikalische Kennwerte der neuen Maßnahmen

| Maßnahme | Im Modell | Quelle |
|---|---|---|
| Heller Belag | Albedo 0,35 (neu 0,3–0,45, sinkt mit der Zeit) | [16] |
| Retentions-Gründach | wie Gründach, Feuchte 0,55 statt 0,4, Abflussbeiwert 0,1, 30 l/m² Speicher | Speicher [5]; Feuchte eigene Annahme |
| Solardach | lässt 5 % der Sonne durch, verdeckt 70 % des Himmels | eigene Annahme (Frage D4) |
| Sonnensegel | lässt 20 % der Sonne durch, verdeckt 70 % des Himmels | eigene Annahme (Frage D4); Bäume lassen im Sommer 10–30 % durch [21] |
| Versickerungsmulde | Rasen mit 300 l/m² Speicher (30 cm tief) | eigene Annahme |
| Baum mit Rigole | Baum mit 150 l/m² Speicher (4,5 m³ unter 30 m² Krone) | eigene Annahme |
| Zisterne | 50 l je m² Dach (5 m³ je 100 m²) | übliche Tankgröße [7] |

Speicher fangen im Modell den Abfluss der ganzen Umgebung auf, bis sie voll sind. In der
Wirklichkeit muss das Wasser dorthin geleitet werden.

## Kosten über einen Zeitraum

Im Optimierer lassen sich die Kosten über einen Zeitraum (Standard 20 Jahre) rechnen
(`src/model/costs.ts`):

    Kosten je m² = Bau · (1 − Förderquote) · Anzahl Bauten + Pflege · Jahre − Einsparung · Jahre

„Anzahl Bauten“: Eine Maßnahme mit 10 Jahren Lebensdauer wird in 20 Jahren zweimal gebaut.
Zinsen und Preissteigerung sind nicht berücksichtigt.

**Einsparungen**

| Einsparung | Im Modell | Quelle |
|---|---|---|
| Strom aus Solardächern | 0,18 kWp je m², 950 kWh je kWp und Jahr, Wert 10 ct/kWh (einstellbar) | Ertrag 900–1.050 kWh/kWp [23]; Einspeisevergütung 2026 bis 7,70 ct/kWh, Eigenverbrauch spart mehr [24]; 0,18 kWp/m² eigene Annahme |
| Niederschlagswassergebühr | 1 € je m² und Jahr mal weniger Abfluss (einstellbar) | Bremen 0,83, Münster 0,95, Dortmund 1,80 €/m² [25]; Elmshorn nicht gefunden |

**Förderung**

| Programm | Förderung | Quelle |
|---|---|---|
| KfW 444 „Natürlicher Klimaschutz in Kommunen“ (nur Kommunen): Grünflächen, Bäume, Entsiegelung | 80 % (finanzschwache Kommunen 90 %); andere Quellen nennen bis 50 % | [26][27] |
| Hamburger Gründachförderung | 60 % der Herstellungskosten | [28] |
| Lübeck, Gründach | 50 %, höchstens 30 €/m² (extensiv) | [29] |
| Frankfurt, Gründach | 50 % | BuGG-Übersicht [30] |
| Berlin, GründachPLUS | bis 95 €/m² | [31] |

Die Vorlage „Stadt mit KfW 444“ setzt 80 % für Bäume, Rigolen, Entsiegelung, Mulden und
Wasserbecken und 50 % für Gründächer. Ob ein Wasserbecken über KfW 444 förderfähig ist,
ist nicht geprüft. Die Vorlage „Privat mit Gründach-Zuschuss“ setzt 50 % für Gründächer.
Programme ändern sich oft; vor einer Planung bei der Stadt nachfragen (Frage E3).

## Rechtlicher Hinweis

In Schleswig-Holstein müssen neue offene Parkplätze ab 70 Stellplätzen mit Photovoltaik
überdacht werden (§ 25 EWKG, Schwelle seit März 2025, vorher 100) [22]. Bestehende
Parkplätze betrifft das nur bei grundlegender Sanierung. Bitte am Gesetzestext prüfen.

## Quellen

1. Raiffeisen: Dachbegrünung – ja oder nein. https://www.raiffeisen.at/vorarlberg/rlb/de/immobilien/wohncenter/wohnexperten/garten/dachbegruenung---ja-oder-nein-.html
2. Bistum Hildesheim: Broschüre Biodiversität. https://www.bistum-hildesheim.de/fileadmin/dateien/Unterbereiche/Nachhaltigkeit/broschueren/biodiversitaet/1__BIODIVERSITAET_Broschuere__2.1_260710.pdf
3. HLNUG: Factsheet 7, Kosten und Nutzen in Gewerbegebieten. https://www.hlnug.de/fileadmin/dokumente/klima/Handlungshilfen/Factsheet7-Kosten-Nutzen_Gewerbegebiete_final.pdf
4. Optigrün, Retentionsdach Mäander 60 (Produktdatenblatt im B-Plan Montabaur). https://vg-montabaur.de/dokumente/leben-erleben/bauen-wohnen/laufende-bauleitplanverfahren/bebauungsplaene-der-stadt-montabaur/martin-luther-strasse/8.-dachbegruenung-i-3-ii.pdf?cid=2eta
5. Baunetz Wissen: Regenrückhaltung durch Dachbegrünungen. https://www.baunetzwissen.de/stadt--und-dachbegruenung/fachwissen/dachbegruenung/regenrueckhaltung-durch-dachbegruenungen-8302934
6. greenox: Dachbeschichtung. https://www.greenox-group.de/dachbeschichtung/
7. baustoffshop.de: Zisterne – Kosten. https://www.baustoffshop.de/infothek/zisterne-kosten/
8. Hausjournal: Kostenbeispiel Zisterne. https://www.hausjournal.net/zisterne-kosten
9. Stadt Münster: Baumschutz. https://www.stadt-muenster.de/umwelt/baeume/baumschutz
10. Stadt Nürnberg: Baumspenden. https://www.nuernberg.de/internet/soer_nbg/baumspenden.html
11. Stadt Koblenz: Praxishilfe, Maßnahme Baumrigole. https://www.koblenz.de/umwelt-und-planung/klimaschutz/aktuelle-konzepte/praxishilfe-klimaresilienter-stadt-und-verkehrsraum/5-priorisierung-und-auswahl-von-massnahmen/massnahmen/5.2-i-baumrigole.pdf?cid=3nna
12. clean-invoice: Rasengitter. https://www.clean-invoice.com/lexikon/rasengitter
13. bau.de Forum: Öko-Pflaster für Zufahrt. https://bau.de/forum/garten/10393.php
14. Stadt Koblenz: Untersuchungen vitale Baumstandorte (Mulden). https://www.koblenz.de/umwelt-und-planung/klimaschutz/aktuelle-projekte/klimaresiliente-verkehrsraum-und-quartiersentwicklung-koblenz-rauental/untersuchungen-am-projektstandort/vitale-baumstandorte.pdf?cid=3oor
15. aroundhome: Teich anlegen lassen. https://www.aroundhome.de/gartenbau-landschaftsbau/teich-anlegen-lassen/
16. Wikipedia: Cool pavement (mit Verweisen auf LBNL und Arizona State University). https://en.wikipedia.org/wiki/Cool_pavement
17. Xpert.Digital: Parkplatz-Kraftwerk. https://xpert.digital/parkplatz-kraftwerk
18. bau.de: Sonnenschutz im Garten. https://bau.de/text/170127-sunliner-garten
19. Umweltbundesamt, Tatenbank: U°CA – Shading strategies for urban microclimate. https://www.umweltbundesamt.de/themen/klima-energie/klimafolgen-anpassung/werkzeuge-der-anpassung/tatenbank/udegca-shading-strategies-for-urban-microclimate
20. Stadt Wiesbaden: Sprühnebel. https://www.wiesbaden.de/leben-in-wiesbaden/umwelt-natur-klima/klimaschutz/spruehnebel
21. Arizona State University (KEEP): Studie zu Verschattung durch PV-Parkdächer und Bäume. https://keep.lib.asu.edu/system/files/2022-05/1-s2.0-s0038092x06002908-main_0.pdf
22. KNE: Länderregelungen Parkplatz-Photovoltaik. https://www.naturschutz-energiewende.de/wp-content/uploads/KNE-Antwort_353_Laenderregelungen-Parkplatz-Photovoltaik.pdf

23. 42watt: Solar-Carport (Erträge nach Fraunhofer ISE). https://42watt.de/magazin/solar-carport
24. Bundesnetzagentur: EEG-Förderung und -Fördersätze. https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/ErneuerbareEnergien/EEG_Foerderung/start.html
25. Bremen: https://www.service.bremen.de/niederschlagswassergebuehren-bezahlen-188773 · Münster: https://www.stadt-muenster.de/tiefbauamt/beitraege-und-gebuehren/gebuehren.html · Dortmund: https://www.dortmund.de/themen/sauberkeit-und-entsorgung/zustands-und-funktionspruefung/gebuereneinsparungen/
26. KfW: Natürlicher Klimaschutz in Kommunen (444). https://www.kfw.de/inlandsfoerderung/%C3%96ffentliche-Einrichtungen/St%C3%A4dte-und-Gemeinden-gestalten/F%C3%B6rderprodukte/Nat%C3%BCrlicher-Klimaschutz-in-Kommunen-(444)/
27. Bundesumweltministerium: Natürlicher Klimaschutz in Kommunen. https://www.bundesumweltministerium.de/FG44
28. Hamburg: Gründachförderung. https://www.hamburg.de/politik-und-verwaltung/behoerden/bukea/themen/hamburgs-gruen/gruendach-und-gruene-fassaden/foerderung
29. Hansestadt Lübeck: Förderrichtlinie Gründach. https://www.luebeck.de/files/stadtentwicklung/Klimaschutz/Foerderrichtlinie_Gruendach_Hansestadt_Luebeck.pdf
30. BuGG: Städte mit Förderprogrammen für Dachbegrünungen. https://www.gebaeudegruen.info/wp-content/uploads/2026/01/Staedte-mit-Foerderprogrammen-fuer-Dachbegruenungen.pdf
31. Berlin: GründachPLUS. https://www.berlin.de/gruenedaecher/

Die meisten Preisangaben stammen aus Ratgebern, Anbieter- und Vermittlungsseiten, nicht aus
Kostenstudien. Für die Arbeit sollten sie mit Angeboten oder Auskünften der Stadt
(Grünflächenamt, Tiefbauamt) abgeglichen werden (Frage D3).
