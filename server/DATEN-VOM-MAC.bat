@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
title Cloudy Daten vom Mac holen
rem Muss im selben Ordner liegen wie CLOUDY-SERVER.bat.
if not exist CLOUDY-SERVER.bat ( echo FEHLER: Lege diese Datei in den Server-Ordner. & pause & exit /b 1 )
echo Wichtig: Beende vorher die Cloudy Server App ^(Taskleiste unten rechts - Rechtsklick - Beenden^).
echo Weiter mit Enter.
pause >nul
echo Alte Server-Fenster und Tunnel beenden ...
taskkill /fi "windowtitle eq Cloudy Server*" /t /f >nul 2>&1
taskkill /im cloudflared.exe /f >nul 2>&1
echo.
echo Gleich fragt das Programm nach dem Pfad zur .sql-Datei vom Mac ^(cloudy.sql^).
call CLOUDY-SERVER.bat import
endlocal
