# Plan de Implementación: Visualización Completa de Ausentes y Compensación Equitativa de Turnos

## 1. Objetivo
1. Mostrar a **todas** las codefensoras (presentes y ausentes) en la pestaña "Reordenar Prioridad" (tanto en la sección superior de Asignación Directa como en la inferior de Secuencia de Precedencia Rotativa).
2. Las codefensoras ausentes se muestran con estilo visual inactivo/atenuado, indicador rojo de ausencia y bloqueo de arrastre hacia ellas en la sección superior.
3. Permitir reordenar la secuencia rotativa completa independientemente del estado de asistencia.
4. Implementar el algoritmo de **compensación equitativa de turnos por motivo**: si una defensora fue salteada durante su ausencia en un motivo particular, al reincorporarse recibe como `PRÓXIMA` ese motivo y luego el ciclo continúa a partir de quien cubrió la tarea.

## 2. Cambios en Backend (`server.js`)
1. **Tabla `turnos_deficit_canales`**:
   - `canal TEXT NOT NULL, nombre_ausente TEXT NOT NULL, nombre_cubrio TEXT NOT NULL, fecha DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (canal, nombre_ausente)`
2. **Registro de Salteo de Turno por Ausencia**:
   - Cuando se consulta o asigna un turno en un canal y la defensora en turno está ausente, se registra el déficit.
3. **Reincorporación y Compensación**:
   - Al marcar a una defensora como Presente (`/api/familia/codefensoras/estado`), se verifica si tiene turnos salteados en `turnos_deficit_canales`.
   - En los canales salteados, se posiciona a la defensora reincorporada como `PRÓXIMA` y se programa el punto de reanudación a partir de quien cubrió.

## 3. Cambios en Frontend (`build-bundle.js` y `dashboard.css`)
1. **Asignación Directa (`renderKanbanCategoryAssignment`)**:
   - Renderizar todas las codefensoras.
   - Tarjetas ausentes: `.is-absent`, opacidad atenuada, dot rojo, etiqueta "(Ausente)", texto explicativo "No disponible (Ausente)", drop bloqueado (`cursor: not-allowed`).
2. **Secuencia de Precedencia (`renderDndList`)**:
   - Renderizar todas las codefensoras en el orden del canal.
   - Filas ausentes: dot rojo, etiqueta "(Ausente)", reordenamiento habilitado.
   - Cálculo de `PRÓXIMA`: saltea ausentes y resalta a la defensora presente en turno.
3. **Estilos CSS (`dashboard.css`)**:
   - `.kanban-defensora-card.is-absent`
   - `.presence-dot.is-absent`
   - `.dnd-item.is-absent`
