# Cloudy-Server (Mac)

**Nur eine Datei öffnen: `CLOUDY-SERVER.command`** (Doppelklick, beim ersten Mal Rechtsklick → Öffnen).

- Erster Start: installiert alles Nötige (Homebrew, Node, MySQL, cloudflared), legt Datenbank und `cloudy.env` an (Admin-Passwort, optional Upload-Schlüssel), richtet den Cloudflare-Tunnel ein oder nutzt den vorhandenen.
- Jeder weitere Start: startet MySQL, Server und Tunnel. Stürzt der Server ab oder aktualisiert er sich, startet er automatisch neu. Fenster offen lassen.
- Test: `https://deine-domain/health` muss `{"ok":true,…}` zeigen.
- Update des Servers: neue Dateien über die alten kopieren (`cloudy.env` und Datenbank bleiben), Datei erneut doppelklicken.

Ordner: `app.js` (Server), `quests.js`, `pass.js`, `stripe.js`, `mail.js`, `site.js`, `status.js`, `keyreq.js` (Module), `site/` (Webseite), `server.js` (alter Datei-Server, ungenutzt), `anleitungen/` (Details).
Geheimnisse (Passwörter, Schlüssel) stehen nur in `cloudy.env` auf dem Mac, nie im Repo.
