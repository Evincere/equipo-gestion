const http = require('http');
const path = require('path');
const sqlite3 = require('node:sqlite');

function makeRequest(options, postData) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, res => {
            let body = '';
            res.on('data', chunk => body += chunk.toString());
            res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(body) }));
        });
        req.on('error', reject);
        if (postData) req.write(JSON.stringify(postData));
        req.end();
    });
}

async function runTests() {
    console.log('🧪 Iniciando Verificación E2E de Corrección de Vinculación de Co-Defensora...');

    try {
        // 1. Crear una atención inicial para un nuevo DNI de prueba
        const testDni = '35999888';
        const resInit = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/atenciones',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            dni: testDni,
            apellidos: 'SANCHEZ',
            nombres: 'VALERIA',
            defensoria: 'CO-DEF. FAMILIA',
            modoDerivacionFamilia: 'Guarda Judicial / Tutela / Adopción',
            codefensoraAsignada: 'Andrea Lombard',
            motivo: 'Adopción Guarda',
            resultado: 'Entrevista con Codefensor',
            atendidoPor: 'Sergio M. Pereyra'
        });

        console.log('✅ 1. POST inicial de atención:', resInit.body);
        if (!resInit.body.success) throw new Error('Falló creación inicial');

        // 2. Consultar historial de familia para DNI 35999888
        const resHistory = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/atenciones/historial-familia?dni=' + testDni,
            method: 'GET'
        });

        console.log('✅ 2. GET historial-familia:', resHistory.body);
        if (!resHistory.body.success || !resHistory.body.found || resHistory.body.suggestedCodefensora !== 'Andrea Lombard') {
            throw new Error('❌ Fallo: suggestedCodefensora esperada "Andrea Lombard", recibida: ' + resHistory.body.suggestedCodefensora);
        }

        // 3. Crear atención de continuación vincular
        const resFollowUp = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/atenciones',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            dni: testDni,
            apellidos: 'SANCHEZ',
            nombres: 'VALERIA',
            defensoria: 'CO-DEF. FAMILIA',
            modoDerivacionFamilia: 'Causa en Trámite',
            codefensoraAsignada: resHistory.body.suggestedCodefensora,
            motivo: '[Guarda Judicial / Tutela / Adopción] Causa en Trámite',
            resultado: 'Entrevista con Codefensor',
            observaciones: 'Aporta informe ambiental.',
            atendidoPor: 'Sergio M. Pereyra'
        });

        console.log('✅ 3. POST continuación de causa:', resFollowUp.body);
        if (!resFollowUp.body.success) throw new Error('Falló continuación');

        // 4. Verificar en DB
        const dbPath = path.join(__dirname, '..', 'data', 'atenciones.db');
        const db = new sqlite3.DatabaseSync(dbPath);
        const rows = db.prepare('SELECT id, dni, modo_derivacion_familia, codefensora_asignada FROM atenciones WHERE dni = ? ORDER BY id DESC').all(testDni);

        console.log('✅ 4. Registros en SQLite para DNI', testDni, ':', rows);

        if (rows[0].codefensora_asignada !== 'Andrea Lombard') {
            throw new Error('❌ Fallo: Co-Defensora asignada no coincide en el nuevo registro de continuación');
        }

        console.log('\n🎉 ¡VERIFICACIÓN DE VINCULACIÓN AUTOMÁTICA DE CO-DEFENSORA COMPLETADA CON ÉXITO!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error en prueba:', err.message);
        process.exit(1);
    }
}

runTests();
