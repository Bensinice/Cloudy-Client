@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
title Tunnel-Adresse setzen
set "PUBLIC_URL=https://cloudyclient.com"
if exist cloudy.env for /f "usebackq eol=# tokens=1,* delims==" %%A in ("cloudy.env") do if /i "%%A"=="PUBLIC_URL" set "PUBLIC_URL=%%B"
set "HOST=%PUBLIC_URL:https://=%"
set "HOST=%HOST:http://=%"
for /f "delims=/" %%H in ("%HOST%") do set "HOST=%%H"
set "CF=cloudy-tools\cloudflared.exe"
if not exist "%CF%" set "CF=cloudflared"
if not exist "%USERPROFILE%\.cloudflared\cert.pem" (
  echo Cloudflare ist auf diesem PC noch nicht angemeldet.
  echo Gleich oeffnet sich der Browser: bei Cloudflare anmelden, die Domain %HOST% waehlen und "Authorize" klicken.
  echo.
  "%CF%" tunnel login
  echo.
)
if not exist "%USERPROFILE%\.cloudflared\cert.pem" (
  echo FEHLER - die Anmeldung wurde nicht abgeschlossen. Bitte nochmal starten und im Browser "Authorize" klicken.
  pause
  exit /b 1
)
echo Setze %HOST% auf den Tunnel "cloudy-server" ^(ueberschreibt einen alten Eintrag^) ...
"%CF%" tunnel route dns --overwrite-dns cloudy-server %HOST%
echo.
if errorlevel 1 ( echo FEHLER - schick mir den Text oben. ^& echo Falls "tunnel not found" dasteht: den Tunnel "cloudy-server" gibt es auf diesem PC nicht, siehe LIES-MICH. ) else ( echo Fertig. Warte 1-2 Minuten und oeffne dann %PUBLIC_URL%/health )
echo.
pause
