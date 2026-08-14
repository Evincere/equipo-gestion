# Masonry Control Asistencia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar la pestaña "Control Asistencia" del modal reemplazando las píldoras comprimidas por un muro Masonry en 2 columnas (estilo Pinterest) con tarjetas ejecutivas de defensora que muestran avatar, switch de presencia y chips verticales para cada turno asignado sin desbordamiento de texto.

**Architecture:** Se actualiza `#presenceGridContainer` en `dashboard.html` a un contenedor `.presence-masonry-container`. En `dashboard.css` se crean estilos con `@supports (grid-template-rows: masonry)` y fallback de columnas CSS (`column-count: 2`, `break-inside: avoid`). En `build-bundle.js` se reescribe la generación HTML de la cuadrícula a tarjetas ejecutivas espaciosas (`.presence-card-masonry`).

**Tech Stack:** HTML5, CSS3 (CSS Grid Masonry, Multi-column CSS, Flexbox), JavaScript Vanilla, Node.js (`build-bundle.js`).

## Global Constraints

- **Layout Masonry**: 2 columnas holgadas. `@supports (grid-template-rows: masonry)` con `grid-template-columns: repeat(2, 1fr)` y fallback `column-count: 2; column-gap: 0.85rem;`.
- **Prevenir Cortes**: `.presence-card-masonry` debe usar `break-inside: avoid; display: inline-block; width: 100%; margin-bottom: 0.85rem;`.
- **Chips Verticales por Especialidad**: Cada turno asignado se lista en su propio bloque vertical con ícono y color sin abreviar agresivamente ni desbordar.
- **Switch Interactivo**: Badge/Toggle visual a la derecha del encabezado de la tarjeta.

---

### Task 1: Estructura HTML en `dashboard.html`

**Files:**
- Modify: `f:\Apps\equipo-gestion\dashboard.html:810-825`

**Interfaces:**
- Consumes: `#presenceGridSection`.
- Produces: Contenedor `#presenceGridContainer` con clase `.presence-masonry-container`.

- [ ] **Step 1: Actualizar el contenedor `#presenceGridContainer` en `dashboard.html`**

```html
<!-- Sección 1: Cuadrícula de Asistencia (Muro Masonry) -->
<div id="presenceGridSection" class="modal-tab-section active">
    <p style="font-size: 0.85rem; color: #94A3B8; margin-bottom: 1rem;">
        Haga clic sobre cualquier profesional para cambiar su estado de asistencia (Presente / Ausente).
    </p>
    <div id="presenceGridContainer" class="presence-masonry-container" style="max-height: 440px; overflow-y: auto; padding-right: 0.25rem;">
        <!-- Se inyectan las tarjetas ejecutivas Masonry desde JS -->
    </div>
</div>
```

- [ ] **Step 2: Commit del marcado HTML**

```bash
git add dashboard.html
git commit -m "feat(ui): update presenceGridContainer to presence-masonry-container in dashboard.html"
```

---

### Task 2: Estilos CSS del Muro Masonry y Tarjetas Ejecutivas en `dashboard.css`

**Files:**
- Modify: `f:\Apps\equipo-gestion\dashboard.css:660-720`

**Interfaces:**
- Consumes: Clases `.presence-masonry-container`, `.presence-card-masonry`, `.card-header`, `.card-duty-list`, `.duty-chip-block`.

- [ ] **Step 1: Agregar reglas de Grid Masonry y Fallback Multi-columna**

```css
/* ==========================================================================
   MURO MASONRY Y TARJETAS DE CONTROL DE ASISTENCIA (PINTEREST STYLE)
   ========================================================================== */
.presence-masonry-container {
    column-count: 2;
    column-gap: 0.85rem;
    width: 100%;
}

@supports (grid-template-rows: masonry) {
    .presence-masonry-container {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        grid-template-rows: masonry;
        gap: 0.85rem;
        column-count: initial;
    }
}
```

- [ ] **Step 2: Agregar estilos para las Tarjetas Ejecutivas de Defensora (`presence-card-masonry`)**

