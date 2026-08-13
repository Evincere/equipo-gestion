# Continuación de Trámites Históricos desde Historial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Habilitar la continuación de trámites históricos en el modal "Registrar Nueva Atención", permitiendo al operador presionar "🔗 Continuar este Trámite" en cualquier tarjeta del historial del ciudadano para auto-completar y vincular la Defensoría, Modo = "Causa en Trámite", Co-Defensora asignada, Expediente y Materia.

**Architecture:** Modificaciones en `dashboard.html` (banner cyan `#linkedHistoryBanner`) y lógica adaptativa en `build-bundle.js` (`renderCitizenHistoryPanel` y `selectHistoryRecordToContinue`), compilada con `npm run build`.

**Tech Stack:** Vanilla JS, HTML5, CSS Windows Aero Glass.

---

### Task 1: Marcado HTML para Banner de Vinculación (`dashboard.html`)

**Files:**
- Modify: [`dashboard.html:640-655`](file:///f:/Apps/equipo-gestion/dashboard.html#L640-L655)

**Interfaces:**
- Produces: Contenedor `#linkedHistoryBanner` con estilo Aero Glass cyan y botón `#btnUnlinkHistory`.

- [ ] **Step 1: Agregar el banner cyan `#linkedHistoryBanner` en `dashboard.html`**

```html
<div id="linkedHistoryBanner" class="full-width" style="display: none; background: rgba(0, 180, 216, 0.15); border: 1px solid #00B4D8; border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1rem; align-items: center; justify-content: space-between; gap: 1rem;">
    <div style="display: flex; align-items: center; gap: 0.6rem; color: #38BDF8; font-weight: 600; font-size: 0.88rem;">
        <i class="ri-link-m" style="font-size: 1.2rem;"></i>
        <span id="linkedHistoryBannerText">Continuando Trámite Previo...</span>
    </div>
    <button type="button" id="btnUnlinkHistory" class="btn btn-sm" style="background: rgba(239, 68, 68, 0.2); color: #FCA5A5; border: 1px solid rgba(239, 68, 68, 0.4); font-size: 0.78rem; padding: 0.25rem 0.6rem; border-radius: 4px; cursor: pointer;">
        <i class="ri-link-unlink-m"></i> Desvincular / Trámite Nuevo
    </button>
</div>
```

- [ ] **Step 2: Commit**
```bash
git add dashboard.html
git commit -m "feat: agregar marcado HTML para banner de vinculacion de tramite historico"
```

---

### Task 2: Lógica de Vinculación en `build-bundle.js` (`dashboard-bundle.js`)

**Files:**
- Modify: [`build-bundle.js:1100-1160`](file:///f:/Apps/equipo-gestion/build-bundle.js#L1100-L1160)
- Modify: [`build-bundle.js:2200-2260`](file:///f:/Apps/equipo-gestion/build-bundle.js#L2200-L2260)

**Interfaces:**
- Produces: Botones `👁️ Ver Ficha` y `🔗 Continuar este Trámite` en las tarjetas del historial, pre-llenado de campos y gestión del banner cyan.

- [ ] **Step 1: Actualizar `renderCitizenHistoryPanel` en `build-bundle.js`**

Agregar los botones de acción en cada tarjeta del historial:
```html
<div style="display: flex; gap: 0.4rem; margin-top: 0.5rem;">
    <button type="button" class="btn-view-history-detail" data-history-id="${item.id}" style="background: rgba(51, 65, 85, 0.8); color: #94A3B8; border: 1px solid #475569; font-size: 0.72rem; padding: 0.2rem 0.5rem; border-radius: 4px; cursor: pointer;">
        <i class="ri-eye-line"></i> Ver Ficha
    </button>
    <button type="button" class="btn-continue-history-record" data-history-id="${item.id}" style="background: rgba(0, 180, 216, 0.2); color: #38BDF8; border: 1px solid #00B4D8; font-size: 0.72rem; padding: 0.2rem 0.6rem; border-radius: 4px; font-weight: 600; cursor: pointer;">
        <i class="ri-link-m"></i> Continuar este Trámite
    </button>
</div>
```

- [ ] **Step 2: Implementar `selectHistoryRecordToContinue(dto)` y event listeners**

Implementar el pre-llenado automático de Defensoría, Modo `Causa en Trámite`, Co-Defensora previa, Expediente y Materia, y la acción `#btnUnlinkHistory`.

- [ ] **Step 3: Compilar con `npm run build`**

- [ ] **Step 4: Commit**
```bash
git add build-bundle.js dashboard-bundle.js
git commit -m "feat: implementar continuacion de tramites historicos desde panel de antecedentes"
```

---

### Task 3: Compilación y Verificación E2E

- [ ] **Step 1: Compilar el bundle**
Run: `npm run build`

- [ ] **Step 2: Ejecutar script de verificación E2E**
Crear `scratch/verify-history-continuation.js` para simular la vinculación de atenciones históricas.

- [ ] **Step 3: Commit final**
```bash
git add .
git commit -m "chore: finalización y verificacion de la continuacion de tramites historicos"
```
