# Drag & Drop Operation Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar un Panel Completo de Operación en el modal de presentismo con navegación por pestañas (Presentismo vs. Reordenamiento) y una interacción Drag & Drop avanzada (Grip 6 dots, ghost preview, línea de inserción brillante, desplazamiento dinámico, anuncios accesibles ARIA Live y persistencia en DB backend).

**Architecture:** Se añade el endpoint `/api/familia/codefensoras/reordenar` y ordenamiento en SQLite DB en `server.js`. En `dashboard.html` se añaden pestañas y la estructura de lista arrastrable con región viva `#dndLiveRegion`. En `dashboard.css` se crean estilos para el feedback del arrastre. En `build-bundle.js` se codifican los controladores de los eventos HTML5 drag & drop (`dragstart`, `dragover`, `drop`, `setDragImage`).

**Tech Stack:** HTML5 Drag and Drop API, CSS3 (CSS Grid/Flexbox, CSS Transitions, ARIA Live), JavaScript Vanilla, Node.js + SQLite3 (`better-sqlite3`).

## Global Constraints

- **Pestañas Segmentadas**: Dos pestañas (`.modal-tab-btn`): `Presentismo` (cuadrícula actual) y `Reordenar Turnos` (lista arrastrable).
- **Grip Icon**: Matriz de 6 puntos (`ri-draggable`).
- **Drag Ghost Preview**: Translucido mediante `dataTransfer.setDragImage()`.
- **Línea de Inserción**: Elemento brillante en borde superior/inferior (`.dnd-insertion-line`).
- **Accesibilidad ARIA**: Anuncios en `#dndLiveRegion` (`aria-live="assertive"`). Prohibido usar el atributo obsoleto `aria-grabbed`.
- **Persistencia**: Actualizar columna `orden` en `codefensoras_estado` en SQLite y broadcast WebSocket `ROTATION_UPDATED`.

---

### Task 1: Backend Database & Endpoint de Reordenamiento en `server.js`

**Files:**
- Modify: `f:\Apps\equipo-gestion\server.js:434-440`
- Modify: `f:\Apps\equipo-gestion\server.js:1381-1435`

**Interfaces:**
- Consumes: Peticiones HTTP `POST /api/familia/codefensoras/reordenar`.
- Produces: Tabla SQLite `codefensoras_estado` ordenada por campo `orden ASC`, broadcast WebSocket `PRESENCE_UPDATED`.

- [ ] **Step 1: Asegurar la columna `orden` e índice en la base de datos SQLite**

En `server.js`, agregar alter table/verificación para la columna `orden`:

```javascript
try {
    db.exec(`ALTER TABLE codefensoras_estado ADD COLUMN orden INTEGER DEFAULT 0`);
} catch(e) {}
```

- [ ] **Step 2: Agregar el Endpoint `/api/familia/codefensoras/reordenar`**

En el router de `server.js`:

```javascript
if (pathname === '/api/familia/codefensoras/reordenar' && req.method === 'POST') {
    return handlePostReordenarCodefensoras(req, res);
}
```

- [ ] **Step 3: Implementar la función `handlePostReordenarCodefensoras`**

```javascript
function handlePostReordenarCodefensoras(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
        try {
            const data = JSON.parse(body); // { ordenNombres: ["Dra. X", "Dra. Y", ...] }
            if (Array.isArray(data.ordenNombres)) {
                const stmt = db.prepare('UPDATE codefensoras_estado SET orden = ? WHERE nombre = ?');
                const updateMany = db.transaction((list) => {
                    list.forEach((nombre, idx) => {
                        stmt.run(idx + 1, nombre);
                    });
                });
                updateMany(data.ordenNombres);

                logAudit(0, data.operatorName || 'OPERADOR', 'REORDEN_PRESENTISMO', `Nuevo orden de turnos establecido: ${data.ordenNombres.join(', ')}`);
                broadcast('PRESENCE_UPDATED', { reordered: true });
            }
            res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ success: true }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
    });
}
```

