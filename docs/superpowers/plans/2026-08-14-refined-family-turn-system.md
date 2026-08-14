# Refined Family Turn System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactorizar el módulo de turnos de familia agregando la tabla `orden_rotacion_canales` en SQLite, un Segmented Control nativo con 4 pestañas por motivo para la Secuencia de Precedencia Rotativa, y reparar el Drag & Drop de fichas de especialidad entre tarjetas de defensora.

**Architecture:** En `server.js` se agrega la tabla `orden_rotacion_canales`, los endpoints `POST /api/familia/codefensoras/reordenar-canal` y `POST /api/familia/turnos/asignar-proximo`, y se adapta `handleGetProximoTurno`. En `dashboard.html` y `dashboard.css` se crea el Segmented Control nativo (`.segmented-control-container`). En `build-bundle.js` se reescribe `renderKanbanCategoryAssignment()` y `renderDndList()` con soporte por motivo y drag handlers corregidos.

**Tech Stack:** Node.js (SQLite, HTTP Server), HTML5 Drag & Drop, CSS3 Flexbox/Grid, Segmented Control UI, JavaScript Vanilla.

## Global Constraints

- **4 Motivos de Derivación**:
  - `ASESORAMIENTO_GENERAL` (Asesoramiento General)
  - `CAUSA_NUEVA` (Causa Nueva)
  - `CONTESTACION_DEMANDA` (Contestación de Demanda)
  - `ADOPCION` (Guarda Judicial / Tutela / Adopción)
- **Segmented Control UI**: Botones conectados en un solo bloque con `.segmented-control-btn`, `border-right: 1px solid rgba(255, 255, 255, 0.08)`, active highlight `#0EA5E9`.
- **Drag & Drop de Fichas entre Tarjetas**: Configurar `dragstart`, `dragover`, `dragleave` y `drop` usando `e.currentTarget` para que arrastrar cualquier chip de especialidad a la tarjeta de otra defensora la asigne de inmediato como próximo turno.

---

### Task 1: Tabla SQLite `orden_rotacion_canales` y Endpoints Backend en `server.js`

**Files:**
- Modify: `f:\Apps\equipo-gestion\server.js`

**Interfaces:**
- Consumes: Tabla `orden_rotacion_canales`, HTTP POST `/api/familia/codefensoras/reordenar-canal`, HTTP POST `/api/familia/turnos/asignar-proximo`.
- Produces: Datos de secuencia por canal y broadcast `PRESENCE_UPDATED`.

- [ ] **Step 1: Crear la tabla `orden_rotacion_canales` en `server.js`**

```javascript
db.exec(`
    CREATE TABLE IF NOT EXISTS orden_rotacion_canales (
        canal TEXT NOT NULL,
        nombre TEXT NOT NULL,
        orden INTEGER DEFAULT 0,
        PRIMARY KEY (canal, nombre)
    );
`);
```

- [ ] **Step 2: Agregar endpoint `/api/familia/codefensoras/reordenar-canal` en dispatching y implementar `handlePostReordenarCanalCodefensora`**

```javascript
if (pathname === '/api/familia/codefensoras/reordenar-canal') {
    if (req.method === 'POST') return handlePostReordenarCanalCodefensora(req, res);
}

function handlePostReordenarCanalCodefensora(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            const { canalKey, ordenNombres, operatorName } = data;

            if (!canalKey || !Array.isArray(ordenNombres)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Parámetros inválidos' }));
                return;
            }

            const stmt = db.prepare('INSERT OR REPLACE INTO orden_rotacion_canales (canal, nombre, orden) VALUES (?, ?, ?)');
            const updateMany = db.transaction((list) => {
                list.forEach((nombre, idx) => {
                    stmt.run(canalKey, nombre, idx + 1);
                });
            });
            updateMany(ordenNombres);

            logAudit(0, operatorName || 'OPERADOR', 'REORDEN_CANAL_PRESENTISMO', `Nuevo orden para canal ${canalKey}: ${ordenNombres.join(', ')}`);
            broadcast('PRESENCE_UPDATED', { reorderedCanal: canalKey, ordenNombres });

            res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ success: true }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
    });
}
```

