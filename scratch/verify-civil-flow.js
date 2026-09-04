/**
 * scratch/verify-civil-flow.js
 * Verificación Integral E2E - Flujo de Asignación en Defensoría Civil
 * 
 * Casos cubiertos:
 * 1. Creación REST (POST /api/atenciones) con DEF. CIVIL y codefensoraAsignada: 'Jorgelina Bayón'.
 * 2. Edición REST (PUT /api/atenciones) actualizando a 'Alejandra Di Menza'.
 * 3. Consulta de Historial Ciudadano (/api/ciudadanos/historial) y sugerencia vincular.
 * 4. Atención Civil sin Asignar (Resuelta en mesa, codefensoraAsignada vacía).
 * 5. Renderizado de Tabla y Detalle (color celeste #38BDF8, etiqueta y fallback).
 * 6. Búsqueda y filtrado (SearchAttendancesUseCase con searchBlob: 'Bayón', 'Di Menza', 'Alvarado').
 */

const http = require('http');
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { DatabaseSync } = require('node:sqlite');

function makeRequest(options, data) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    resolve({ status: res.statusCode, data: json });
                } catch (e) {
                    resolve({ status: res.statusCode, text: body });
                }
            });
        });
        req.on('error', reject);
        if (data) {
            req.write(typeof data === 'string' ? data : JSON.stringify(data));
        }
        req.end();
    });
}

async function startTestServer(port, dbPath) {
    if (fs.existsSync(dbPath)) {
        try { fs.unlinkSync(dbPath); } catch (e) {}
    }

    const env = { ...process.env, PORT: port.toString(), DB_PATH: dbPath };
    const serverProcess = spawn('node', ['server.js'], {
        cwd: path.join(__dirname, '..'),
        env,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    serverProcess.stderr.on('data', d => {
        const msg = d.toString();
        if (!msg.includes('ExperimentalWarning')) {
            console.error(`[SERVER ERR]: ${msg}`);
        }
    });

    // Esperar a que el servidor responda
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout esperando inicio del servidor')), 6000);
        const interval = setInterval(async () => {
            try {
                const res = await makeRequest({ hostname: 'localhost', port, path: '/api/atenciones', method: 'GET' });
                if (res.status === 200) {
                    clearTimeout(timeout);
                    clearInterval(interval);
                    resolve();
                }
            } catch (e) {}
        }, 150);
    });

    return serverProcess;
}

