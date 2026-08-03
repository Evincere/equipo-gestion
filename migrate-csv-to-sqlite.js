const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const csvPath = path.join(__dirname, 'atenciones.csv');
const dbPath = process.env.DB_PATH || path.join(__dirname, 'atenciones.db');

console.log('🚀 Iniciando migración de atenciones.csv a SQLite...');
console.log(`📁 Destino Base de Datos: ${dbPath}`);

// 1. Crear / Conectar Base de Datos
const db = new DatabaseSync(dbPath);

// 2. Crear Estructura de Tabla e Índices
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_atenciones_dni ON atenciones(dni);
    CREATE INDEX IF NOT EXISTS idx_atenciones_expte ON atenciones(expte);
    CREATE INDEX IF NOT EXISTS idx_atenciones_defensoria ON atenciones(defensoria);
    CREATE INDEX IF NOT EXISTS idx_atenciones_apellidos ON atenciones(apellidos);
`);

console.log('✅ Tabla "atenciones" e índices creados correctamente.');

// 3. Parsear CSV
const csvText = fs.readFileSync(csvPath, 'utf8');
const lines = csvText.split(/\r\n|\n/);

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
        else current += char;
    }
    result.push(current);
    return result;
}

const insertStmt = db.prepare(`
    INSERT INTO atenciones (
        fecha, actividad, dni, apellidos, nombres, celular, expte, motivo,
        defensoria, resultado, observaciones, atendido_por, derivado_a, escritos
    ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
`);

let insertedCount = 0;

db.exec('BEGIN TRANSACTION;');

try {
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = parseCSVLine(line);
        if (cols.length < 4) continue;

        const fecha = cols[0] ? cols[0].trim() : '';
        const actividad = cols[1] ? cols[1].trim() : '';
        const dni = cols[2] ? cols[2].trim() : '';
        const apellidos = cols[3] ? cols[3].trim() : '';
        const nombres = cols[4] ? cols[4].trim() : '';
        const celular = cols[5] ? cols[5].trim() : '';
        const expte = cols[6] ? cols[6].trim() : '';
        const motivo = cols[7] ? cols[7].trim() : '';
        const defensoria = cols[8] ? cols[8].trim() : '';
        const resultado = cols[9] ? cols[9].trim() : '';
        const observaciones = cols[10] ? cols[10].trim() : '';
        const atendidoPor = cols[11] ? cols[11].trim() : '';
        const derivadoA = cols[12] ? cols[12].trim() : '';
        const escritos = cols[13] ? cols[13].trim() : '';

        if (fecha || apellidos || dni) {
            insertStmt.run(
                fecha, actividad, dni, apellidos, nombres, celular, expte, motivo,
                defensoria, resultado, observaciones, atendidoPor, derivadoA, escritos
            );
            insertedCount++;
        }
    }
    db.exec('COMMIT;');
    console.log(`🎉 Migración completada exitosamente. Total de registros insertados en SQLite: ${insertedCount}`);
} catch (error) {
    db.exec('ROLLBACK;');
    console.error('❌ Error durante la migración:', error);
}
