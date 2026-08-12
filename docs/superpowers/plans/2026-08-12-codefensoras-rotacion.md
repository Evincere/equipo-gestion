# Módulo de Co-Defensorías de Familia y Rotación Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidar la función `handlePutAtencion` en `server.js` para corregir la pérdida de campos de Co-Defensorías de Familia en ediciones, perfeccionar el flujo de ausencias en causas en trámite y añadir controles de administración para resetear y ajustar manualmente la rotación de turnos por canal.

**Architecture:** Servidor Node.js REST API con SQLite nativo (`node:sqlite`) y WebSockets (`ws`) en el backend. Cliente JS compilado (`build-bundle.js` -> `dashboard-bundle.js`) con Arquitectura Hexagonal en la vista del tablero (`dashboard.html`).

**Tech Stack:** Node.js, `node:sqlite`, WebSockets, Vanilla JS, HTML5, CSS Windows Aero Dark Mode.

## Global Constraints

- Backend en `server.js` usando `DatabaseSync` nativo de Node.js.
- Compilación del frontend mediante `npm run build` (`node build-bundle.js`).
- Mantenimiento del esquema de base de datos SQLite y tabla de auditoría `auditoria_acciones`.

---

### Task 1: Consolidar y corregir `handlePutAtencion` en `server.js`

