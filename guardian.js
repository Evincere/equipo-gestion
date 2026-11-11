const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'data', 'service.log');

function log(msg) {
    const entry = `[${new Date().toISOString()}] ${msg}\n`;
    try {
        fs.appendFileSync(LOG_FILE, entry);
    } catch (e) {}
}

log('Iniciando guardián de Equipo Gestión...');

// Mantener el guardián permanentemente vivo en el event loop
setInterval(() => {}, 1000 * 60 * 60);

function startServer() {
    log('Arrancando server.js con soporte SQLite...');
    let outLog;
    try {
        outLog = fs.openSync(LOG_FILE, 'a');
    } catch (e) {
        outLog = 'ignore';
    }

    const child = spawn(process.execPath, ['--experimental-sqlite', 'server.js'], {
        cwd: __dirname,
        stdio: ['ignore', outLog, outLog],
        detached: true
    });

    child.on('exit', (code, signal) => {
        log(`El servidor se detuvo (código: ${code}, señal: ${signal}). Reiniciando en 2 segundos...`);
        if (typeof outLog === 'number') {
            try { fs.closeSync(outLog); } catch (e) {}
        }
        setTimeout(startServer, 2000);
    });

    child.on('error', (err) => {
        log(`Error al lanzar el servidor: ${err.message}. Reintentando en 5 segundos...`);
        if (typeof outLog === 'number') {
            try { fs.closeSync(outLog); } catch (e) {}
        }
        setTimeout(startServer, 5000);
    });
}

startServer();