```css
.presence-card-masonry {
    display: inline-block;
    width: 100%;
    break-inside: avoid;
    margin-bottom: 0.85rem;
    background: rgba(30, 41, 59, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 0.85rem 1rem;
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    cursor: pointer;
    box-sizing: border-box;
}

.presence-card-masonry.is-present {
    border-color: rgba(74, 222, 128, 0.35);
    background: rgba(15, 23, 42, 0.85);
}

.presence-card-masonry.is-absent {
    border-color: rgba(239, 68, 68, 0.25);
    background: rgba(30, 41, 59, 0.4);
    opacity: 0.75;
}

.presence-card-masonry:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
    border-color: rgba(56, 189, 248, 0.4);
}

.card-header-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.6rem;
}

.card-user-info {
    display: flex;
    align-items: center;
    gap: 0.6rem;
}

.card-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(51, 65, 85, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #38BDF8;
    font-size: 1rem;
}

.card-name {
    font-size: 0.88rem;
    font-weight: 700;
    color: #FFF;
}

.card-status-badge {
    font-size: 0.72rem;
    font-weight: 700;
    padding: 0.2rem 0.55rem;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    white-space: nowrap;
}

.card-status-badge.present {
    background: rgba(74, 222, 128, 0.18);
    color: #4ADE80;
    border: 1px solid rgba(74, 222, 128, 0.3);
}

.card-status-badge.absent {
    background: rgba(239, 68, 68, 0.18);
    color: #F87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
}

.card-duty-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 0.5rem;
    margin-top: 0.4rem;
}

.duty-chip-block {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.74rem;
    font-weight: 600;
    padding: 0.3rem 0.6rem;
    border-radius: 6px;
}

.duty-chip-block.duty-asesoria {
    background: rgba(236, 72, 153, 0.15);
    color: #F472B6;
    border: 1px solid rgba(236, 72, 153, 0.3);
}

.duty-chip-block.duty-causa {
    background: rgba(14, 165, 233, 0.15);
    color: #38BDF8;
    border: 1px solid rgba(14, 165, 233, 0.3);
}

.duty-chip-block.duty-contestacion {
    background: rgba(245, 158, 11, 0.15);
    color: #FBBF24;
    border: 1px solid rgba(245, 158, 11, 0.3);
}

.duty-chip-block.duty-adopcion {
    background: rgba(139, 92, 246, 0.15);
    color: #A78BFA;
    border: 1px solid rgba(139, 92, 246, 0.3);
}
```

- [ ] **Step 3: Commit de los cambios CSS**

```bash
git add dashboard.css
git commit -m "feat(css): add masonry wall and executive card styles in dashboard.css"
```

---

### Task 3: Lógica JS para Generar Tarjetas Ejecutivas Masonry en `build-bundle.js`

**Files:**
- Modify: `f:\Apps\equipo-gestion\build-bundle.js`
- Modify: `f:\Apps\equipo-gestion\dashboard-bundle.js` (vía script `node build-bundle.js`)

**Interfaces:**
- Consumes: `this.codefensorasRoster`, `this.currentTurnos`.
- Produces: HTML de `.presence-card-masonry` en `#presenceGridContainer`.

- [ ] **Step 1: Actualizar la generación HTML dentro de `renderPresenceRoster()` en `build-bundle.js`**

Implementar `generateMasonryCardHtml(c)` para renderizar las tarjetas ejecutivas en `#presenceGridContainer`:

