@echo off
chcp 65001 >nul
rem Doppelklick: startet Cloudy direkt (ohne Installer) und installiert fehlende Pakete automatisch
cd /d "%~dp0..\.."
where node >nul 2>nul || (start https://nodejs.org & echo Node.js fehlt. Bitte installieren und erneut starten. & pause & exit /b 1)
call npm install || (echo npm install fehlgeschlagen. & pause & exit /b 1)
node node_modules\electron\install.js 2>nul
call npm start
