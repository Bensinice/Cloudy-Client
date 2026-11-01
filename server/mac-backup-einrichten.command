#!/bin/bash
# Richtet auf dem Mac alles fuer den Cloudy-Backup-Server ein (MySQL, Datenbank, Benutzer, Daten einspielen, Server-Startdatei).
cd "$(dirname "$0")" || exit 1
say() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31mFEHLER: %s\033[0m\nDruecke Enter zum Schliessen.\n' "$*"; read -r; exit 1; }

say "1/6  Homebrew (Programm-Installer) pruefen"
for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do [ -x "$b" ] && eval "$($b shellenv)"; done
if ! command -v brew >/dev/null; then
  echo "Homebrew fehlt, wird installiert (dein Mac-Passwort wird abgefragt, beim Tippen sieht man nichts)."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || fail "Homebrew konnte nicht installiert werden."
  for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do [ -x "$b" ] && eval "$($b shellenv)"; done
fi
command -v brew >/dev/null || fail "Homebrew wurde nicht gefunden."

say "2/6  MySQL und Node.js installieren (dauert ein paar Minuten)"
brew list mysql >/dev/null 2>&1 || brew install mysql || fail "MySQL konnte nicht installiert werden."
command -v node >/dev/null || brew install node || fail "Node.js konnte nicht installiert werden."
brew services start mysql >/dev/null 2>&1
printf "Warte auf MySQL"; for i in $(seq 1 40); do mysqladmin ping --silent 2>/dev/null && break; printf "."; sleep 2; done; echo
mysqladmin ping --silent 2>/dev/null || fail "MySQL startet nicht. Starte den Mac neu und fuehre das Skript nochmal aus."

say "3/6  Passwoerter festlegen"
if [ -f mac-backup.env ]; then . ./mac-backup.env; echo "Vorhandene Einstellungen aus mac-backup.env werden benutzt."; fi
if [ -z "$DB_PASS" ]; then DB_PASS=$(openssl rand -hex 10); fi
if [ -z "$ADMIN_PASS" ]; then
  echo "Tippe das ADMIN-Passwort deines Haupt-Servers ein (das gleiche, mit dem du dich als admin anmeldest). Beim Tippen sieht man nichts:"
  read -r -s ADMIN_PASS; echo
  [ ${#ADMIN_PASS} -ge 8 ] || fail "Das Admin-Passwort braucht mindestens 8 Zeichen."
fi
umask 077
printf 'DB_HOST=127.0.0.1\nDB_USER=CloudyClient\nDB_NAME=CloudyClient\nDB_PASS=%s\nADMIN_PASS=%s\nPORT=3364\n' "$DB_PASS" "$ADMIN_PASS" > mac-backup.env
. ./mac-backup.env

say "4/6  Datenbank anlegen"
mysql -u root <<SQL || fail "Datenbank konnte nicht angelegt werden. Hast du schon ein MySQL-Root-Passwort gesetzt? Dann brauche ich Hilfe."
CREATE DATABASE IF NOT EXISTS CloudyClient CHARACTER SET utf8mb4;
CREATE USER IF NOT EXISTS 'CloudyClient'@'127.0.0.1' IDENTIFIED BY '$DB_PASS';
ALTER USER 'CloudyClient'@'127.0.0.1' IDENTIFIED BY '$DB_PASS';
GRANT ALL ON CloudyClient.* TO 'CloudyClient'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

say "5/6  Konten vom Haupt-Server einspielen"
echo "Ziehe jetzt die exportierte .sql-Datei (aus phpMyAdmin) in dieses Fenster und druecke Enter."
echo "Ohne Datei einfach nur Enter (dann startet das Backup leer und kennt keine Konten):"
read -r F
F="${F%"${F##*[![:space:]]}"}"; F="${F#\'}"; F="${F%\'}"; F="${F#\"}"; F="${F%\"}"; F="${F//\\ / }"
if [ -n "$F" ]; then
  [ -f "$F" ] || fail "Die Datei wurde nicht gefunden: $F"
  mysql -u CloudyClient -p"$DB_PASS" -h 127.0.0.1 CloudyClient < "$F" || fail "Die Datei konnte nicht eingespielt werden."
  echo "Daten eingespielt."
fi

say "6/6  Server-Programme installieren und Startdatei erstellen"
[ -f package.json ] || npm init -y >/dev/null 2>&1
npm i express mysql2 cors >/dev/null 2>&1 || fail "npm install ist fehlgeschlagen (Internet?)."
cat > mac-backup-starten.command <<'S'
#!/bin/bash
cd "$(dirname "$0")" || exit 1
set -a; . ./mac-backup.env; set +a
brew services start mysql >/dev/null 2>&1
echo "Cloudy-Backup-Server laeuft auf http://localhost:$PORT  (Fenster offen lassen, zum Beenden Strg+C)"
exec caffeinate -i node app.js
S
chmod +x mac-backup-starten.command

printf '\n\033[1;32mFERTIG.\033[0m\nStarte den Server mit Doppelklick auf  mac-backup-starten.command\nTest im Browser: http://localhost:3364/health\n\nDruecke Enter zum Schliessen.\n'
read -r
