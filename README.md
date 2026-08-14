# Wizard PWA - Punkte-Tracker

Dies ist eine Progressive Web App (PWA) zur digitalen Erfassung der Punkte beim Kartenspiel "Wizard". Sie ist "mobile-first" für das iPhone optimiert, verwendet Vue 3 (für die Logik), Tailwind CSS & daisyUI (für das Styling) und speichert die Daten lokal im Browser (localStorage).

## Funktionen
- **Startbildschirm**: Übersicht aktiver Spiele, Starten neuer Spiele.
- **Spiel-Setup**: Eingabe von 3-6 Spielern, automatisches Auswürfeln des Startgebers.
- **Spiel-Loop**:
  - Eingabe der Tipps und tatsächlichen Stiche mit großen, touch-optimierten (+/-) Buttons.
  - "Wolke"-Funktion: Tipps in der laufenden Runde nachträglich ändern.
  - Automatische Validierung (Summe Stiche = ausgeteilte Karten).
  - Score-Tabelle nach jeder Runde.
- **Spielende**: Ranking, Sieger-Hervorhebung, Konfetti-Animation, Revanche-Option.
- **Offline-fähig**: Dank Service Worker (`sw.js`) und Web-App-Manifest.
- **Dark/Light Mode**: Anpassbar über den Header.

## Testanleitung (Lokales Hosten & Installation auf dem iPhone)

Da PWAs (und Service Worker) aus Sicherheitsgründen HTTPS erfordern (außer unter `localhost`), gibt es verschiedene Wege, die App lokal auf dem iPhone zu testen.

### Lokales Starten auf Debian (mit npm)

Das Projekt ist so vorbereitet, dass du den lokalen Webserver direkt aus dem Root-Verzeichnis mit folgendem Befehl starten kannst:

\`\`\`bash
npm run wizard
\`\`\`
*(Alternativ via Alias: `up run wizard`)*

Der Server ist dann unter `http://localhost:8000` bzw. `http://127.0.0.1:8000` erreichbar.

### Möglichkeit 1: Lokales Netzwerk & ngrok / localtunnel (Empfohlen)

Um den laufenden lokalen Server auf deinem iPhone zu testen:
1. **Starte den lokalen Webserver** wie oben beschrieben (`npm run wizard`).
2. **Mache den Server über HTTPS erreichbar**:
   Lade dir `ngrok` herunter oder nutze `localtunnel`, um eine öffentliche HTTPS-URL zu generieren:
   \`\`\`bash
   # Mit npx localtunnel (kein Account nötig):
   npx localtunnel --port 8000
   \`\`\`
3. Du erhältst eine URL (z.B. `https://xyza-123-45.loca.lt`).
4. **Auf dem iPhone**:
   - Öffne **Safari** und rufe die generierte URL auf.
   - Tippe in Safari unten auf den "Teilen"-Button (das Viereck mit dem Pfeil nach oben).
   - Wähle **"Zum Home-Bildschirm"** aus.
   - Nun hast du die Wizard PWA als vollwertige App-Icon auf deinem Homescreen. Sie öffnet sich im Vollbild (Standalone) ohne Safari-Bedienelemente.

### Möglichkeit 2: Hosting auf GitHub Pages (Direkt startklar)

Da alle Dateien (`index.html`, `app.js`, etc.) direkt im Hauptverzeichnis (Root) liegen, ist das Repository **sofort bereit für GitHub Pages**.
1. Lade das Repository auf GitHub hoch.
2. Gehe in die Repository-Einstellungen unter "Pages".
3. Wähle als Source den Branch aus (z. B. `main` oder `master`) und den Ordner `/ (root)`.
4. Du erhältst sofort eine HTTPS-URL (z.B. `https://dein-username.github.io/wizard-pwa`).
5. Öffne diese URL in Safari auf deinem iPhone und füge sie "Zum Home-Bildschirm" hinzu.

## Technische Details
- Die iOS-Meta-Tags verhindern das automatische Zoomen beim Tippen (`touch-action: pan-y; user-select: none;` in CSS).
- Das State-Management ist reaktiv in `app.js` aufgebaut und wird bei Änderungen sofort im `localStorage` gespeichert.

Viel Spaß beim Spielen!
