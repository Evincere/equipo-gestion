# Design Spec: Panel de Operación de Presentismo con Pestañas y Reordenamiento Drag & Drop

**Fecha**: 2026-08-14  
**Proyecto**: Sistema de Gestión de Atenciones - Defensoría Pública (Mendoza)  
**Módulo**: Modal de Operaciones de Presentismo y Turnos (`presenceGridModal`)  

---

## 1. Contexto y Objetivos

El modal actual de presentismo ofrece una vista básica de asistencia en cuadrícula. Sin embargo, el operador necesita la capacidad de realizar **ajustes finos y correcciones manuales al orden de prioridad y precedencia del turno rotativo** diario.

Se rediseñará el modal transformándolo en un **Panel Completo de Operación** con dos pestañas de navegación (Segmented Tabs) y una experiencia interactiva de **Drag & Drop de alto nivel** accesible con feedback visual continuo.

---

## 2. Especificación de Diseño Visual y Funcional

### A. Navegación por Pestañas (Segmented Control)
El modal contará con dos pestañas en su encabezado:
1. **Pestaña "Presentismo"**: Cuadrícula de asistencia rápida (Presente / Ausente).
2. **Pestaña "Reordenamiento de Turnos"**: Panel interactivo para reordenar la precedencia de las defensora en la rotación del día mediante arrastrar y soltar (Drag & Drop).

---

### B. Interacción Drag & Drop Completa

1. **Grip / Drag Handle (6 Puntos)**:
   - Cada fila de la lista de reordenamiento incluye un icono de agarre compacto de 6 puntos (`ri-draggable` / matrix dots) a la izquierda.
   - Cursor `grab` / `grabbing`.

2. **Drag Preview / Ghost (`DataTransfer.setDragImage()`)**:
   - Al iniciar el arrastre (`dragstart`), se genera una vista previa semi-translucida de la fila que sigue al puntero del mouse sin tapar los indicadores de destino.

3. **Línea de Inserción y Desplazamiento Dinámico**:
   - Durante `dragover`, el objetivo de soltado muestra una **línea de inserción brillante** (azul/cyan `#0EA5E9`) arriba o abajo de la fila según la posición del cursor.
   - Las filas contiguas efectúan un desplazamiento suave por CSS para abrir espacio dinámico al elemento arrastrado antes de soltar.

4. **Accesibilidad con Región Viva ARIA (ARIA Live Region)**:
   - Se incluye una región viva `<div id="dndLiveRegion" class="sr-only" aria-live="assertive" aria-atomic="true"></div>`.
   - **Anuncios de voz / lectores de pantalla**:
     - *Al agarrar*: `"Se ha seleccionado a Dra. [Nombre]. Posición actual 2 de 5."`
     - *Al mover*: `"Moviendo sobre la posición de Dra. [Nombre Destino]."`
     - *Al soltar*: `"Dra. [Nombre] reordenada a la posición 3 de 5."`
   - Sin utilizar el atributo obsoleto `aria-grabbed`.

---

### C. Persistencia y Sincronización en Tiempo Real

- Al soltar la fila en su nueva posición, se envía una petición HTTP `POST /api/familia/codefensoras/reordenar` con el nuevo orden de IDs/Nombres.
- La base de datos SQLite actualiza la secuencia de prioridad (`ORDER BY orden ASC`).
- El servidor emite un evento WebSocket `PRESENCE_UPDATED` / `ROTATION_UPDATED` a todos los clientes.
- El marquee ticker del dashboard principal actualiza inmediatamente sus pills y su recorrido en tiempo real.

---

## 3. Arquitectura de Cambios por Archivo

1. **`dashboard.html`**:
   - Añadir navegación de pestañas en `presenceGridModal`.
   - Añadir contenedor `#presenceReorderContainer` para la lista Drag & Drop.
   - Añadir región viva ARIA `#dndLiveRegion`.

2. **`dashboard.css`**:
   - Estilos para pestañas segmented control (`.modal-tabs`, `.modal-tab-btn`).
   - Estilos para la lista arrastrable (`.dnd-list`, `.dnd-item`).
   - Estilos para el drag handle (`.dnd-handle`).
   - Estilos para la línea de inserción (`.dnd-insertion-line`, `.drop-target-above`, `.drop-target-below`).
   - Clase de accesibilidad `.sr-only`.

3. **`server.js`**:
   - Endpoint `POST /api/familia/codefensoras/reordenar`: recibe `{ orden: [id1, id2, ...] }` o `{ nombres: [...] }`.
   - Actualiza el campo `orden` en la tabla `codefensoras_estado`.
   - Emite broadcast de actualización.

4. **`build-bundle.js` / `dashboard-bundle.js`**:
   - Lógica de intercambio de pestañas en el modal.
   - Implementación de los eventos `dragstart`, `dragenter`, `dragover`, `dragleave`, `drop`, `dragend`.
   - Creación del canvas/element de `setDragImage()`.
   - Actualización de región viva ARIA.
   - Envío de la actualización del orden al servidor.

---

## 4. Plan de Verificación

1. **Verificación Estética & Drag & Drop**:
   - Comprobar que el grip de 6 puntos cambia el cursor a `grab`.
   - Probar que al arrastrar se visualiza el ghost translúcido y la línea azul de inserción.
   - Comprobar que las filas se desplazan abriendo espacio al pasar el cursor.
2. **Verificación de Accesibilidad (ARIA Live)**:
   - Inspeccionar `#dndLiveRegion` en las dev tools para confirmar los textos generados durante el inicio, movimiento y soltado.
3. **Verificación de Persistencia**:
   - Cambiar el orden de 2 defensoras, cerrar el modal o recargar la página y verificar que el nuevo orden persiste en la base de datos y se refleja en el Marquee Ticker.
