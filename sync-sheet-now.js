const fs = require('fs');
const path = require('path');
const https = require('https');

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1palZNvG2-2RiIOibQiNcAeXqcdmPGoqK6tW3_01Nj1Y/export?format=csv&gid=41703451';
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

function normalizeFecha(fechaStr) {
    if (!fechaStr) return '';
    const parts = fechaStr.trim().split('/');
    if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        let year = parts[2];
        if (year.length === 2) year = '20' + year;
        return `${day}/${month}/${year}`;
    }
    return fechaStr.trim();
}

function fixMojibake(str) {
    if (!str) return '';
    return str
        .replace(/Ã‘/g, 'Ñ').replace(/Ã’/g, 'Ó').replace(/Ã“/g, 'Ó').replace(/Ã±/g, 'ñ')
        .replace(/Ã¡/g, 'á').replace(/Ã©/g, 'é').replace(/Ã­/g, 'í').replace(/Ã/g, 'Í')
        .replace(/Ã³/g, 'ó').replace(/Ãº/g, 'ú').replace(/Ãš/g, 'Ú').replace(/NÂ°/g, 'N°').replace(/Â°/g, '°');
}

async function run() {
    console.log('📡 Descargando Google Sheet en vivo para sincronización...');
    const rawCSV = await fetchCSV(SHEET_URL);
    const sheetLines = rawCSV.split(/\r\n|\n/);

    const localContent = fs.readFileSync(CSV_PATH, 'utf8');
    const localLines = localContent.split(/\r\n|\n/);
    
    // Crear conjunto de llaves existentes en local atenciones.csv
    const existingSet = new Set();
    localLines.forEach(l => {
        if (!l.trim()) return;
        const cols = parseCSVLine(l);
        const fecha = normalizeFecha(cols[0] ? cols[0].replace(/"/g, '') : '');
        const dni = cols[2] ? normalizeDNI(cols[2]) : '';
        const apellidos = cols[3] ? cols[3].replace(/"/g, '').trim().toUpperCase() : '';
        const expteOrMotivo = (cols[6] || cols[7] || '').replace(/"/g, '').trim().toUpperCase();

        if (fecha || dni || apellidos) {
            if (dni && apellidos) existingSet.add(`${fecha}|${dni}|${apellidos}`);
            if (dni && expteOrMotivo) existingSet.add(`${fecha}|${dni}|${expteOrMotivo}`);
            if (apellidos && expteOrMotivo) existingSet.add(`${fecha}|${apellidos}|${expteOrMotivo}`);
            if (dni) existingSet.add(`${fecha}|${dni}`);
        }
    });

    const newRows = [];
    let buffer = '';

    for (let i = 1; i < sheetLines.length; i++) {
        const rawLine = sheetLines[i];
        if (buffer) buffer += '\n' + rawLine;
        else buffer = rawLine;

        const quoteCount = (buffer.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) continue;

        const lineToParse = buffer.trim();
        buffer = '';
        if (!lineToParse) continue;

        const cols = parseCSVLine(lineToParse);
        if (cols.length < 4) continue;

        const fechaRaw = cols[0] ? cols[0].trim() : '';
        const fecha = normalizeFecha(fechaRaw);
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

        // Ignorar filas totalmente vacías de datos personales y de expediente
        if (!dniRaw && !apellidos && !nombres && !expte && !motivo && !observaciones) {
            continue;
        }

        const cleanDni = normalizeDNI(dniRaw);
        const expteOrMotivo = (expte || motivo || '').toUpperCase();
        const key1 = cleanDni && apellidos ? `${fecha}|${cleanDni}|${apellidos}` : '';
        const key2 = cleanDni && expteOrMotivo ? `${fecha}|${cleanDni}|${expteOrMotivo}` : '';
        const key3 = apellidos && expteOrMotivo ? `${fecha}|${apellidos}|${expteOrMotivo}` : '';
        const key4 = cleanDni ? `${fecha}|${cleanDni}` : '';

        if ((key4 && existingSet.has(key4)) || (key1 && existingSet.has(key1)) || (key2 && existingSet.has(key2)) || (key3 && existingSet.has(key3))) {
            continue;
        }

        newRows.push({
            fecha, actividad, dni: dniRaw, apellidos, nombres, celular, expte,
            motivo, defensoria, resultado, observaciones, atendidoPor, derivadoA, escritos
        });
    }

    console.log(`\n🎉 Insertando ${newRows.length} nuevos registros en atenciones.csv...`);
    let appendStr = '';
    newRows.forEach(r => {
        appendStr += `\n"${r.fecha}","${r.actividad}","${r.dni}","${r.apellidos}","${r.nombres}","${r.celular}","${r.expte}","${r.motivo}","${r.defensoria}","${r.resultado}","${r.observaciones}","${r.atendidoPor}","${r.derivadoA}","${r.escritos}"`;
    });

    fs.appendFileSync(CSV_PATH, appendStr, 'utf8');
    console.log('✅ atenciones.csv actualizado correctamente.');
}

run().catch(console.error);
