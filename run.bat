@echo off
setlocal EnableDelayedExpansion
title ConversaStore Mobile Engine

echo ============================================================
echo   ConversaStore Mobile Engine
echo   100%% DB Driven - Zero Mock - Mobile First
echo ============================================================
echo.

set PORT=8000
set OCCUPIED_PID=

:: Verification si le port 8000 est deja utilise
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    set OCCUPIED_PID=%%a
)

if not defined OCCUPIED_PID goto LAUNCH

echo [ATTENTION] Le port %PORT% est actuellement utilise par le processus PID !OCCUPIED_PID!.
echo Une instance precedente de ConversaStore ou un autre programme tourne deja.
echo.

set "REPONSE=O"
set /p "REPONSE=Voulez-vous arreter ce processus (PID !OCCUPIED_PID!) et liberer le port ? (O/N) [O] : "

set "REP_FIRST=!REPONSE:~0,1!"
if /i "!REP_FIRST!"=="N" goto CANCELLED

echo.
echo [Action] Fermeture du ou des processus occupant le port %PORT%...
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    echo   - Arret du processus PID %%p...
    taskkill /F /PID %%p >nul 2>&1
)
ping 127.0.0.1 -n 2 >nul
echo [OK] Port %PORT% libere avec succes.
echo.

:LAUNCH
echo [Demarrage] Lancement du serveur ConversaStore sur le port %PORT%...
echo.
cd /d "%~dp0backend"
python run_server.py
if errorlevel 1 (
    echo.
    echo [Erreur] Le serveur s'est arrete avec une erreur.
)
goto END

:CANCELLED
echo.
echo [Annule] Demarrage annule. Le port %PORT% n'a pas ete modifie.
echo.

:END
pause
