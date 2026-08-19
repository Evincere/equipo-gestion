const fs = require('fs');

const rawBuffer = fs.readFileSync('atenciones.csv');

// Probar lectura utf8 vs latin1/win1252
const utf8Str = rawBuffer.toString('utf8');
const latin1Str = rawBuffer.toString('latin1');

console.log('--- Muestra UTF-8 ---');
console.log(utf8Str.substring(0, 500));

console.log('\n--- Muestra LATIN1 ---');
console.log(latin1Str.substring(0, 500));
