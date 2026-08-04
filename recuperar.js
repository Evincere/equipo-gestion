const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

// Detectar dónde está la base de datos realmente
let dbPath = path.join(__dirname, 'data', 'atenciones.db');
let csvPath = path.join(__dirname, 'data', 'atenciones.csv');

if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

const db = new DatabaseSync(dbPath);

// Asegurarnos de que la tabla exista para que no de error
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
        tarea_pendiente INTEGER DEFAULT 0,
        detalle_pendiente TEXT DEFAULT '',
        tarea_cumplida_at TEXT
    );
`);

const records = [
    { apellidos: "ALTAMIRANO", nombres: "DANIELA MARINA", dni: "27772976", motivo: "Espontánea", defensoria: "2° DEFENSORIA PENAL", resultado: "Deriva a A. Técnica", atendido_por: "Sergio M. Pereyra" },
    { apellidos: "CARDOZO", nombres: "JORGE HUMBERTO", dni: "11243041", motivo: "t-2876/22", defensoria: "1° DEFENSORIA PENAL", resultado: "Resuelve", atendido_por: "I. Molina" },
    { apellidos: "OLEA", nombres: "ROXANA", dni: "45719624", motivo: "Espontánea", defensoria: "Otro", resultado: "Resuelve", atendido_por: "A. Alonso" },
    { apellidos: "FABRICA", nombres: "CARLOS JAVIER", dni: "23713060", motivo: "DIVORCIO", defensoria: "DEF. CIVIL", resultado: "Resuelve", atendido_por: "J.P. Papini" },
    { apellidos: "CAMPOS", nombres: "KARINA ANDREA", dni: "", motivo: "Espontánea", defensoria: "Otro", resultado: "Deriva a otra repartición", atendido_por: "I. Molina" },
    { apellidos: "MOLINA", nombres: "MARTA DELIA", dni: "", motivo: "P-105390/24", defensoria: "3° DEFENSORIA PENAL", resultado: "Resuelve", atendido_por: "I. Molina" },
    { apellidos: "ESCOBAR", nombres: "OSCAR ABRAHAN", dni: "22093312", motivo: "Espontánea", defensoria: "Otro", resultado: "Resuelve", atendido_por: "A. Alonso" },
    { apellidos: "CHACON", nombres: "ANGELES", dni: "45853725", motivo: "Espontánea", defensoria: "DEF. CIVIL", resultado: "Deriva a A. Técnica", atendido_por: "Sergio M. Pereyra" },
    { apellidos: "ALANIZ", nombres: "ROSALIA DEL CARMEN", dni: "", motivo: "Espontánea", defensoria: "DEF. CIVIL", resultado: "Pendiente", atendido_por: "L. Alvarado", tarea_pendiente: 1, detalle_pendiente: "CARTA DOCUMENTO" },
    { apellidos: "FLORES LORENTE", nombres: "WALTER RODRIGO", dni: "45874955", motivo: "P-56829/26", defensoria: "2° DEFENSORIA PENAL", resultado: "Deriva a A. Técnica", atendido_por: "A. Alonso" },
    { apellidos: "MOLINA", nombres: "MARTA DELIA", dni: "14688900", motivo: "P-105390/24", defensoria: "3° DEFENSORIA PENAL", resultado: "Resuelve", atendido_por: "I. Molina" }
];

const stmt = db.prepare(`
    INSERT INTO atenciones (
        fecha, actividad, dni, apellidos, nombres, celular, expte, motivo,
        defensoria, resultado, observaciones, atendido_por, derivado_a, escritos,
        tarea_pendiente, detalle_pendiente
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

db.exec('BEGIN TRANSACTION');
let csvAppend = '';
for (const r of records.reverse()) {
    stmt.run(
        '04/08/2026', 'Atención Personal', r.dni, r.apellidos, r.nombres, '', '', r.motivo,
        r.defensoria, r.resultado, '', r.atendido_por, '', '', r.tarea_pendiente || 0, r.detalle_pendiente || ''
    );
    csvAppend += \`\\n"04/08/2026","Atención Personal","\${r.dni}","\${r.apellidos}","\${r.nombres}","","","\${r.motivo}","\${r.defensoria}","\${r.resultado}","","\${r.atendido_por}","",""\`;
}
db.exec('COMMIT');

fs.appendFileSync(csvPath, csvAppend, 'utf8');
console.log('✅ ' + records.length + ' registros restaurados exitosamente.');
