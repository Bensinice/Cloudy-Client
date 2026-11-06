@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
title Cloudy Server
rem ============================================================================
rem  CLOUDY-SERVER.bat - die EINE Datei fuer den Cloudy-Server unter Windows.
rem  Doppelklick. Beim ersten Start richtet sie alles ein (Node, Datenbank, cloudflared,
rem  Tunnel). Danach startet sie bei jedem Doppelklick Datenbank + Server + Tunnel.
rem  Fenster offen lassen. Alles Heruntergeladene liegt im Ordner cloudy-tools.
rem ============================================================================
if /i "%~1"=="loop" goto serverloop
set "TOOLS=%~dp0cloudy-tools"
set "DBDIR=%TOOLS%\mariadb"
set "DBDATA=%TOOLS%\data"
if not exist "%TOOLS%" mkdir "%TOOLS%"
set "PATH=%PATH%;C:\Program Files\nodejs;%TOOLS%;%DBDIR%\bin;C:\Program Files (x86)\cloudflared"

echo.
echo == 1/5  Programme pruefen
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js fehlt und wird installiert ^(Windows fragt evtl. nach Erlaubnis^) ...
  winget install -e --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
  set "PATH=%PATH%;C:\Program Files\nodejs"
)
where node >nul 2>&1
if errorlevel 1 ( echo FEHLER: Node.js konnte nicht installiert werden. Installiere es von nodejs.org und starte die Datei nochmal. & goto fail )
if not exist node_modules\express goto npmi
if not exist node_modules\mysql2 goto npmi
if not exist node_modules\cors goto npmi
goto npmok
:npmi
if not exist package.json call npm init -y >nul 2>&1
call npm i express mysql2 cors >nul 2>&1
if errorlevel 1 ( echo FEHLER: npm install ist fehlgeschlagen ^(Internet?^). & goto fail )
:npmok
where cloudflared >nul 2>&1
if errorlevel 1 (
  echo Lade cloudflared herunter ...
  powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -UseBasicParsing 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '%TOOLS%\cloudflared.exe'"
)
where cloudflared >nul 2>&1
if errorlevel 1 ( echo FEHLER: cloudflared konnte nicht geladen werden. Lade cloudflared-windows-amd64.exe von github.com/cloudflare/cloudflared/releases, nenne es cloudflared.exe und lege es in den Ordner cloudy-tools. & goto fail )
echo Alles da.

echo.
echo == 2/5  Datenbank starten
call :dbping
if not errorlevel 1 ( echo Eine Datenbank laeuft schon auf Port 3306. & goto dbok )
if exist "%DBDIR%\bin\mariadbd.exe" goto dbinit
echo Lade die Datenbank herunter ^(einmalig, ca. 100 MB, dauert ein paar Minuten^) ...
powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; $ok=$false; foreach($v in '10.11.10','10.11.9','10.11.8'){ try { Invoke-WebRequest -UseBasicParsing ('https://archive.mariadb.org/mariadb-'+$v+'/winx64-packages/mariadb-'+$v+'-winx64.zip') -OutFile '%TOOLS%\db.zip'; $ok=$true; break } catch {} }; if(-not $ok){ exit 1 }"
if errorlevel 1 ( echo FEHLER: Datenbank-Download fehlgeschlagen. Installiere MySQL oder MariaDB selbst, starte es und doppelklicke die Datei nochmal. & goto fail )
if exist "%TOOLS%\dbx" rmdir /s /q "%TOOLS%\dbx"
mkdir "%TOOLS%\dbx"
tar -xf "%TOOLS%\db.zip" -C "%TOOLS%\dbx"
if errorlevel 1 powershell -NoProfile -Command "Expand-Archive -LiteralPath '%TOOLS%\db.zip' -DestinationPath '%TOOLS%\dbx' -Force"
for /d %%D in ("%TOOLS%\dbx\*") do move "%%D" "%DBDIR%" >nul
rmdir /s /q "%TOOLS%\dbx" 2>nul
del "%TOOLS%\db.zip" 2>nul
if not exist "%DBDIR%\bin\mariadbd.exe" ( echo FEHLER: Im Download wurde kein Datenbank-Programm gefunden. & goto fail )
:dbinit
if not exist "%DBDATA%\mysql" "%DBDIR%\bin\mariadb-install-db.exe" --datadir="%DBDATA%" --silent
if not exist "%DBDATA%\mysql" ( echo FEHLER: Der Datenordner der Datenbank konnte nicht angelegt werden. & goto fail )
start "Cloudy Datenbank" /min "%DBDIR%\bin\mariadbd.exe" --datadir="%DBDATA%" --port=3306 --bind-address=127.0.0.1 --console --skip-name-resolve
set /a TRIES=0
:dbwait
call :dbping
if not errorlevel 1 goto dbok
set /a TRIES+=1
if %TRIES% GEQ 40 ( echo FEHLER: Die Datenbank startet nicht. Starte den PC neu und doppelklicke die Datei nochmal. & goto fail )
timeout /t 2 /nobreak >nul
goto dbwait
:dbok
echo Datenbank laeuft.

