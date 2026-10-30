# Changelog

Alle nennenswerten Änderungen am Wizard Tracker. Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

## [1.0.1] - 2026-10-30

### Geändert
- Tipps sind jetzt bis Kartenzahl + 1 möglich (z. B. 0 bis 4 in Runde 3), auch im Tischmodus, mit der Wolke und beim Korrigieren einer Runde. Die Stiche bleiben auf die Kartenzahl begrenzt.

## [1.0.0] - 2026-10-29

Erste versionierte Ausgabe mit allem, was bis hierhin entstanden ist.

### Hinzugefügt
- **Tischmodus**: große Kacheln für alle am Tisch mit Punkten, Rang, Tipp, Stichen, Geber und „beginnt“. Stiche lassen sich live per Antippen mitzählen, die obere Reihe kann um 180° gedreht werden, und der Bildschirm bleibt an.
- **Regel „Tipps dürfen nicht aufgehen“** (pro Spiel wählbar): Die verbotene Zahl des letzten Spielers ist gesperrt und wird angezeigt.
- **Punkteleiste** mit Rang und Geber, in jeder Runde sichtbar.
- **Zahlen-Chips** für Tipps und Stiche; der letzte Spieler bekommt die restlichen Stiche automatisch.
- **Zwischenstand** nach Punkten sortiert, mit Rundenpunkten und Abstand zu Platz 1.
- **Verlauf** mit Punkte-Diagramm und Rundentabelle; jede Runde lässt sich nachträglich korrigieren, die letzte auch wieder öffnen.
- **Statistik** pro Spiel (Trefferquote, Serien, beste und schlechteste Runde) und **Titel** am Spielende.
- **Bestenliste** über alle beendeten Spiele mit Siegen, Ø Punkten und Rekorden.
- **Setup**: Spieler-Vorschläge aus früheren Spielen, Sitzreihenfolge sortierbar, Rundenzahl wählbar, Sonderkarten Bombe und Wolke einzeln abschaltbar, Fortsetzen eines Spiels vom Papier.
- **Bombe** (ein Stich weniger) und **Wolke** (Tipp ±1, wird vermerkt und ist rückgängig machbar).
- **Weitermachen nach Neustart**: Die App öffnet wieder das zuletzt offene Spiel.
- Versionsnummer auf der Übersicht, dieses Changelog.

### Geändert
- Übersicht trennt laufende und beendete Spiele; Löschen fragt nach.
- Eigenes App-Icon statt eines verlinkten Logos.
- CSS wird fertig gebaut mitgeliefert statt bei jedem Start im Browser übersetzt; die App startet schneller und funktioniert offline zuverlässiger.

### Behoben
- Updates kamen wegen des Service-Worker-Caches nie bei den Nutzern an.
- Beendete Spiele standen unter „aktiv“, und „Fortsetzen“ öffnete eine leere Seite.
- Alte Spielstände (auch vom Papier fortgesetzte) werden beim Laden automatisch übernommen.
