# Derivadas Asist. Técnica Card Interactivity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the static "DERIVADAS ASIST. TÉCNICA" KPI card into an interactive filtering and analytics tool with click-to-filter capability and a popover breakdown by technical area.

**Architecture:** Extend `dashboard.html` with popover breakdown elements and interactive UI handles. Update `build-bundle.js` (`DashboardViewController`) to manage filtering state (`activeTecnicaFilter` and `activeTecnicaCategory`), calculate technical breakdown counts in `updateSummaryView()`, update `matchesFilters()` logic, and handle popover UI events.

**Tech Stack:** Vanilla JavaScript (ES6+), HTML5, CSS3, Google Fonts, Remix Icons, Node.js bundle builder (`build-bundle.js`).

## Global Constraints
- Target workspace: `e:\Apps\equipo-gestion`
- File bundle build: Run `node build-bundle.js` to update `dashboard-bundle.js` after editing `build-bundle.js`.
- Never remove existing CSS/JS functionality unrelated to this card.

---

### Task 1: Add HTML Structure and CSS for Card Interactivity and Popover

**Files:**
- Modify: `dashboard.html:176-183`
- Modify: `dashboard.css`

**Interfaces:**
- Consumes: Existing `.stat-card` markup and popover styles.
- Produces: HTML element IDs `cardDerivadasTecnica`, `btnToggleTecnicaBreakdown`, `tecnicaBreakdownPopover`, `tecnicaBreakdownList`, and active filter badge container.

- [ ] **Step 1: Update `dashboard.html` to add IDs, breakdown button, and popover markup**

```html
<div class="stat-card stat-magenta" id="cardDerivadasTecnica" style="cursor: pointer; position: relative;">
    <div class="stat-header">
        <span class="stat-label">Derivadas Asist. Técnica</span>
        <div style="display: flex; align-items: center; gap: 0.4rem;">
            <button type="button" id="btnToggleTecnicaBreakdown" title="Ver desglose por áreas" style="background: none; border: none; color: #EC4899; cursor: pointer; font-size: 1.1rem; padding: 0.2rem; border-radius: 4px;" onclick="event.stopPropagation();">
                <i class="ri-pie-chart-line"></i>
            </button>
            <div class="stat-icon"><i class="ri-git-pull-request-line"></i></div>
        </div>
    </div>
    <div class="stat-value" id="kpiTecnica">...</div>
    <div id="tecnicaFilterBadge" style="display: none; margin-top: 0.4rem; font-size: 0.75rem; color: #F472B6; background: rgba(236, 72, 153, 0.15); border: 1px solid #EC4899; padding: 0.2rem 0.5rem; border-radius: 12px; align-items: center; justify-content: space-between;">
        <span id="tecnicaFilterBadgeText">Filtro: Asistencia Técnica</span>
        <i class="ri-close-line" id="btnClearTecnicaFilter" style="cursor: pointer; margin-left: 0.4rem; font-weight: bold;"></i>
    </div>
    
    <!-- Popover Desglose Flotante -->
    <div id="tecnicaBreakdownPopover" style="display: none; position: absolute; top: 100%; right: 0; margin-top: 0.5rem; width: 260px; background: #1E293B; border: 1px solid #EC4899; border-radius: 8px; padding: 0.75rem; box-shadow: 0 10px 25px rgba(0,0,0,0.5); z-index: 100;" onclick="event.stopPropagation();">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.4rem;">
            <strong style="color: #F472B6; font-size: 0.8rem; text-transform: uppercase;">Desglose Áreas Técnicas</strong>
            <i class="ri-close-line" id="btnCloseTecnicaPopover" style="color: #94A3B8; cursor: pointer; font-size: 1rem;"></i>
        </div>
        <div id="tecnicaBreakdownList" style="display: flex; flex-direction: column; gap: 0.4rem;">
            <span style="color: #94A3B8; font-size: 0.8rem;">Cargando...</span>
        </div>
    </div>
</div>
```

- [ ] **Step 2: Add CSS styles for `.active-filter-card` in `dashboard.css`**

```css
.stat-card.active-filter-card {
    border: 2px solid #EC4899 !important;
    box-shadow: 0 0 12px rgba(236, 72, 153, 0.4) !important;
}
```

- [ ] **Step 3: Build bundle and verify HTML/CSS**

Run: `node build-bundle.js`
Expected: `✅ Bundle actualizado...`