echo.
echo == 3/5  Einstellungen und Datenbank
if exist cloudy.env goto envok
echo Erster Start: Ich lege die Datenbank und die Einstellungen an.
for /f %%P in ('powershell -NoProfile -Command "-join ((48..57)+(97..102) | Get-Random -Count 20 | %%{[char]$_})"') do set "NEWDBPASS=%%P"
set /p "NEWADMIN=ADMIN-Passwort fuer dein Admin-Konto (mind. 8 Zeichen, man sieht es beim Tippen): "
if "%NEWADMIN:~7,1%"=="" ( echo FEHLER: Das Admin-Passwort braucht mindestens 8 Zeichen. & goto fail )
set /p "NEWUPKEY=Upload-Schluessel fuer GitHub-Releases (= GitHub-Secret CLOUDY_UPLOAD_KEY, mind. 12 Zeichen; ohne Upload einfach Enter): "
set /p "NEWURL=Oeffentliche Adresse deines Servers (Enter = https://cloudyclient.com): "
if "%NEWURL%"=="" set "NEWURL=https://cloudyclient.com"
> cloudy.env echo DB_HOST=127.0.0.1
>> cloudy.env echo DB_USER=CloudyClient
>> cloudy.env echo DB_NAME=CloudyClient
>> cloudy.env echo DB_PASS=%NEWDBPASS%
>> cloudy.env echo ADMIN_PASS=%NEWADMIN%
>> cloudy.env echo PORT=3364
>> cloudy.env echo PUBLIC_URL=%NEWURL%
if not "%NEWUPKEY%"=="" >> cloudy.env echo UPLOAD_KEY=%NEWUPKEY%
set "ROOTPW="
:dbsetup
call node cloudy-sql.js setup
if "%ERRORLEVEL%"=="2" (
  set /p "ROOTPW=Auf Port 3306 laeuft schon eine Datenbank mit Root-Passwort. Root-Passwort eingeben (wird nicht gespeichert): "
  goto dbsetup
)
if errorlevel 1 ( del cloudy.env & echo FEHLER: Die Datenbank konnte nicht angelegt werden. Schick mir die Meldung oben. & goto fail )
call :importask
goto envdone
:envok
echo Gespeicherte Einstellungen ^(cloudy.env^) werden benutzt.
:envdone
for /f "usebackq eol=# tokens=1,* delims==" %%A in ("cloudy.env") do set "%%A=%%B"
if "%PORT%"=="" set "PORT=3364"
if /i "%~1"=="import" call :importask

