@echo off
title Detener Servidor - Equipo Gestion
color 0C
cd /d "%~dp0"

echo Deteniendo tarea programada EquipoGestionIntranet...
powershell -Command "Stop-ScheduledTask -TaskName 'EquipoGestionIntranet' -ErrorAction SilentlyContinue"

echo Deteniendo procesos asociados al puerto 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo Finalizando PID %%a...
    taskkill /F /PID %%a >nul 2>&1
)
echo.
echo Servidor detenido correctamente.
timeout /t 2 /nobreak >nul
