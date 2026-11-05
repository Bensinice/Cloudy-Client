# Cloudy-Server (Mac)

**Nur eine Datei öffnen: `CLOUDY-SERVER.command`** (Doppelklick, beim ersten Mal Rechtsklick → Öffnen).

- Erster Start: installiert alles Nötige (Homebrew, Node, MySQL, cloudflared), legt Datenbank und `cloudy.env` an (Admin-Passwort, optional Upload-Schlüssel), richtet den Cloudflare-Tunnel ein oder nutzt den vorhandenen.
- Jeder weitere Start: startet MySQL, Server und Tunnel. Stürzt der Server ab oder aktualisiert er sich, startet er automatisch neu. Fenster offen lassen.
- Test: `https://deine-domain/health` muss `{"ok":true,…}` zeigen.
- Update des Servers: neue Dateien über die alten kopieren (`cloudy.env` und Datenbank bleiben), Datei erneut doppelklicken.

Ordner: `app.js` (Server), `quests.js`, `pass.js`, `stripe.js`, `mail.js`, `site.js`, `status.js`, `keyreq.js` (Module), `site/` (Webseite), `server.js` (alter Datei-Server, ungenutzt), `anleitungen/` (Details).
Geheimnisse (Passwörter, Schlüssel) stehen nur in `cloudy.env` auf dem Mac, nie im Repo.

## Cloudy Notes (neu)
`notes.js` speichert Notizen, Prompts, Entwicklungsstatus und Tour-Stand je Konto in der vorhandenen Datenbank (Tabellen `cloudy_notes`, `cloudy_notes_hist`, `cloudy_notes_user` werden beim Start automatisch angelegt). Der OpenAI-API-Key jedes Nutzers wird **verschlüsselt** (AES-256-GCM) gespeichert und nie an die App zurückgegeben; der Server ruft OpenAI selbst auf.
Optionale Variablen in `cloudy.env`:
- `NOTES_SECRET` – eigener Schlüssel für die Verschlüsselung (sonst wird er vom Anmelde-Geheimnis abgeleitet). Ändert er sich, müssen Nutzer ihren OpenAI-Key neu eintragen.
- `NOTES_OPENAI_MODEL` – Standardmodell (sonst `gpt-4.1`); jeder Nutzer kann in „AI Connections“ ein anderes wählen.
- `NOTES_OPENAI_BASE` – nur für Tests/Proxy (Standard `https://api.openai.com/v1`).
Der Server braucht ausgehend Internet zu `api.openai.com`. Limits: 6 Prompt-Anfragen pro Minute und 80 pro Tag je Konto.
