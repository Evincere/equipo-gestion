# Design Spec: Rediseño de Pestaña "Reordenar Prioridad" con Filas Ejecutivas y Controles de Flechas (▲/▼)

**Fecha**: 2026-08-14  
**Proyecto**: Sistema de Gestión de Atenciones - Defensoría Pública (Mendoza)  
**Módulo**: Modal de Operaciones de Presentismo (`presenceGridModal` - Pestaña `presenceReorderSection`)  

---

## 1. Contexto y Objetivos

La pestaña de **Reordenar Prioridad (Drag & Drop)** mostraba anteriormente filas simples y planas sin contexto suficiente sobre la posición de precedencia o las tareas que cada defensora asume según su lugar en la rotación.

Se rediseñará este panel convirtiéndolo en un **Panel Ejecutivo de Precedencia de Turnos** con:
1. Insignias de posición de prioridad numeradas (`1°`, `2°`, `3°`, `4°`).
2. Drag Handles de 6 puntos (`ri-draggable`) con vista previa translúcida y línea de inserción brillante.
3. Chips de especialidad de turno asignados en tiempo real a la posición en el orden de prioridad.
4. Botones de acción rápida `▲` (Subir) y `▼` (Bajar) para reordenar con un clic sin necesidad de arrastrar.

---

## 2. Especificación de Diseño Visual y Funcional

### A. Estructura de la Fila de Reordenamiento (`dnd-item-executive`)
Cada fila en la lista arrastrable contendrá:
1. **Extremo Izquierdo**:
   - **Drag Handle (Grip)**: Icono de 6 puntos (`ri-draggable`) con estado `hover` y cursor `grab`.
   - **Badge de Posición de Prioridad**: Insignia numerada destacada (`1°`, `2°`, `3°`, `4°`) teñida en azul/cyan (`rgba(14, 165, 233, 0.2)`).
2. **Centro (Información del Profesional & Turnos)**:
   - **Dot de Asistencia**: Punto verde `#4ADE80` (Presente) o gris/rojo (Ausente).
   - **Nombre de la Defensora**: `Dra. Mariela Fokszek`.
   - **Chips de Especialidad de Turno Asignado**: Chips que muestran qué canal rotativo le toca a esta posición en el orden (ej. `Ases. Gen.`, `Contestación`).
3. **Extremo Derecho (Controles Rápidos)**:
   - **Botones Flecha (Subir / Bajar)**:
     - Botón `▲` (`btn-move-up`): Sube la fila una posición (deshabilitado en `1°`).
     - Botón `▼` (`btn-move-down`): Baja la fila una posición (deshabilitado en el último puesto).
   - **Interactividad**: Al presionar `▲` o `▼` o al soltar un Drag & Drop:
     - El orden se actualiza dinámicamente en pantalla.
     - Se anuncia verbalmente en la región viva ARIA `#dndLiveRegion`.
     - Se persiste de inmediato en la base de datos backend (`POST /api/familia/codefensoras/reordenar`).
     - Se transmite la actualización en tiempo real vía WebSocket al Marquee Ticker.

---

## 3. Arquitectura de Cambios por Archivo

1. **`dashboard.css`**:
   - Estilos para `.dnd-item-executive`, `.priority-badge`, `.btn-move-up`, `.btn-move-down`, `.dnd-duty-chips`.

2. **`build-bundle.js` / `dashboard-bundle.js`**:
   - Actualizar `renderDndList()` para construir las filas ejecutivas numeradas con chips de turno y asociar los click listeners de las flechas `▲` y `▼`.

---

## 4. Plan de Verificación

1. **Verificación Estética & Números de Prioridad**:
   - Comprobar que cada fila exhibe claramente su número de prioridad (`1°`, `2°`, etc.) y las etiquetas de especialidad correspondientes a su puesto.
2. **Verificación de Reordenamiento por Flechas (▲/▼)**:
   - Presionar `▲` en la defensora de la posición `2°` y verificar que intercambia puestos con la `1°` en tiempo real.
3. **Verificación de Reordenamiento por Drag & Drop**:
   - Arrastrar desde el grip de 6 puntos y soltar en otra posición; verificar que las insignias `1°`, `2°`... se recalculan instantáneamente y persisten en la DB.
