# Wizard PWA - Punkte-Tracker

Progressive Web App zum Mitschreiben der Punkte beim Kartenspiel „Wizard“. Mobile-first, ohne Build-Schritt: Vue 3 (Logik), Tailwind CSS & daisyUI (Styling) über CDN, Speicherung lokal im Browser (localStorage).

## Funktionen
- **Übersicht**: laufende und beendete Spiele getrennt, mit Spitzenreiter; Löschen mit Rückfrage.
- **Spiel-Setup**: 3–6 Spieler in Sitzreihenfolge (sortierbar), Geber wird ausgelost.
  - Regel **„Tipps dürfen nicht aufgehen“** pro Spiel ein-/ausschaltbar (Standard: an).
  - **Vom Papier fortsetzen**: Runde, Geber und bisherige Punkte übernehmen.
- **Punkte immer sichtbar**: Punkteleiste mit Rang und Geber oben in jeder Runde.
- **Tipps**: Zahlen-Chips pro Spieler, Anzeige über-/unterboten. Bei aktiver Regel wird die verbotene Zahl des letzten Spielers gesperrt und angezeigt („⛔ Anna darf nicht 2 tippen“).
- **Stiche**: Zahlen-Chips; sind alle bis auf einen eingetragen, bekommt der letzte automatisch den Rest. Bombe (−1 Stich) und Wolke (Tipp ±1, wird vermerkt und ist rückgängig machbar).
- **Zwischenstand** nach Punkten sortiert, mit Rundenpunkten, Abstand zum Ersten und ausklappbarem Verlauf. „Letzte Runde korrigieren“ öffnet die zuletzt gewertete Runde erneut.
- **Tischmodus** (Knopf „Tisch“): große Kacheln für alle am Tisch, mit Punkten, Rang, Tipp, Stichen, Geber, „beginnt“ und Verbot. Stiche live mitzählen per Antippen der Kachel. Mit ⇅ wird die obere Reihe für die Gegenübersitzenden um 180° gedreht (Gerät liegt flach). Der Bildschirm bleibt an (Wake Lock, sofern unterstützt).
- **Spielende**: Ranking, Konfetti, Revanche.
- **Offline-fähig** dank Service Worker; Dark/Light Mode.

## Projektstruktur
```
index.html       Oberfläche (Vue-Templates)
js/app.js        Vue-App: Ansichten, Eingaben, Tischmodus
js/rules.js      reine Spiellogik (Wertung, verbotener Tipp, Migration alter Spielstände)
style.css        eigene Styles (Chips, Tischmodus, Konfetti)
sw.js            Service Worker (eigene Dateien network-first, CDN cache-first)
tests/           Tests für die Spiellogik (node:test)
```

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
Alle Dateien liegen im Root und nutzen relative Pfade, ein Build ist nicht nötig. Repository-Einstellungen → Pages → Branch wählen, Ordner `/ (root)`. Die URL in Safari öffnen und „Zum Home-Bildschirm“ hinzufügen.

Bei Änderungen an der App die Version `CACHE_NAME` in `sw.js` erhöhen. Dank network-first kommen Updates aber auch ohne das beim nächsten Öffnen mit Netz an.

Viel Spaß beim Spielen!
