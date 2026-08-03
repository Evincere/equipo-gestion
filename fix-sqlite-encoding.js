const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'atenciones.db');
console.log(`🧹 Limpiando caracteres extraños (Mojibake) en Base de Datos SQLite: ${dbPath}`);

const db = new DatabaseSync(dbPath);

function fixMojibake(str) {
    if (!str) return '';
    try {
        const decoded = Buffer.from(str, 'latin1').toString('utf8');
        if (!decoded.includes('')) {
            return decoded;
        }
    } catch (e) {}
    
    return str
        .replace(/Ã‘/g, 'Ñ')
        .replace(/Ã’/g, 'Ñ')
        .replace(/Ã±/g, 'ñ')
        .replace(/Ã¡/g, 'á')
        .replace(/Ã©/g, 'é')
        .replace(/Ã­/g, 'í')
        .replace(/Ã³/g, 'ó')
        .replace(/Ãº/g, 'ú')
        .replace(/NÂ°/g, 'N°')
        .replace(/Â°/g, '°');
}

const rows = db.prepare('SELECT * FROM atenciones').all();

const updateStmt = db.prepare(`
    UPDATE atenciones SET
        actividad = ?,
        apellidos = ?,
        nombres = ?,
        motivo = ?,
        defensoria = ?,
        resultado = ?,
        observaciones = ?,
        atendido_por = ?,
        derivado_a = ?,
        escritos = ?
    WHERE id = ?
`);

db.exec('BEGIN TRANSACTION;');

let fixedCount = 0;
for (const row of rows) {
    const fixedActividad = fixMojibake(row.actividad);
    const fixedApellidos = fixMojibake(row.apellidos);
    const fixedNombres = fixMojibake(row.nombres);
    const fixedMotivo = fixMojibake(row.motivo);
    const fixedDefensoria = fixMojibake(row.defensoria);
    const fixedResultado = fixMojibake(row.resultado);
    const fixedObs = fixMojibake(row.observaciones);
    const fixedAtendido = fixMojibake(row.atendido_por);
    const fixedDerivado = fixMojibake(row.derivado_a);
    const fixedEscritos = fixMojibake(row.escritos);

    updateStmt.run(
        fixedActividad,
        fixedApellidos,
        fixedNombres,
        fixedMotivo,
        fixedDefensoria,
        fixedResultado,
        fixedObs,
        fixedAtendido,
        fixedDerivado,
        fixedEscritos,
        row.id
    );
    fixedCount++;
}

db.exec('COMMIT;');
console.log(`✅ ¡Limpieza de codificación completada! ${fixedCount} registros corregidos en SQLite.`);
