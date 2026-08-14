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

### Möglichkeit 1: Lokales Netzwerk & ngrok / localtunnel (Empfohlen)

1. **Starte einen lokalen Webserver** in dem Ordner, in dem die Dateien liegen:
   \`\`\`bash
   # Mit Python (installiert auf den meisten Systemen):
   python3 -m http.server 8000

   # ODER mit Node.js (z.B. http-server):
   npx http-server -p 8000
   \`\`\`
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

### Möglichkeit 2: Hosting auf GitHub Pages / Vercel (Einfachste dauerhafte Lösung)

1. Lade die Dateien (`index.html`, `app.js`, `style.css`, `manifest.json`, `sw.js`) in ein neues GitHub-Repository hoch.
2. Aktiviere "GitHub Pages" in den Repository-Einstellungen.
3. Du erhältst sofort eine HTTPS-URL (z.B. `https://dein-username.github.io/wizard-pwa`).
4. Öffne diese URL in Safari auf deinem iPhone und füge sie "Zum Home-Bildschirm" hinzu.

## Technische Details
- Die iOS-Meta-Tags verhindern das automatische Zoomen beim Tippen (`touch-action: pan-y; user-select: none;` in CSS).
- Das State-Management ist reaktiv in `app.js` aufgebaut und wird bei Änderungen sofort im `localStorage` gespeichert.

Viel Spaß beim Spielen!
