#!/bin/bash
# Gibt dem Mac-Backup-Server eine oeffentliche https-Adresse (kostenloser Cloudflare-Tunnel). Braucht eine Domain, die bei Cloudflare liegt.
cd "$(dirname "$0")" || exit 1
say() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31mFEHLER: %s\033[0m\nDruecke Enter zum Schliessen.\n' "$*"; read -r; exit 1; }
for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do [ -x "$b" ] && eval "$($b shellenv)"; done
command -v brew >/dev/null || fail "Homebrew fehlt. Fuehre zuerst mac-backup-einrichten.command aus."
[ -f mac-backup.env ] || fail "mac-backup.env fehlt. Fuehre zuerst mac-backup-einrichten.command aus."
set -a; . ./mac-backup.env; set +a

say "1/5  cloudflared installieren"
command -v cloudflared >/dev/null || brew install cloudflared || fail "cloudflared konnte nicht installiert werden."

say "2/5  Bei Cloudflare anmelden"
if [ ! -f "$HOME/.cloudflared/cert.pem" ]; then
  echo "Gleich oeffnet sich der Browser. Melde dich bei Cloudflare an und waehle deine Domain aus."
  cloudflared tunnel login || fail "Anmeldung bei Cloudflare fehlgeschlagen."
fi
[ -f "$HOME/.cloudflared/cert.pem" ] || fail "Die Anmeldung wurde nicht abgeschlossen (cert.pem fehlt)."

say "3/5  Adresse waehlen"
echo "Welche Adresse soll das Backup bekommen? Zum Beispiel  backup.deinedomain.de  (die Domain muss bei Cloudflare liegen):"
read -r HOST
HOST="${HOST#https://}"; HOST="${HOST#http://}"; HOST="${HOST%%/*}"
case "$HOST" in *.*) ;; *) fail "Das sieht nicht wie eine Adresse aus: $HOST";; esac

say "4/5  Tunnel anlegen"
NAME=cloudy-backup
ID=$(cloudflared tunnel list --name "$NAME" -o json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const a=JSON.parse(s);console.log(a[0]&&a[0].id||"")}catch{console.log("")}})')
if [ -z "$ID" ]; then
  cloudflared tunnel create "$NAME" || fail "Tunnel konnte nicht angelegt werden."
  ID=$(cloudflared tunnel list --name "$NAME" -o json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const a=JSON.parse(s);console.log(a[0]&&a[0].id||"")}catch{console.log("")}})')
fi
[ -n "$ID" ] || fail "Die Tunnel-ID wurde nicht gefunden."
cloudflared tunnel route dns "$NAME" "$HOST" || echo "Hinweis: Der DNS-Eintrag existiert evtl. schon. Falls spaeter nichts erreichbar ist, loesche im Cloudflare-Dashboard den alten Eintrag fuer $HOST und fuehre das Skript nochmal aus."
cat > "$HOME/.cloudflared/config.yml" <<Y
tunnel: $ID
credentials-file: $HOME/.cloudflared/$ID.json
ingress:
  - hostname: $HOST
    service: http://localhost:${PORT:-3364}
  - service: http_status:404
Y

say "5/5  Startdatei erstellen"
printf 'PUBLIC_URL=https://%s\n' "$HOST" >> mac-backup.env
cat > mac-alles-starten.command <<'S'
#!/bin/bash
# Startet Backup-Server UND Tunnel. Fenster offen lassen.
cd "$(dirname "$0")" || exit 1
for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do [ -x "$b" ] && eval "$($b shellenv)"; done
set -a; . ./mac-backup.env; set +a
brew services start mysql >/dev/null 2>&1
caffeinate -i node app.js &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT INT TERM
sleep 4
echo "Backup-Adresse fuer Cloudy:  $PUBLIC_URL"
cloudflared tunnel run cloudy-backup
S
chmod +x mac-alles-starten.command
printf '\n\033[1;32mFERTIG.\033[0m\nStarte ab jetzt alles mit Doppelklick auf  mac-alles-starten.command\nDanach im Browser testen:  https://%s/health\nDiese Adresse traegst du in Cloudy unter "Backup-Server" ein:  https://%s\n\nDruecke Enter zum Schliessen.\n' "$HOST" "$HOST"
read -r
