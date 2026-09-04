# Vinculación de Defensora y Co-Defensoras en Defensoría Civil - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir la asignación manual y sugerida por historial de la Defensora Civil (Dra. Jorgelina Bayón) y Co-Defensoras (Dra. Alejandra Di Menza y Dra. Laura Alvarado) en atenciones de Defensoría Civil, visualizándolas destacadas en la tabla principal y ficha de detalle.

**Architecture:** Se extiende el uso de la columna existente `codefensora_asignada` en SQLite y `codefensoraAsignada` en el DTO/entidad para el fuero `DEF. CIVIL`. En el frontend se incorpora un selector contextual dentro de `#fueroCivilSection` con sugerencia automática por antecedentes, se actualiza el guardado/edición en `server.js`, y se renderiza en la tabla principal con formato destacado en color celeste y operador debajo.

**Tech Stack:** Node.js HTTP/WebSocket server, SQLite (`node:sqlite`), JavaScript Vanilla (Bundle modularizado en `scripts/build-bundle.js`), HTML5/CSS3.

## Global Constraints
- Reutilizar la columna `codefensora_asignada` en SQLite y DTOs sin agregar columnas innecesarias (Enfoque 1 aprobado).
- Nombres de las profesionales: `Jorgelina Bayón` (Defensora Civil), `Alejandra Di Menza` (Co-Defensora), `Laura Alvarado` (Co-Defensora).
- Al guardar o editar mediante `build-bundle.js`, sincronizar siempre `dashboard.html` y `dashboard-bundle.js`.
- Pruebas automatizadas con scripts de verificación Node.js en `scratch/`.

---

### Task 1: Habilitar persistencia de `codefensora_asignada` para `DEF. CIVIL` en `server.js`

**Files:**
- Modify: `server.js:930-970` (`handlePostAtencion`)
- Modify: `server.js:1055-1095` (`handlePutAtencion`)
- Test: `scratch/test-civil-assignment-backend.js`

**Interfaces:**
- Consumes: Request `POST /api/atenciones` y `PUT /api/atenciones` con `defensoria: 'DEF. CIVIL'` y `codefensoraAsignada: string`.
- Produces: Registro en SQLite en la tabla `atenciones` con `codefensora_asignada` poblado para `DEF. CIVIL`.

- [ ] **Step 1: Escribir el test que falle para la persistencia backend de Civil**

