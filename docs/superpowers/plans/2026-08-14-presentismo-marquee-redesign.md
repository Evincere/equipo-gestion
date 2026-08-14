# Presentismo Marquee Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar el panel de Presentismo Co-Defensoría de Familia en un cintillo Marquee horizontal compacto (~42px), unificando la presencia de las defensoras con los turnos rotativos asignados, máscara de desvanecimiento en bordes (Edge Fade), pausa al hover, soporte accesible para movimiento reducido y una vista modal opcional en cuadrícula (Grid View).

**Architecture:** Se actualiza el marcado HTML de `dashboard.html` a un contenedor `presence-marquee-container`, se crean estilos CSS3 modernos en `dashboard.css` con `@keyframes` y `mask-image`, y se reescribe el renderizador `renderPresenceRoster()` en `build-bundle.js`/`dashboard-bundle.js` para generar los pills unificados y duplicarlos (2x) en el DOM logrando un bucle sin cortes.

**Tech Stack:** HTML5, CSS3 (CSS Grid/Flexbox, Keyframes, CSS Masks), JavaScript Vanilla, Node.js (build system script `build-bundle.js`).

## Global Constraints

- **Single Line Height:** El cintillo no debe exceder 44px de altura vertical total.
- **Color Codes por Especialidad**:
  - Asesoría General: `#EC4899` (Magenta/Rosa)
  - Causa Nueva: `#0EA5E9` (Azul/Cyan)
  - Contestación: `#F59E0B` (Dorado/Ámbar)
  - Adopción / Guarda: `#8B5CF6` (Púrpura/Violeta)
- **Marquee sin etiqueta obsoleta `<marquee>`**: Usar únicamente `@keyframes translateX(-50%)` con la pista duplicada en el DOM.
- **Edge Fade**: Aplicar `mask-image` / `-webkit-mask-image` con `linear-gradient` para disolver elementos a los lados.

---

### Task 1: Estructura HTML y Modal en `dashboard.html`

**Files:**
- Modify: `f:\Apps\equipo-gestion\dashboard.html:126-137`
- Modify: `f:\Apps\equipo-gestion\dashboard.html:780-790`

**Interfaces:**
- Consumes: Contenedor `.presence-panel` existente.
- Produces: IDs `#presenceMarqueeWrapper`, `#presenceMarqueeTrack`, `#btnExpandPresence`, y `#presenceGridModal`.

- [ ] **Step 1: Reemplazar el contenedor `.presence-panel` actual por la estructura Marquee**

```html
<!-- Panel de Asistencia / Presentismo Co-Defensoría de Familia (Marquee Compacto) -->
<div class="presence-marquee-container">
    <div class="presence-marquee-header">
        <span class="presence-marquee-title"><i class="ri-user-follow-line"></i> Turnos & Presentismo</span>
    </div>
    <div class="presence-marquee-wrapper" id="presenceMarqueeWrapper">
        <div class="presence-marquee-track" id="presenceMarqueeTrack">
            <span style="font-size: 0.8rem; color: #94A3B8; padding: 0.5rem;">Cargando estado de asistencia y turnos...</span>
        </div>
    </div>
    <button class="btn-expand-presence" id="btnExpandPresence" title="Ver todo el equipo en cuadrícula">
        <i class="ri-grid-fill"></i>
    </button>
</div>
```

- [ ] **Step 2: Agregar el Modal de Vista en Cuadrícula (`presenceGridModal`) al final del body**

```html
<!-- Modal Vista en Cuadrícula (Presentismo Completo) -->
<div id="presenceGridModal" class="modal-overlay" style="display: none;">
    <div class="modal-card" style="max-width: 650px; width: 90%;">
        <div class="modal-header">
            <h3 style="margin: 0; display: flex; align-items: center; gap: 0.5rem; color: #FFF; font-size: 1.1rem;">
                <i class="ri-team-line" style="color: var(--mpd-red);"></i> Estado de Asistencia y Turnos Rotativos
            </h3>
            <button class="modal-close" id="btnClosePresenceGridModal">&times;</button>
        </div>
        <div class="modal-body" style="padding: 1.25rem;">
            <p style="font-size: 0.85rem; color: #94A3B8; margin-bottom: 1rem;">
                Haga clic sobre cualquier profesional para cambiar su estado de asistencia (Presente / Ausente).
            </p>
            <div id="presenceGridContainer" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.75rem; max-height: 400px; overflow-y: auto;">
                <!-- Se inyectan las cards en cuadrícula -->
            </div>
        </div>
    </div>
</div>
```

