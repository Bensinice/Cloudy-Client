@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
title Cloudy Reparatur
rem Diese Datei muss im selben Ordner liegen wie CLOUDY-SERVER.bat.
if not exist CLOUDY-SERVER.bat ( echo FEHLER: Lege diese Datei in den Ordner, in dem CLOUDY-SERVER.bat liegt. & pause & exit /b 1 )
echo 1/4  Alte Cloudy-Fenster und den Tunnel beenden ...
taskkill /fi "windowtitle eq Cloudy Server*" /t /f >nul 2>&1
taskkill /fi "windowtitle eq Cloudy Datenbank*" /t /f >nul 2>&1
taskkill /im cloudflared.exe /f >nul 2>&1
echo 2/4  Server-Port auf 3380 setzen ^(3364 gehoert deiner MySQL-Datenbank^) ...
if exist cloudy.env powershell -NoProfile -Command "$l = Get-Content 'cloudy.env' | Where-Object { $_ -notmatch '^PORT=' }; ($l + 'PORT=3380') | Set-Content 'cloudy.env' -Encoding ASCII"
echo 3/4  Tunnel-Datei auf Port 3380 setzen ...
set "CFG=%USERPROFILE%\.cloudflared\config.yml"
if exist "%CFG%" powershell -NoProfile -Command "$f='%CFG%'; $t=Get-Content -Raw $f; $n=[regex]::Replace($t,'service: http://127\.0\.0\.1:\d+','service: http://127.0.0.1:3380'); Set-Content -NoNewline -Path $f -Value $n"
echo 4/4  Adresse auf diesen Tunnel setzen und alles starten ...
set "PUBLIC_URL=https://cloudyclient.com"
if exist cloudy.env for /f "usebackq eol=# tokens=1,* delims==" %%A in ("cloudy.env") do if /i "%%A"=="PUBLIC_URL" set "PUBLIC_URL=%%B"
set "HOST=%PUBLIC_URL:https://=%"
set "HOST=%HOST:http://=%"
for /f "delims=/" %%H in ("%HOST%") do set "HOST=%%H"
set "CF=cloudy-tools\cloudflared.exe"
if not exist "%CF%" set "CF=cloudflared"
"%CF%" tunnel route dns --overwrite-dns cloudy-server %HOST%
call CLOUDY-SERVER.bat
endlocal
