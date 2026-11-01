# Backup-Server auf dem Mac (Schritt für Schritt)

**Wichtig vorab:** Ein Backup-Server hilft nur, wenn er **dieselben Konten** kennt. Die Anmelde-Tokens sind in `app.js` mit einem Schlüssel signiert, der in der Datenbank liegt. Deshalb gilt:

- **Gleiche MySQL-Datenbank** wie der Haupt-Server → alles funktioniert, Konten, Coins und Freunde sind identisch. (Variante 1, empfohlen)
- Eigene Datenbank auf dem Mac mit einer Kopie → nur der Stand der letzten Kopie, Änderungen auf dem Backup gehen später verloren. (Variante 2, Notlösung)
- Die dateibasierte `server.js` hat keine gemeinsame Datenbank. Dafür gibt es kein echtes Backup.

## 1. Mac vorbereiten
1. Node.js (LTS) installieren: https://nodejs.org
2. Ordner `server` aus dem Repo auf den Mac kopieren, im Terminal dorthin wechseln und einmal ausführen:
   `npm init -y && npm i express mysql2 cors`
3. Damit der Mac nicht einschläft: Systemeinstellungen → Batterie/Energie → „Ruhezustand verhindern, wenn das Display aus ist“ (am Netzteil). Oder starte den Server mit `caffeinate -i`.

## 2a. Variante 1: dieselbe Datenbank benutzen
1. Beim Hoster der Datenbank **Fernzugriff** erlauben (bei vielen Panels heißt das „Remote MySQL“ oder „Zugelassene IPs“) und deine Heim-IP eintragen. Die Heim-IP ändert sich manchmal, dann musst du sie neu eintragen. Geht das bei deinem Hoster nicht, nimm Variante 2.
2. Starten (Werte vom Haupt-Server übernehmen):
   `DB_HOST=db.deinhoster.de DB_USER=CloudyClient DB_PASS=DEIN_DB_PASSWORT DB_NAME=CloudyClient ADMIN_PASS=DEIN_ADMIN_PASSWORT PORT=3364 node app.js`
3. Test im Browser: `http://localhost:3364/health` muss `{"ok":true,...}` zeigen.

## 2b. Variante 2: Kopie der Datenbank
1. MySQL auf dem Mac: `brew install mysql && brew services start mysql`, dann Datenbank `CloudyClient` und Benutzer anlegen.
2. Auf dem Haupt-Server regelmäßig sichern: `mysqldump CloudyClient > backup.sql` und auf dem Mac einspielen: `mysql CloudyClient < backup.sql`.
3. Starten wie oben, mit `DB_HOST=127.0.0.1`.

## 3. Von außen erreichbar machen (Cloudflare Tunnel, kostenlos, mit HTTPS)
Du brauchst eine Domain bei Cloudflare (kostenloser Account).
1. `brew install cloudflared`
2. `cloudflared tunnel login`
3. `cloudflared tunnel create cloudy-backup`
4. `cloudflared tunnel route dns cloudy-backup backup.deinedomain.de`
5. Datei `~/.cloudflared/config.yml`:
   ```
   tunnel: cloudy-backup
   credentials-file: /Users/DEINNAME/.cloudflared/DIE-ID.json
   ingress:
     - hostname: backup.deinedomain.de
       service: http://localhost:3364
     - service: http_status:404
   ```
6. Starten: `cloudflared tunnel run cloudy-backup`. Als Dauerdienst: `sudo cloudflared service install`.
7. Test: `https://backup.deinedomain.de/health`.

(`cloudflared tunnel --url ...` ohne Domain geht auch, die Adresse ändert sich aber bei jedem Start. Dafür ist es als Backup ungeeignet.)

## 4. Dauerhaft laufen lassen
`sudo npm i -g pm2`, dann `DB_HOST=… DB_USER=… DB_PASS=… DB_NAME=… ADMIN_PASS=… PORT=3364 pm2 start app.js --name cloudy-backup`, danach `pm2 save && pm2 startup` und den angezeigten Befehl ausführen.

## 5. In Cloudy eintragen
Einstellungen → Konto-Server → **Backup-Server**: `https://backup.deinedomain.de` → Speichern. Der Haupt-Server muss dafür die neue `app.js` haben (sie kennt `/admin/backup`). Die Adresse wird auf dem Haupt-Server gespeichert. Alle Spieler mit der neuen Cloudy-Version holen sie sich automatisch und wechseln bei einem Ausfall selbst um.

**Grenzen:** Ein Spieler muss Cloudy (neue Version) mindestens einmal gestartet haben, während der Haupt-Server lief. Fällt der Haupt-Server aus, dauert die erste Umschaltung bis zu 6 Sekunden, danach 60 Sekunden lang direkt der Backup.
