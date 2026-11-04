# Cloudy-Server einrichten (Schritt für Schritt)

Der Server speichert alle Konten zentral. Als Admin siehst du darüber alle Tester.
Er braucht nur **Node.js 18 oder neuer**, sonst nichts.

## A) Zuerst am eigenen PC testen
1. Node.js (LTS) von https://nodejs.org installieren.
2. Ordner `cloudy-server` öffnen, dort ein Terminal / die Eingabeaufforderung starten.
3. Starten (Windows):
   `set ADMIN_PASS=adminonlyacc && node server.js`
   Mac/Linux: `ADMIN_PASS=adminonlyacc node server.js`
4. Im Browser `http://localhost:8080/health` öffnen. Es muss `{"ok":true}` erscheinen.

Beim ersten Start entstehen die Konten **admin** (Passwort = ADMIN_PASS) und **Tester** (Passwort 12345, Wechsel Pflicht, unendlich Coins). Alles liegt in `accounts.json`.

## B) Für alle Tester erreichbar machen (Variante 1: Mietserver, empfohlen)
1. Einen kleinen Linux-Server (VPS) mieten, z. B. bei Hetzner, Netcup oder Contabo (ca. 3–5 €/Monat), mit Ubuntu.
2. Per SSH einloggen und Node installieren:
   `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs`
3. Den Ordner `cloudy-server` hochladen (z. B. mit WinSCP oder `scp -r cloudy-server root@DEINE-IP:/opt/`).
4. Dauerhaft starten, auch nach Neustart:
   `sudo npm i -g pm2`
   `cd /opt/cloudy-server && ADMIN_PASS=DEIN_STARKES_PASSWORT pm2 start server.js --name cloudy`
   `pm2 save && pm2 startup`
5. Port 8080 in der Firewall freigeben: `sudo ufw allow 8080`.
6. Test: `http://DEINE-IP:8080/health`.

**Wichtig – HTTPS:** Ohne HTTPS laufen Passwörter unverschlüsselt durchs Netz. Hol dir eine Domain (oder Gratis-Subdomain wie DuckDNS) und setze Caddy davor:
`sudo apt install -y caddy` und in `/etc/caddy/Caddyfile`:
```
konten.deinedomain.de {
  reverse_proxy localhost:8080
}
```
`sudo systemctl reload caddy`. Danach ist der Server unter `https://konten.deinedomain.de` erreichbar (Zertifikat automatisch). Dann Port 8080 wieder nach außen sperren.

## C) Variante 2: Gratis-Hoster (Render, Railway)
Ordner in ein GitHub-Repository hochladen, dort „New Web Service“ wählen, Start-Befehl `node server.js`, Umgebungsvariable `ADMIN_PASS` setzen. HTTPS gibt es automatisch. Achtung: Gratis-Pläne schlafen ein und löschen oft Dateien – `accounts.json` braucht einen dauerhaften Speicher („Disk“/Volume, meist kostenpflichtig).

## D) Variante 3: Dein eigener PC
Router-Portfreigabe für Port 8080 und eine DynDNS-Adresse nötig. PC muss immer laufen. Nicht empfohlen.

## Funktionen des Servers
`POST /register`, `POST /login`, `GET /me`, `POST /password`
Admin: `GET /admin/users`, `POST /admin/ban`, `/admin/coins`, `/admin/reset`, `/admin/delete`
Anmeldung per Token (`Authorization: Bearer …`), Passwörter nur als scrypt-Hash, Begrenzung auf 10 Versuche pro Minute.

## Backup
Die Datei `accounts.json` regelmäßig kopieren. Sie enthält alle Konten.

## Im Launcher einschalten
Cloudy → Einstellungen → **Konto-Server**: Adresse eintragen (z. B. `https://konten.deinedomain.de`), Speichern, neu anmelden. Danach melden sich alle über den Server an. Als `admin` siehst du unter „Konten verwalten“ alle Tester und kannst sperren, Passwort zurücksetzen oder löschen.
Hinweis: Coins/Shop-Käufe werden weiterhin pro PC gespeichert, nur Konten, Sperren und Passwörter liegen zentral.
