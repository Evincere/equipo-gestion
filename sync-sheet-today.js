const fs = require('fs');
const path = require('path');
const https = require('https');
const { DatabaseSync } = require('node:sqlite');

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1palZNvG2-2RiIOibQiNcAeXqcdmPGoqK6tW3_01Nj1Y/export?format=csv&gid=41703451';
const DB_PATH = path.join(__dirname, 'atenciones.db');
const CSV_PATH = path.join(__dirname, 'atenciones.csv');

function fetchCSV(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchCSV(res.headers.location).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

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

function normalizeDNI(dniStr) {
    if (!dniStr) return '';
    return dniStr.replace(/\D/g, '');
}

function fixMojibake(str) {
    if (!str) return '';
    return str
        .replace(/Ã‘/g, 'Ñ').replace(/Ã’/g, 'Ó').replace(/Ã“/g, 'Ó').replace(/Ã±/g, 'ñ')
        .replace(/Ã¡/g, 'á').replace(/Ã©/g, 'é').replace(/Ã­/g, 'í').replace(/Ã/g, 'Í')
        .replace(/Ã³/g, 'ó').replace(/Ãº/g, 'ú').replace(/Ãš/g, 'Ú').replace(/NÂ°/g, 'N°').replace(/Â°/g, '°');
}

async function run() {
    console.log('📡 Descargando planilla en vivo desde Google Sheets...');
    const rawCSV = await fetchCSV(SHEET_URL);
    const lines = rawCSV.split(/\r\n|\n/);
    console.log(`📄 Total de líneas obtenidas del Google Sheet: ${lines.length}`);

    const db = new DatabaseSync(DB_PATH);
    
    // Obtener DNI y Fecha de registros existentes en SQLite
    const existing = db.prepare('SELECT fecha, dni, apellidos, nombres, expte, motivo FROM atenciones').all();
    const existingSet = new Set();
    existing.forEach(r => {
        const cleanDni = normalizeDNI(r.dni);
        const key = `${r.fecha}|${cleanDni}|${(r.apellidos||'').toUpperCase()}|${(r.expte||r.motivo||'').toUpperCase()}`;
        existingSet.add(key);
        if (cleanDni) existingSet.add(`${r.fecha}|${cleanDni}`);
    });

    const newRecords = [];
    let buffer = '';

    for (let i = 1; i < lines.length; i++) {
        const rawLine = lines[i];
        if (buffer) buffer += '\n' + rawLine;
        else buffer = rawLine;

        const quoteCount = (buffer.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) continue;

        const lineToParse = buffer.trim();
        buffer = '';
        if (!lineToParse) continue;

        const cols = parseCSVLine(lineToParse);
        if (cols.length < 4) continue;

        const fecha = cols[0] ? cols[0].trim() : '';
        const actividad = cols[1] ? cols[1].trim() : 'Atención Personal';
        const dniRaw = cols[2] ? cols[2].trim() : '';
        const apellidos = cols[3] ? fixMojibake(cols[3].trim()).toUpperCase() : '';
        const nombres = cols[4] ? fixMojibake(cols[4].trim()).toUpperCase() : '';
        const celular = cols[5] ? cols[5].trim() : '';
        const expte = cols[6] ? cols[6].trim() : '';
        const motivo = cols[7] ? fixMojibake(cols[7].trim()) : '';
        const defensoria = cols[8] ? cols[8].trim() : 'Otro';
        const resultado = cols[9] ? cols[9].trim() : 'Resuelve';
        const observaciones = cols[10] ? fixMojibake(cols[10].trim()) : '';
        const atendidoPor = cols[11] ? cols[11].trim() : 'Secretaría';
        const derivadoA = cols[12] ? cols[12].trim() : '';
        const escritos = cols[13] ? cols[13].trim() : '';

        if (!fecha && !dniRaw && !apellidos) continue;

        const cleanDni = normalizeDNI(dniRaw);
        const key1 = `${fecha}|${cleanDni}|${apellidos}|${(expte||motivo||'').toUpperCase()}`;
        const key2 = `${fecha}|${cleanDni}`;

        if (cleanDni && existingSet.has(key2)) continue;
        if (existingSet.has(key1)) continue;

        newRecords.push({
            fecha, actividad, dni: dniRaw, apellidos, nombres, celular, expte,
            motivo, defensoria, resultado, observaciones, atendidoPor, derivadoA, escritos
        });
    }

    console.log(`✨ Se encontraron ${newRecords.length} nuevos registros para sincronizar.`);

    if (newRecords.length === 0) {
        console.log('✅ Todos los registros ya están al día.');
        return;
    }

    const insertStmt = db.prepare(`
        INSERT INTO atenciones (
            fecha, actividad, dni, apellidos, nombres, celular, expte, motivo,
            defensoria, resultado, observaciones, atendido_por, derivado_a, escritos
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.exec('BEGIN TRANSACTION');
    let csvAppend = '';

    newRecords.forEach(r => {
        insertStmt.run(
            r.fecha, r.actividad, r.dni, r.apellidos, r.nombres, r.celular,
            r.expte, r.motivo, r.defensoria, r.resultado, r.observaciones,
            r.atendidoPor, r.derivadoA, r.escritos
        );
        csvAppend += `\n"${r.fecha}","${r.actividad}","${r.dni}","${r.apellidos}","${r.nombres}","${r.celular}","${r.expte}","${r.motivo}","${r.defensoria}","${r.resultado}","${r.observaciones}","${r.atendidoPor}","${r.derivadoA}","${r.escritos}"`;
    });

    db.exec('COMMIT');
    fs.appendFileSync(CSV_PATH, csvAppend, 'utf8');

    console.log(`🎉 ¡Sincronización exitosa! ${newRecords.length} registros insertados en SQLite y atenciones.csv.`);
}

run().catch(err => console.error('❌ Error sincronizando:', err));
