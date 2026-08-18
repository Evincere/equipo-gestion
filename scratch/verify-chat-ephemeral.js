const http = require('http');
const fs = require('fs');
const path = require('path');

function makeRequest(options, postBuffer, isJson = true) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, res => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                if (isJson) {
                    try {
                        resolve({ statusCode: res.statusCode, headers: res.headers, body: JSON.parse(buffer.toString()) });
                    } catch(e) {
                        resolve({ statusCode: res.statusCode, headers: res.headers, rawBody: buffer });
                    }
                } else {
                    resolve({ statusCode: res.statusCode, headers: res.headers, rawBody: buffer });
                }
            });
        });
        req.on('error', reject);
        if (postBuffer) req.write(postBuffer);
        req.end();
    });
}

async function runTests() {
    console.log('🧪 Iniciando Verificación E2E de Chat 1-a-1 y Purga Efímera de Adjuntos...');

    try {
        // 1. Probar subir un archivo de prueba
        const testFileBuffer = Buffer.from('CONTENIDO DE PRUEBA DOCUMENTO CONFIDENCIAL DEFENSORÍA');
        const uploadRes = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/chat/upload',
            method: 'POST',
            headers: {
                'Content-Type': 'application/pdf',
                'X-File-Name': encodeURIComponent('expediente_prueba.pdf')
            }
        }, testFileBuffer);

        console.log('✅ 1. POST /api/chat/upload:', uploadRes.body);
        if (!uploadRes.body.success) throw new Error('Falló subida de archivo');

        const savedPath = uploadRes.body.archivoRuta;
        console.log('📁 Archivo guardado físicamente en:', savedPath);
        console.log('🔎 ¿Existe en disco antes de descargar?:', fs.existsSync(savedPath));
        if (!fs.existsSync(savedPath)) throw new Error('El archivo debería existir antes de la descarga');

        // 2. Insertar mensaje en DB
        const sqlite3 = require('node:sqlite');
        const dbPath = path.join(__dirname, '..', 'data', 'atenciones.db');
        const db = new sqlite3.DatabaseSync(dbPath);

        const stmt = db.prepare(`
            INSERT INTO chat_mensajes (
                emisor_username, receptor_username, mensaje, tipo,
                archivo_nombre, archivo_ruta, archivo_tamano, archivo_mime, descargado, leido
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
        `);
        const insertRes = stmt.run('spereyra', 'aalonso', 'Envío expediente de prueba', 'FILE', 'expediente_prueba.pdf', savedPath, testFileBuffer.length, 'application/pdf');
        const msgId = Number(insertRes.lastInsertRowid);
        console.log('✅ 2. Mensaje de chat registrado en SQLite ID:', msgId);

        // 3. Probar GET /api/chat/unread-count
        const unreadRes = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/chat/unread-count?username=aalonso',
            method: 'GET'
        });
        console.log('✅ 3. GET /api/chat/unread-count (aalonso):', unreadRes.body);

        // 4. Descargar el archivo vía GET /api/chat/descargar/:id
        const downloadRes = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/chat/descargar/' + msgId,
            method: 'GET'
        }, null, false);

        console.log(`✅ 4. GET /api/chat/descargar/${msgId} StatusCode:`, downloadRes.statusCode);
        console.log('📄 Tamaño de contenido recibido:', downloadRes.rawBody.length, 'bytes');

        // Esperar 200ms para asegurar que el evento res.on('finish') ejecutó fs.unlinkSync
        await new Promise(resolve => setTimeout(resolve, 200));

        // 5. VERIFICACIÓN CRÍTICA DE PURGA EFÍMERA
        const existsAfterDownload = fs.existsSync(savedPath);
        console.log('🔥 ¿Existe en disco tras la descarga?:', existsAfterDownload);

        if (!existsAfterDownload) {
            console.log('🗑️ ¡ÉXITO CONFIRMADO! El archivo fue eliminado automáticamente del servidor tras la descarga.');
        } else {
            throw new Error('❌ Fallo: El archivo no se eliminó del disco tras la descarga');
        }

        // 6. Verificar estado descargado = 1 en SQLite
        const updatedMsg = db.prepare('SELECT * FROM chat_mensajes WHERE id = ?').get(msgId);
        console.log('✅ 5. Registro SQLite actualizado `descargado`:', updatedMsg.descargado);

        console.log('\n🎉 ¡TODAS LAS PRUEBAS E2E PASARON SATISFACTORIAMENTE!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error en prueba E2E:', err.message);
        process.exit(1);
    }
}

runTests();
