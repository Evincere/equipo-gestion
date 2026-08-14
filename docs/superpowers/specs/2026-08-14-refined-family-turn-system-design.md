# Design Spec: Refactorización Completa del Módulo de Turnos de Familia - Asignación Directa y Secuencia por Motivo

**Fecha**: 2026-08-14  
**Proyecto**: Sistema de Gestión de Atenciones - Defensoría Pública (Mendoza)  
**Módulo**: Modal de Operaciones de Presentismo (`presenceGridModal` - Pestaña `presenceReorderSection`)  

---

## 1. Contexto y Análisis del Dominio

Existen **4 motivos independientes de derivación a Co-Defensoría de Familia**:
1. `ASESORAMIENTO_GENERAL` (Asesoramiento General)
2. `CAUSA_NUEVA` (Causa Nueva)
3. `CONTESTACION_DEMANDA` (Contestación de Demanda)
4. `ADOPCION` (Guarda Judicial / Tutela / Adopción)

Dado que las ausencias o reincorporaciones de defensoras alteran el flujo de trabajo, el operador requiere poder:
1. **Reasignar el Próximo Turno de Cualquier Motivo (Drag Category entre Cards)**: Arrastrar el chip de una especialidad (ej. `Asesoría General`) de una tarjeta de defensora a otra tarjeta de defensora para definir quién atiende la próxima consulta.
2. **Reconfigurar la Secuencia de Precedencia Rotativa por Motivo (Segmented Control)**: Establecer una secuencia de orden (`1°`, `2°`, `3°`...) independiente para cada uno de los 4 motivos mediante un control de segmentos de estilo nativo (`NSSegmentedControl`).

---

## 2. Especificación Visual y Funcional

### A. Bloque Superior: "Asignación Directa del Próximo Turno"
- **Visualización**: Tarjetas para cada defensora presente (`.kanban-defensora-card`).
- **Fichas de Especialidad Arrastrables**: Cada motivo asignado a una defensora aparece como un chip coloreado con `draggable="true"`.
  - 🌸 `Asesoría General` (`#EC4899`)
  - 🔷 `Causa Nueva` (`#0EA5E9`)
  - 📙 `Contestación de Demanda` (`#F59E0B`)
  - 💜 `Adopción / Guarda` (`#8B5CF6`)
- **Fix Mecanismo Drag & Drop**:
  - `dragstart`: Guarda el canal y nombre origen en `e.dataTransfer`.
  - `dragover` / `dragenter`: `e.preventDefault()`, activa clase `.drop-target-active` en la tarjeta destino utilizando `e.currentTarget`.
  - `drop`: Reasigna el próximo turno de ese canal a la defensora destino e invoca `POST /api/familia/turnos/asignar-proximo`.

---

### B. Bloque Inferior: "Secuencia de Precedencia Rotativa"
- **Título**: **"Secuencia de Precedencia Rotativa"** (se retira "del día").
- **Segmented Control Estilo Nativo (`NSSegmentedControl` / SwiftUI Picker)**:
  - Botones conectados en un único contenedor con bordes sutiles y separadores verticales entre segmentos contiguos (`border-right: 1px solid rgba(255, 255, 255, 0.08)`).
  - 4 Segmentos: `Asesoramiento General` | `Causa Nueva` | `Contestación` | `Adopción / Guarda`.
  - Segmento seleccionado destacado con `#0EA5E9`, texto en blanco negrita y sombra suave.
- **Contenido del Segmento Activo**:
  - Muestra la lista de precedencia (`1°`, `2°`, `3°`...) correspondiente **exclusivamente al motivo seleccionado**.
  - Permite reordenar la secuencia mediante Drag & Drop (grip de 6 puntos) o botones flecha `▲` / `▼`.
  - Al modificar el orden de un motivo, se guarda vía `POST /api/familia/codefensoras/reordenar-canal`.

---

## 3. Arquitectura Backend & Base de Datos

1. **Nueva Tabla SQLite**: `orden_rotacion_canales`
   ```sql
   CREATE TABLE IF NOT EXISTS orden_rotacion_canales (
       canal TEXT NOT NULL,
       nombre TEXT NOT NULL,
       orden INTEGER DEFAULT 0,
       PRIMARY KEY (canal, nombre)
   );
   ```

2. **Endpoints Backend**:
   - `POST /api/familia/turnos/asignar-proximo`: Actualiza `last_index` en `rotacion_turnos_canales`.
   - `POST /api/familia/codefensoras/reordenar-canal`: Guarda la secuencia de prioridad de un canal específico en `orden_rotacion_canales`.
   - `GET /api/familia/codefensoras`: Retorna el orden general y específico por canal.

---

## 4. Plan de Verificación

1. **Verificación Drag & Drop de Fichas entre Tarjetas**:
   - Arrastrar el chip `Asesoría General` desde Dra. Mariela y soltarlo en la tarjeta de Dra. Claudia.
   - Confirmar que la ficha se transfiere a Dra. Claudia y que `GET /api/familia/proximo-turno?canal=Asesoramiento+General` devuelve a Dra. Claudia.
2. **Verificación Segmented Control & Secuencia por Motivo**:
   - Cambiar entre las 4 pestañas del Segmented Control.
   - Reordenar la lista en la pestaña `Causa Nueva` (mover Dra. Andrea al `1°` lugar).
   - Pasar a la pestaña `Contestación` y verificar que su orden permanece independiente.
   - Confirmar persistencia en SQLite y actualización en el Marquee Ticker.