Crear `scratch/test-civil-assignment-backend.js`:
```javascript
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const assert = require('assert');

const dbPath = path.join(__dirname, '../data/atenciones.db');
const db = new DatabaseSync(dbPath);

// Insertar una atención de prueba de DEF. CIVIL
const stmt = db.prepare(`
    INSERT INTO atenciones (
        fecha, actividad, dni, apellidos, nombres, celular, expte, motivo,
        defensoria, resultado, observaciones, atendido_por, derivado_a, escritos,
        codefensora_asignada
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const testDni = '99999001';
const result = stmt.run(
    '04/09/2026', 'Atención Personal', testDni, 'TEST_CIVIL', 'JUAN', '2604000000', '',
    'Determinación de Capacidad', 'DEF. CIVIL', 'Entrevista con Defensor/a',
    'Observacion de prueba', 'Operador Test', '', '', 'Jorgelina Bayón'
);

const row = db.prepare('SELECT * FROM atenciones WHERE id = ?').get(result.lastInsertRowid);
assert.strictEqual(row.defensoria, 'DEF. CIVIL');
assert.strictEqual(row.codefensora_asignada, 'Jorgelina Bayón');
console.log('✅ Test directo SQLite superado:', row.id, row.codefensora_asignada);

// Limpiar registro de prueba
db.prepare('DELETE FROM atenciones WHERE id = ?').run(result.lastInsertRowid);
```

- [ ] **Step 2: Ejecutar test para verificar funcionamiento de base de datos**

Run: `node scratch/test-civil-assignment-backend.js`
Expected: PASS en SQLite directo.

- [ ] **Step 3: Actualizar `handlePostAtencion` y `handlePutAtencion` en `server.js`**

En `server.js`, en `handlePostAtencion` (línea ~933):
```javascript
const isFamilia = data.defensoria === 'CO-DEF. FAMILIA';
const isCivil = data.defensoria === 'DEF. CIVIL';
const modoFamilia = isFamilia ? (data.modoDerivacionFamilia || '') : '';
const codefensora = (isFamilia || isCivil) ? (data.codefensoraAsignada || '') : '';
const vencimiento = isFamilia ? (data.fechaVencimientoContestacion || '') : '';
```

En `handlePutAtencion` (línea ~1061):
```javascript
const isFamilia = data.defensoria === 'CO-DEF. FAMILIA';
const isCivil = data.defensoria === 'DEF. CIVIL';
const modoFamilia = isFamilia ? (data.modoDerivacionFamilia || '') : '';
const codefensora = (isFamilia || isCivil) ? (data.codefensoraAsignada || '') : '';
const vencimiento = isFamilia ? (data.fechaVencimientoContestacion || '') : '';
```

- [ ] **Step 4: Crear test de integración HTTP para verificar `POST` y `PUT` con `DEF. CIVIL`**

Crear `scratch/test-http-civil-assignment.js` que envíe peticiones HTTP a `http://localhost:3000/api/atenciones` y verifique que `codefensora_asignada` se guarde y devuelva correctamente.

- [ ] **Step 5: Commit de Task 1**

```bash
git add server.js scratch/test-civil-assignment-backend.js
git commit -m "feat(backend): permitir persistencia de codefensora_asignada para DEF. CIVIL"
```

---

### Task 2: Añadir el selector de Defensora / Co-Defensora Civil en `public/index.html`

**Files:**
- Modify: `public/index.html:810-828` (`#fueroCivilSection`)

**Interfaces:**
- Consumes: Ninguno
- Produces: Elementos DOM `#newDefensoraCivil` y `#defensoraCivilBadgeStatus` dentro de `#fueroCivilSection`.

- [ ] **Step 1: Agregar el selector y badge en `public/index.html`**

En `public/index.html`, dentro de `#fueroCivilSection`:
```html
<div class="form-grid" style="margin-top: 0.75rem;">
    <div class="form-group full-width" id="defensoraCivilGroup">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
            <label style="color: #38BDF8; margin: 0;"><i class="ri-user-star-line"></i> Defensora / Co-Defensora Civil Asignada</label>
            <span class="badge" id="defensoraCivilBadgeStatus" style="font-size: 0.7rem; background: rgba(56, 189, 248, 0.2); color: #38BDF8; display: none;">Sugerida por Historial</span>
        </div>
        <select id="newDefensoraCivil" class="form-control" style="font-weight: 600; border-color: #0284C7;">
            <option value="">-- Sin asignar (Resuelve Operador en Mesa) --</option>
            <option value="Jorgelina Bayón">Dra. Jorgelina Bayón (Defensora Civil)</option>
            <option value="Alejandra Di Menza">Dra. Alejandra Di Menza (Co-Defensora)</option>
            <option value="Laura Alvarado">Dra. Laura Alvarado (Co-Defensora)</option>
        </select>
        <span id="defensoraCivilHint" style="font-size: 0.75rem; color: #94A3B8; margin-top: 0.3rem; display: block;">Asigne a la profesional interviniente o deje en blanco si resuelve en mesa de entrada.</span>
    </div>
</div>
```

- [ ] **Step 2: Verificar la sintaxis HTML**

Revisar que los tags estén correctamente cerrados y no rompan el layout de `#fueroCivilSection`.

- [ ] **Step 3: Commit de Task 2**

```bash
git add public/index.html
git commit -m "feat(ui): agregar selector newDefensoraCivil en fueroCivilSection"
```

---

### Task 3: Implementar la lógica de asignación y autocompletado por historial en `scripts/build-bundle.js`

**Files:**
- Modify: `scripts/build-bundle.js`
- Test: `scratch/test-civil-ui-logic.js`

**Interfaces:**
- Consumes: `#newDefensoraCivil`, `#defensoraCivilBadgeStatus`, historial de atenciones del ciudadano
- Produces: Asignación automática por historial, lectura en `openEditRecordModal`, inclusión en `formData.codefensoraAsignada` al enviar formulario.

- [ ] **Step 1: Enlazar referencias DOM en `DashboardViewController.initDOMReferences`**

En `scripts/build-bundle.js`:
```javascript
this.newDefensoraCivil = document.getElementById('newDefensoraCivil');
this.defensoraCivilBadgeStatus = document.getElementById('defensoraCivilBadgeStatus');
```

- [ ] **Step 2: Manejar cambio de fuero en `handleFueroChange()`**

Asegurar que al seleccionar `DEF. CIVIL`:
- Se muestre `#fueroCivilSection`.
- Si no hay valor previo, se configure en blanco o con sugerencia.

- [ ] **Step 3: Sugerencia por historial del ciudadano en `handleCitizenSearch()` / detección de historial**

Cuando se consultan antecedentes del ciudadano por DNI o N° de Expte., buscar si existe alguna atención previa con `defensoria === 'DEF. CIVIL'` y `codefensora_asignada`:
```javascript
if (isCivil && this.newDefensoraCivil) {
    const prevCivil = this.currentCitizenHistory.find(r => 
        (r.defensoria === 'DEF. CIVIL' || r.defensoriaCategory === 'DEF. CIVIL') && 
        (r.codefensora_asignada || r.codefensoraAsignada)
    );
    if (prevCivil) {
        const profName = prevCivil.codefensora_asignada || prevCivil.codefensoraAsignada;
        this.setSelectValueNormalized(this.newDefensoraCivil, profName);
        if (this.defensoraCivilBadgeStatus) this.defensoraCivilBadgeStatus.style.display = 'inline-block';
    } else {
        if (this.defensoraCivilBadgeStatus) this.defensoraCivilBadgeStatus.style.display = 'none';
    }
}
```
Y si el usuario cambia manualmente `#newDefensoraCivil`, ocultar o cambiar el badge a `Asignación Manual`.

- [ ] **Step 4: Soporte en `openEditRecordModal()`**

Al editar un registro existente:
```javascript
if (isCivil && this.newDefensoraCivil) {
    this.setSelectValueNormalized(this.newDefensoraCivil, entity.codefensoraAsignada || '');
}
```

- [ ] **Step 5: Extracción de valor al guardar en `submitBtn`**

En la recolección de datos del formulario:
```javascript
const isFamilia = this.newDefensoriaSelect && this.newDefensoriaSelect.value === 'CO-DEF. FAMILIA';
const isCivil = this.newDefensoriaSelect && this.newDefensoriaSelect.value === 'DEF. CIVIL';
let codefensora = '';
if (isFamilia && this.newCodefensoraAsignada) {
    codefensora = this.newCodefensoraAsignada.value;
} else if (isCivil && this.newDefensoraCivil) {
    codefensora = this.newDefensoraCivil.value;
}
```
Y pasarlo en `codefensoraAsignada: codefensora`.

- [ ] **Step 6: Commit de Task 3**

```bash
git add scripts/build-bundle.js
git commit -m "feat(frontend): gestionar asignacion y sugerencia por historial de Defensora Civil"
```

---

### Task 4: Actualizar visualización en tabla principal, modal de detalle y búsqueda

**Files:**
- Modify: `scripts/build-bundle.js`

**Interfaces:**
- Consumes: `dto.defensoriaName`, `dto.codefensoraAsignada`, `dto.atendidoPor`
- Produces: Renderizado de celda con color celeste y operador debajo, visualización en modal de detalle, indexación en búsqueda.

- [ ] **Step 1: Modificar el renderizado de la tabla en `updateView()`**

En `scripts/build-bundle.js` (línea ~4699):
```javascript
'<td>' +
    (dto.defensoriaName === 'CO-DEF. FAMILIA' && dto.codefensoraAsignada 
        ? '<span style="color:#F472B6; font-weight:600;">' + dto.codefensoraAsignada + '</span><br><span style="font-size:0.7rem; color:#94A3B8">Operador: ' + dto.atendidoPor + '</span>' 
        : (dto.defensoriaName === 'DEF. CIVIL' && dto.codefensoraAsignada
            ? '<span style="color:#38BDF8; font-weight:600;">Dra. ' + dto.codefensoraAsignada.replace(/^Dra\.\s*/i, '') + '</span><br><span style="font-size:0.7rem; color:#94A3B8">Operador: ' + dto.atendidoPor + '</span>'
            : dto.atendidoPor)) +
'</td>'
```

- [ ] **Step 2: Modificar el modal de detalle (`openDetailModal`)**

En `scripts/build-bundle.js` (línea ~4797):
```javascript
(dto.defensoriaName === 'CO-DEF. FAMILIA' && dto.codefensoraAsignada ? '<div><span style="font-size: 0.75rem; color: #C63F95; text-transform: uppercase;">Co-Defensora Asignada</span><p style="font-weight: 700; color: #EC4899;">Dra. ' + dto.codefensoraAsignada.replace(/^Dra\.\s*/i, '') + '</p></div>' : '') +
(dto.defensoriaName === 'DEF. CIVIL' && dto.codefensoraAsignada ? '<div><span style="font-size: 0.75rem; color: #38BDF8; text-transform: uppercase;">Defensora / Co-Defensora Civil</span><p style="font-weight: 700; color: #0284C7;">Dra. ' + dto.codefensoraAsignada.replace(/^Dra\.\s*/i, '') + '</p></div>' : '') +
```

- [ ] **Step 3: Asegurar que el filtro del buscador incluya a la profesional de Civil**

Verificar en `SearchAttendancesUseCase` o en el método de filtrado de `DashboardViewController` que `item.codefensoraAsignada` esté incluido en la búsqueda en texto plano.

- [ ] **Step 4: Compilar el bundle**

Run: `node scripts/build-bundle.js`
Expected: `✅ Bundle actualizado... y dashboard.html sincronizado.`

- [ ] **Step 5: Commit de Task 4**

```bash
git add scripts/build-bundle.js public/dashboard.html public/js/dashboard-bundle.js
git commit -m "feat(ui): renderizar defensora civil destacada en tabla, detalle y busqueda"
```

---

### Task 5: Verificación integral de extremo a extremo (E2E)

**Files:**
- Create: `scratch/verify-civil-flow.js`

- [ ] **Step 1: Escribir script de prueba integral `scratch/verify-civil-flow.js`**

Verificar:
1. Creación de atención en `DEF. CIVIL` con `codefensoraAsignada: 'Jorgelina Bayón'`.
2. Verificación de que la fila recuperada tiene `codefensora_asignada === 'Jorgelina Bayón'`.
3. Actualización vía edición a `codefensoraAsignada: 'Alejandra Di Menza'`.
4. Comprobación de que la actualización persistió.
5. Creación de segunda atención del mismo DNI comprobando sugerencia de historial.
6. Limpieza de datos de prueba.

- [ ] **Step 2: Ejecutar el script de verificación**

Run: `node scratch/verify-civil-flow.js`
Expected: PASS en todos los pasos.

- [ ] **Step 3: Commit final y limpieza**

```bash
git add scratch/verify-civil-flow.js
git commit -m "test: verificacion integral de flujo de asignacion en defensoria civil"
```
