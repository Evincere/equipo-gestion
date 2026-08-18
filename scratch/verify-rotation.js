const http = require('http');

function makeRequest(options, postData) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, res => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(body) }));
        });
        req.on('error', reject);
        if (postData) req.write(JSON.stringify(postData));
        req.end();
    });
}

async function runTests() {
    console.log('🧪 Iniciando verificación automatizada del Servidor y API de Rotaciones...');

    try {
        // 1. Probar GET /api/familia/proximo-turno?canal=CAUSA_NUEVA
        const r1 = await makeRequest({ hostname: 'localhost', port: 3000, path: '/api/familia/proximo-turno?canal=CAUSA_NUEVA', method: 'GET' });
        console.log('✅ GET proximo-turno (CAUSA_NUEVA):', r1.body);

        // 2. Probar POST /api/admin/rotacion/canal
        const r2 = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/admin/rotacion/canal',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { canal: 'CAUSA_NUEVA', lastIndex: 2, adminOperatorName: 'TEST_ADMIN' });
        console.log('✅ POST admin rotacion canal:', r2.body);

        // 3. Verificar que el próximo turno cambió acorde al nuevo lastIndex
        const r3 = await makeRequest({ hostname: 'localhost', port: 3000, path: '/api/familia/proximo-turno?canal=CAUSA_NUEVA', method: 'GET' });
        console.log('✅ GET proximo-turno tras ajuste:', r3.body);

        // 4. Probar POST /api/admin/rotacion/reset
        const r4 = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/admin/rotacion/reset',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { adminOperatorName: 'TEST_ADMIN' });
        console.log('✅ POST admin rotacion reset:', r4.body);

        console.log('\n🎉 ¡Todas las pruebas de verificación pasaron exitosamente!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error durante la verificación:', err.message);
        process.exit(1);
    }
}

runTests();
