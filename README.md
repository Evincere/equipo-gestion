# 🏛️ equipo-gestion - Sistema de Gestión de Atenciones
**Ministerio Público de la Defensa (Mendoza)**

Sistema unificado de gestión de atenciones ciudadanas, asignación de turnos rotativos para Co-Defensorías de Familia, trazabilidad de tareas pendientes y auditoría para la Defensoría Pública (Mendoza).

## 🚀 Tecnologías

- **Backend**: Node.js REST API + `node:sqlite` (SQLite integrado)
- **Frontend**: Vanilla JS (Arquitectura Hexagonal DTOs/Casos de Uso) + Windows Aero Glass Dark Mode CSS
- **Despliegue**: Docker / Dokploy VPS

## ⚡ Inicio Rápido Local

```bash
# Iniciar servidor local en port 3000
npm run dev
```

Acceder en el navegador a: `http://localhost:3000/dashboard.html`

## 🐳 Despliegue en Dokploy / Docker

El proyecto incluye un `Dockerfile` optimizado. En Dokploy:
1. Conecta el repositorio: `https://github.com/Evincere/equipo-gestion.git`
2. Selecciona Build Type: **Dockerfile** o **Nixpacks**
3. Mapea el Puerto: **3000**
