#!/bin/bash
# ============================================================================
#  CLOUDY-SERVER.command  -  die EINE Datei fuer den Cloudy-Server auf dem Mac.
#  Doppelklick (beim ersten Mal: Rechtsklick -> Oeffnen). Beim ersten Start richtet sie
#  alles ein (Homebrew, Node, MySQL, Datenbank, Cloudflare-Tunnel). Danach startet sie
#  bei jedem Doppelklick Datenbank + Server + Tunnel. Fenster offen lassen.
# ============================================================================
cd "$(dirname "$0")" || exit 1
say()  { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m%s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31mFEHLER: %s\033[0m\nDruecke Enter zum Schliessen.\n' "$*"; read -r; exit 1; }
brewenv() { for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do [ -x "$b" ] && eval "$($b shellenv)"; done; }
brewenv
ENVF=cloudy.env
# Einstellungen aus der alten Backup-Einrichtung uebernehmen
[ ! -f "$ENVF" ] && [ -f mac-backup.env ] && cp mac-backup.env "$ENVF"

# ---------------------------------------------------------------- Programme
say "1/5  Programme pruefen"
if ! command -v brew >/dev/null; then
  echo "Homebrew (Programm-Installer) fehlt und wird installiert. Dein Mac-Passwort wird abgefragt, beim Tippen sieht man nichts."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || fail "Homebrew konnte nicht installiert werden."
  brewenv
fi
command -v brew >/dev/null || fail "Homebrew wurde nicht gefunden."
command -v node >/dev/null || brew install node || fail "Node.js konnte nicht installiert werden."
command -v mysql >/dev/null || brew install mysql || fail "MySQL konnte nicht installiert werden."
command -v cloudflared >/dev/null || brew install cloudflared || fail "cloudflared konnte nicht installiert werden."
if [ ! -d node_modules/express ] || [ ! -d node_modules/mysql2 ] || [ ! -d node_modules/cors ]; then
  [ -f package.json ] || npm init -y >/dev/null 2>&1
  npm i express mysql2 cors >/dev/null 2>&1 || fail "npm install ist fehlgeschlagen (Internet?)."
fi
echo "Alles da."

# ---------------------------------------------------------------- MySQL
say "2/5  MySQL starten"
brew services start mysql >/dev/null 2>&1
printf "Warte auf MySQL"; for i in $(seq 1 40); do mysqladmin ping --silent 2>/dev/null && break; printf "."; sleep 2; done; echo
mysqladmin ping --silent 2>/dev/null || fail "MySQL startet nicht. Starte den Mac neu und doppelklicke die Datei nochmal."

# ---------------------------------------------------------------- Einstellungen / Datenbank (nur beim ersten Mal)
say "3/5  Einstellungen und Datenbank"
if [ ! -f "$ENVF" ]; then
  echo "Erster Start: Ich lege die Datenbank und die Einstellungen an."
  DB_PASS=$(openssl rand -hex 10)
  echo "Tippe das ADMIN-Passwort fuer dein Admin-Konto ein (mind. 8 Zeichen, beim Tippen sieht man nichts):"
  read -r -s ADMIN_PASS; echo
  [ ${#ADMIN_PASS} -ge 8 ] || fail "Das Admin-Passwort braucht mindestens 8 Zeichen."
  echo "Upload-Schluessel fuer GitHub-Releases (das gleiche wie das GitHub-Secret CLOUDY_UPLOAD_KEY, mind. 12 Zeichen). Ohne Upload einfach Enter:"
  read -r -s UPLOAD_KEY; echo
  echo "Oeffentliche Adresse deines Servers (Enter = https://cloudyclient.com):"
  read -r PUBLIC_URL; PUBLIC_URL="${PUBLIC_URL:-https://cloudyclient.com}"
  umask 077
  printf 'DB_HOST=127.0.0.1\nDB_USER=CloudyClient\nDB_NAME=CloudyClient\nDB_PASS=%s\nADMIN_PASS=%s\nPORT=3364\nPUBLIC_URL=%s\n' "$DB_PASS" "$ADMIN_PASS" "$PUBLIC_URL" > "$ENVF"
  [ -n "$UPLOAD_KEY" ] && printf 'UPLOAD_KEY=%s\n' "$UPLOAD_KEY" >> "$ENVF"
  umask 022
  mysql -u root <<SQL || fail "Datenbank konnte nicht angelegt werden. Hast du ein MySQL-Root-Passwort gesetzt? Dann schick mir diese Meldung."
CREATE DATABASE IF NOT EXISTS CloudyClient CHARACTER SET utf8mb4;
CREATE USER IF NOT EXISTS 'CloudyClient'@'127.0.0.1' IDENTIFIED BY '$DB_PASS';
ALTER USER 'CloudyClient'@'127.0.0.1' IDENTIFIED BY '$DB_PASS';
GRANT ALL ON CloudyClient.* TO 'CloudyClient'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
  echo "Wenn du Konten von deinem alten Server mitnehmen willst: ziehe die exportierte .sql-Datei in dieses Fenster und druecke Enter. Sonst nur Enter:"
  read -r F
  F="${F%"${F##*[![:space:]]}"}"; F="${F#\'}"; F="${F%\'}"; F="${F#\"}"; F="${F%\"}"; F="${F//\\ / }"
  if [ -n "$F" ]; then
    [ -f "$F" ] || fail "Die Datei wurde nicht gefunden: $F"
    mysql -u root -e "DROP DATABASE IF EXISTS CloudyClient; CREATE DATABASE CloudyClient CHARACTER SET utf8mb4; GRANT ALL ON CloudyClient.* TO 'CloudyClient'@'127.0.0.1';" || fail "Alte Datenbank konnte nicht geleert werden."
    MYSQL_PWD="$DB_PASS" mysql -u CloudyClient -h 127.0.0.1 CloudyClient < "$F" || fail "Die Datei konnte nicht eingespielt werden."
    echo "Daten eingespielt."
  fi
else
  echo "Gespeicherte Einstellungen (cloudy.env) werden benutzt."
fi
set -a; . "./$ENVF"; set +a
export PORT="${PORT:-3364}"
MYSQL_PWD="$DB_PASS" mysql -u "$DB_USER" -h 127.0.0.1 "$DB_NAME" -e "SELECT 1" >/dev/null 2>&1 || fail "Die Datenbank ist nicht erreichbar (Benutzer/Passwort aus cloudy.env). Loesche cloudy.env, wenn du neu einrichten willst."

# ---------------------------------------------------------------- Tunnel
say "4/5  Cloudflare-Tunnel (Verbindung zu deiner Domain)"
CF="$HOME/.cloudflared/config.yml"
if [ -f "$CF" ]; then
  echo "Vorhandener Tunnel wird benutzt ($CF)."
else
  echo "Noch kein Tunnel eingerichtet. Ich lege einen an (die Domain muss bei Cloudflare liegen)."
  if [ ! -f "$HOME/.cloudflared/cert.pem" ]; then
    echo "Gleich oeffnet sich der Browser: bei Cloudflare anmelden und die Domain waehlen."
    cloudflared tunnel login || fail "Anmeldung bei Cloudflare fehlgeschlagen."
  fi
  HOST="${PUBLIC_URL#https://}"; HOST="${HOST#http://}"; HOST="${HOST%%/*}"
  NAME=cloudy-server
  idof() { cloudflared tunnel list --name "$NAME" -o json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const a=JSON.parse(s);console.log(a[0]&&a[0].id||"")}catch{console.log("")}})'; }
  ID=$(idof); [ -z "$ID" ] && { cloudflared tunnel create "$NAME" || fail "Tunnel konnte nicht angelegt werden."; ID=$(idof); }
  [ -n "$ID" ] || fail "Die Tunnel-ID wurde nicht gefunden."
  cloudflared tunnel route dns "$NAME" "$HOST" || warn "Hinweis: Der DNS-Eintrag fuer $HOST existiert evtl. schon. Falls nichts erreichbar ist, loesche den alten Eintrag im Cloudflare-Dashboard und starte die Datei nochmal."
  printf 'tunnel: %s\ncredentials-file: %s/.cloudflared/%s.json\ningress:\n  - hostname: %s\n    service: http://127.0.0.1:%s\n  - service: http_status:404\n' "$ID" "$HOME" "$ID" "$HOST" "$PORT" > "$CF"
fi

# ---------------------------------------------------------------- Start
say "5/5  Server und Tunnel starten"
SRVPID=""
cleanup() { [ -n "$SRVPID" ] && kill "$SRVPID" 2>/dev/null; kill 0 2>/dev/null; }
trap cleanup EXIT INT TERM
# Server in Schleife: stuerzt er ab oder startet sich nach einem Update selbst neu, laeuft er sofort wieder
( while true; do caffeinate -i node app.js; echo "Server beendet, Neustart in 3 Sekunden (Strg+C zum Stoppen) ..."; sleep 3; done ) &
SRVPID=$!
sleep 5
if curl -fs "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then printf '\033[1;32mServer laeuft auf Port %s.\033[0m\n' "$PORT"; else warn "Der Server antwortet noch nicht - siehe Meldungen oben (z. B. 'Start fehlgeschlagen')."; fi
echo "Adresse: ${PUBLIC_URL:-deine Domain}   -   Test: ${PUBLIC_URL:-https://deine-domain}/health"
echo "Fenster offen lassen. Beenden mit Strg+C."
cloudflared tunnel run