echo.
echo == 4/5  Cloudflare-Tunnel ^(Verbindung zu deiner Domain^)
set "CFG=%USERPROFILE%\.cloudflared\config.yml"
if exist "%CFG%" ( echo Vorhandener Tunnel wird benutzt ^(%CFG%^). & goto tunnelok )
echo Noch kein Tunnel eingerichtet. Ich lege einen an ^(die Domain muss bei Cloudflare liegen^).
if not exist "%USERPROFILE%\.cloudflared\cert.pem" (
  echo Gleich oeffnet sich der Browser: bei Cloudflare anmelden und die Domain waehlen.
  cloudflared tunnel login
  if errorlevel 1 ( echo FEHLER: Anmeldung bei Cloudflare fehlgeschlagen. & goto fail )
)
set "HOST=%PUBLIC_URL:https://=%"
set "HOST=%HOST:http://=%"
for /f "delims=/" %%H in ("%HOST%") do set "HOST=%%H"
set "TID="
for /f %%I in ('cloudflared tunnel list --name cloudy-server -o json 2^>nul ^| node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const a=JSON.parse(s);console.log(a[0]&&a[0].id||'')}catch{console.log('')}})"') do set "TID=%%I"
if "%TID%"=="" (
  cloudflared tunnel create cloudy-server
  for /f %%I in ('cloudflared tunnel list --name cloudy-server -o json 2^>nul ^| node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const a=JSON.parse(s);console.log(a[0]&&a[0].id||'')}catch{console.log('')}})"') do set "TID=%%I"
)
if "%TID%"=="" ( echo FEHLER: Die Tunnel-ID wurde nicht gefunden. & goto fail )
cloudflared tunnel route dns cloudy-server %HOST%
if errorlevel 1 echo Hinweis: Der DNS-Eintrag fuer %HOST% existiert evtl. schon. Falls nichts erreichbar ist, loesche den alten Eintrag im Cloudflare-Dashboard und starte die Datei nochmal.
> "%CFG%" echo tunnel: %TID%
>> "%CFG%" echo credentials-file: %USERPROFILE%\.cloudflared\%TID%.json
>> "%CFG%" echo ingress:
>> "%CFG%" echo   - hostname: %HOST%
>> "%CFG%" echo     service: http://127.0.0.1:%PORT%
>> "%CFG%" echo   - service: http_status:404
:tunnelok

echo.
echo == 5/5  Server und Tunnel starten
rem Server in eigenem Fenster, in Schleife: stuerzt er ab oder startet sich nach einem Update selbst neu, laeuft er sofort wieder
start "Cloudy Server (Fenster offen lassen)" cmd /c ""%~f0" loop"
timeout /t 6 /nobreak >nul
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing http://127.0.0.1:%PORT%/health -TimeoutSec 5).StatusCode } catch { exit 1 }" >nul 2>&1
if errorlevel 1 ( echo Der Server antwortet noch nicht - siehe das Fenster "Cloudy Server" ^(z. B. "Start fehlgeschlagen"^). ) else ( echo Server laeuft auf Port %PORT%. )
echo Adresse: %PUBLIC_URL%   -   Test: %PUBLIC_URL%/health
echo Fenster offen lassen. Beenden: Fenster schliessen ^(auch das Fenster "Cloudy Server" und die Datenbank^).
cloudflared tunnel run
goto end

:serverloop
cd /d "%~dp0"
for /f "usebackq eol=# tokens=1,* delims==" %%A in ("cloudy.env") do set "%%A=%%B"
if "%PORT%"=="" set "PORT=3364"
:sl
node app.js
echo Server beendet, Neustart in 3 Sekunden ^(Strg+C zum Stoppen^) ...
timeout /t 3 /nobreak >nul
goto sl

:importask
echo.
echo SQL-Datei einspielen ^(z. B. database.sql vom alten Server^). Der Inhalt der Datenbank wird dabei ersetzt.
echo Tippe den ganzen Pfad zur Datei ein ^(z. B. C:\Users\Name\Downloads\database.sql^) oder ziehe die Datei in dieses Fenster. Nur Enter = ueberspringen.
set "SQLF="
set /p "SQLF=Pfad zur .sql-Datei: "
if "%SQLF%"=="" exit /b 0
set "SQLF=%SQLF:"=%"
if not exist "%SQLF%" ( echo FEHLER: Die Datei wurde nicht gefunden: %SQLF% & goto fail )
:imp
call node cloudy-sql.js import "%SQLF%"
if "%ERRORLEVEL%"=="2" (
  set /p "ROOTPW=Root-Passwort der Datenbank (wird nicht gespeichert): "
  goto imp
)
if errorlevel 1 ( echo FEHLER: Die Datei konnte nicht eingespielt werden. & goto fail )
echo Daten eingespielt.
exit /b 0

:dbping
powershell -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1',3306); $c.Close(); exit 0 } catch { exit 1 }"
exit /b %errorlevel%

:fail
echo.
echo Druecke eine Taste zum Schliessen.
pause >nul
:end
endlocal
