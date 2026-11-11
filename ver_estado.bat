@echo off
title Estado del Servidor - Equipo Gestion
color 0B
cd /d "%~dp0"

echo =======================================================
echo    VERIFICACION DE ESTADO DEL SERVIDOR INTRANET
echo =======================================================
echo.
echo 1. Estado de la Tarea Programada de Windows:
powershell -Command "Get-ScheduledTask -TaskName 'EquipoGestionIntranet' | Select-Object TaskName, State"
echo.
echo 2. Health check (http://127.0.0.1:3000/health):
curl.exe -s http://127.0.0.1:3000/health
echo.
echo.
echo 3. Consulta de registros en Base de Datos local (C:):
node --experimental-sqlite -e "const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync('data/atenciones.db'); console.log('Total registros:', db.prepare('SELECT COUNT(*) as c FROM atenciones').get().c); console.log('Ultima atencion:', db.prepare('SELECT id, fecha, apellidos, nombres FROM atenciones ORDER BY id DESC LIMIT 1').all()[0]);"
echo.
echo =======================================================
pause