- [ ] **Step 3: Verificar sintaxis del HTML**

Comprobar que no haya etiquetas sin cerrar en `dashboard.html`.

- [ ] **Step 4: Commit de la estructura HTML**

```bash
git add dashboard.html
git commit -m "feat(ui): add marquee html structure and presence grid modal to dashboard.html"
```

---

### Task 2: Estilos CSS en `dashboard.css`

**Files:**
- Modify: `f:\Apps\equipo-gestion\dashboard.css:393-450`

**Interfaces:**
- Consumes: Clases `.presence-marquee-container`, `.presence-marquee-wrapper`, `.presence-marquee-track`, `.presence-pill-unified`, modal `#presenceGridModal`.

- [ ] **Step 1: Agregar variables y estilos base del Marquee Ticker con Edge Fade Mask**

```css
/* ==========================================================================
   PANEL DE PRESENTISMO Y ASISTENCIA - MARQUEE TICKER REDISEÑADO
   ========================================================================== */
.presence-marquee-container {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 0.35rem 0.75rem;
    margin-bottom: 1rem;
    height: 44px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.presence-marquee-header {
    display: flex;
    align-items: center;
    white-space: nowrap;
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    padding-right: 0.75rem;
}

.presence-marquee-title {
    font-size: 0.8rem;
    font-weight: 600;
    color: #94A3B8;
    display: flex;
    align-items: center;
    gap: 0.4rem;
}

.presence-marquee-wrapper {
    flex: 1;
    overflow: hidden;
    position: relative;
    display: flex;
    align-items: center;
    mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%);
    -webkit-mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%);
}

.presence-marquee-track {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    width: max-content;
    animation: marqueeLoop 32s linear infinite;
    will-change: transform;
}

.presence-marquee-track:hover {
    animation-play-state: paused;
}

@keyframes marqueeLoop {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
}

@media (prefers-reduced-motion: reduce) {
    .presence-marquee-track {
        animation: none;
        overflow-x: auto;
    }
}
```

- [ ] **Step 2: Agregar estilos de los Pills Unificados Inteligentes y Botón Grid**

```css
.presence-pill-unified {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    background: rgba(30, 41, 59, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    padding: 0.25rem 0.65rem;
    font-size: 0.78rem;
    color: #E2E8F0;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s ease;
    user-select: none;
}

.presence-pill-unified:hover {
    transform: translateY(-1px);
    background: rgba(51, 65, 85, 0.9);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.presence-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background-color: #64748B;
    box-shadow: 0 0 4px rgba(100, 116, 139, 0.4);
}

.presence-dot.is-present {
    background-color: #4ADE80;
    box-shadow: 0 0 8px rgba(74, 222, 128, 0.6);
}

.duty-chip {
    font-size: 0.68rem;
    font-weight: 700;
    padding: 0.1rem 0.4rem;
    border-radius: 10px;
    text-transform: uppercase;
    letter-spacing: 0.02em;
}

/* Colores por especialidad */
.duty-asesoria {
    border-color: rgba(236, 72, 153, 0.4);
}
.duty-asesoria .duty-chip {
    background: rgba(236, 72, 153, 0.18);
    color: #F472B6;
    border: 1px solid rgba(236, 72, 153, 0.3);
}

.duty-causa {
    border-color: rgba(14, 165, 233, 0.4);
}
.duty-causa .duty-chip {
    background: rgba(14, 165, 233, 0.18);
    color: #38BDF8;
    border: 1px solid rgba(14, 165, 233, 0.3);
}

.duty-contestacion {
    border-color: rgba(245, 158, 11, 0.4);
}
.duty-contestacion .duty-chip {
    background: rgba(245, 158, 11, 0.18);
    color: #FBBF24;
    border: 1px solid rgba(245, 158, 11, 0.3);
}

.duty-adopcion {
    border-color: rgba(139, 92, 246, 0.4);
}
.duty-adopcion .duty-chip {
    background: rgba(139, 92, 246, 0.18);
    color: #A78BFA;
    border: 1px solid rgba(139, 92, 246, 0.3);
}

.btn-expand-presence {
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94A3B8;
    border-radius: 8px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
}

.btn-expand-presence:hover {
    color: #FFF;
    background: rgba(51, 65, 85, 0.9);
    border-color: var(--mpd-red);
}
```