- [ ] **Step 3: Actualizar `handleGetProximoTurno` para considerar `orden_rotacion_canales`**

```javascript
const presentes = db.prepare(`
    SELECT c.nombre, c.is_presente, COALESCE(o.orden, c.orden) as orden
    FROM codefensoras_estado c
    LEFT JOIN orden_rotacion_canales o ON o.canal = ? AND o.nombre = c.nombre
    WHERE c.is_presente = 1
    ORDER BY orden ASC, c.id ASC
`).all(canalKey);
```

- [ ] **Step 4: Verificar sintaxis con `node -c server.js` y commit**

Run: `node -c server.js`

```bash
git add server.js
git commit -m "feat(api): add orden_rotacion_canales table and reordenar-canal endpoint in server.js"
```

---

### Task 2: Estructura HTML & Estilos CSS del Segmented Control Nativo

**Files:**
- Modify: `f:\Apps\equipo-gestion\dashboard.html:825-835`
- Modify: `f:\Apps\equipo-gestion\dashboard.css`

**Interfaces:**
- Consumes: `#presenceReorderSection`.
- Produces: Segmented Control `.segmented-control-container` y título "Secuencia de Precedencia Rotativa".

- [ ] **Step 1: Actualizar marcado en `dashboard.html`**

```html
<!-- Bloque 2: Secuencia de Precedencia Rotativa -->
<div style="background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 1rem;">
    <h4 style="font-size: 0.88rem; color: #F59E0B; font-weight: 700; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.4rem;">
        <i class="ri-sort-asc"></i> Secuencia de Precedencia Rotativa
    </h4>
    <p style="font-size: 0.78rem; color: #94A3B8; margin-bottom: 0.85rem;">
        Seleccione el motivo de derivación para ajustar su orden de precedencia específico (1°, 2°, 3°...).
    </p>

    <!-- Segmented Control Estilo Nativo -->
    <div class="segmented-control-container" style="margin-bottom: 1rem;">
        <button class="segmented-control-btn active" data-canal="ASESORAMIENTO_GENERAL">Asesoramiento General</button>
        <button class="segmented-control-btn" data-canal="CAUSA_NUEVA">Causa Nueva</button>
        <button class="segmented-control-btn" data-canal="CONTESTACION_DEMANDA">Contestación</button>
        <button class="segmented-control-btn" data-canal="ADOPCION">Adopción / Guarda</button>
    </div>

    <div id="presenceReorderContainer" class="dnd-list-container">
        <!-- Se inyectan las filas ordenables según la pestaña activa -->
    </div>
</div>
```

- [ ] **Step 2: Agregar estilos CSS para el Segmented Control Nativo en `dashboard.css`**

```css
.segmented-control-container {
    display: flex;
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    padding: 3px;
    gap: 0;
    width: 100%;
    box-sizing: border-box;
}

.segmented-control-btn {
    flex: 1;
    padding: 0.45rem 0.6rem;
    font-size: 0.76rem;
    font-weight: 600;
    color: #94A3B8;
    background: transparent;
    border: none;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: center;
    white-space: nowrap;
}

.segmented-control-btn:first-child {
    border-top-left-radius: 6px;
    border-bottom-left-radius: 6px;
}

.segmented-control-btn:last-child {
    border-top-right-radius: 6px;
    border-bottom-right-radius: 6px;
    border-right: none;
}

.segmented-control-btn.active {
    background: #0EA5E9;
    color: #FFFFFF;
    font-weight: 700;
    box-shadow: 0 2px 8px rgba(14, 165, 233, 0.35);
    border-right-color: transparent;
}
```

- [ ] **Step 3: Commit del HTML y CSS**

