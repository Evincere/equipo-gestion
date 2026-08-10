const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('e:/Apps/equipo-gestion/data/atenciones.db');

// Ver todos los registros del 05/08/2026 de CO-DEF. FAMILIA con datos completos
const rows = db.prepare(
  "SELECT id, apellidos, nombres, dni, atendido_por, codefensora_asignada, modo_derivacion_familia FROM atenciones WHERE defensoria='CO-DEF. FAMILIA' AND fecha='05/08/2026' ORDER BY id"
).all();
console.log("Registros CO-DEF. FAMILIA 05/08/2026:");
console.log(JSON.stringify(rows, null, 2));

// Ver también el último UPDATE ejecutado mirando el max(rowid)
const last = db.prepare("SELECT id, apellidos, nombres, atendido_por, codefensora_asignada FROM atenciones ORDER BY rowid DESC LIMIT 5").all();
console.log("\nÚltimos 5 por rowid:");
console.log(JSON.stringify(last, null, 2));
