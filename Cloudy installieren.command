#!/bin/bash
# Doppelklick: installiert Cloudy komplett (Node.js, Bibliotheken, Electron) und legt Cloudy.app in /Programme ab.
cd "$(dirname "$0")"
clear
echo "☁️  Cloudy wird installiert. Beim ersten Mal dauert das 3 bis 5 Minuten."
fail(){ echo; echo "❌ $1"; read -n 1 -s -r -p "Taste drücken zum Beenden"; exit 1; }

if ! command -v node >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then brew install node || fail "Node.js konnte nicht installiert werden."
  else open "https://nodejs.org"; fail "Node.js fehlt. Installiere die LTS-Version und starte diese Datei danach erneut."; fi
fi

SRC="$PWD"; STAGE="$(mktemp -d /tmp/cloudy-build.XXXXXX)"; APP="$STAGE/Cloudy.app"
mkdir -p "$STAGE/app" "$STAGE/tools"
echo "[1/4] Programmdateien kopieren …"
rsync -a --exclude node_modules --exclude dist --exclude .git --exclude .github --exclude client-src --exclude scripts --exclude '*.bat' --exclude '*.command' --exclude '*.md' "$SRC/" "$STAGE/app/" || fail "Kopieren fehlgeschlagen."
echo "[2/4] Bibliotheken laden …"
(cd "$STAGE/app" && npm install --omit=dev --no-audit --no-fund) || fail "npm install fehlgeschlagen."
EV=$(node -p "require('./package.json').devDependencies.electron.replace('^','')")
echo "[3/4] Electron $EV laden …"
(cd "$STAGE/tools" && npm init -y >/dev/null && npm install "electron@$EV" --no-audit --no-fund && node node_modules/electron/install.js) || fail "Electron konnte nicht geladen werden."
cp -R "$STAGE/tools/node_modules/electron/dist/Electron.app" "$APP" || fail "Electron.app fehlt."

echo "[4/4] Cloudy einrichten …"
mv "$APP/Contents/MacOS/Electron" "$APP/Contents/MacOS/Cloudy"
P="$APP/Contents/Info.plist"
for kv in "CFBundleName=Cloudy" "CFBundleDisplayName=Cloudy" "CFBundleExecutable=Cloudy" "CFBundleIdentifier=app.cloudy.launcher"; do plutil -replace "${kv%%=*}" -string "${kv#*=}" "$P"; done
sips -s format icns "$STAGE/app/build/icon.png" --out "$APP/Contents/Resources/electron.icns" >/dev/null 2>&1
rm -f "$APP/Contents/Resources/default_app.asar"
mkdir -p "$APP/Contents/Resources/app" && cp -R "$STAGE/app/." "$APP/Contents/Resources/app/"
pkill -x Cloudy 2>/dev/null
rm -rf /Applications/Cloudy.app
cp -R "$APP" /Applications/Cloudy.app || fail "Kopieren nach /Programme fehlgeschlagen."
xattr -cr /Applications/Cloudy.app
codesign --force --deep --sign - /Applications/Cloudy.app 2>/dev/null
rm -rf "$STAGE"
echo "✅ Fertig! Cloudy ist in deinem Programme-Ordner."
open /Applications/Cloudy.app
