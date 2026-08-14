# Unified Kanban Category Assignment & Rotation Panel Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el Panel Unificado en la pestaña de Reordenamiento con 2 bloques claros: (1) Asignación Directa Kanban donde las fichas de especialidad se arrastran entre tarjetas de defensora para asignar el próximo turno, y (2) Secuencia de Precedencia Rotativa con insignias `1°`, `2°`... y flechas ▲/▼.

**Architecture:** En `server.js` se añade el endpoint `POST /api/familia/turnos/asignar-proximo`. En `dashboard.html` y `dashboard.css` se estructuran las 2 secciones (Bloque Kanban Superior + Bloque Secuencia Inferior). En `build-bundle.js` se implementa la lógica de arrastre de fichas de especialidad, manejadores de suelta (`drop`) en tarjetas de defensora, y llamadas API.

**Tech Stack:** Node.js (SQLite, HTTP Server), HTML5 Drag & Drop, CSS Flexbox & Grid, JavaScript Vanilla.

## Global Constraints

- **Canales de Turno**:
  - `ASESORAMIENTO_GENERAL` -> 'Asesoría General'
  - `CAUSA_NUEVA` -> 'Causa Nueva'
  - `CONTESTACION_DEMANDA` -> 'Contestación'
  - `ADOPCION` -> 'Adopción / Guarda'
- **Drag & Drop de Categorías**: Fichas `.draggable-category-chip` tienen `draggable="true"`, dataTransfer especifica el canal. Las tarjetas `.kanban-defensora-card` actúan como dropzone.
- **Transmisión de Eventos**: Tras asignar un turno directo o cambiar el orden, se emite WebSocket `PRESENCE_UPDATED`.

---

### Task 1: Backend Endpoint `POST /api/familia/turnos/asignar-proximo` en `server.js`

**Files:**
- Modify: `f:\Apps\equipo-gestion\server.js:430-455` & `1450-1490`

**Interfaces:**
- Consumes: HTTP POST `/api/familia/turnos/asignar-proximo`.
- Produces: JSON `{ success: true, proximaDefensora, canalKey }` y broadcast `PRESENCE_UPDATED`.

- [ ] **Step 1: Agregar dispatch de la ruta `/api/familia/turnos/asignar-proximo` en `server.js`**

```javascript
if (req.method === 'POST' && parsedUrl.pathname === '/api/familia/turnos/asignar-proximo') {
    return handlePostAsignarProximoTurno(req, res);
}
```

- [ ] **Step 2: Implementar la función `handlePostAsignarProximoTurno(req, res)`**

```javascript
function handlePostAsignarProximoTurno(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            const { canalKey, nombreDefensora, operatorName } = data;

            if (!canalKey || !nombreDefensora) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Parámetros faltantes' }));
                return;
            }

            // Obtener lista de defensoras presentes ordenadas
            const presentes = db.prepare('SELECT nombre FROM codefensoras_estado WHERE is_presente = 1 ORDER BY orden ASC, id ASC').all();
            const targetIdx = presentes.findIndex(p => p.nombre === nombreDefensora);

            if (targetIdx === -1) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'La defensora seleccionada no está presente' }));
                return;
            }

            // Ajustar last_index para que (last_index + 1) % presentes.length == targetIdx
            const newLastIndex = (targetIdx - 1 + presentes.length) % presentes.length;

            db.prepare('INSERT OR REPLACE INTO rotacion_turnos_canales (canal, last_index, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
                .run(canalKey, newLastIndex);

            logAudit(0, operatorName || 'OPERADOR', 'ASIGNACION_DIRECTA_TURNO', `Próximo turno de ${canalKey} asignado a Dra. ${nombreDefensora}`);
            broadcast('PRESENCE_UPDATED', { canalKey, proximaDefensora: nombreDefensora });

            res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ success: true, proximaDefensora: nombreDefensora, canalKey }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
    });
}
```

- [ ] **Step 3: Verificar sintaxis y commit del backend**

Run: `node -c server.js`
Expected: Exited with code 0.

```bash
git add server.js
git commit -m "feat(api): add handlePostAsignarProximoTurno endpoint in server.js"
```

---

### Task 2: Estructura HTML y Estilos CSS para el Panel Unificado

**Files:**
- Modify: `f:\Apps\equipo-gestion\dashboard.html:825-835`
- Modify: `f:\Apps\equipo-gestion\dashboard.css`

**Interfaces:**
- Consumes: `#presenceReorderSection`.
- Produces: Sub-sección Kanban `.kanban-assignment-container` y sub-sección Precedencia `.rotation-sequence-container`.

- [ ] **Step 1: Actualizar marcado HTML en `dashboard.html`**

