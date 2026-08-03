const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, 'atenciones.csv');
const dataDir = path.join(__dirname, 'src', 'data');
const targetPath = path.join(dataDir, 'atencionesData.js');

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const csvContent = fs.readFileSync(csvPath, 'utf8');

const jsContent = `/**
 * Data Module fallback para la carga de atenciones.csv
 * Permite que la aplicación funcione tanto vía servidor web como directamente por file://
 */
export const ATENCIONES_CSV_DATA = ${JSON.stringify(csvContent)};
`;

fs.writeFileSync(targetPath, jsContent, 'utf8');
console.log('✅ Archivo src/data/atencionesData.js generado correctamente.');