- [ ] **Step 3: Commit de los cambios CSS**

```bash
git add dashboard.css
git commit -m "feat(css): add marquee animation, edge fade mask, and unified pill styles"
```

---

### Task 3: Lógica JS para Renderizar Marquee y Manejar Interacciones

**Files:**
- Modify: `f:\Apps\equipo-gestion\build-bundle.js`
- Modify: `f:\Apps\equipo-gestion\dashboard-bundle.js` (si aplica o vía script de build)

**Interfaces:**
- Consumes: API endpoints `/api/presentismo`, `socket.on('presentismo_updated')`.
- Produces: Actualización de `#presenceMarqueeTrack` y `#presenceGridContainer`.

- [ ] **Step 1: Actualizar la inicialización de elementos en JS**

Localizar en `build-bundle.js` las referencias a `presenceRosterContainer` y `turnIndicatorBadge`, y actualizarlas para hacer referencia a `presenceMarqueeTrack` y los nuevos contenedores.

- [ ] **Step 2: Modificar el método de renderizado de la asistencia (`renderPresenceRoster`)**

Generar el HTML para los pills unificados cruzando cada profesional con su turno rotativo actual y su estado `isPresente`.
Duplicar las cards en el `presenceMarqueeTrack` (`itemsHtml + itemsHtml`) para permitir un bucle suave de animación.

```javascript
// Construcción del HTML de pills unificados
const renderUnifiedPills = (defensores, turnos) => {
    return defensores.map(def => {
        // Identificar especialidad activa
        let dutyClass = '';
        let dutyLabel = '';
        if (turnos.asesoria === def.nombre) { dutyClass = 'duty-asesoria'; dutyLabel = 'Ases. Gen.'; }
        else if (turnos.causaNueva === def.nombre) { dutyClass = 'duty-causa'; dutyLabel = 'Causa Nva.'; }
        else if (turnos.contestacion === def.nombre) { dutyClass = 'duty-contestacion'; dutyLabel = 'Contestación'; }
        else if (turnos.adopcion === def.nombre) { dutyClass = 'duty-adopcion'; dutyLabel = 'Adopción'; }

        return `
            <div class="presence-pill-unified ${dutyClass}" data-nombre="${def.nombre}" data-presente="${def.isPresente}">
                <span class="presence-dot ${def.isPresente ? 'is-present' : ''}"></span>
                <span class="presence-name">${def.nombre}</span>
                ${dutyLabel ? `<span class="duty-chip">${dutyLabel}</span>` : ''}
            </div>
        `;
    }).join('');
};
```

- [ ] **Step 3: Vincular eventos de clic para cambiar asistencia y abrir Modal**

En los pills renderizados, añadir click event listener para llamar a `togglePresentismo(nombre, isPresente)`.
Al hacer clic en `#btnExpandPresence`, mostrar `#presenceGridModal` inyectando la cuadrícula en `#presenceGridContainer`.
Vincular el botón `#btnClosePresenceGridModal` para cerrar la cuadrícula.

- [ ] **Step 4: Ejecutar la compilación del bundle (`npm run build`)**

Run: `node build-bundle.js`
Expected: "Bundle actualizado exitosamente" / salida sin errores.

- [ ] **Step 5: Commit de la implementación en JS**

```bash
git add build-bundle.js dashboard-bundle.js
git commit -m "feat(js): implement marquee track rendering with 2x duplicated loop and grid modal interactions"
```

---

### Task 4: Verificación Runtime & Pruebas en Vivo

**Files:**
- Test: Navegador / Servidor local en `server.js`

- [ ] **Step 1: Iniciar el servidor local si no está corriendo**

Run: `node server.js`
Verify: El servidor inicia correctamente en `http://localhost:3000`.

- [ ] **Step 2: Verificar la interfaz mediante inspección/captura de pantalla o consulta**

Verificar que:
1. El marquee se desplaza suavemente de derecha a izquierda.
2. Los extremos se desvanecen gradualmente con el gradiente de máscara.
3. El alto de la sección de presentismo no sobrepasa 44px.
4. Al colocar el cursor sobre un pill, la animación se detiene (`paused`).
5. El botón de cuadrícula abre el modal con todo el equipo.

- [ ] **Step 3: Commit final**

```bash
git add .
git commit -m "refactor(dashboard): finalize presentismo marquee redesign implementation"
```
