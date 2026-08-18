const http = require('http');
const assert = require('assert');
const { PlantillaEscrito } = require('../src/domain/entities/PlantillaEscrito');
const { DocumentRenderService } = require('../src/domain/services/DocumentRenderService');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

console.log('--- TEST 1: Domain Service & Entity ---');
const template = new PlantillaEscrito({
    id: 1,
    codigo: 'cambio_domicilio_penal',
    titulo: 'Cambio de Domicilio en Causa Penal',
    categoria: 'PENAL',
    sumario: 'INFORMA CAMBIO DE DOMICILIO REAL',
    cuerpoTemplate: 'Comparece {{CIUDADANO_NOMBRE}}, DNI N° {{DNI}}, fija domicilio en {{NUEVO_DOMICILIO}}. Expte: {{EXPTE}}, Defensoría: {{DEFENSORIA}}.',
    camposDinamicos: [{ key: 'NUEVO_DOMICILIO', label: 'Nuevo Domicilio', required: true }]
});

const rendered = DocumentRenderService.renderTemplate(template.cuerpoTemplate, {
    apellidos: 'PÉREZ',
    nombres: 'JUAN MANUEL',
    dni: '32123456',
    expte: 'P-12345/26',
    defensoria: '3ª DEFENSORÍA PENAL',
    NUEVO_DOMICILIO: 'Av. Mitre 1234, San Rafael, Mendoza'
});

console.log('Rendered text:', rendered);
assert(rendered.includes('PÉREZ JUAN MANUEL'), 'Should interpolate CIUDADANO_NOMBRE');
assert(rendered.includes('32.123.456'), 'Should format and interpolate DNI');
assert(rendered.includes('P-12345/26'), 'Should interpolate EXPTE');
assert(rendered.includes('3ª DEFENSORÍA PENAL'), 'Should interpolate DEFENSORIA');
assert(rendered.includes('Av. Mitre 1234, San Rafael, Mendoza'), 'Should interpolate custom dynamic field');
console.log('✅ TEST 1 Passed!');

const printableHtml = DocumentRenderService.generatePrintableHtml({
    titulo: template.titulo,
    sumario: template.sumario,
    cuerpoTexto: rendered,
    ciudadanoNombre: 'PÉREZ JUAN MANUEL',
    dni: '32123456',
    expte: 'P-12345/26',
    defensoria: '3ª DEFENSORÍA PENAL',
    operador: 'Operador Mesa',
    fecha: '15/08/2026'
});

assert(printableHtml.includes('Logo sin fondo 3-recortado.PNG'), 'Should contain MPD logo');
assert(printableHtml.toLowerCase().includes('ministerio público de la defensa'), 'Should contain MPD header');
assert(printableHtml.includes('INFORMA CAMBIO DE DOMICILIO REAL'), 'Should contain sumario');
console.log('✅ TEST 2 (Printable HTML) Passed!');

console.log('--- TEST 3: Database plantillas_escritos schema & initial seed ---');
const dbPath = path.join(__dirname, '..', 'data', 'atenciones.db');
const db = new DatabaseSync(dbPath);

const templates = db.prepare('SELECT * FROM plantillas_escritos WHERE activo = 1').all();
console.log('Active templates in DB:', templates.map(t => ({ codigo: t.codigo, titulo: t.titulo, cat: t.categoria })));
assert(templates.length >= 3, 'Should have at least 3 initial active templates');
assert(templates.some(t => t.codigo === 'cambio_domicilio_penal'), 'Should have cambio_domicilio_penal');
assert(templates.some(t => t.codigo === 'entrega_objetos_secuestrados'), 'Should have entrega_objetos_secuestrados');
assert(templates.some(t => t.codigo === 'escrito_general'), 'Should have escrito_general');
console.log('✅ TEST 3 (Database seeded templates) Passed!');

console.log('--- TEST 4: Database columns in atenciones ---');
const atencionesCols = db.prepare("PRAGMA table_info('atenciones')").all();
const colNames = atencionesCols.map(c => c.name);
assert(colNames.includes('plantilla_codigo'), 'atenciones should have plantilla_codigo column');
assert(colNames.includes('escritos_data'), 'atenciones should have escritos_data column');
console.log('✅ TEST 4 (atenciones columns) Passed!');

console.log('🎉 All automated tests passed successfully!');
db.close();
