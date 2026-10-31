#!/bin/bash
# Doppelklick: startet Cloudy direkt (ohne App zu bauen) und installiert fehlende Pakete automatisch
cd "$(dirname "$0")/../.."
npm install && npm start
