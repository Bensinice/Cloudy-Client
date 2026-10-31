# Cloudy
Minecraft-Launcher mit Liquid-Glass-Design, 8 Farbthemen, Fabric-/Modrinth-Manager, Ressourcen-Manager und automatischen Updates. Windows 10/11 und macOS.

## Fertige Programme (nichts selbst bauen)
1. Ordner als GitHub-Repo hochladen (Branch `main`). GitHub baut automatisch (Tab „Actions“, 5–10 Min.).
2. Unter **Releases** laden: `Cloudy-Setup.exe` (Installer), `Cloudy-Portable.exe` (ohne Installation), `Cloudy-arm64.dmg` / `Cloudy-x64.dmg` (macOS).
3. Windows-Warnung bei unsignierten Programmen: **Weitere Informationen > Trotzdem ausführen**.

## Updates für Nutzer
- Repo einmal in `config/app.json` eintragen: `{ "updateRepo": "deinname/cloudy" }`.
- Neues Update veröffentlichen: `version` in `package.json` erhöhen und hochladen. Cloudy meldet es beim Start; **Jetzt aktualisieren** lädt (mit Fortschritt), installiert und startet neu. Einstellungen, Mods, Profile und Welten bleiben erhalten.

## Projektstruktur
```
main.js · preload.js · index.html   Electron (Hauptprozess, Brücke, Oberfläche)
assets/css · assets/js              Design und Oberflächen-Logik
themes/themes.css                   Farbthemen (Variablen)
update/updater.js                   Updater (Prüfen, Download, Installation, Neustart)
lib/                                Mod-/Paket-/Java-/Optionen-Helfer
config/app.json                     Konfiguration (Update-Quelle)
build/icon.png                      App-Icon
client-src/ · client/               Fabric-Client-Mod (1.21.4, Java 21)
Cloudy installieren.bat/.command    Ein-Klick-Installer
Cloudy Setup bauen.bat              Baut den richtigen Installer dist\Cloudy-Setup.exe (wie Lunar)
scripts/                            Entwicklungs- und Client-Mod-Skripte
.github/workflows/build.yml         Automatischer Build und Release
```

## Installieren – ein Klick
- **Windows:** `Cloudy installieren.bat` doppelklicken. Installiert Node.js falls nötig, richtet Cloudy unter `%LOCALAPPDATA%\Programs\Cloudy` ein, legt Desktop- und Startmenü-Verknüpfung an und startet es.
- **macOS:** `Cloudy installieren.command` doppelklicken (installiert Cloudy.app nach /Programme).
- Entwicklung: `scripts/windows/Cloudy starten.bat` bzw. `scripts/macos/Cloudy starten.command`. Fertige Installer (.exe/.dmg): `npm run dist:win` / `npm run dist` oder GitHub-Action.

Java wird passend zur Minecraft-Version erkannt (vorhandenes Java mit richtiger Version) oder automatisch geladen. Nutzerdaten liegen getrennt vom Programm und bleiben bei Neuinstallation erhalten.

## Client-Mod
`client-src/` (Fabric, Minecraft 1.21.4) wird von der GitHub-Action zu `client/cloudy-client.jar` gebaut. Lokal: `scripts/*/Cloudy Client bauen.*` (JDK 21 + Gradle).

## Credits
- Cosmetics-Modelle "ZZv4 Cosmetics", "ZZv4 15 Million", "ZZv3 Cosmetics", "ZZv3 1 Million Special", "ZZv5 2 Million" und "500K Cosmetics" und "Yin Yang Black/White" von nqrman (Umhang, Flügel, Schild) von BastiGHG, lizenziert unter CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), von Cloudy in Netze für Minecraft umgewandelt; Silber-Varianten sind eingefärbte Kopien der Original-Texturen.
- Schrift "Poppins" (SIL Open Font License 1.1).
