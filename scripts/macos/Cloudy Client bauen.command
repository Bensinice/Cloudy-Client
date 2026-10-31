#!/bin/bash
# Doppelklick: baut die Cloudy-Client-Mod (client/cloudy-client.jar). Braucht Java 21 (JDK) und Gradle.
cd "$(dirname "$0")/../../client-src"
clear
fail(){ echo "$1"; read -n 1 -s -r -p "Taste drücken zum Beenden"; exit 1; }
command -v javac >/dev/null 2>&1 || fail "Java-JDK 21 fehlt. Installiere es mit:  brew install --cask temurin@21"
command -v gradle >/dev/null 2>&1 || fail "Gradle fehlt. Installiere es mit:  brew install gradle"
gradle build --no-daemon || fail "Build fehlgeschlagen."
mkdir -p ../client && cp build/libs/cloudy-client-1.2.0.jar ../client/cloudy-client.jar
echo "✅ Fertig: client/cloudy-client.jar"
read -n 1 -s -r -p "Taste drücken zum Beenden"