```html
<!-- Sección 2: Configuración & Reordenamiento de Turnos -->
<div id="presenceReorderSection" class="modal-tab-section">
    <!-- Bloque 1: Asignación Directa Kanban -->
    <div style="margin-bottom: 1.5rem;">
        <h4 style="font-size: 0.9rem; color: #38BDF8; font-weight: 700; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.4rem;">
            <i class="ri-drag-drop-line"></i> Asignación Directa del Próximo Turno
        </h4>
        <p style="font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.85rem;">
            Arrastre cualquier ficha de especialidad y suéltela sobre la tarjeta de la defensora que desea asignar como próximo turno.
        </p>
        <div id="kanbanCategoryContainer" class="kanban-category-grid">
            <!-- Se inyectan tarjetas de defensora con chips arrastrables desde JS -->
        </div>
    </div>

    <!-- Bloque 2: Secuencia de Precedencia Rotativa del Día -->
    <div>
        <h4 style="font-size: 0.9rem; color: #F59E0B; font-weight: 700; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.4rem;">
            <i class="ri-sort-asc"></i> Secuencia de Precedencia Rotativa del Día
        </h4>
        <p style="font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.85rem;">
            Reordene las posiciones rotativas (1°, 2°, 3°...) arrastrando la fila o utilizando las flechas ▲ / ▼.
        </p>
        <div id="presenceReorderContainer" class="dnd-list-container">
            <!-- Se inyectan las filas ordenables desde JS -->
        </div>
    </div>
</div>
```

- [ ] **Step 2: Agregar estilos CSS en `dashboard.css`**

```css
.kanban-category-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 0.85rem;
}

.kanban-defensora-card {
    background: rgba(30, 41, 59, 0.65);
    border: 2px dashed rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    padding: 0.85rem;
    transition: all 0.2s ease;
}

.kanban-defensora-card.drop-target-active {
    border-color: #38BDF8;
    background: rgba(14, 165, 233, 0.12);
    box-shadow: 0 0 15px rgba(14, 165, 233, 0.3);
}

.kanban-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.86rem;
    font-weight: 700;
    color: #FFF;
    margin-bottom: 0.6rem;
}

.draggable-category-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.65rem;
    border-radius: 6px;
    font-size: 0.76rem;
    font-weight: 700;
    cursor: grab;
    user-select: none;
    margin-bottom: 0.4rem;
    transition: transform 0.15s ease;
}

.draggable-category-chip:active {
    cursor: grabbing;
    transform: scale(1.04);
}
```

- [ ] **Step 3: Commit del HTML y CSS**

```bash
git add dashboard.html dashboard.css
git commit -m "feat(ui): add html structure and css for unified kanban assignment and rotation panel"
```

---

### Task 3: Lógica JS de Asignación Kanban y Reordenamiento en `build-bundle.js`

**Files:**
- Modify: `f:\Apps\equipo-gestion\build-bundle.js`
- Modify: `f:\Apps\equipo-gestion\dashboard-bundle.js` (vía `node build-bundle.js`)

**Interfaces:**
- Consumes: API `/api/familia/turnos/asignar-proximo`, API `/api/familia/codefensoras/reordenar`.
- Produces: Eventos dragstart/dragover/drop en chips e inyección de tarjetas Kanban.

- [ ] **Step 1: Implementar `renderKanbanCategoryAssignment()` en `build-bundle.js`**

