@echo off
chcp 65001 >nul
rem Doppelklick: baut die Cloudy-Client-Mod (client\cloudy-client.jar). Braucht Java 21 (JDK) und Gradle.
cd /d "%~dp0..\..\client-src"
cls
where javac >nul 2>nul || (echo Java-JDK 21 fehlt. Installiere es mit:  winget install EclipseAdoptium.Temurin.21.JDK & pause & exit /b 1)
where gradle >nul 2>nul || (echo Gradle fehlt. Installiere es mit:  winget install Gradle.Gradle & pause & exit /b 1)
call gradle build --no-daemon || (echo Build fehlgeschlagen. & pause & exit /b 1)
if not exist "..\client" mkdir "..\client"
copy /y "build\libs\cloudy-client-1.2.0.jar" "..\client\cloudy-client.jar" >nul
echo ✅ Fertig: client\cloudy-client.jar
pause