```javascript
const generateMasonryCardHtml = (c) => {
    const isPresent = !!c.isPresente;
    const turnos = this.currentTurnos || {};
    const roles = [];

    if (turnos['Ases. General'] === c.nombre || turnos['Asesoramiento General'] === c.nombre) {
        roles.push({ cls: 'duty-asesoria', label: 'Asesoría General', icon: 'ri-file-user-line' });
    }
    if (turnos['Causa Nueva'] === c.nombre) {
        roles.push({ cls: 'duty-causa', label: 'Causa Nueva', icon: 'ri-folder-add-line' });
    }
    if (turnos['Contestación'] === c.nombre) {
        roles.push({ cls: 'duty-contestacion', label: 'Contestación de Demanda', icon: 'ri-edit-2-line' });
    }
    if (turnos['Adopción / Guarda'] === c.nombre || turnos['Adopción'] === c.nombre) {
        roles.push({ cls: 'duty-adopcion', label: 'Adopción / Guarda', icon: 'ri-heart-add-line' });
    }

    let dutyBlocksHtml = '';
    if (roles.length > 0) {
        dutyBlocksHtml = '<div class="card-duty-list">' +
            roles.map(r => '<div class="duty-chip-block ' + r.cls + '"><i class="' + r.icon + '"></i><span>' + r.label + '</span></div>').join('') +
        '</div>';
    } else {
        dutyBlocksHtml = '<div style="font-size: 0.72rem; color: #64748B; padding-top: 0.4rem; font-style: italic;">Sin turno asignado hoy</div>';
    }

    const cardStateClass = isPresent ? 'is-present' : 'is-absent';
    const statusBadgeClass = isPresent ? 'present' : 'absent';
    const statusText = isPresent ? '<i class="ri-checkbox-circle-fill"></i> Presente' : '<i class="ri-close-circle-line"></i> Ausente';

    return '<div class="presence-card-masonry ' + cardStateClass + '" data-name="' + c.nombre + '">' +
        '<div class="card-header-main">' +
            '<div class="card-user-info">' +
                '<div class="card-avatar"><i class="ri-user-star-line"></i></div>' +
                '<span class="card-name">Dra. ' + c.nombre + '</span>' +
            '</div>' +
            '<span class="card-status-badge ' + statusBadgeClass + '">' + statusText + '</span>' +
        '</div>' +
        dutyBlocksHtml +
    '</div>';
};
```

- [ ] **Step 2: Inyectar `generateMasonryCardHtml` en `gridContainer` y vincular click event**

```javascript
if (gridContainer) {
    gridContainer.innerHTML = this.codefensorasRoster.map(c => generateMasonryCardHtml(c)).join('');
    gridContainer.querySelectorAll('.presence-card-masonry').forEach(card => {
        card.addEventListener('click', async () => {
            const nombre = card.getAttribute('data-name');
            const c = this.codefensorasRoster.find(item => item.nombre === nombre);
            if (c) {
                c.isPresente = !c.isPresente;
                await this.updateCodefensoraPresenceServer(c);
                this.renderPresenceRoster();
                await this.calculateProximoTurno();
            }
        });
    });
}
```

- [ ] **Step 3: Compilar el bundle autónomo con `node build-bundle.js`**

Run: `node build-bundle.js`
Expected: "Bundle actualizado exitosamente" sin errores de sintaxis.

- [ ] **Step 4: Commit del JS**

```bash
git add build-bundle.js dashboard-bundle.js
git commit -m "feat(js): implement masonry executive cards rendering in build-bundle.js"
```

---

### Task 4: Verificación Runtime & Pruebas de Integración

**Files:**
- Test: Navegador / Servidor en `server.js`

- [ ] **Step 1: Reiniciar/Verificar servidor local**

Run: `node server.js`

- [ ] **Step 2: Verificar la visualización en el navegador**

1. Abrir `http://localhost:3000`.
2. Abrir el modal de operaciones de presentismo.
3. Comprobar que las defensoras se presentan en tarjetas de 2 columnas Masonry espaciosas.
4. Verificar que las defensoras con múltiples turnos (ej. Dra. Mariela Fokszek con Asesoría General + Contestación) muestran sus chips en líneas verticales separadas sin apretujar texto.
5. Hacer clic en cualquier tarjeta para alternar entre Presente y Ausente.

- [ ] **Step 3: Commit final**

```bash
git add .
git commit -m "refactor(masonry): finalize control asistencia masonry wall redesign"
```
