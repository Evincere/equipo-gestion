# Design Spec: Panel Unificado de Configuración de Turnos - Asignación Directa Kanban y Orden de Rotación

**Fecha**: 2026-08-14  
**Proyecto**: Sistema de Gestión de Atenciones - Defensoría Pública (Mendoza)  
**Módulo**: Modal de Operaciones de Presentismo (`presenceGridModal` - Pestaña `presenceReorderSection`)  

---

## 1. Contexto y Análisis de Reglas de Negocio

El sistema administra **4 canales independientes de turnos rotativos de familia**:
1. `ASESORAMIENTO_GENERAL` (Asesoría General)
2. `CAUSA_NUEVA` (Causa Nueva)
3. `CONTESTACION_DEMANDA` (Contestación de Demanda)
4. `ADOPCION` (Guarda Judicial / Tutela / Adopción)

El operador necesita dos niveles de control complementarios al comenzar la jornada:
1. **Asignación Directa del Próximo Turno por Especialidad**: Decidir qué defensora específica atenderá la *próxima* consulta de cada una de las 4 especialidades.
2. **Orden de Rotación Secuencial del Día**: Definir el orden de precedencia (`1°`, `2°`, `3°`, `4°`) en el que las defensoras irán rotando automáticamente las consultas subsiguientes.

Ambos controles convivirán en la pestaña **Configuración & Reordenamiento de Turnos**, organizados en 2 secciones visuales claras e intuitivas.

---

## 2. Especificación Visual y Funcional

### A. Sección Superior: "Asignación Directa del Próximo Turno (Drag Category -> Defensora)"
- **Visualización**: Muestra una tarjeta por cada defensora presente (`Dra. Mariela`, `Dra. Andrea`, `Dra. Claudia`, `Dra. Luz`).
- **Fichas de Especialidad Arrastrables (`.draggable-category-chip`)**:
  - `Asesoría General` (Rosa `#EC4899`)
  - `Causa Nueva` (Azul `#0EA5E9`)
  - `Contestación` (Dorado `#F59E0B`)
  - `Adopción / Guarda` (Púrpura `#8B5CF6`)
- **Mecanismo Drag & Drop**:
  - El operador puede arrastrar cualquiera de las 4 fichas de especialidad desde la tarjeta de una defensora y soltarla (`onDrop`) sobre la tarjeta de otra defensora.
  - **Efecto Inmediato**: Al soltar el chip `Causa Nueva` sobre la tarjeta de la *Dra. Andrea Lombard*, el sistema actualiza el registro en `rotacion_turnos_canales` asignando a la Dra. Andrea como la encargada del **Próximo Turno** de Causa Nueva.

---

### B. Sección Inferior: "Secuencia de Rotación del Día (Precedencia Rotativa)"
- **Visualización**: Muestra la lista ordenada de precedencia rotativa con insignias de posición (`1°`, `2°`, `3°`, `4°`).
- **Mecanismo**:
  - El operador puede reordenar la secuencia mediante Drag & Drop desde el grip de 6 puntos (`ri-draggable`) o con botones de flecha rápida (`▲` / `▼`).
  - Define el orden en que se asignarán las consultas rotativas automáticamente una vez consumido el primer turno.

---

## 3. Backend & Persistencia API

1. **Nuevo Endpoint Backend**: `POST /api/familia/turnos/asignar-proximo`
   - **Payload**: `{ canalKey: 'CAUSA_NUEVA', nombreDefensora: 'Andrea Lombard', operatorName: 'Sergio' }`
   - **Acción**: Busca el índice de `Andrea Lombard` en la lista de defensoras presentes y actualiza `last_index` en la tabla `rotacion_turnos_canales` para que el siguiente turno calculado `(last_index + 1) % presentes.length` apunte exactamente a ella.
   - **Emisión WebSocket**: Broadcast `PRESENCE_UPDATED` para actualizar en tiempo real la UI del operador y el Marquee Ticker.

2. **Endpoint Existente**: `POST /api/familia/codefensoras/reordenar`
   - Actualiza el orden `orden` en `codefensoras_estado`.

---

## 4. Plan de Verificación

1. **Prueba de Drag & Drop de Categoría**:
   - Arrastrar el chip `Causa Nueva` hacia la tarjeta de *Dra. Andrea Lombard*.
   - Verificar que la ficha se mueve a su tarjeta y que la API devuelve `{ success: true }`.
   - Confirmar que al solicitar `GET /api/familia/proximo-turno?canal=Causa+Nueva`, la respuesta indica `proximaDefensora: "Andrea Lombard"`.
2. **Prueba de Reordenamiento Secuencial**:
   - Reordenar el listado de precedencia rotativa y confirmar que los turnos subsiguientes respetan la nueva secuencia.
3. **Sincronización Marquee**:
   - Verificar que el Marquee Ticker principal refleja inmediatamente las nuevas defensoras asignadas como próximo turno.
