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

async function runDirectSqliteTest() {
    console.log('--- TEST 1: SQLite schema y persistencia directa ---');
    const testDbPath = path.join(__dirname, 'test_civil_direct.db');
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

    const db = new DatabaseSync(testDbPath);
    db.exec(`
        CREATE TABLE IF NOT EXISTS atenciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha TEXT,
            actividad TEXT,
            dni TEXT,
            apellidos TEXT,
            nombres TEXT,
            celular TEXT,
            expte TEXT,
            motivo TEXT,
            defensoria TEXT,
            resultado TEXT,
            observaciones TEXT,
            atendido_por TEXT,
            derivado_a TEXT,
            escritos TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            tarea_pendiente INTEGER DEFAULT 0,
            detalle_pendiente TEXT,
            tarea_cumplida_at DATETIME,
            modo_derivacion_familia TEXT,
            codefensora_asignada TEXT,
            fecha_vencimiento_contestacion TEXT,
            detalle_reparticion TEXT,
            plantilla_codigo TEXT,
            escritos_data TEXT
        );
    `);

    const stmt = db.prepare(`
        INSERT INTO atenciones (
            fecha, actividad, dni, apellidos, nombres, celular, expte, motivo, defensoria,
            resultado, observaciones, atendido_por, derivado_a, escritos,
            tarea_pendiente, detalle_pendiente, modo_derivacion_familia, codefensora_asignada, fecha_vencimiento_contestacion, detalle_reparticion,
            plantilla_codigo, escritos_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
        '04/09/2026', 'Atención Personal', '30111222', 'GONZALEZ', 'MARIA', '2604112233',
        'CIV-1234/26', 'Asesoramiento civil', 'DEF. CIVIL', 'Resuelve', 'Observación test',
        'Secretaría', '', '', 0, '', '', 'Jorgelina Bayón', '', '', '', ''
    );

    const row = db.prepare('SELECT * FROM atenciones WHERE dni = ?').get('30111222');
    assert(row, 'Debe encontrar la atención registrada');
    assert.strictEqual(row.defensoria, 'DEF. CIVIL', 'Defensoría debe ser DEF. CIVIL');
    assert.strictEqual(row.codefensora_asignada, 'Jorgelina Bayón', 'codefensora_asignada debe ser Jorgelina Bayón');

    db.close();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    console.log('✅ TEST 1 Passed: SQLite admite y persiste codefensora_asignada para DEF. CIVIL.');
}

async function runHttpApiTests() {
    console.log('\n--- TEST 2: HTTP API handlePostAtencion y handlePutAtencion ---');
    const testPort = 3099;
    const testDbPath = path.join(__dirname, 'test_civil_server.db');
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

    const env = { ...process.env, PORT: testPort.toString(), DB_PATH: testDbPath };
    const serverProcess = spawn('node', ['server.js'], {
        cwd: path.join(__dirname, '..'),
        env,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    serverProcess.stdout.on('data', d => {
        // console.log(`[SERVER]: ${d}`);
    });
    serverProcess.stderr.on('data', d => {
        console.error(`[SERVER ERR]: ${d}`);
    });

    // Esperar a que el servidor inicie
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Server start timeout')), 5000);
        const interval = setInterval(async () => {
            try {
                const res = await makeRequest({ hostname: 'localhost', port: testPort, path: '/api/atenciones', method: 'GET' });
                if (res.status === 200) {
                    clearTimeout(timeout);
                    clearInterval(interval);
                    resolve();
                }
            } catch (e) {}
        }, 200);
    });

    try {
        // 1. POST Atencion DEF. CIVIL con codefensoraAsignada = 'Jorgelina Bayón'
        console.log('Testing POST DEF. CIVIL con codefensoraAsignada...');
        const postCivil = await makeRequest({
            hostname: 'localhost',
            port: testPort,
            path: '/api/atenciones',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            dni: '40111222',
            apellidos: 'PEREZ',
            nombres: 'ANA',
            defensoria: 'DEF. CIVIL',
            codefensoraAsignada: 'Jorgelina Bayón',
            motivo: 'Amparo',
            resultado: 'Resuelve'
        });

        assert.strictEqual(postCivil.status, 201, `POST should return 201, got ${postCivil.status}`);
        assert(postCivil.data.success, 'POST response should be success');
        assert(postCivil.data.id, 'POST response should return id');
        const civilId = postCivil.data.id;

        // Verificar en base de datos via GET
        const listRes = await makeRequest({ hostname: 'localhost', port: testPort, path: '/api/atenciones', method: 'GET' });
        const savedCivil = listRes.data.data.find(a => a.id === civilId);
        assert(savedCivil, 'Saved civil attention must exist');
        assert.strictEqual(savedCivil.defensoria, 'DEF. CIVIL');
        assert.strictEqual(savedCivil.codefensora_asignada, 'Jorgelina Bayón', 'codefensora_asignada debe ser "Jorgelina Bayón"');
        console.log('✅ POST DEF. CIVIL guardó codefensora_asignada correctamente.');

        // 2. PUT Atencion DEF. CIVIL actualizando codefensoraAsignada = 'Alejandra Di Menza'
        console.log('Testing PUT DEF. CIVIL actualizando codefensoraAsignada...');
        const putCivil = await makeRequest({
            hostname: 'localhost',
            port: testPort,
            path: '/api/atenciones',
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        }, {
            id: civilId,
            dni: '40111222',
            apellidos: 'PEREZ',
            nombres: 'ANA',
            defensoria: 'DEF. CIVIL',
            codefensoraAsignada: 'Alejandra Di Menza',
            motivo: 'Amparo',
            resultado: 'Resuelve'
        });

        assert.strictEqual(putCivil.status, 200, `PUT should return 200, got ${putCivil.status}`);
        assert(putCivil.data.success, 'PUT response should be success');

        const listRes2 = await makeRequest({ hostname: 'localhost', port: testPort, path: '/api/atenciones', method: 'GET' });
        const updatedCivil = listRes2.data.data.find(a => a.id === civilId);
        assert.strictEqual(updatedCivil.codefensora_asignada, 'Alejandra Di Menza', 'codefensora_asignada debe actualizarse a "Alejandra Di Menza"');
        console.log('✅ PUT DEF. CIVIL actualizó codefensora_asignada correctamente.');

        // 3. POST Atencion CO-DEF. FAMILIA con Laura Alvarado (debe seguir funcionando igual)
        console.log('Testing POST CO-DEF. FAMILIA para comprobar no-regresión...');
        const postFamilia = await makeRequest({
            hostname: 'localhost',
            port: testPort,
            path: '/api/atenciones',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            dni: '40333444',
            apellidos: 'LOPEZ',
            nombres: 'CARLOS',
            defensoria: 'CO-DEF. FAMILIA',
            codefensoraAsignada: 'Laura Alvarado',
            modoDerivacionFamilia: 'CAUSA_NUEVA'
        });
        assert.strictEqual(postFamilia.status, 201);
        const familiaId = postFamilia.data.id;

        const listRes3 = await makeRequest({ hostname: 'localhost', port: testPort, path: '/api/atenciones', method: 'GET' });
        const savedFamilia = listRes3.data.data.find(a => a.id === familiaId);
        assert.strictEqual(savedFamilia.codefensora_asignada, 'Laura Alvarado');
        console.log('✅ POST CO-DEF. FAMILIA mantuvo su comportamiento esperado.');

        // 4. POST Otra Defensoría (e.g. PENAL) - NO debe persistir codefensoraAsignada
        console.log('Testing POST otra defensoría no guarda codefensora...');
        const postPenal = await makeRequest({
            hostname: 'localhost',
            port: testPort,
            path: '/api/atenciones',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            dni: '40555666',
            apellidos: 'GOMEZ',
            nombres: 'PEDRO',
            defensoria: '1ª DEFENSORÍA PENAL',
            codefensoraAsignada: 'Jorgelina Bayón'
        });
        assert.strictEqual(postPenal.status, 201);
        const penalId = postPenal.data.id;

        const listRes4 = await makeRequest({ hostname: 'localhost', port: testPort, path: '/api/atenciones', method: 'GET' });
        const savedPenal = listRes4.data.data.find(a => a.id === penalId);
        assert.strictEqual(savedPenal.codefensora_asignada, '', 'codefensora_asignada debe ser vacía para defensorías que no son FAMILIA ni CIVIL');
        console.log('✅ POST otra defensoría no persiste codefensora como esperado.');

        console.log('\n🎉 ¡Todos los tests de backend pasaron exitosamente!');
    } finally {
        serverProcess.kill();
        await new Promise(r => setTimeout(r, 500));
        if (fs.existsSync(testDbPath)) {
            try { fs.unlinkSync(testDbPath); } catch (e) {}
        }
    }
}

async function main() {
    try {
        await runDirectSqliteTest();
        await runHttpApiTests();
        process.exit(0);
    } catch (err) {
        console.error('❌ Error en pruebas:', err);
        process.exit(1);
    }
}

main();
