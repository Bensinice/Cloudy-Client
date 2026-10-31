@echo off
chcp 65001 >nul
setlocal
title Cloudy Setup bauen
cd /d "%~dp0"
cls
echo.
echo   Baut den richtigen Windows-Installer "Cloudy-Setup.exe" (dauert 3 bis 6 Minuten).
echo.
where node >nul 2>nul
if errorlevel 1 (echo   Node.js fehlt. Installiere die LTS-Version von https://nodejs.org und starte diese Datei erneut. & start https://nodejs.org & pause & exit /b 1)
call npm install --no-audit --no-fund
if errorlevel 1 goto fail
call npx electron-builder --win nsis --x64
if errorlevel 1 goto fail
echo.
echo   Fertig! Der Installer liegt in:  %~dp0dist\Cloudy-Setup.exe
start "" "%~dp0dist"
pause
exit /b 0
:fail
echo.
echo   Das hat leider nicht geklappt. Mache einen Screenshot dieses Fensters und schick ihn mir.
pause
exit /b 1
