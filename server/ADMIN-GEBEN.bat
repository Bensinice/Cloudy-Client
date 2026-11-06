@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
title Cloudy Admin geben
rem Muss im selben Ordner liegen wie CLOUDY-SERVER.bat und cloudy.env.
if not exist cloudy.env ( echo FEHLER: cloudy.env nicht gefunden. Lege diese Datei in den Server-Ordner. & pause & exit /b 1 )
set "PATH=%PATH%;C:\Program Files\nodejs"
set "WHO="
set /p "WHO=Kontoname, der Admin werden soll (z. B. Benn): "
if "%WHO%"=="" ( echo Kein Name. & pause & exit /b 1 )
echo Server und Tunnel beenden ...
taskkill /fi "windowtitle eq Cloudy Server*" /t /f >nul 2>&1
taskkill /im cloudflared.exe /f >nul 2>&1
for /f "usebackq eol=# tokens=1,* delims==" %%A in ("cloudy.env") do set "%%A=%%B"
call node cloudy-owner.js "%WHO%"
if errorlevel 1 ( echo FEHLER siehe oben. & pause & exit /b 1 )
echo.
echo Starte alles neu ...
call CLOUDY-SERVER.bat
endlocal