**Files:**
- Modify: [`server.js:744-926`](file:///f:/Apps/equipo-gestion/server.js#L744-L926)

**Interfaces:**
- Consumes: Request `PUT /api/atenciones` con `data.id`, `data.codefensoraAsignada`, `data.modoDerivacionFamilia`, `data.fechaVencimientoContestacion`.
- Produces: `UPDATE atenciones SET ...` en SQLite conservando todos los campos de Familia; audit `logAudit` y WebSocket broadcast `RECORD_UPDATED`.

- [ ] **Step 1: Crear test script en `scratch/test-put-atencion.js`**

```javascript
const http = require('http');

const data = JSON.stringify({
    id: 1,
    fecha: "12/08/2026",
    actividad: "Atención Personal",
    dni: "11223344",
    apellidos: "TEST",
    nombres: "PRUEBA",
    celular: "2610000000",
    expte: "999/26",
    motivo: "Divorcio",
    defensoria: "CO-DEF. FAMILIA",
    resultado: "Deriva a CO-DEF- FAMILIA",
    observaciones: "Prueba de edicion",
    atendidoPor: "A. Alonso",
    derivadoA: "",
    escritos: "",
    tareaPendiente: false,
    detallePendiente: "",
    modoDerivacionFamilia: "Causa en Trámite",
    codefensoraAsignada: "Andrea Lombard",
    fechaVencimientoContestacion: "20/08/2026"
});

const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/atenciones',
    method: 'PUT',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
}, res => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => console.log('Response:', body));
});

req.write(data);
req.end();
```

- [ ] **Step 2: Verificar la duplicación actual en `server.js`**

Comprobar que en `server.js` existen dos definiciones de `handlePutAtencion` (línea 744 y línea 853). La de la línea 853 omite `modo_derivacion_familia`, `codefensora_asignada` y `fecha_vencimiento_contestacion`.

- [ ] **Step 3: Consolidar `handlePutAtencion` en `server.js`**

Eliminar la segunda definición de `handlePutAtencion` en la línea 853. Modificar la función única para que quede estructurada así:

```javascript
function handlePutAtencion(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            if (!data.id) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'ID es requerido para actualizar' }));
                return;
            }

            const stmt = db.prepare(`
                UPDATE atenciones SET
                    fecha = ?,
                    actividad = ?,
                    dni = ?,
                    apellidos = ?,
                    nombres = ?,
                    celular = ?,
                    expte = ?,
                    motivo = ?,
                    defensoria = ?,
                    resultado = ?,
                    observaciones = ?,
                    atendido_por = ?,
                    derivado_a = ?,
                    escritos = ?,
                    tarea_pendiente = ?,
                    detalle_pendiente = ?,
                    modo_derivacion_familia = ?,
                    codefensora_asignada = ?,
                    fecha_vencimiento_contestacion = ?
                WHERE id = ?
            `);

            const atendidoPorFinal = data.atendidoPor || 'Secretaría';
            const esPendiente = Boolean(data.tareaPendiente) ? 1 : 0;
            const detallePendiente = data.detallePendiente || '';
            const isFamilia = data.defensoria === 'CO-DEF. FAMILIA';
            const modoFamilia = isFamilia ? (data.modoDerivacionFamilia || '') : '';
            const codefensora = isFamilia ? (data.codefensoraAsignada || '') : '';
            const vencimiento = isFamilia ? (data.fechaVencimientoContestacion || '') : '';

            stmt.run(
                data.fecha || 'S/F',
                data.actividad || 'Atención Personal',
                data.dni || '',
                (data.apellidos || '').toUpperCase(),
                (data.nombres || '').toUpperCase(),
                data.celular || '',
                data.expte || '',
                data.motivo || '',
                data.defensoria || 'Otro',
                data.resultado || 'Resuelve',
                data.observaciones || '',
                atendidoPorFinal,
                data.derivadoA || '',
                data.escritos || '',
                esPendiente,
                detallePendiente,
                modoFamilia,
                codefensora,
                vencimiento,
                Number(data.id)
            );

            logAudit(data.operatorId || 0, atendidoPorFinal, 'EDITAR_ATENCION', `Atención ID ${data.id} editada correctamente`);

            const updatedRecord = {
                id: Number(data.id),
                fecha: data.fecha || 'S/F',
                actividad: data.actividad || 'Atención Personal',
                dni: data.dni || '',
                apellidos: (data.apellidos || '').toUpperCase(),
                nombres: (data.nombres || '').toUpperCase(),
                celular: data.celular || '',
                expte: data.expte || '',
                motivo: data.motivo || '',
                defensoria: data.defensoria || 'Otro',
                resultado: data.resultado || 'Resuelve',
                observaciones: data.observaciones || '',
                atendido_por: atendidoPorFinal,
                derivado_a: data.derivadoA || '',
                escritos: data.escritos || '',
                tarea_pendiente: esPendiente,
                detalle_pendiente: detallePendiente,
                modo_derivacion_familia: modoFamilia,
                codefensora_asignada: codefensora,
                fecha_vencimiento_contestacion: vencimiento
            };
            broadcast('RECORD_UPDATED', { record: updatedRecord });

            res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ success: true, message: 'Atención actualizada correctamente' }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
    });
}
```

- [ ] **Step 4: Probar la actualización PUT con el script y verificar persistencia en SQLite**

- [ ] **Step 5: Commit**
```bash
git add server.js
git commit -m "fix: consolidar handlePutAtencion para preservar campos de Co-Defensoria de Familia"
```

---

### Task 2: Endpoints para Reset y Ajuste de Rotación en Backend (`server.js`)

**Files:**
- Modify: [`server.js:430-455`](file:///f:/Apps/equipo-gestion/server.js#L430-L455)
- Modify: [`server.js:1080-1120`](file:///f:/Apps/equipo-gestion/server.js#L1080-L1120)

**Interfaces:**
- Consumes: `POST /api/admin/rotacion/reset`, `POST /api/admin/rotacion/canal`
- Produces: JSON response, `UPDATE rotacion_turnos_canales`, audit logs (`RESET_ROTACION`, `AJUSTAR_ROTACION_CANAL`).

- [ ] **Step 1: Agregar ruteo en `server.js` para los nuevos endpoints**

En `server.js` dentro del bloque de endpoints de REST API:

```javascript
    if (pathname === '/api/admin/rotacion/reset' && req.method === 'POST') {
        return handleAdminResetRotacion(req, res);
    }

    if (pathname === '/api/admin/rotacion/canal' && req.method === 'POST') {
        return handleAdminAjustarCanal(req, res);
    }
```

- [ ] **Step 2: Implementar los handlers en `server.js`**

```javascript
function handleAdminResetRotacion(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
        try {
            const data = JSON.parse(body || '{}');
            const adminName = data.adminOperatorName || 'Sergio M. Pereyra (ADMIN)';
            
            db.exec("UPDATE rotacion_turnos_canales SET last_index = -1;");
            logAudit(0, adminName, 'RESET_ROTACION', 'Se reiniciaron los turnos Round-Robin a cero para todos los canales de Familia');

            res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ success: true, message: 'Rotación de turnos reiniciada a cero correctamente' }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
    });
}

function handleAdminAjustarCanal(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
        try {
            const data = JSON.parse(body || '{}');
            const { canal, lastIndex, adminOperatorName } = data;

            if (!canal || typeof lastIndex !== 'number') {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Canal y lastIndex son requeridos' }));
                return;
            }

            const stmt = db.prepare('INSERT OR REPLACE INTO rotacion_turnos_canales (canal, last_index) VALUES (?, ?)');
            stmt.run(canal, lastIndex);

            logAudit(0, adminOperatorName || 'ADMIN', 'AJUSTAR_ROTACION_CANAL', `Canal ${canal} ajustado a last_index = ${lastIndex}`);

            res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ success: true, message: `Canal ${canal} actualizado a índice ${lastIndex}` }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
    });
}
```

- [ ] **Step 3: Probar los endpoints con script de Node**

- [ ] **Step 4: Commit**
```bash
git add server.js
git commit -m "feat: agregar endpoints admin para reset y ajuste manual de rotacion por canales"
```

---

### Task 3: Alerta Visual de Co-Defensora Ausente en Causa en Trámite (`build-bundle.js`)

**Files:**
- Modify: [`build-bundle.js:1807-1849`](file:///f:/Apps/equipo-gestion/build-bundle.js#L1807-L1849)

**Interfaces:**
- Consumes: `codefensorasRoster` y respuesta `/api/atenciones/historial-familia`.
- Produces: Renderizado de aviso de alerta ámbar en `this.codefensoraHint` cuando la Co-Defensora de una causa previa está ausente.

- [ ] **Step 1: Actualizar `updateFamiliaAssignmentLogic()` en `build-bundle.js`**

Modificar la rama `modo === 'Causa en Trámite'` en `build-bundle.js`:

```javascript
            if (modo === 'Causa en Trámite') {
                const dniClean = this.newDniInput ? this.newDniInput.value.replace(/[^\d]/g, '') : '';
                const expteClean = this.newExpteInput ? this.newExpteInput.value.trim() : '';

                if (dniClean || expteClean) {
                    try {
                        const res = await fetch(getApiUrl('/api/atenciones/historial-familia?dni=' + encodeURIComponent(dniClean) + '&expte=' + encodeURIComponent(expteClean)));
                        if (res.ok) {
                            const data = await res.json();
                            if (data.success && data.found && data.suggestedCodefensora) {
                                const suggestedName = data.suggestedCodefensora;
                                if (this.newCodefensoraAsignada) {
                                    this.newCodefensoraAsignada.value = suggestedName;
                                }
                                
                                // Verificar si la Co-Defensora sugerida esta presente o ausente actualmente
                                const defObj = this.codefensorasRoster.find(item => item.nombre.toLowerCase() === suggestedName.toLowerCase());
                                const isPresente = defObj ? defObj.isPresente : true;
                                const motivo = (defObj && defObj.motivoAusencia) ? ' (' + defObj.motivoAusencia + ')' : '';

                                if (this.codefensoraHint) {
                                    if (isPresente) {
                                        this.codefensoraHint.style.color = '#4ADE80';
                                        this.codefensoraHint.textContent = '✓ Co-Defensora previa vinculada al historial: Dra. ' + suggestedName;
                                    } else {
                                        this.codefensoraHint.style.color = '#FBBF24';
                                        this.codefensoraHint.textContent = '⚠️ Dra. ' + suggestedName + ' (asignada previamente a este expediente) figura Ausente' + motivo + '. Puede mantenerla o re-asignar a otra Co-Defensora presente.';
                                    }
                                }
                                return;
                            }
                        }
                    } catch(e) {}
                }

                if (this.codefensoraHint) {
                    this.codefensoraHint.style.color = '#FBBF24';
                    this.codefensoraHint.textContent = '⚠️ Causa en Trámite: Sin antecedente previo registrado. Seleccione la Co-Defensora asignada manualmente.';
                }
            }
```

- [ ] **Step 2: Compilar el bundle con `npm run build`**

- [ ] **Step 3: Commit**
```bash
git add build-bundle.js dashboard-bundle.js
git commit -m "feat: agregar alerta visual cuando la Co-Defensora previa en causa en tramite figura ausente"
```

---

### Task 4: Panel de Control de Rotación en la pestaña Configuración Admin (`dashboard.html` & `build-bundle.js`)

**Files:**
- Modify: [`dashboard.html:450-500`](file:///f:/Apps/equipo-gestion/dashboard.html#L450-L500)
- Modify: [`build-bundle.js:1650-1710`](file:///f:/Apps/equipo-gestion/build-bundle.js#L1650-L1710)

**Interfaces:**
- Consumes: Endpoints `/api/admin/rotacion/reset`, `/api/admin/rotacion/canal` y `/api/familia/codefensoras`.
- Produces: Tarjeta en tab Configuración con controles de reset y selección manual de Co-Defensora inicial por canal.

- [ ] **Step 1: Agregar el marcado HTML de la tarjeta de rotación en `dashboard.html`**

En la sección `#tab-config`:

```html
<div class="card aero-card" style="margin-top: 1.5rem;">
    <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
        <h3><i class="ri-refresh-line"></i> Gestión de Rotación de Turnos (Co-Defensorías de Familia)</h3>
        <button class="btn btn-secondary" id="btnResetRotacion" style="background: rgba(239, 68, 68, 0.2); color: #F87171; border-color: #EF4444;">
            <i class="ri-history-line"></i> Reiniciar Rotación a Cero
        </button>
    </div>
    <div class="card-body">
        <p style="color: #94A3B8; font-size: 0.88rem; margin-bottom: 1.25rem;">
            Ajuste el turno inicial o corrija desviaciones de distribución circular para cada canal. Las Co-Defensoras marcadas como ausentes serán omitidas automáticamente.
        </p>
        <div class="grid-form" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.25rem;" id="rotacionCanalesContainer">
            <!-- Renderizado dinámico de controles por canal -->
        </div>
    </div>
</div>
```

- [ ] **Step 2: Agregar lógica de renderizado y eventos en `build-bundle.js`**

En `DashboardViewController`:

```javascript
        async loadAdminRotacionControl() {
            const container = document.getElementById('rotacionCanalesContainer');
            const btnReset = document.getElementById('btnResetRotacion');

            if (btnReset && !btnReset.dataset.bound) {
                btnReset.dataset.bound = "true";
                btnReset.addEventListener('click', () => {
                    showConfirm('¿Reiniciar Rotación?', '¿Confirma reiniciar el puntero de rotación a cero para todos los canales?', async () => {
                        try {
                            const res = await fetch(getApiUrl('/api/admin/rotacion/reset'), {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ adminOperatorName: this.currentUser ? this.currentUser.nombreCompleto : 'ADMIN' })
                            });
                            if (res.ok) {
                                showToast('Rotación reiniciada a cero correctamente', 'success');
                                await this.loadAdminRotacionControl();
                                await this.calculateProximoTurno();
                            }
                        } catch(e) {
                            showToast('Error al reiniciar rotación', 'error');
                        }
                    });
                });
            }

            if (!container) return;

            const canales = [
                { key: 'ASESORAMIENTO_GENERAL', label: 'Asesoramiento General' },
                { key: 'CAUSA_NUEVA', label: 'Causa Nueva' },
                { key: 'CONTESTACION_DEMANDA', label: 'Contestación de Demanda' },
                { key: 'ADOPCION', label: 'Guarda / Tutela / Adopción' }
            ];

            let html = '';
            for (const c of canales) {
                const turnRes = await fetch(getApiUrl('/api/familia/proximo-turno?canal=' + encodeURIComponent(c.key)));
                let proxima = 'Sin asignar';
                if (turnRes.ok) {
                    const tData = await turnRes.json();
                    if (tData.proximaDefensora) proxima = tData.proximaDefensora;
                }

                let optionsHtml = '';
                this.codefensorasRoster.forEach((def, idx) => {
                    const selected = def.nombre === proxima ? 'selected' : '';
                    const ausenteTxt = def.isPresente ? '' : ' (Ausente)';
                    optionsHtml += `<option value="${idx - 1}" ${selected}>Inicia con: Dra. ${def.nombre}${ausenteTxt}</option>`;
                });

                html += `
                    <div class="form-group" style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
                        <label style="font-weight: 600; color: #E2E8F0;">${c.label}</label>
                        <div style="font-size: 0.82rem; color: #38BDF8; margin-bottom: 0.5rem;">Próximo Turno: Dra. ${proxima}</div>
                        <select class="form-control channel-rotation-select" data-canal="${c.key}" style="font-size: 0.85rem;">
                            ${optionsHtml}
                        </select>
                    </div>
                `;
            }

            container.innerHTML = html;

            container.querySelectorAll('.channel-rotation-select').forEach(sel => {
                sel.addEventListener('change', async (e) => {
                    const canal = sel.getAttribute('data-canal');
                    const lastIndex = parseInt(sel.value, 10);
                    try {
                        const res = await fetch(getApiUrl('/api/admin/rotacion/canal'), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                canal,
                                lastIndex,
                                adminOperatorName: this.currentUser ? this.currentUser.nombreCompleto : 'ADMIN'
                            })
                        });
                        if (res.ok) {
                            showToast('Turno del canal actualizado', 'success');
                            await this.calculateProximoTurno();
                        }
                    } catch(err) {
                        showToast('Error al actualizar canal', 'error');
                    }
                });
            });
        }
```

- [ ] **Step 3: Compilar y generar `dashboard-bundle.js` (`npm run build`)**

- [ ] **Step 4: Commit**
```bash
git add dashboard.html build-bundle.js dashboard-bundle.js
git commit -m "feat: agregar panel admin de control de rotacion con reset y ajustes individuales por canal"
```

---

### Task 5: Compilación Final y Verificación E2E

- [ ] **Step 1: Compilar la aplicación con `npm run build`**

Run: `npm run build`  
Expected: `dashboard-bundle.js` actualizado sin errores.

- [ ] **Step 2: Probar el flujo completo e iniciar el servidor**

Run: `node server.js`  
Probar:
1. Crear atención de Co-Defensora de Familia y verificar avance de rotación.
2. Editar atención y comprobar que se preservan `codefensora_asignada`, `modo_derivacion_familia` y `fecha_vencimiento_contestacion`.
3. Probar alerta cuando la Co-Defensora de causa previa está ausente.
4. Probar en Admin la tarjeta de control de rotación (reset y ajuste de canal).

- [ ] **Step 3: Commit final**
```bash
git add .
git commit -m "chore: finalizacion y verificacion e2e del modulo de co-defensoras y rotacion"
```