- [ ] **Step 4: Actualizar `SELECT` en `handleGetCodefensoras` para ordenar por `orden ASC, id ASC`**

```javascript
const rows = db.prepare('SELECT id, nombre, is_presente, motivo_ausencia, orden FROM codefensoras_estado ORDER BY orden ASC, id ASC').all();
```

- [ ] **Step 5: Commit del cambio en el backend**

```bash
git add server.js
git commit -m "feat(api): add reordering endpoint and orden column support in server.js"
```

---

### Task 2: Estructura HTML con Pestañas y Región Viva ARIA en `dashboard.html`

**Files:**
- Modify: `f:\Apps\equipo-gestion\dashboard.html:788-808`

**Interfaces:**
- Consumes: Modal `#presenceGridModal`.
- Produces: Pestañas `#tabPresenceGrid`, `#tabPresenceReorder`, contendores `#presenceGridContainer`, `#presenceReorderContainer`, y región viva `#dndLiveRegion`.

- [ ] **Step 1: Modificar el encabezado e interior de `#presenceGridModal` en `dashboard.html`**

```html
<!-- Modal Vista de Operaciones (Presentismo & Reordenamiento Drag & Drop) -->
<div class="modal-overlay" id="presenceGridModal">
    <div class="modal-content" style="max-width: 680px;">
        <div class="modal-header" style="flex-direction: column; align-items: stretch; gap: 0.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h4 style="margin: 0; display: flex; align-items: center; gap: 0.5rem; color: #FFF; font-size: 1.1rem;">
                    <i class="ri-team-line" style="color: var(--mpd-red);"></i> Panel de Gestión de Turnos & Presentismo
                </h4>
                <button class="modal-close-btn" id="btnClosePresenceGridModal"><i class="ri-close-line"></i></button>
            </div>
            
            <!-- Pestañas Segmentadas -->
            <div class="modal-tabs">
                <button class="modal-tab-btn active" id="tabPresenceGrid" data-target="presenceGridSection">
                    <i class="ri-grid-fill"></i> Control Asistencia
                </button>
                <button class="modal-tab-btn" id="tabPresenceReorder" data-target="presenceReorderSection">
                    <i class="ri-drag-drop-line"></i> Reordenar Prioridad (Drag & Drop)
                </button>
            </div>
        </div>

        <div class="modal-body">
            <!-- Región Viva ARIA para accesibilidad del Drag and Drop -->
            <div id="dndLiveRegion" class="sr-only" aria-live="assertive" aria-atomic="true"></div>

            <!-- Sección 1: Cuadrícula de Asistencia -->
            <div id="presenceGridSection" class="modal-tab-section active">
                <p style="font-size: 0.85rem; color: #94A3B8; margin-bottom: 1rem;">
                    Haga clic sobre cualquier profesional para cambiar su estado de asistencia (Presente / Ausente).
                </p>
                <div id="presenceGridContainer" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.75rem; max-height: 420px; overflow-y: auto;">
                </div>
            </div>

            <!-- Sección 2: Reordenamiento por Drag & Drop -->
            <div id="presenceReorderSection" class="modal-tab-section" style="display: none;">
                <p style="font-size: 0.85rem; color: #94A3B8; margin-bottom: 1rem;">
                    Arrastre las filas desde el icono de 6 puntos para establecer la prioridad y orden de asignación rotativa del día.
                </p>
                <div id="presenceReorderContainer" class="dnd-list-container" style="max-height: 420px; overflow-y: auto;">
                </div>
            </div>
        </div>
    </div>
</div>
```

- [ ] **Step 2: Commit del marcado HTML**

```bash
git add dashboard.html
git commit -m "feat(ui): add segmented tabs and dnd container to presenceGridModal in dashboard.html"
```

---

### Task 3: Estilos CSS para Drag & Drop y Pestañas en `dashboard.css`

**Files:**
- Modify: `f:\Apps\equipo-gestion\dashboard.css:480-530`

