# Dinamismo del Formulario de Registro y Flujo de Antecedentes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el dinamismo inteligente en el formulario "Registrar Nueva Atención": ocultar el desplegable de Materia al elegir la causa "Guarda Judicial / Tutela / Adopción", filtrar los Motivos Generales y Resultados para el fuero de Familia, agregar la especificación de repartición al derivar a otras entidades y conectar el registro con el historial futuro del ciudadano.

**Architecture:** Modificaciones en `server.js` (columna `detalle_reparticion` en SQLite), marcado HTML en `dashboard.html` y lógica adaptativa en `build-bundle.js` empaquetada vía `npm run build`.

**Tech Stack:** Node.js, `node:sqlite`, Vanilla JS, HTML5, CSS Windows Aero Glass.

---

### Task 1: Migración de Base de Datos y Handlers Backend (`server.js`)

**Files:**
- Modify: [`server.js:75-90`](file:///f:/Apps/equipo-gestion/server.js#L75-L90)
- Modify: [`server.js:680-730`](file:///f:/Apps/equipo-gestion/server.js#L680-L730)
- Modify: [`server.js:745-810`](file:///f:/Apps/equipo-gestion/server.js#L745-L810)

**Interfaces:**
- Consumes: Peticiones `POST /api/atenciones` y `PUT /api/atenciones/:id`.
- Produces: Persistencia del campo `detalle_reparticion` en SQLite y emisión por WebSocket.

- [ ] **Step 1: Agregar migración de columna `detalle_reparticion` en `server.js`**

```javascript
try { db.exec('ALTER TABLE atenciones ADD COLUMN detalle_reparticion TEXT;'); } catch (e) {}
```

- [ ] **Step 2: Actualizar `handlePostAtencion` y `handlePutAtencion` en `server.js` para incluir `detalle_reparticion`**

- [ ] **Step 3: Commit**
```bash
git add server.js
git commit -m "feat: agregar columna detalle_reparticion en SQLite y handlers REST"
```

---

### Task 2: Marcado HTML en Modal Nuevo Registro (`dashboard.html`)

**Files:**
- Modify: [`dashboard.html:665-680`](file:///f:/Apps/equipo-gestion/dashboard.html#L665-L680)

**Interfaces:**
- Produces: Contenedor HTML `#reparticionDetalleGroup` con input `#newReparticionDetalle`.

- [ ] **Step 1: Agregar el contenedor `#reparticionDetalleGroup` en `dashboard.html`**

```html
<div class="form-group full-width" id="reparticionDetalleGroup" style="display: none;">
    <label style="color: #38BDF8;"><i class="ri-building-line"></i> Especificar Repartición a la que se Derivó</label>
    <input type="text" id="newReparticionDetalle" class="form-control" placeholder="Ej: ETI, Asesoría de Niñez, Registro Civil, etc...">
</div>
```

- [ ] **Step 2: Commit**
```bash
git add dashboard.html
git commit -m "feat: agregar marcado HTML para especificar reparticion derivada en dashboard.html"
```

---

### Task 3: Lógica Adaptativa del Formulario en Frontend (`build-bundle.js` -> `dashboard-bundle.js`)

**Files:**
- Modify: [`build-bundle.js:890-950`](file:///f:/Apps/equipo-gestion/build-bundle.js#L890-L950)
- Modify: [`build-bundle.js:1000-1060`](file:///f:/Apps/equipo-gestion/build-bundle.js#L1000-L1060)

**Interfaces:**
- Produces: Formulario adaptativo en tiempo real que oculta materias duplicadas, filtra motivos y resultados de Familia y maneja especificación de repartición.

- [ ] **Step 1: Actualizar `updateFamiliaFormDynamism()` en `build-bundle.js`**

Implementar la lógica adaptativa:
1. Al seleccionar `CO-DEF. FAMILIA`:
   - En `#newMotivo`, ofrecer únicamente: `Espontánea`, `Causa en Trámite`, `Turno`, `Otro`.
   - En `#newResultado`, ofrecer únicamente: `Resuelve operador`, `Entrevista con Codefensor`, `Derivado a otra repartición`, `Otro`.
2. Al cambiar `#newModoDerivacionFamilia`:
   - Si la causa es `Guarda Judicial / Tutela / Adopción`, ocultar `#familySubmotivoGroup` (`display: none`) y setear `#newFamilySubmotivo.value = 'Guarda Judicial / Tutela / Adopción'`.
   - Si es otra causa, mostrar `#familySubmotivoGroup` (`display: flex`).
3. Al cambiar `#newResultado`:
   - Si se selecciona `Derivado a otra repartición`, mostrar `#reparticionDetalleGroup` (`display: flex`).
   - Si se selecciona otro resultado, ocultar `#reparticionDetalleGroup` (`display: none`).

- [ ] **Step 2: Incluir `detalle_reparticion` en `createRecordPayload()` y reset de formulario**

- [ ] **Step 3: Compilar con `npm run build`**

- [ ] **Step 4: Commit**
```bash
git add build-bundle.js dashboard-bundle.js
git commit -m "feat: implementar dinamismo adaptativo del formulario de registro en build-bundle.js"
```

---

### Task 4: Compilación y Verificación E2E

- [ ] **Step 1: Compilar el bundle**
Run: `npm run build`

- [ ] **Step 2: Ejecutar script de prueba E2E de dinamismo**
Crear `scratch/verify-form-dynamism.js` para validar la creación de atenciones de Familia con `detalle_reparticion` y el comportamiento del formulario.

- [ ] **Step 3: Commit final**
```bash
git add .
git commit -m "chore: finalizacion y verificacion del dinamismo del formulario de registro"
```