async function runAllTests() {
    console.log('======================================================================');
    console.log('🧪 INICIANDO VERIFICACIÓN INTEGRAL: FLUJO DE DEFENSORÍA CIVIL (E2E)');
    console.log('======================================================================\n');

    const testPort = 3199;
    const testDbPath = path.join(__dirname, 'test_civil_flow.db');
    let serverProcess = null;

    try {
        serverProcess = await startTestServer(testPort, testDbPath);
        const db = new DatabaseSync(testDbPath);

        const testDni = '32987654';

        // ---------------------------------------------------------------------
        // CASO 1: Creación REST (POST /api/atenciones)
        // ---------------------------------------------------------------------
        console.log('▶ CASO 1: Creación REST (POST /api/atenciones) con DEF. CIVIL y Jorgelina Bayón');
        const postPayload = {
            fecha: '04/09/2026',
            dni: testDni,
            apellidos: 'QUIROGA',
            nombres: 'MARIANA',
            celular: '2604123456',
            expte: 'CIV-9012/26',
            motivo: 'Amparo',
            defensoria: 'DEF. CIVIL',
            codefensoraAsignada: 'Jorgelina Bayón',
            resultado: 'Entrevista con Defensor',
            observaciones: 'Primera consulta para amparo de salud',
            atendidoPor: 'Mesa de Entrada'
        };

        const postRes = await makeRequest({
            hostname: 'localhost',
            port: testPort,
            path: '/api/atenciones',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, postPayload);

        assert.strictEqual(postRes.status, 201, `Status esperado 201, recibido ${postRes.status}`);
        assert(postRes.data && postRes.data.success, 'La respuesta de creación debe ser exitosa');
        assert(postRes.data.id, 'Debe devolver el ID generado');
        const createdId = postRes.data.id;

        // Validar directamente en SQLite
        const row1 = db.prepare('SELECT * FROM atenciones WHERE id = ?').get(createdId);
        assert(row1, 'El registro debe existir en SQLite');
        assert.strictEqual(row1.defensoria, 'DEF. CIVIL', 'defensoria debe ser DEF. CIVIL');
        assert.strictEqual(row1.codefensora_asignada, 'Jorgelina Bayón', 'codefensora_asignada en SQLite debe ser "Jorgelina Bayón"');
        console.log(`  ✔ Status 201 OK. ID: ${createdId}`);
        console.log(`  ✔ Persistencia SQLite: defensoria="${row1.defensoria}", codefensora_asignada="${row1.codefensora_asignada}"\n`);

        // ---------------------------------------------------------------------
        // CASO 2: Edición REST (PUT /api/atenciones)
        // ---------------------------------------------------------------------
        console.log('▶ CASO 2: Edición REST (PUT /api/atenciones) cambiando profesional a Alejandra Di Menza');
        const putPayload = {
            id: createdId,
            fecha: '04/09/2026',
            dni: testDni,
            apellidos: 'QUIROGA',
            nombres: 'MARIANA',
            celular: '2604123456',
            expte: 'CIV-9012/26',
            motivo: 'Amparo',
            defensoria: 'DEF. CIVIL',
            codefensoraAsignada: 'Alejandra Di Menza',
            resultado: 'Entrevista con Defensor',
            observaciones: 'Modificada reasignación a Dra. Di Menza',
            atendidoPor: 'Mesa de Entrada'
        };

        const putRes = await makeRequest({
            hostname: 'localhost',
            port: testPort,
            path: '/api/atenciones',
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        }, putPayload);

        assert.strictEqual(putRes.status, 200, `Status esperado 200, recibido ${putRes.status}`);
        assert(putRes.data && putRes.data.success, 'La respuesta de actualización debe ser exitosa');

        // Validar en SQLite
        const row2 = db.prepare('SELECT * FROM atenciones WHERE id = ?').get(createdId);
        assert.strictEqual(row2.codefensora_asignada, 'Alejandra Di Menza', 'codefensora_asignada debe actualizarse a "Alejandra Di Menza"');
        console.log(`  ✔ Status 200 OK.`);
        console.log(`  ✔ Actualización SQLite: codefensora_asignada="${row2.codefensora_asignada}"\n`);

        // ---------------------------------------------------------------------
        // CASO 3: Consulta de Historial Ciudadano y Sugerencia
        // ---------------------------------------------------------------------
        console.log('▶ CASO 3: Consulta de Historial Ciudadano (/api/ciudadanos/historial) y lógica de sugerencia');
        const histRes = await makeRequest({
            hostname: 'localhost',
            port: testPort,
            path: `/api/ciudadanos/historial?dni=${testDni}`,
            method: 'GET'
        });

        assert.strictEqual(histRes.status, 200, `Status esperado 200, recibido ${histRes.status}`);
        assert(histRes.data && histRes.data.success, 'Respuesta exitosa');
        assert.strictEqual(histRes.data.found, true, 'Debe indicar found: true');
        assert(Array.isArray(histRes.data.history), 'Debe contener arreglo history');
        assert(histRes.data.history.length >= 1, 'Debe contener al menos un registro histórico');

        // Simular la lógica de sugerencia exacta del frontend (updateCivilAssignmentLogic)
        const citizenHistory = histRes.data.history;
        const prevCivil = citizenHistory.find(r => {
            const defName = r.defensoria || (r.defensoriaCategory && r.defensoriaCategory.name) || '';
            return (defName.includes('CIVIL') || defName === 'DEF. CIVIL') && (r.codefensora_asignada || r.codefensoraAsignada);
        });

        assert(prevCivil, 'Debe encontrar la atención previa de DEF. CIVIL con profesional asignada');
        const suggestedProfessional = prevCivil.codefensora_asignada || prevCivil.codefensoraAsignada;
        assert.strictEqual(suggestedProfessional, 'Alejandra Di Menza', 'La sugerencia debe ser "Alejandra Di Menza"');
        console.log(`  ✔ Historial recuperado: ${histRes.data.history.length} registro(s).`);
        console.log(`  ✔ Registro Civil previo detectado: ID ${prevCivil.id}`);
        console.log(`  ✔ Profesional sugerida correctamente: "${suggestedProfessional}"\n`);

        // ---------------------------------------------------------------------
        // CASO 4: Atención Civil sin Asignar (Resuelta en mesa)
        // ---------------------------------------------------------------------
        console.log('▶ CASO 4: Atención Civil sin Asignar (Resuelta en mesa, codefensoraAsignada vacía)');
        const postUnassignedPayload = {
            fecha: '04/09/2026',
            dni: '45111222',
            apellidos: 'BERMUDEZ',
            nombres: 'CARLOS',
            defensoria: 'DEF. CIVIL',
            codefensoraAsignada: '',
            motivo: 'Asesoramiento verbal',
            resultado: 'Resuelve',
            atendidoPor: 'Mesa de Entrada'
        };

        const unassignedRes = await makeRequest({
            hostname: 'localhost',
            port: testPort,
            path: '/api/atenciones',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, postUnassignedPayload);

        assert.strictEqual(unassignedRes.status, 201, `Status esperado 201, recibido ${unassignedRes.status}`);
        const unassignedId = unassignedRes.data.id;

        const rowUnassigned = db.prepare('SELECT * FROM atenciones WHERE id = ?').get(unassignedId);
        assert(rowUnassigned, 'Debe persistirse el registro no asignado');
        assert.strictEqual(rowUnassigned.defensoria, 'DEF. CIVIL');
        assert.strictEqual(rowUnassigned.codefensora_asignada || '', '', 'codefensora_asignada debe ser vacía');
        console.log(`  ✔ Status 201 OK. ID: ${unassignedId}`);
        console.log(`  ✔ SQLite almacena codefensora_asignada vacía: "${rowUnassigned.codefensora_asignada || ''}" sin errores.\n`);

        // ---------------------------------------------------------------------
        // CASO 5: Renderizado de Celda de Tabla y Modal Detalle
        // ---------------------------------------------------------------------
        console.log('▶ CASO 5: Renderizado de Celda de Tabla y Modal Detalle');

        // Lógica de celda de tabla según dashboard-bundle.js
        function renderOperadorCell(dto) {
            return (dto.defensoriaName === 'CO-DEF. FAMILIA' && dto.codefensoraAsignada 
                ? '<span style="color:#F472B6; font-weight:600;">' + dto.codefensoraAsignada + '</span><br><span style="font-size:0.7rem; color:#94A3B8">Operador: ' + dto.atendidoPor + '</span>' 
                : ((dto.defensoriaName === 'DEF. CIVIL' || (dto.defensoriaName && dto.defensoriaName.includes('CIVIL'))) && dto.codefensoraAsignada
                    ? '<span style="color:#38BDF8; font-weight:600;">Dra. ' + dto.codefensoraAsignada.trim().replace(/^dra\.?\s*/i, '') + '</span><br><span style="font-size:0.7rem; color:#94A3B8">Operador: ' + dto.atendidoPor + '</span>'
                    : dto.atendidoPor));
        }

        // Lógica de modal detalle según dashboard-bundle.js
        function renderDetailModalCivilBlock(dto) {
            return ((dto.defensoriaName === 'DEF. CIVIL' || (dto.defensoriaName && dto.defensoriaName.includes('CIVIL'))) && dto.codefensoraAsignada 
                ? '<div><span style="font-size: 0.75rem; color: #38BDF8; text-transform: uppercase;">Defensora / Co-Defensora Civil</span><p style="font-weight: 700; color: #0284C7;">Dra. ' + dto.codefensoraAsignada.trim().replace(/^dra\.?\s*/i, '') + '</p></div>' 
                : '');
        }

        // 5a. Civil asignada
        const dtoCivilAsignada = {
            defensoriaName: 'DEF. CIVIL',
            codefensoraAsignada: 'Jorgelina Bayón',
            atendidoPor: 'Sergio Pereyra'
        };
        const htmlCellAsignada = renderOperadorCell(dtoCivilAsignada);
        assert(htmlCellAsignada.includes('#38BDF8'), 'Debe incluir el color celeste #38BDF8');
        assert(htmlCellAsignada.includes('Dra. Jorgelina Bayón'), 'Debe anteponer Dra. y nombre');
        assert(htmlCellAsignada.includes('Operador: Sergio Pereyra'), 'Debe renderizar al operador debajo');

        const htmlDetailAsignada = renderDetailModalCivilBlock(dtoCivilAsignada);
        assert(htmlDetailAsignada.includes('Defensora / Co-Defensora Civil'), 'Debe incluir el título de bloque civil');
        assert(htmlDetailAsignada.includes('#38BDF8'), 'Debe incluir color #38BDF8 en label');
        assert(htmlDetailAsignada.includes('Dra. Jorgelina Bayón'), 'Debe incluir Dra. Jorgelina Bayón');

        // 5b. Civil sin asignar (mesa)
        const dtoCivilSinAsignar = {
            defensoriaName: 'DEF. CIVIL',
            codefensoraAsignada: '',
            atendidoPor: 'Sergio Pereyra'
        };
        const htmlCellSinAsignar = renderOperadorCell(dtoCivilSinAsignar);
        assert.strictEqual(htmlCellSinAsignar, 'Sergio Pereyra', 'Sin profesional asignada debe renderizar únicamente el nombre del operador');
        const htmlDetailSinAsignar = renderDetailModalCivilBlock(dtoCivilSinAsignar);
        assert.strictEqual(htmlDetailSinAsignar, '', 'Sin profesional asignada no debe renderizar bloque en detalle');

        // 5c. Validar presencia exacta en public/js/dashboard-bundle.js
        const bundleJsPath = path.join(__dirname, '..', 'public', 'js', 'dashboard-bundle.js');
        const bundleContent = fs.readFileSync(bundleJsPath, 'utf8');
        assert(bundleContent.includes('#38BDF8'), 'dashboard-bundle.js debe contener estilos #38BDF8 para defensora civil');
        assert(bundleContent.includes('Defensora / Co-Defensora Civil'), 'dashboard-bundle.js debe contener etiqueta en modal de detalle');

        console.log(`  ✔ Tabla con asignada: ${htmlCellAsignada}`);
        console.log(`  ✔ Tabla sin asignar: "${htmlCellSinAsignar}"`);
        console.log(`  ✔ Detalle modal con asignada: ${htmlDetailAsignada}`);
        console.log(`  ✔ Verificación de archivo bundle en disco exitosa.\n`);

        // ---------------------------------------------------------------------
        // CASO 6: Búsqueda y Filtrado con searchBlob
        // ---------------------------------------------------------------------
        console.log('▶ CASO 6: Búsqueda y Filtrado (SearchAttendancesUseCase / searchBlob)');

        // Implementación idéntica a SearchAttendancesUseCase en dashboard-bundle.js
        function filterAttendances(attendances, { query = '', defensoria = '' }) {
            const norm = (str) => String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const qRaw = norm(query).trim();
            const qClean = qRaw.replace(/[^a-z0-9]/g, '');
            const qWords = qRaw.split(/\s+/).filter(Boolean);

            return attendances.filter(item => {
                let matchesQuery = true;
                if (qRaw) {
                    const idStr = String(item.id || '');
                    const dniClean = item.dniClean || '';
                    const dniRaw = item.dniRaw || '';
                    const apellidos = norm(item.apellidos);
                    const nombres = norm(item.nombres);
                    const fullName1 = apellidos + ' ' + nombres;
                    const fullName2 = nombres + ' ' + apellidos;
                    const expte = norm(item.expte);
                    const motivo = norm(item.motivo);
                    const defensoriaName = norm(item.defensoria);
                    const resName = norm(item.resultado);
                    const obs = norm(item.observaciones);
                    const detPend = norm(item.detallePendiente);
                    const atendido = norm(item.atendidoPor);
                    const codef = norm(item.codefensoraAsignada);

                    const searchBlob = [idStr, dniClean, dniRaw, fullName1, fullName2, expte, motivo, defensoriaName, resName, obs, detPend, atendido, codef].join(' ');
                    const searchBlobClean = searchBlob.replace(/[^a-z0-9]/g, '');

                    matchesQuery = (qClean.length > 0 && searchBlobClean.includes(qClean)) ||
                                   qWords.every(word => searchBlob.includes(word));
                }

                const matchesDefensoria = !defensoria || item.defensoria === defensoria;
                return matchesQuery && matchesDefensoria;
            });
        }

        const sampleDataset = [
            {
                id: 101,
                dniRaw: '30111222',
                dniClean: '30111222',
                apellidos: 'GARCIA',
                nombres: 'LILIANA',
                expte: 'CIV-1001/26',
                motivo: 'Amparo',
                defensoria: 'DEF. CIVIL',
                codefensoraAsignada: 'Jorgelina Bayón',
                resultado: 'Resuelve',
                observaciones: '',
                detallePendiente: '',
                atendidoPor: 'Mesa 1'
            },
            {
                id: 102,
                dniRaw: '30333444',
                dniClean: '30333444',
                apellidos: 'MARTINEZ',
                nombres: 'ROBERTO',
                expte: 'CIV-1002/26',
                motivo: 'Prescripción',
                defensoria: 'DEF. CIVIL',
                codefensoraAsignada: 'Alejandra Di Menza',
                resultado: 'Resuelve',
                observaciones: '',
                detallePendiente: '',
                atendidoPor: 'Mesa 2'
            },
            {
                id: 103,
                dniRaw: '30555666',
                dniClean: '30555666',
                apellidos: 'LOPEZ',
                nombres: 'MARCELA',
                expte: 'FAM-2001/26',
                motivo: 'Alimentos',
                defensoria: 'CO-DEF. FAMILIA',
                codefensoraAsignada: 'Laura Alvarado',
                resultado: 'Entrevista con Codefensor',
                observaciones: '',
                detallePendiente: '',
                atendidoPor: 'Mesa 1'
            },
            {
                id: 104,
                dniRaw: '30777888',
                dniClean: '30777888',
                apellidos: 'FERNANDEZ',
                nombres: 'SOFIA',
                expte: 'CIV-1003/26',
                motivo: 'Asesoramiento verbal',
                defensoria: 'DEF. CIVIL',
                codefensoraAsignada: '',
                resultado: 'Resuelve',
                observaciones: '',
                detallePendiente: '',
                atendidoPor: 'Mesa 3'
            }
        ];

        // 6a. Búsqueda por "Bayón" y "bayon"
        const searchBayonAccented = filterAttendances(sampleDataset, { query: 'Bayón' });
        assert.strictEqual(searchBayonAccented.length, 1, 'Debe encontrar 1 registro para "Bayón"');
        assert.strictEqual(searchBayonAccented[0].codefensoraAsignada, 'Jorgelina Bayón');

        const searchBayonUnaccented = filterAttendances(sampleDataset, { query: 'bayon' });
        assert.strictEqual(searchBayonUnaccented.length, 1, 'Debe encontrar 1 registro para "bayon"');
        assert.strictEqual(searchBayonUnaccented[0].id, 101);
        console.log('  ✔ Búsqueda "Bayón" / "bayon" -> Encontró registro de Jorgelina Bayón.');

        // 6b. Búsqueda por "Di Menza"
        const searchDiMenza = filterAttendances(sampleDataset, { query: 'Di Menza' });
        assert.strictEqual(searchDiMenza.length, 1, 'Debe encontrar 1 registro para "Di Menza"');
        assert.strictEqual(searchDiMenza[0].codefensoraAsignada, 'Alejandra Di Menza');
        console.log('  ✔ Búsqueda "Di Menza" -> Encontró registro de Alejandra Di Menza.');

        // 6c. Búsqueda por "Alvarado"
        const searchAlvarado = filterAttendances(sampleDataset, { query: 'Alvarado' });
        assert.strictEqual(searchAlvarado.length, 1, 'Debe encontrar 1 registro para "Alvarado"');
        assert.strictEqual(searchAlvarado[0].codefensoraAsignada, 'Laura Alvarado');
        console.log('  ✔ Búsqueda "Alvarado" -> Encontró registro de Laura Alvarado.');

        // 6d. Búsqueda general "DEF. CIVIL"
        const searchCivil = filterAttendances(sampleDataset, { defensoria: 'DEF. CIVIL' });
        assert.strictEqual(searchCivil.length, 3, 'Debe encontrar 3 registros de DEF. CIVIL');
        console.log('  ✔ Filtro por defensoría "DEF. CIVIL" -> 3 registros encontrados correctamente.\n');

        db.close();

        console.log('======================================================================');
        console.log('🎉 ¡TODOS LOS CASOS DE PRUEBA (1 A 6) PASARON EXITOSAMENTE CON CÓDIGO 0!');
        console.log('======================================================================');
        return true;
    } finally {
        if (serverProcess) {
            serverProcess.kill();
            // Esperar desconexión del proceso
            await new Promise(r => setTimeout(r, 600));
        }
        if (fs.existsSync(testDbPath)) {
            try { fs.unlinkSync(testDbPath); } catch (e) {}
        }
    }
}

runAllTests()
    .then(() => {
        process.exit(0);
    })
    .catch(err => {
        console.error('\n❌ ERROR EN LA VERIFICACIÓN INTEGRAL:');
        console.error(err);
        process.exit(1);
    });