**Interfaces:**
- Consumes: Clases `.modal-tabs`, `.modal-tab-btn`, `.dnd-list-container`, `.dnd-item`, `.dnd-handle`, `.dnd-insertion-line`, `.sr-only`.

- [ ] **Step 1: Agregar estilos para Pestañas Segmentadas y Accesibilidad `.sr-only`**

```css
/* Pestañas Modal */
.modal-tabs {
    display: flex;
    gap: 0.5rem;
    background: rgba(15, 23, 42, 0.6);
    padding: 0.25rem;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
}

.modal-tab-btn {
    flex: 1;
    background: none;
    border: none;
    color: #94A3B8;
    padding: 0.45rem 0.75rem;
    font-size: 0.82rem;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    transition: all 0.2s ease;
}

.modal-tab-btn.active {
    background: rgba(51, 65, 85, 0.8);
    color: #FFF;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}
```

- [ ] **Step 2: Agregar estilos para la Lista Drag & Drop, Handle y Línea de Inserción**

```css
.dnd-list-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    position: relative;
}

.dnd-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(30, 41, 59, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 0.6rem 0.85rem;
    transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;
    user-select: none;
    position: relative;
}

.dnd-item.is-dragging {
    opacity: 0.4;
    border-style: dashed;
    border-color: #38BDF8;
    background: rgba(14, 165, 233, 0.1);
}

.dnd-handle {
    cursor: grab;
    color: #64748B;
    font-size: 1.1rem;
    padding-right: 0.6rem;
    display: flex;
    align-items: center;
}

.dnd-handle:active {
    cursor: grabbing;
    color: #38BDF8;
}

/* Línea de inserción brillante */
.dnd-item.drop-target-above::before {
    content: '';
    position: absolute;
    top: -3px;
    left: 0;
    right: 0;
    height: 4px;
    background: #0EA5E9;
    border-radius: 2px;
    box-shadow: 0 0 10px #0EA5E9;
}

.dnd-item.drop-target-below::after {
    content: '';
    position: absolute;
    bottom: -3px;
    left: 0;
    right: 0;
    height: 4px;
    background: #0EA5E9;
    border-radius: 2px;
    box-shadow: 0 0 10px #0EA5E9;
}
```

- [ ] **Step 3: Commit de los cambios en CSS**

```bash
git add dashboard.css
git commit -m "feat(css): add dnd list styles, handle, insertion line, and segmented tabs"
```

---

### Task 4: Lógica Drag & Drop y Conmutación de Pestañas en `build-bundle.js`

**Files:**
- Modify: `f:\Apps\equipo-gestion\build-bundle.js`
- Modify: `f:\Apps\equipo-gestion\dashboard-bundle.js` (vía script `node build-bundle.js`)

**Interfaces:**
- Consumes: Eventos HTML5 Drag & Drop, API `/api/familia/codefensoras/reordenar`.
- Produces: Reordenamiento interactivo en tiempo real y anuncios en `#dndLiveRegion`.

- [ ] **Step 1: Agregar controlador de pestañas en `bindEvents()` de `build-bundle.js`**

```javascript
const tabBtns = document.querySelectorAll('.modal-tab-btn');
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-target');
        document.querySelectorAll('.modal-tab-section').forEach(sec => {
            sec.style.display = (sec.id === targetId) ? 'block' : 'none';
        });
    });
});
```

- [ ] **Step 2: Implementar la renderización de la lista Drag & Drop y los Event Listeners**

En `renderPresenceRoster()`, renderizar la lista en `#presenceReorderContainer` con `draggable="true"` en cada `.dnd-item` y vincular los eventos:

