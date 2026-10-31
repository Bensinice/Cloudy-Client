@echo off
chcp 65001 >nul
setlocal
title Cloudy installieren
cd /d "%~dp0"
cls
echo.
echo   Cloudy wird installiert. Beim ersten Mal dauert das 3 bis 5 Minuten.
echo   Bitte das Fenster offen lassen.
echo.

where node >nul 2>nul
if not errorlevel 1 goto hasnode
echo   [1/5] Node.js fehlt und wird installiert ...
where winget >nul 2>nul
if errorlevel 1 goto nonode
winget install -e --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
set "PATH=%PATH%;%ProgramFiles%\nodejs"
where node >nul 2>nul
if errorlevel 1 goto nonode
goto nodeok
:nonode
echo.
echo   Node.js konnte nicht automatisch installiert werden.
echo   Die Download-Seite wird geoeffnet. Installiere die LTS-Version und starte diese Datei danach erneut.
start https://nodejs.org
pause
exit /b 1
:hasnode
echo   [1/5] Node.js gefunden.
:nodeok

set "STAGE=%TEMP%\cloudy-build"
set "DEST=%LOCALAPPDATA%\Programs\Cloudy"
if exist "%STAGE%" rd /s /q "%STAGE%"
mkdir "%STAGE%\app" "%STAGE%\tools"

echo   [2/5] Programmdateien kopieren ...
robocopy "%~dp0." "%STAGE%\app" /E /XD node_modules dist .git .github scripts /XF *.bat *.command *.md >nul
if errorlevel 8 goto fail

echo   [3/5] Bibliotheken laden ...
pushd "%STAGE%\app"
call npm install --omit=dev --no-audit --no-fund
if errorlevel 1 popd & goto fail
popd

for /f "usebackq delims=" %%v in (`node -p "require('./package.json').devDependencies.electron.replace('^','')"`) do set "EV=%%v"
echo   [4/5] Electron %EV% laden ...
pushd "%STAGE%\tools"
call npm init -y >nul
call npm install electron@%EV% --no-audit --no-fund
node node_modules\electron\install.js
popd
if not exist "%STAGE%\tools\node_modules\electron\dist\electron.exe" goto fail

echo   [5/5] Cloudy einrichten ...
powershell -NoProfile -Command "Get-Process | Where-Object { $_.Path -and $_.Path -like '%DEST%\*' } | Stop-Process -Force -ErrorAction SilentlyContinue" >nul 2>nul
taskkill /f /t /im Cloudy.exe >nul 2>nul
set "TRIES=0"
:rmloop
timeout /t 2 /nobreak >nul
if exist "%DEST%" rd /s /q "%DEST%" >nul 2>nul
if not exist "%DEST%" goto rmdone
set /a TRIES+=1
if %TRIES% lss 4 goto rmloop
rem Ordner gesperrt (z. B. Virenscanner) -> alten Ordner umbenennen statt loeschen
ren "%DEST%" "Cloudy.alt.%RANDOM%" >nul 2>nul
if exist "%DEST%" (
  echo.
  echo   Der Cloudy-Ordner ist noch in Benutzung. Schliesse Cloudy und Minecraft, starte den PC neu oder nimm den Cloudy-Setup-Installer.
  goto fail
)
:rmdone
robocopy "%STAGE%\tools\node_modules\electron\dist" "%DEST%" /E >nul
if errorlevel 8 goto fail
move /y "%DEST%\electron.exe" "%DEST%\Cloudy.exe" >nul
if exist "%DEST%\resources\default_app.asar" del /q "%DEST%\resources\default_app.asar"
robocopy "%STAGE%\app" "%DEST%\resources\app" /E >nul
if errorlevel 8 goto fail

powershell -NoProfile -Command "try{Add-Type -AssemblyName System.Drawing;$b=New-Object System.Drawing.Bitmap('%DEST%\resources\app\build\icon.png');$t=New-Object System.Drawing.Bitmap($b,256,256);$i=[System.Drawing.Icon]::FromHandle($t.GetHicon());$f=[IO.File]::Create('%DEST%\cloudy.ico');$i.Save($f);$f.Close()}catch{}; $w=New-Object -ComObject WScript.Shell; foreach($p in @([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('Programs'))){$s=$w.CreateShortcut($p+'\Cloudy.lnk');$s.TargetPath='%DEST%\Cloudy.exe';$s.WorkingDirectory='%DEST%';if(Test-Path '%DEST%\cloudy.ico'){$s.IconLocation='%DEST%\cloudy.ico'};$s.Save()}"

rd /s /q "%STAGE%" >nul 2>nul
echo.
echo   Fertig! Cloudy ist installiert (Desktop-Verknuepfung und Startmenue).
start "" "%DEST%\Cloudy.exe"
timeout /t 5 >nul
exit /b 0

:fail
echo.
echo   Das hat leider nicht geklappt. Mache ein Foto oder Screenshot dieses Fensters und schick es mir.
pause
exit /b 1
