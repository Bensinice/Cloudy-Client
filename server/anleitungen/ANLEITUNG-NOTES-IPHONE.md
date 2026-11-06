# Cloudy Notes auf dem iPhone (Web-App / PWA)

## Was es ist
Eine installierbare Web-App unter **https://cloudyclient.com/notes/**. Sie benutzt dein normales Cloudy-Konto und **dieselbe Datenbank** wie die Cloudy Server App – es gibt kein zweites Notizsystem. Dateien liegen in `server/site/notes/` (werden mit der Webseite ausgeliefert).

Warum keine native App? Eine echte iPhone-App (SwiftUI) bräuchte Xcode, einen Mac, ein Apple-Entwicklerkonto (99 $/Jahr) und müsste für jedes Update neu gebaut und signiert werden (TestFlight/App Store). Das Projekt in `ios/` ist nur ein Web-Wrapper ohne Signierung. Die Web-App liefert dasselbe ohne diese Kosten und aktualisiert sich selbst.

## Installieren (einmalig, ~1 Minute)
1. Auf dem iPhone in **Safari** `https://cloudyclient.com/notes/` öffnen.
2. Mit deinem Cloudy-Benutzernamen und Passwort anmelden.
3. Teilen-Symbol → **Zum Home-Bildschirm** → Hinzufügen. (Auf iOS geht das nur in Safari.)
4. Ab jetzt startet „Notes“ vom Home-Bildschirm im Vollbild.

Voraussetzung: dein Cloudy-Server läuft und ist über `cloudyclient.com` (HTTPS) erreichbar – ohne HTTPS gibt es weder Installation noch Offline-Modus.

## Notizen mit der Server App teilen
In der Cloudy Server App: **Notes → Einstellungen → „Cloudy-Konto verknüpfen“**, deinen Cloudy-Benutzernamen eintragen. Bisherige Notizen der Server App werden auf dein Konto übernommen. Danach sehen Server App, iPhone und Website dieselben Notizen. (Ohne Verknüpfung bleiben die Notizen der Server App getrennt.)

## Sync
- Speichert automatisch (kurz nach dem Tippen). Anzeige oben: Gespeichert / Speichert … / Offline.
- Offline kannst du lesen und schreiben; es wird gesendet, sobald wieder Internet da ist.
- Ändern zwei Geräte dieselbe Notiz, geht nichts verloren: die andere Fassung bleibt als „(Konflikt-Kopie)“.
- Der Offline-Speicher liegt im Browser des Geräts. Abmelden löscht ihn.

## Updates
- **Web-App:** sie prüft beim Öffnen und alle 30 Minuten auf eine neue Version. Ist eine da und nichts Ungespeichertes offen, lädt sie sich selbst neu; sonst erscheint „Update verfügbar“. Notizen und Anmeldung bleiben erhalten. Manuell: Zahnrad → „Nach Updates suchen“.
- **Neue Version ausliefern:** in `server/site/notes/` die Version an **drei** Stellen gleich hochsetzen: `VERSION` in `sw.js`, `APP_VERSION` in `app.js`, `?v=` in `index.html` – `node scripts/test-notes-pwa.js` prüft das. Dann die Dateien auf den Server legen (kein Neustart nötig).
- **Server:** `GET /notes/info` meldet `server`, `api` und `minClientApi`. Eine App funktioniert, solange `minClientApi` ≤ ihrer API ist. Wird die API einmal inkompatibel, zeigt eine alte App einen Hinweis und aktualisiert sich. Datenbanktabellen werden beim Serverstart nur ergänzt (`CREATE TABLE IF NOT EXISTS`/`ALTER`), nie gelöscht.

## Versionen getrennt
Launcher (`package.json`), Server App, Notes-Web-App (`APP_VERSION`), Notizen-Server (`VERSION.server`) und API (`VERSION.api`) zählen unabhängig voneinander.

## Rückgängig / Fehler
- Alte Web-App-Version zurück: alte Dateien in `server/site/notes/` wiederherstellen (Version nicht niedriger als die installierte setzen – lieber eine höhere Nummer mit altem Inhalt).
- Wenn gar nichts mehr lädt: Einstellungen → Safari → Website-Daten → cloudyclient.com löschen (Notizen liegen weiter auf dem Server).
