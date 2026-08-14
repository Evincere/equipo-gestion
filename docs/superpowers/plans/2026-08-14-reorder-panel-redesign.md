# Reorder Panel Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar la pestaña "Reordenar Prioridad" agregando insignias numeradas de posición de prioridad (`1°`, `2°`...), visualización de turnos asignados a cada posición, y botones de acción rápida (`▲` / `▼`) para reordenar por clic o por Drag & Drop.

**Architecture:** Se actualizan los estilos en `dashboard.css` con clases para `.priority-badge`, `.dnd-item-executive` y `.btn-move-arrow`. En `build-bundle.js` se reescribe `renderDndList()` para calcular la prioridad numerada y vincular eventos de clics en flechas `▲` / `▼` además del drag & drop HTML5 existente.

**Tech Stack:** HTML5 Drag & Drop, CSS3 Flexbox, JavaScript Vanilla, Node.js (`build-bundle.js`).

## Global Constraints

- **Badge de Posición**: Insignia numerada (`1°`, `2°`, `3°`, `4°`...).
- **Grip Icon**: Matriz de 6 puntos (`ri-draggable`).
- **Botones Flecha (▲/▼)**: Botones `.btn-move-arrow` para subir/bajar rápida una posición. `▲` deshabilitado en 1er puesto, `▼` en último puesto.
- **Chips de Turno Asignado**: Mostrar qué especialidad rotativa le corresponde al puesto ocupado por esa defensora.
- **Persistencia**: Invocar `POST /api/familia/codefensoras/reordenar` tras cada movimiento y emitir broadcast WebSocket `PRESENCE_UPDATED`.

---

### Task 1: Estilos CSS para Filas Ejecutivas Numeradas y Botones Flechas (▲/▼) en `dashboard.css`

**Files:**
- Modify: `f:\Apps\equipo-gestion\dashboard.css:660-700`

**Interfaces:**
- Consumes: `.dnd-item`, `.priority-badge`, `.btn-move-arrow`, `.dnd-duty-chips`.

- [ ] **Step 1: Agregar estilos para la insignia de prioridad, chips de especialidad y botones de flechas**

```css
.priority-badge {
    font-size: 0.76rem;
    font-weight: 800;
    padding: 0.2rem 0.55rem;
    border-radius: 12px;
    background: rgba(14, 165, 233, 0.18);
    color: #38BDF8;
    border: 1px solid rgba(14, 165, 233, 0.35);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
}

.dnd-item-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
}

.dnd-duty-chips {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin-left: 0.5rem;
}

.dnd-actions {
    display: flex;
    align-items: center;
    gap: 0.3rem;
}

.btn-move-arrow {
    background: rgba(51, 65, 85, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94A3B8;
    border-radius: 6px;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s ease;
}

.btn-move-arrow:hover:not(:disabled) {
    background: rgba(14, 165, 233, 0.25);
    color: #38BDF8;
    border-color: #38BDF8;
}

.btn-move-arrow:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}
```

- [ ] **Step 2: Commit de los cambios CSS**

```bash
git add dashboard.css
git commit -m "feat(css): add priority badge and arrow move button styles in dashboard.css"
```

---

### Task 2: Lógica JS para Filas Ejecutivas Numeradas y Botones ▲/▼ en `build-bundle.js`

**Files:**
- Modify: `f:\Apps\equipo-gestion\build-bundle.js`
- Modify: `f:\Apps\equipo-gestion\dashboard-bundle.js` (vía script `node build-bundle.js`)

**Interfaces:**
- Consumes: `this.codefensorasRoster`, `this.currentTurnos`, API `/api/familia/codefensoras/reordenar`.
- Produces: HTML enriquecido de `.dnd-item` con insignias numeradas, chips de especialidad y botones ▲/▼.

- [ ] **Step 1: Actualizar `renderDndList()` en `build-bundle.js`**

