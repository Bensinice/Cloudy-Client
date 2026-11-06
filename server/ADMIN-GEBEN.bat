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
if "%DB_PORT%"=="" set "DB_PORT=3306"
call :dbping
if not errorlevel 1 goto dbok
set "DBDIR=%~dp0cloudy-tools\mariadb"
set "DBDATA=%~dp0cloudy-tools\data"
if not exist "%DBDIR%\bin\mariadbd.exe" ( echo Die Datenbank laeuft nicht und ist nicht installiert. Starte einmal CLOUDY-SERVER.bat, dann diese Datei nochmal. & pause & exit /b 1 )
echo Datenbank starten ...
start "Cloudy Datenbank" /min "%DBDIR%\bin\mariadbd.exe" --datadir="%DBDATA%" --port=%DB_PORT% --bind-address=127.0.0.1 --console --skip-name-resolve
set /a TRIES=0
:dbwait
call :dbping
if not errorlevel 1 goto dbok
set /a TRIES+=1
if %TRIES% GEQ 30 ( echo FEHLER: Die Datenbank startet nicht. & pause & exit /b 1 )
timeout /t 2 /nobreak >nul
goto dbwait
:dbok
call node cloudy-owner.js "%WHO%"
if errorlevel 1 ( echo FEHLER siehe oben. & pause & exit /b 1 )
echo.
echo Starte alles neu ...
call CLOUDY-SERVER.bat
goto :eof

:dbping
powershell -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1',%DB_PORT%); $c.Close(); exit 0 } catch { exit 1 }"
exit /b %errorlevel%