- [ ] **Step 4: Commit UI changes**

```bash
git add dashboard.html dashboard.css build-bundle.js dashboard-bundle.js
git commit -m "feat(ui): agregar estructura HTML y CSS para interactividad de card Derivadas Asist. Técnica"
```

---

### Task 2: Implement Filter Logic and Breakdown Calculations in `build-bundle.js`

**Files:**
- Modify: `build-bundle.js` (`DashboardViewController`)

**Interfaces:**
- Consumes: DOM elements `cardDerivadasTecnica`, `btnToggleTecnicaBreakdown`, `tecnicaBreakdownPopover`, `tecnicaBreakdownList`, `tecnicaFilterBadge`.
- Produces: `activeTecnicaFilter`, `activeTecnicaCategory`, `updateSummaryView()` breakdown rendering, `matchesFilters()` technical derivation check, and click event listeners.

- [ ] **Step 1: Bind DOM references and state in `DashboardViewController` constructor**

In `build-bundle.js`:
```javascript
this.cardDerivadasTecnica = document.getElementById('cardDerivadasTecnica');
this.btnToggleTecnicaBreakdown = document.getElementById('btnToggleTecnicaBreakdown');
this.tecnicaBreakdownPopover = document.getElementById('tecnicaBreakdownPopover');
this.tecnicaBreakdownList = document.getElementById('tecnicaBreakdownList');
this.tecnicaFilterBadge = document.getElementById('tecnicaFilterBadge');
this.tecnicaFilterBadgeText = document.getElementById('tecnicaFilterBadgeText');
this.btnClearTecnicaFilter = document.getElementById('btnClearTecnicaFilter');
this.btnCloseTecnicaPopover = document.getElementById('btnCloseTecnicaPopover');

this.activeTecnicaFilter = false;
this.activeTecnicaCategory = null;
```

- [ ] **Step 2: Update `matchesFilters(entity)` to respect technical derivation filter state**

In `build-bundle.js`:
```javascript
if (this.activeTecnicaFilter) {
    if (!entity.isDerivacionTecnica()) return false;
    if (this.activeTecnicaCategory) {
        const cat = this.activeTecnicaCategory.toLowerCase();
        const textToSearch = `${entity.resultado} ${entity.derivadoA} ${entity.motivo} ${entity.observaciones}`.toLowerCase();
        if (!textToSearch.includes(cat)) return false;
    }
}
```

- [ ] **Step 3: Update `updateSummaryView()` to compute and render technical breakdown list**

Categorize into 4 groups:
1. `ETI / Vulnerabilidad` (ETI, vulnerabilidad, protección)
2. `Psicología / Trabajo Social` (psicolog, trabajo social, equipo técnico, gabinete)
3. `Asesoría de Niñez / Capacidad` (asesor, niñez, incapac, capacidad)
4. `Otras Áreas Técnicas` (any other technical derivation)

Render itemized count rows with clickable handlers that call `setTecnicaCategoryFilter(category)`.

- [ ] **Step 4: Add event listeners for card click, breakdown toggle, and badge reset**

```javascript
if (this.cardDerivadasTecnica) {
    this.cardDerivadasTecnica.addEventListener('click', (e) => {
        if (e.target.closest('#btnToggleTecnicaBreakdown') || e.target.closest('#tecnicaBreakdownPopover')) return;
        this.toggleTecnicaFilter();
    });
}

if (this.btnToggleTecnicaBreakdown) {
    this.btnToggleTecnicaBreakdown.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleTecnicaPopover();
    });
}

if (this.btnClearTecnicaFilter) {
    this.btnClearTecnicaFilter.addEventListener('click', (e) => {
        e.stopPropagation();
        this.clearTecnicaFilter();
    });
}

if (this.btnCloseTecnicaPopover) {
    this.btnCloseTecnicaPopover.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.tecnicaBreakdownPopover) this.tecnicaBreakdownPopover.style.display = 'none';
    });
}
```

- [ ] **Step 5: Run bundle build and test implementation**

Run: `node build-bundle.js`
Expected: `✅ Bundle actualizado...`

- [ ] **Step 6: Commit implementation**

```bash
git add build-bundle.js dashboard-bundle.js
git commit -m "feat: implementar filtro interactivo y desglose por areas tecnicas en card Derivadas Asist. Tecnica"
```

- [ ] **Step 7: Push changes to remote origin**

```bash
git push origin main
```
