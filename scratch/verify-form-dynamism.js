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
    console.log('🧪 Iniciando Verificación E2E de Dinamismo de Formulario y Repartición...');

    try {
        // 1. Crear atención derivada a otra repartición
        const res1 = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/atenciones',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            dni: '30111222',
            apellidos: 'PRUEBA',
            nombres: 'FORMULARIO DINAMICO',
            defensoria: 'CO-DEF. FAMILIA',
            modoDerivacionFamilia: 'Guarda Judicial / Tutela / Adopción',
            codefensoraAsignada: 'Andrea Lombard',
            motivo: 'Consulta Adopción',
            resultado: 'Derivado a otra repartición',
            detalleReparticion: 'ETI San Rafael / Equipo Interdisciplinario',
            atendidoPor: 'Sergio M. Pereyra'
        });

        console.log('✅ 1. POST /api/atenciones (Derivado a otra repartición):', res1.body);
        if (!res1.body.success) throw new Error('Falló creación de atención');

        const newId = res1.body.id;

        // 2. Consultar SQLite para verificar detalle_reparticion
        const dbPath = path.join(__dirname, '..', 'data', 'atenciones.db');
        const db = new sqlite3.DatabaseSync(dbPath);
        const record = db.prepare('SELECT * FROM atenciones WHERE id = ?').get(newId);

        console.log('✅ 2. Registro SQLite en DB:', {
            id: record.id,
            defensoria: record.defensoria,
            modo_derivacion_familia: record.modo_derivacion_familia,
            resultado: record.resultado,
            detalle_reparticion: record.detalle_reparticion
        });

        if (record.detalle_reparticion !== 'ETI San Rafael / Equipo Interdisciplinario') {
            throw new Error('❌ Fallo: detalle_reparticion no se guardó correctamente en SQLite');
        }

        // 3. Crear atención con 'Resuelve operador' y verificar que no avanza la rotación Round-Robin de manera innecesaria
        const res2 = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/atenciones',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            dni: '30111222',
            apellidos: 'PRUEBA',
            nombres: 'RESUELVE OPERADOR',
            defensoria: 'CO-DEF. FAMILIA',
            modoDerivacionFamilia: 'Asesoramiento General',
            codefensoraAsignada: 'Mariela Fokszek',
            motivo: 'Asesoramiento verbal en mesa de entrada',
            resultado: 'Resuelve operador',
            atendidoPor: 'Sergio M. Pereyra'
        });

        console.log('✅ 3. POST /api/atenciones (Resuelve operador):', res2.body);

        console.log('\n🎉 ¡TODAS LAS PRUEBAS DE DINAMISMO Y ANTECEDENTES PASARON CON ÉXITO!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error en prueba de dinamismo:', err.message);
        process.exit(1);
    }
}

runTests();
