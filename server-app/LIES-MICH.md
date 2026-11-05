# Cloudy Server (Fenster-App)

Hostet den Cloudy-Server ohne Terminal. Enthält Node (über Electron) – du musst nichts installieren außer MySQL (und `cloudflared`, wenn du den Tunnel aus der App starten willst).

- **Übersicht**: Starten / Stoppen / Neustarten, Status, Gesundheitscheck.
- **Logs**: live, filterbar, gespeichert pro Tag (14 Tage). Fehlerbericht ohne Passwörter.
- **Datenbank**: Verbindung testen, Datenbank + Benutzer anlegen (Root-Passwort wird nicht gespeichert).
- **Tunnel**: `cloudflared` per Token oder vorhandener Einrichtung.
- **Backup**: Dateien (+ Datenbank mit `mysqldump`), optional täglich.
- **Einstellungen → Code-Editor**: `app.js` & Co. bearbeiten. Beim Speichern: Syntaxprüfung, alte Fassung wird gesichert, „Original“ stellt die mitgelieferte Version wieder her.
- **Einstellungen → Konfiguration**: `cloudy.env` (Umgebungsvariablen: DB_HOST, DB_USER, DB_NAME, DB_PASS, ADMIN_PASS, PORT, PUBLIC_URL, UPLOAD_KEY, …).
- Server-Ordner standardmäßig im App-Datenordner; du kannst einen bestehenden Ordner wählen. Eigene Änderungen werden bei App-Updates nie überschrieben.

Mac (ungesigniert): nach dem Kopieren nach „Programme“ einmal `xattr -cr "/Applications/Cloudy Server.app"` oder Rechtsklick → Öffnen.
Entwickeln: `cd server-app && npm install && npm start` (Server-Dateien kommen dann aus `../server`). Tests: `npm test`.