```javascript
renderKanbanCategoryAssignment() {
    const container = document.getElementById('kanbanCategoryContainer');
    if (!container) return;

    const turnos = this.currentTurnos || {};
    const canalKeys = {
        'Ases. General': 'ASESORAMIENTO_GENERAL',
        'Asesoramiento General': 'ASESORAMIENTO_GENERAL',
        'Causa Nueva': 'CAUSA_NUEVA',
        'Contestación': 'CONTESTACION_DEMANDA',
        'Contestación de Demanda': 'CONTESTACION_DEMANDA',
        'Adopción / Guarda': 'ADOPCION',
        'Adopción': 'ADOPCION'
    };

    let html = '';
    this.codefensorasRoster.forEach(c => {
        if (!c.isPresente) return;

        const assignedRoles = [];
        if (turnos['Ases. General'] === c.nombre || turnos['Asesoramiento General'] === c.nombre) {
            assignedRoles.push({ key: 'ASESORAMIENTO_GENERAL', label: 'Asesoría General', cls: 'duty-asesoria', icon: 'ri-file-user-line' });
        }
        if (turnos['Causa Nueva'] === c.nombre) {
            assignedRoles.push({ key: 'CAUSA_NUEVA', label: 'Causa Nueva', cls: 'duty-causa', icon: 'ri-folder-add-line' });
        }
        if (turnos['Contestación'] === c.nombre) {
            assignedRoles.push({ key: 'CONTESTACION_DEMANDA', label: 'Contestación', cls: 'duty-contestacion', icon: 'ri-edit-2-line' });
        }
        if (turnos['Adopción / Guarda'] === c.nombre || turnos['Adopción'] === c.nombre) {
            assignedRoles.push({ key: 'ADOPCION', label: 'Adopción / Guarda', cls: 'duty-adopcion', icon: 'ri-heart-add-line' });
        }

        let chipsHtml = '';
        if (assignedRoles.length > 0) {
            chipsHtml = assignedRoles.map(r => 
                '<div class="draggable-category-chip ' + r.cls + '" draggable="true" data-canal="' + r.key + '" data-label="' + r.label + '">' +
                    '<i class="' + r.icon + '"></i><span>' + r.label + '</span>' +
                '</div>'
            ).join('');
        } else {
            chipsHtml = '<div style="font-size: 0.74rem; color: #64748B; font-style: italic;">Sin turnos asignados como próximo</div>';
        }

        html += '<div class="kanban-defensora-card" data-nombre="' + c.nombre + '">' +
            '<div class="kanban-card-header">' +
                '<span>Dra. ' + c.nombre + '</span>' +
                '<span class="presence-dot is-present"></span>' +
            '</div>' +
            '<div class="kanban-card-body" style="min-height: 48px; display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center;">' +
                chipsHtml +
            '</div>' +
        '</div>';
    });

    container.innerHTML = html;

    // Configurar event listeners de drag & drop
    let draggedCanal = null;
    let draggedLabel = null;
    const liveRegion = this.dndLiveRegion || document.getElementById('dndLiveRegion');

    container.querySelectorAll('.draggable-category-chip').forEach(chip => {
        chip.addEventListener('dragstart', (e) => {
            draggedCanal = chip.getAttribute('data-canal');
            draggedLabel = chip.getAttribute('data-label');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', draggedCanal);

            if (liveRegion) {
                liveRegion.textContent = 'Seleccionada especialidad ' + draggedLabel + ' para reasignar próximo turno.';
            }
        });
    });

    container.querySelectorAll('.kanban-defensora-card').forEach(card => {
        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            card.classList.add('drop-target-active');
        });

        card.addEventListener('dragleave', () => {
            card.classList.remove('drop-target-active');
        });

        card.addEventListener('drop', async (e) => {
            e.preventDefault();
            card.classList.remove('drop-target-active');

            const nombreDefensora = card.getAttribute('data-nombre');
            if (!draggedCanal || !nombreDefensora) return;

            if (liveRegion) {
                liveRegion.textContent = 'Asignando próximo turno de ' + draggedLabel + ' a Dra. ' + nombreDefensora + '.';
            }

            try {
                await fetch(getApiUrl('/api/familia/turnos/asignar-proximo'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        canalKey: draggedCanal,
                        nombreDefensora: nombreDefensora,
                        operatorName: this.currentUser ? this.currentUser.nombreCompleto : 'OPERADOR'
                    })
                });
            } catch(err) {}

            this.renderPresenceRoster();
            await this.calculateProximoTurno();
        });
    });
}
```

- [ ] **Step 2: Invocar `renderKanbanCategoryAssignment()` dentro de `renderPresenceRoster()`**

```javascript
this.renderKanbanCategoryAssignment();
```

- [ ] **Step 3: Compilar bundle autónomo con `node build-bundle.js`**

Run: `node build-bundle.js`
Expected: Exited with code 0.

- [ ] **Step 4: Commit del JS**

```bash
git add build-bundle.js dashboard-bundle.js
git commit -m "feat(js): implement kanban category assignment drag & drop handlers in build-bundle.js"
```

---

### Task 4: Verificación Runtime & Pruebas de Integración

**Files:**
- Test: Navegador / Servidor en `server.js`

- [ ] **Step 1: Verificar sintaxis del servidor**

Run: `node -c server.js`

- [ ] **Step 2: Iniciar servidor y probar en navegador**

1. Ejecutar `node server.js`.
2. Abrir `http://localhost:3000`.
3. Abrir el modal de operaciones y verificar la pestaña "Reordenar Prioridad".
4. Confirmar que el bloque superior muestra las tarjetas Kanban de defensora con fichas arrastrables.
5. Arrastrar el chip `Causa Nueva` desde la Dra. X hasta la tarjeta de la Dra. Y.
6. Verificar que la ficha se reubica instantáneamente y que el Marquee Ticker de la pantalla principal refleja a la Dra. Y como el próximo turno de Causa Nueva.

- [ ] **Step 3: Commit final**

```bash
git add .
git commit -m "refactor(kanban): finalize unified kanban category assignment and rotation order panel"
```
