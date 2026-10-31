@echo off
chcp 65001 >nul
rem Kopiert die bei dir gebaute Client-Mod in diesen Ordner (client\cloudy-client.jar).
rem Danach den ganzen Ordner als ZIP packen: Alle, die dieses Update installieren, brauchen die Mod dann nicht mehr selbst zu bauen.
set SRC=%APPDATA%\Cloudy\client\cloudy-client-1.21.4.jar
if not exist "%SRC%" set SRC=%APPDATA%\Cloudy\client\cloudy-client.jar
if not exist "%SRC%" (
  echo Keine gebaute Client-Mod gefunden.
  echo Starte zuerst Minecraft 1.21.4 mit Cloudy-Cosmetics oder Leistungs-Mods als Admin, damit sie gebaut wird.
  pause & exit /b 1
)
if not exist "%~dp0client" mkdir "%~dp0client"
copy /Y "%SRC%" "%~dp0client\cloudy-client.jar" >nul && echo Fertig: client\cloudy-client.jar wurde aktualisiert.
pause
