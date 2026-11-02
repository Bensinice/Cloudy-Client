# Webseite, Downloads und Updates auf cloudyclient.com

## Einmalig einrichten
1. Auf dem Server (Hoster) die Dateien **app.js**, **site.js** und den Ordner **site/** in denselben Ordner legen (alte app.js ersetzen).
2. Eine neue Umgebungsvariable setzen: **UPLOAD_KEY** = ein langes, geheimes Passwort (mind. 12 Zeichen). Ohne sie ist das Hochladen aus.
3. Server neu starten. Dann zeigt https://cloudyclient.com die Webseite (der Konto-Server läuft unverändert weiter).

## Neue Version hochladen
- Öffne https://cloudyclient.com/upload, gib den Schlüssel, die Versionsnummer (z. B. 0.9.72) ein und ziehe die Dateien hinein (Cloudy-Setup.exe, Cloudy-Portable.exe, Cloudy-arm64.dmg, Cloudy-x64.dmg, Cloudy-Linux.AppImage).
- Sie erscheinen sofort auf der Download-Seite (jede Version mit eigenen Knöpfen) und im Update-Feed.
- Optional automatisch: In GitHub unter Settings > Secrets > Actions das Secret **CLOUDY_UPLOAD_KEY** (gleicher Wert) anlegen, dann lädt die Action jede neue Version selbst hoch.

## Hinweise
- Update-Feed: /update/latest.json ist nur für den Cloudy-Client sichtbar (ein normaler Browser bekommt 404). Das ist ein Sichtschutz, kein Passwort: die Installer selbst stehen ja öffentlich auf der Download-Seite.
- Dateien liegen im Ordner **releases/** neben app.js (oder dort, wohin RELEASE_DIR zeigt). Diesen Ordner nicht löschen und bei einem Umzug mitnehmen.
- Kontakt für den Zugangscode: oben in site/site.js bei `CONTACT` eintragen.
