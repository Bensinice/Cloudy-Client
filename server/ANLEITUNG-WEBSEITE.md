# Webseite, Downloads und Updates auf cloudyclient.com

## Einmalig einrichten
1. Auf dem Server (Hoster) diese Dateien in den Ordner legen, in dem schon die alte app.js liegt: **app.js** (ersetzt die alte), **site.js** und den ganzen Ordner **site/**.
2. Eine Umgebungsvariable **UPLOAD_KEY** anlegen: ein langes geheimes Passwort (mind. 12 Zeichen), z. B. 4 zufällige Wörter. Ohne sie ist das Hochladen ausgeschaltet.
3. Server neu starten. Dann zeigt https://cloudyclient.com die Webseite; der Konto-Server läuft unverändert weiter.

## Eine neue Version auf den Server bringen
1. Die fertigen Dateien holen: GitHub -> Releases -> die neueste Version -> die 5 Dateien herunterladen
   (Cloudy-Setup.exe, Cloudy-Portable.exe, Cloudy-arm64.dmg, Cloudy-x64.dmg, Cloudy-Linux.AppImage).
2. https://cloudyclient.com/upload öffnen.
3. Upload-Schlüssel eingeben, Versionsnummer (z. B. 0.9.72, wie in package.json) eintippen, optional einen Hinweis „Was ist neu?“.
4. Die 5 Dateien in das Feld ziehen und auf „Hochladen“ klicken. Warten, bis überall „Fertig ✓“ steht.
5. Fertig: Die Version steht auf der Download-Seite (mit Knöpfen) und im Update-Feed; Clients melden sie beim nächsten Start.

Automatisch statt von Hand: In GitHub unter Settings -> Secrets and variables -> Actions das Secret **CLOUDY_UPLOAD_KEY** (gleicher Wert wie UPLOAD_KEY) anlegen. Dann lädt die Action jede neue Version selbst hoch, und Schritt 1–4 entfallen.

## Installieren (für Tester)
- Windows: Cloudy-Setup.exe doppelklicken (Warnung: Weitere Informationen -> Trotzdem ausführen). Ohne Installation: Cloudy-Portable.exe.
- Mac: .dmg öffnen, Cloudy in „Programme“ ziehen; beim ersten Start Rechtsklick -> Öffnen. arm64 = Apple Silicon, x64 = Intel.
- Linux: AppImage ausführbar machen und doppelklicken.
Diese Schritte stehen auch auf der Webseite im Abschnitt „Installation“.

## Hinweise
- /update/latest.json ist nur für den Cloudy-Client sichtbar (Browser bekommen 404). Sichtschutz, kein Passwort.
- Hochgeladene Dateien liegen im Ordner **releases/** neben app.js (oder wo RELEASE_DIR hinzeigt). Nicht löschen, bei einem Umzug mitnehmen.
- Kontakt für den Zugangscode: oben in site/site.js bei `CONTACT` eintragen.
