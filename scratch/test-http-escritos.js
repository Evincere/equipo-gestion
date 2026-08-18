const http = require('http');
const assert = require('assert');
const { DocumentRenderService } = require('../src/domain/services/DocumentRenderService');

function request(options, data) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    resolve({ status: res.statusCode, data: json });
                } catch(e) {
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

async function runTests() {
    console.log('🚀 Iniciando pruebas integrales HTTP del Módulo de Escritos y Plantillas...');

    // 0. Test Roster de Defensorías Penales & Zero Emojis
    console.log('\n--- TEST 0: Roster Oficial y Renderizado sin Emojis ---');
    const def1 = DocumentRenderService.getDefensoriaPenalOfficials('1ª DEFENSORÍA PENAL', 'titular');
    assert.strictEqual(def1.defensor, 'Dr. Jorge Luque');
    assert.strictEqual(def1.codefensora, 'Dra. Lourdes Braggio');

    const def2 = DocumentRenderService.getDefensoriaPenalOfficials('2ª DEFENSORÍA PENAL', 'codefensora');
    assert.strictEqual(def2.defensor, 'Dra. Daniela García');
    assert.strictEqual(def2.codefensora, 'Dra. Macarena Orozco');
    assert(def2.funcionarioTexto.includes('Dra. Macarena Orozco'));

    const def3 = DocumentRenderService.getDefensoriaPenalOfficials('3ª DEFENSORÍA PENAL', 'titular');
    assert.strictEqual(def3.defensor, 'Dr. Jorge Miguel Vitale');
    assert.strictEqual(def3.codefensora, 'Dra. Sofia Camerucci');
    assert(def3.funcionarioTexto.includes('Dr. Jorge Miguel Vitale'));

    console.log('✅ TEST 0 Passed! Roster de 1ª, 2ª y 3ª Defensorías Penales verificado.');

    // 1. GET /api/plantillas-escritos
    console.log('\n--- TEST 1: GET /api/plantillas-escritos ---');
    const resPlantillas = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/plantillas-escritos',
        method: 'GET'
    });
    assert.strictEqual(resPlantillas.status, 200);
    assert.strictEqual(resPlantillas.data.success, true);
    
    const cambioDom = resPlantillas.data.data.find(p => p.codigo === 'cambio_domicilio_penal');
    assert(cambioDom, 'Should have cambio_domicilio_penal');
    assert(cambioDom.destinatario_default.toLowerCase().includes('fiscal'), 'Destinatario default debe ser el Fiscal');
    assert(cambioDom.cuerpo_template.includes('SEÑOR/A FISCAL DE INSTRUCCIÓN:'), 'Debe dirigirse al Fiscal');
    assert(!cambioDom.cuerpo_template.includes('📍'), 'No debe contener emojis de mapa');
    assert(!cambioDom.cuerpo_template.includes('📞'), 'No debe contener emojis de teléfono');
    console.log('✅ TEST 1 Passed! Plantilla de Cambio de Domicilio dirigida al Fiscal y sin emojis.');

    // 2. Renderizado de Cambio de Domicilio para la 3ª Defensoría
    console.log('\n--- TEST 2: Renderizado Dinámico con Defensor/Codefensor ---');
    const renderedText = DocumentRenderService.renderTemplate(cambioDom.cuerpo_template, {
        apellidos: 'ZAPATA',
        nombres: 'FEDERICO',
        dni: '38111222',
        expte: 'P-5544/26',
        defensoria: '3ª DEFENSORÍA PENAL',
        FIRMANTE_DEFENSA: 'Defensor/a Oficial Titular',
        NUEVO_DOMICILIO: 'Calle Zapata 309',
        LOCALIDAD: 'San Rafael (Ciudad)',
        ENTRECALLES: 'Entre Av. Mitre y calle El Libertador',
        TELEFONO_CONTACTO: '2634515362'
    });

    console.log('Texto Renderizado:\n', renderedText);
    assert(renderedText.includes('SEÑOR/A FISCAL DE INSTRUCCIÓN:'), 'Debe encabezar al Fiscal');
    assert(renderedText.includes('Dr. Jorge Miguel Vitale'), 'Debe mencionar al Dr. Jorge Miguel Vitale para la 3ª');
    assert(renderedText.includes('ZAPATA FEDERICO'), 'Debe incluir al ciudadano asistido');
    assert(renderedText.includes('38.111.222'), 'Debe formatear el DNI');
    assert(renderedText.includes('- NUEVO DOMICILIO REAL: Calle Zapata 309'), 'Formato sobrio con guiones sin emojis');
    assert(renderedText.includes('- TELÉFONO DE CONTACTO / WHATSAPP: 2634515362'));
    console.log('✅ TEST 2 Passed!');

    // 3. POST /api/atenciones con Escrito
    console.log('\n--- TEST 3: POST /api/atenciones con Escrito y Tarea Pendiente ---');
    const newAtencion = {
        fecha: '15/08/2026',
        actividad: 'Atención Personal',
        dni: '38111222',
        apellidos: 'ZAPATA',
        nombres: 'FEDERICO',
        celular: '2634515362',
        expte: 'P-5544/26',
        motivo: 'Informa nuevo domicilio real',
        defensoria: '3ª DEFENSORÍA PENAL',
        resultado: 'Trámite / Confección Escrito',
        observaciones: 'Comparece espontáneamente',
        atendidoPor: 'spereyra',
        tareaPendiente: true,
        detallePendiente: 'Confección de Escrito: Informar Cambio de Domicilio Real (Penal)',
        plantillaCodigo: 'cambio_domicilio_penal',
        escritos: renderedText,
        escritosData: JSON.stringify({
            FIRMANTE_DEFENSA: 'Defensor/a Oficial Titular',
            NUEVO_DOMICILIO: 'Calle Zapata 309',
            LOCALIDAD: 'San Rafael (Ciudad)',
            ENTRECALLES: 'Entre Av. Mitre y calle El Libertador',
            TELEFONO_CONTACTO: '2634515362'
        })
    };

    const resPost = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/atenciones',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, newAtencion);

    assert(resPost.status === 200 || resPost.status === 201);
    const createdId = resPost.data.id;
    console.log('✅ TEST 3 Passed! Creado ID:', createdId);

    // 4. Cleanup
    await request({
        hostname: 'localhost',
        port: 3000,
        path: `/api/atenciones?id=${createdId}&operatorName=ADMIN`,
        method: 'DELETE'
    });

    console.log('\n🎉 ¡TODAS LAS PRUEBAS INTEGRALES PASARON SATISFACTORIAMENTE!');
}

runTests().catch(err => {
    console.error('❌ Error en pruebas:', err);
    process.exit(1);
});
