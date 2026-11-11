@echo off
title Iniciar Servidor - Equipo Gestion
color 0A
cd /d "%~dp0"

echo Iniciando tarea programada EquipoGestionIntranet...
powershell -Command "Start-ScheduledTask -TaskName 'EquipoGestionIntranet'"
timeout /t 2 /nobreak >nul
echo.
echo Estado actual:
powershell -Command "Get-ScheduledTask -TaskName 'EquipoGestionIntranet' | Select-Object TaskName, State"
echo.
curl.exe -s http://127.0.0.1:3000/health
echo.
pause
