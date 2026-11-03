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

## Neu in Stufe 1
- **Anfragen (Request Key)**: Im Launcher gibt es auf dem Zugangscode-Bildschirm „Request key“. Die Anfragen erscheinen im Admin-Bereich (Reiter „Anfragen“) und im Launcher unter Einstellungen > Zugangscodes. „Freigeben“ erzeugt einen einmaligen Code (7 Tage), den der Spieler automatisch sieht. Gespeichert in der Datenbank (Tabelle cloudy_kv, Schlüssel keyreqs). Neue Datei: **keyreq.js**.
- **Server-Status**: Öffentlich unter /api/status, auf der Webseite im Abschnitt „Systemstatus“ und im Launcher unter Einstellungen. Geprüft werden Konto-Server + Datenbank (live) und optional ein Minecraft-Server (Adresse im Admin-Bereich > Übersicht > Status-Seite). Dort schaltest du auch den Wartungsmodus. Neue Datei: **status.js**, Einstellungen in **status-config.json**.
- **Prüfsummen**: Beim Hochladen berechnet der Server SHA-256 (steht im Update-Feed); der Launcher prüft den Download vor dem Installieren. Ältere Uploads ohne Prüfsumme werden einfach ohne Prüfung installiert.
- Zum Einspielen **alle** Dateien aus diesem Paket (app.js, site.js, keyreq.js, status.js, site/) hochladen.

## E-Mail bei neuen Early-Access-Anfragen (Request Key)
Sobald jemand im Client „Request Key“ nutzt, schickt der Server eine E-Mail an **ben.haertel29@gmail.com** (andere Adresse: `MAIL_TO`). Neue Datei: **mail.js** (kein Zusatzpaket nötig).
Damit der Server senden darf, braucht er ein Postfach zum Absenden. Setze diese Umgebungsvariablen (genau wie `DB_PASS`) und starte den Server neu:

| Variable | Beispiel für Gmail |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` (SSL) oder `587` (STARTTLS) |
| `SMTP_USER` | deine Gmail-Adresse |
| `SMTP_PASS` | **App-Passwort** (Google-Konto > Sicherheit > Bestätigung in zwei Schritten > App-Passwörter), nicht dein normales Passwort |
| `SMTP_FROM` | optional, sonst `SMTP_USER` |
| `MAIL_TO` | optional, Standard `ben.haertel29@gmail.com` |

Ohne `SMTP_HOST` wird keine Mail gesendet (die Anfrage selbst funktioniert trotzdem und steht im Admin-Bereich). Fehler beim Senden stehen im Server-Log mit dem Anfang `[mail]`.

## Quests & Cloudy Stars (neu)
Neue Datei: **quests.js** (neben `app.js`). Es ist **keine Datenbank-Änderung nötig**: der Stand wird automatisch in der vorhandenen Tabelle `cloudy_kv` unter dem Schlüssel `quests` gespeichert.
- Aufgaben, Ziele und Belohnungen stehen nur im Server (`quests.js`) – der Launcher kann nichts selbst vergeben. Rücksetzung: täglich um 00:00 und wöchentlich Montag 00:00 (Zeit Europe/Berlin).
- Spielzeit wird nur so schnell gezählt wie die echte Zeit (höchstens 90 s je Meldung, eine Meldung je 20 s).
- Belohnungen (Cloudy Coins) werden beim Abholen auf dem Server gutgeschrieben; Stars liegen nur auf dem Server.
- Neue Wege: `/quests/state`, `/quests/event`, `/quests/beat`, `/quests/claim` (alle nur mit Anmeldung).
Zum Anpassen der Aufgaben oder Belohnungen ändere die Listen `DAILY` und `WEEKLY` oben in `quests.js` und starte den Server neu.

## Cloudy Pass (neu)
Neue Datei: **pass.js** (neben `app.js` und `quests.js`). Keine Datenbank-Änderung nötig (Schlüssel `pass` in `cloudy_kv`).
- 30 Level, Stufe L braucht insgesamt L × 8 Sterne. Belohnungen (Coins, Items) stehen in `pass.js` ganz oben und lassen sich dort ändern. Season-Daten: `SEASON` ebenfalls dort.
- Premium-Reihe: nur mit Cloudy+. Bezahlen ist noch nicht eingebaut; bis dahin vergibst du Cloudy+ per Admin: `POST /admin/plus` mit `{ "name": "...", "days": 30 }` (days 0 = beenden).