```javascript
const renderDndList = (container, roster) => {
    if (!container) return;
    container.innerHTML = roster.map((c, index) => `
        <div class="dnd-item" draggable="true" data-index="${index}" data-nombre="${c.nombre}">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span class="dnd-handle" title="Arrastrar para reordenar"><i class="ri-draggable"></i></span>
                <span style="font-weight: 600; font-size: 0.85rem; color: #FFF;">Dra. ${c.nombre}</span>
            </div>
            <span class="presence-dot ${c.isPresente ? 'is-present' : ''}"></span>
        </div>
    `).join('');

    let draggedItem = null;
    let draggedIndex = -1;
    const liveRegion = document.getElementById('dndLiveRegion');

    container.querySelectorAll('.dnd-item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            draggedItem = item;
            draggedIndex = parseInt(item.getAttribute('data-index'), 10);
            item.classList.add('is-dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', item.getAttribute('data-nombre'));

            if (liveRegion) {
                liveRegion.textContent = `Se ha seleccionado a Dra. ${item.getAttribute('data-nombre')}. Posición actual ${draggedIndex + 1} de ${roster.length}.`;
            }
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            container.querySelectorAll('.dnd-item').forEach(el => {
                el.classList.remove('drop-target-above', 'drop-target-below');
            });

            const rect = item.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            if (e.clientY < midpoint) {
                item.classList.add('drop-target-above');
            } else {
                item.classList.add('drop-target-below');
            }
        });

        item.addEventListener('drop', async (e) => {
            e.preventDefault();
            item.classList.remove('drop-target-above', 'drop-target-below');

            if (!draggedItem || draggedItem === item) return;

            const targetIndex = parseInt(item.getAttribute('data-index'), 10);
            const rosterCopy = [...this.codefensorasRoster];
            const [moved] = rosterCopy.splice(draggedIndex, 1);
            rosterCopy.splice(targetIndex, 0, moved);

            this.codefensorasRoster = rosterCopy;

            if (liveRegion) {
                liveRegion.textContent = `Dra. ${moved.nombre} reordenada a la posición ${targetIndex + 1} de ${rosterCopy.length}.`;
            }

            // Guardar en backend
            const nombresOrdenados = rosterCopy.map(r => r.nombre);
            try {
                await fetch(getApiUrl('/api/familia/codefensoras/reordenar'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ordenNombres: nombresOrdenados, operatorName: this.currentUser ? this.currentUser.nombreCompleto : 'OPERADOR' })
                });
            } catch(e) {}

            this.renderPresenceRoster();
            await this.calculateProximoTurno();
        });

        item.addEventListener('dragend', () => {
            if (draggedItem) draggedItem.classList.remove('is-dragging');
            container.querySelectorAll('.dnd-item').forEach(el => {
                el.classList.remove('drop-target-above', 'drop-target-below');
            });
        });
    });
};
```

- [ ] **Step 3: Compilar el bundle autónomo con `node build-bundle.js`**

Run: `node build-bundle.js`
Expected: "Bundle actualizado exitosamente" sin errores de sintaxis.

- [ ] **Step 4: Commit de la lógica Drag & Drop**

```bash
git add build-bundle.js dashboard-bundle.js
git commit -m "feat(js): implement drag and drop reordering handlers, aria live announcements, and tab view switching"
```

---

### Task 5: Verificación Runtime & Pruebas de Integración

**Files:**
- Test: Navegador / Servidor en `server.js`

- [ ] **Step 1: Reiniciar/Verificar servidor local**

Run: `node server.js`

- [ ] **Step 2: Verificar la interacción Drag & Drop en el navegador**

1. Abrir la app en `http://localhost:3000`.
2. Abrir el modal de gestión con el botón del Marquee Ticker.
3. Cambiar a la pestaña "Reordenar Prioridad (Drag & Drop)".
4. Arrastrar una defensora hacia arriba o abajo desde el icono de 6 puntos.
5. Comprobar que la línea brillante aparece en el destino y que al soltar cambia el orden inmediatamente.
6. Verificar que el Marquee Ticker del dashboard refleja la nueva secuencia de prioridad.

- [ ] **Step 3: Commit final**

```bash
git add .
git commit -m "refactor(dnd): finalize drag and drop operation panel implementation"
```