```javascript
renderDndList() {
    const container = this.presenceReorderContainer || document.getElementById('presenceReorderContainer');
    if (!container) return;

    const turnos = this.currentTurnos || {};

    let html = '';
    this.codefensorasRoster.forEach((c, index) => {
        const isPresent = !!c.isPresente;
        const dotClass = isPresent ? 'is-present' : '';

        // Determinar especialidad asignada a esta defensora
        const roles = [];
        if (turnos['Ases. General'] === c.nombre || turnos['Asesoramiento General'] === c.nombre) {
            roles.push({ cls: 'duty-asesoria', label: 'Ases. Gen.' });
        }
        if (turnos['Causa Nueva'] === c.nombre) {
            roles.push({ cls: 'duty-causa', label: 'Causa Nva.' });
        }
        if (turnos['Contestación'] === c.nombre) {
            roles.push({ cls: 'duty-contestacion', label: 'Contestación' });
        }
        if (turnos['Adopción / Guarda'] === c.nombre || turnos['Adopción'] === c.nombre) {
            roles.push({ cls: 'duty-adopcion', label: 'Adopción' });
        }

        const dutyChipHtml = roles.map(r => '<span class="duty-chip ' + r.cls + '">' + r.label + '</span>').join('');

        const isFirst = index === 0;
        const isLast = index === this.codefensorasRoster.length - 1;

        html += '<div class="dnd-item" draggable="true" data-index="' + index + '" data-nombre="' + c.nombre + '">' +
            '<div class="dnd-item-content">' +
                '<span class="dnd-handle" title="Arrastrar para reordenar"><i class="ri-draggable"></i></span>' +
                '<span class="priority-badge">' + (index + 1) + '°</span>' +
                '<span class="presence-dot ' + dotClass + '"></span>' +
                '<span style="font-weight: 600; font-size: 0.88rem; color: #FFF;">Dra. ' + c.nombre + '</span>' +
                '<div class="dnd-duty-chips">' + dutyChipHtml + '</div>' +
            '</div>' +
            '<div class="dnd-actions">' +
                '<button class="btn-move-arrow btn-move-up" title="Subir prioridad" ' + (isFirst ? 'disabled' : '') + '><i class="ri-arrow-up-s-line"></i></button>' +
                '<button class="btn-move-arrow btn-move-down" title="Bajar prioridad" ' + (isLast ? 'disabled' : '') + '><i class="ri-arrow-down-s-line"></i></button>' +
            '</div>' +
        '</div>';
    });

    container.innerHTML = html;

    // Vincular botones ▲ / ▼
    container.querySelectorAll('.dnd-item').forEach(item => {
        const index = parseInt(item.getAttribute('data-index'), 10);

        const btnUp = item.querySelector('.btn-move-up');
        if (btnUp) {
            btnUp.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (index > 0) {
                    await this.reorderDefensoras(index, index - 1);
                }
            });
        }

        const btnDown = item.querySelector('.btn-move-down');
        if (btnDown) {
            btnDown.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (index < this.codefensorasRoster.length - 1) {
                    await this.reorderDefensoras(index, index + 1);
                }
            });
        }
    });

    // Vincular HTML5 Drag & Drop (usando this.reorderDefensoras)
    this.attachDndDragHandlers(container);
}
```

- [ ] **Step 2: Crear el helper `reorderDefensoras(fromIdx, toIdx)`**

```javascript
async reorderDefensoras(fromIdx, toIdx) {
    const rosterCopy = [...this.codefensorasRoster];
    const [moved] = rosterCopy.splice(fromIdx, 1);
    rosterCopy.splice(toIdx, 0, moved);

    this.codefensorasRoster = rosterCopy;

    const liveRegion = this.dndLiveRegion || document.getElementById('dndLiveRegion');
    if (liveRegion) {
        liveRegion.textContent = 'Dra. ' + moved.nombre + ' reordenada a la posición ' + (toIdx + 1) + ' de ' + rosterCopy.length + '.';
    }

    const nombresOrdenados = rosterCopy.map(r => r.nombre);
    try {
        await fetch(getApiUrl('/api/familia/codefensoras/reordenar'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ordenNombres: nombresOrdenados, operatorName: this.currentUser ? this.currentUser.nombreCompleto : 'OPERADOR' })
        });
    } catch(err) {}

    this.renderPresenceRoster();
    await this.calculateProximoTurno();
}
```

- [ ] **Step 3: Compilar el bundle autónomo (`node build-bundle.js`)**

Run: `node build-bundle.js`
Expected: "Bundle actualizado exitosamente" sin errores de sintaxis.

- [ ] **Step 4: Commit del JS**

```bash
git add build-bundle.js dashboard-bundle.js
git commit -m "feat(js): add priority badges, duty chips, and arrow move buttons to reorder list"
```

---

### Task 3: Verificación Runtime & Pruebas de Integración

**Files:**
- Test: Navegador / Servidor en `server.js`

- [ ] **Step 1: Reiniciar/Verificar servidor local**

Run: `node server.js`

- [ ] **Step 2: Verificar la visualización en el navegador**

1. Abrir `http://localhost:3000`.
2. Abrir el modal de operaciones de presentismo y pasar a la pestaña "Reordenar Prioridad".
3. Comprobar que cada fila muestra su badge de prioridad (`1°`, `2°`, `3°`, `4°`), el nombre de la defensora, el dot de asistencia, los chips de especialidades asignadas a su puesto, y los botones `▲` / `▼`.
4. Hacer clic en `▲` en la defensora de la posición `2°` y verificar que sube al puesto `1°` recalculando los badges y persistiéndolo en la DB.
5. Probar arrastrar mediante el grip de 6 puntos para verificar que el Drag & Drop funciona en armonía.

- [ ] **Step 3: Commit final**

```bash
git add .
git commit -m "refactor(reorder): finalize reorder panel redesign implementation"
```
