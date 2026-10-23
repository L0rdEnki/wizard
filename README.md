# Wizard PWA - Punkte-Tracker

Progressive Web App zum Mitschreiben der Punkte beim Kartenspiel „Wizard“. Mobile-first: Vue 3 (Logik, per CDN), Tailwind CSS & daisyUI (Styling, als fertig gebautes `css/tailwind.css` im Repo), Speicherung lokal im Browser (localStorage).

## Funktionen
- **Übersicht**: laufende und beendete Spiele getrennt, mit Spitzenreiter; Löschen mit Rückfrage.
- **Weitermachen nach Neustart**: Die App öffnet wieder das Spiel und die Ansicht, in der sie geschlossen wurde.
- **Spiel-Setup**: 3–6 Spieler in Sitzreihenfolge (sortierbar), Geber wird ausgelost. Namen aus früheren Spielen stehen als Schnellauswahl bereit.
  - Regel **„Tipps dürfen nicht aufgehen“** pro Spiel ein-/ausschaltbar (Standard: an).
  - **Rundenzahl** wählbar für kürzere Spiele.
  - **Sonderkarten** der Jubiläumsedition (Bombe, Wolke) einzeln ein-/ausschaltbar.
  - **Vom Papier fortsetzen**: Runde, Geber und bisherige Punkte übernehmen.
- **Punkte immer sichtbar**: Punkteleiste mit Rang und Geber oben in jeder Runde.
- **Tipps**: Zahlen-Chips pro Spieler, Anzeige über-/unterboten. Bei aktiver Regel wird die verbotene Zahl des letzten Spielers gesperrt und angezeigt („⛔ Anna darf nicht 2 tippen“).
- **Stiche**: Zahlen-Chips; sind alle bis auf einen eingetragen, bekommt der letzte automatisch den Rest. Bombe (−1 Stich) und Wolke (Tipp ±1, wird vermerkt und ist rückgängig machbar).
- **Zwischenstand** nach Punkten sortiert, mit Rundenpunkten und Abstand zum Ersten.
  - **Verlauf**: Diagramm der Punktestände und Tabelle aller Runden. Jede Runde lässt sich durch Antippen korrigieren.
  - **Statistik**: Trefferquote, längste Serie, beste/schlechteste Runde, Ø Abweichung.
  - „Letzte Runde korrigieren“ öffnet die zuletzt gewertete Runde erneut.
- **Tischmodus** (Knopf „Tisch“): große Kacheln für alle am Tisch, mit Punkten, Rang, Tipp, Stichen, Geber, „beginnt“ und Verbot. Stiche live mitzählen per Antippen der Kachel. Mit ⇅ wird die obere Reihe für die Gegenübersitzenden um 180° gedreht (Gerät liegt flach). Der Bildschirm bleibt an (Wake Lock, sofern unterstützt).
- **Spielende**: Ranking, Titel (z. B. „Höchste Trefferquote“, „Größter Absturz“), Konfetti, Revanche.
- **Bestenliste**: Siege, Ø Punkte, Rekorde und Trefferquote über alle beendeten Spiele.
- **Offline-fähig** dank Service Worker; Dark/Light Mode.

## Projektstruktur
```
index.html       Oberfläche (Vue-Templates)
js/app.js        Vue-App: Ansichten, Eingaben, Tischmodus
js/rules.js      reine Spiellogik (Wertung, verbotener Tipp, Statistik, Migration alter Spielstände)
css/tailwind.css gebautes Tailwind/daisyUI-CSS (wird committet, nicht von Hand ändern)
style.css        eigene Styles (Chips, Tischmodus, Diagramm, Konfetti)
sw.js            Service Worker (eigene Dateien network-first, Vue-CDN cache-first)
tests/           Tests für die Spiellogik (node:test)
```

## CSS bauen
Tailwind-Klassen werden nicht mehr im Browser übersetzt. Nach Änderungen an Klassen in `index.html` oder `js/` einmal das CSS neu bauen und `css/tailwind.css` mit committen:
```bash
npm install
```
```bash
npm run build:css
```
Während der Entwicklung baut `npm run watch:css` bei jeder Änderung automatisch neu.

## Lokal starten & testen
```bash
npm run wizard
```
Der Server läuft dann unter `http://localhost:8000`.

```bash
npm test
```

### Auf dem iPhone testen
PWAs bzw. Service Worker brauchen HTTPS (außer auf `localhost`). Den lokalen Server kannst du z. B. so per HTTPS erreichbar machen:
```bash
npx localtunnel --port 8000
```
Die angezeigte URL in Safari öffnen → Teilen → „Zum Home-Bildschirm“.

## Hosting auf GitHub Pages
Alle Dateien liegen im Root und nutzen relative Pfade; das gebaute CSS liegt im Repo, auf GitHub Pages ist also kein Build nötig. Repository-Einstellungen → Pages → Branch wählen, Ordner `/ (root)`. Die URL in Safari öffnen und „Zum Home-Bildschirm“ hinzufügen.

Bei Änderungen an der App die Version `CACHE_NAME` in `sw.js` erhöhen. Dank network-first kommen Updates aber auch ohne das beim nächsten Öffnen mit Netz an.

Viel Spaß beim Spielen!
