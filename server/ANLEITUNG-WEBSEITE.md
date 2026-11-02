# Webseite, Downloads und Updates auf cloudyclient.com

## Einmalig einrichten
1. Auf dem Server (Hoster) diese Dateien in den Ordner legen, in dem schon die alte app.js liegt: **app.js** (ersetzt die alte), **site.js** und den ganzen Ordner **site/**.
2. Optional: Umgebungsvariable **UPLOAD_KEY** (mind. 12 Zeichen) – nur nötig für das automatische Hochladen durch GitHub. Für dich selbst brauchst du sie nicht mehr, du meldest dich mit deinem Konto an.
3. Server neu starten. Dann zeigt https://cloudyclient.com die Webseite; der Konto-Server läuft unverändert weiter.

## Admin-Bereich (Login)
- https://cloudyclient.com/admin: mit deinem Cloudy-Konto anmelden. Es kommen nur Konten mit Admin-Recht **oder Owner-Tag** (so wie in der Datenbank) hinein. Alle anderen werden abgewiesen.
- **Übersicht**: Zahlen (Konten, online, neu, gesperrt …), Ankündigung an alle Spieler senden, Server-Status und neueste Version.
- **Versionen**: Versionsnummer eintippen, Dateien hineinziehen, „Hochladen“. Große Dateien gehen automatisch in 8-MB-Stücken (Proxys mit Größenlimit sind kein Problem), mit Wiederholung bei Aussetzern. Darunter alle Versionen: Hinweis ändern, einzelne Dateien oder ganze Versionen löschen.
- **Konten**: suchen, sperren/entsperren (mit Dauer und Grund), pausieren, Coins setzen oder zugeben, Tags (z. B. owner, tester), Passwort auf 12345 zurücksetzen, löschen.
- **Zugangscodes**: erstellen (Nutzungen, Gültigkeit), löschen, optional mit Entzug des Zugangs.
- **Webseite**: Titel, Untertitel, Beta-Texte, Kontakt, Fußzeile, Funktions-Karten und Beta-Schritte selbst ändern, dazu ein blauer Ankündigungs-Balken oben. Speichern, Seite neu laden. „Alles auf Standard“ setzt zurück. Gespeichert wird in **site-data.json** neben app.js (mitnehmen bei einem Umzug).
- Auf der Startseite erscheint nach dem Login im selben Browser-Tab ein gelber Link „Admin“.

### Neue Version holen
Dateien von GitHub (Releases) herunterladen und im Reiter „Versionen“ hochladen. Danach stehen sie auf der Download-Seite und im Update-Feed.
Automatisch: GitHub -> Settings -> Secrets -> Actions -> **CLOUDY_UPLOAD_KEY** = Wert von UPLOAD_KEY. Dann lädt die Action jede Version selbst hoch.

## Installieren (für Tester)
- Windows: Cloudy-Setup.exe doppelklicken (Warnung: Weitere Informationen -> Trotzdem ausführen). Ohne Installation: Cloudy-Portable.exe.
- Mac: .dmg öffnen, Cloudy in „Programme“ ziehen; beim ersten Start Rechtsklick -> Öffnen. arm64 = Apple Silicon, x64 = Intel.
- Linux: AppImage ausführbar machen und doppelklicken.
Diese Schritte stehen auch auf der Webseite im Abschnitt „Installation“.

## Hinweise
- /update/latest.json ist nur für den Cloudy-Client sichtbar (Browser bekommen 404). Sichtschutz, kein Passwort.
- Hochgeladene Dateien liegen im Ordner **releases/** neben app.js (oder wo RELEASE_DIR hinzeigt). Nicht löschen, bei einem Umzug mitnehmen.
- Kontakt für den Zugangscode: oben in site/site.js bei `CONTACT` eintragen.

## Automatischer Neustart
- Ersetzt du **app.js** oder **site.js** auf dem Server, beendet sich der Server ~4 Sekunden nach der letzten Änderung selbst und startet neu (nur wenn sich der Inhalt wirklich geändert hat). Neue Installer (Upload) brauchen keinen Neustart.
- Damit er wieder hochkommt, muss dein Hoster ihn neu starten (pm2, Docker, „Auto-Restart“ im Panel). Geht das bei dir nicht: Umgebungsvariable **RESPAWN=1** setzen, dann startet er sich selbst neu.
- Abschalten: **AUTO_RESTART=0**.