```bash
git add dashboard.html dashboard.css
git commit -m "feat(ui): add native segmented control styles and updated reorder html structure"
```

---

### Task 3: Lógica JS para Drag & Drop Corregido y Segmented Control por Motivo

**Files:**
- Modify: `f:\Apps\equipo-gestion\build-bundle.js`
- Modify: `f:\Apps\equipo-gestion\dashboard-bundle.js` (vía `node build-bundle.js`)

**Interfaces:**
- Consumes: API `/api/familia/turnos/asignar-proximo`, API `/api/familia/codefensoras/reordenar-canal`.
- Produces: Eventos en Segmented Control y manejadores Drag & Drop robustos.

- [ ] **Step 1: Corregir `renderKanbanCategoryAssignment()` en `build-bundle.js`**

Asegurar que todas las 4 especialidades se inyectan correctamente y que `dragover` / `drop` en las `.kanban-defensora-card` previenen el comportamiento por defecto adecuadamente:

```javascript
renderKanbanCategoryAssignment() {
    const container = document.getElementById('kanbanCategoryContainer');
    if (!container) return;

    const turnos = this.currentTurnos || {};

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

    let draggedCanal = null;

    container.querySelectorAll('.draggable-category-chip').forEach(chip => {
        chip.addEventListener('dragstart', (e) => {
            draggedCanal = chip.getAttribute('data-canal');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', draggedCanal);
        });
    });

    container.querySelectorAll('.kanban-defensora-card').forEach(card => {
        ['dragenter', 'dragover'].forEach(eventName => {
            card.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                card.classList.add('drop-target-active');
            });
        });

        ['dragleave', 'dragend'].forEach(eventName => {
            card.addEventListener(eventName, (e) => {
                e.preventDefault();
                card.classList.remove('drop-target-active');
            });
        });

        card.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            card.classList.remove('drop-target-active');

            const nombreDefensora = card.getAttribute('data-nombre');
            const canalToAssign = draggedCanal || e.dataTransfer.getData('text/plain');

            if (!canalToAssign || !nombreDefensora) return;

            try {
                await fetch(getApiUrl('/api/familia/turnos/asignar-proximo'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        canalKey: canalToAssign,
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

- [ ] **Step 2: Implementar la gestión de pestañas del Segmented Control y `renderDndList(canalKey)`**

```javascript
bindSegmentedControlEvents() {
    const container = document.querySelector('.segmented-control-container');
    if (!container) return;

    container.querySelectorAll('.segmented-control-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.segmented-control-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const selectedCanal = btn.getAttribute('data-canal');
            this.currentSelectedCanal = selectedCanal;
            this.renderDndList(selectedCanal);
        });
    });
}
```

- [ ] **Step 3: Compilar bundle autónomo con `node build-bundle.js`**

Run: `node build-bundle.js`
Expected: Exited with code 0.

- [ ] **Step 4: Commit del JS**

```bash
git add build-bundle.js dashboard-bundle.js
git commit -m "feat(js): implement segmented control per motive and fix kanban drag & drop handlers"
```

---

### Task 4: Verificación Runtime & Pruebas de Integración

**Files:**
- Test: Navegador / Servidor en `server.js`

- [ ] **Step 1: Verificar sintaxis del servidor**

Run: `node -c server.js`

- [ ] **Step 2: Probar en navegador**

1. Ejecutar `node server.js`.
2. Abrir `http://localhost:3000`.
3. Probar el arrastre de cualquier chip entre tarjetas de defensora y verificar que se reasigna inmediatamente.
4. Alternar entre las pestañas del Segmented Control (`Asesoramiento General`, `Causa Nueva`, `Contestación`, `Adopción`) y verificar que cada una mantiene su orden de precedencia independiente.

- [ ] **Step 3: Commit final**

```bash
git add .
git commit -m "refactor(turnos): finalize refined family turn system implementation"
```
