const http = require('http');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'atenciones.db');
const CSV_BACKUP_PATH = path.join(__dirname, 'data', 'atenciones.csv');

console.log(`\n==================================================`);
console.log(`🏛️ Conectando a Base de Datos SQLite: ${DB_PATH}`);
console.log(`==================================================`);

const db = new DatabaseSync(DB_PATH);

// Inicializar tablas
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

    CREATE TABLE IF NOT EXISTS codefensoras_estado (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT UNIQUE NOT NULL,
        is_presente INTEGER DEFAULT 1,
        motivo_ausencia TEXT DEFAULT '',
        orden INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rotacion_turnos (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        last_index INTEGER DEFAULT -1
    );

    INSERT OR IGNORE INTO rotacion_turnos (id, last_index) VALUES (1, -1);

    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        nombre_completo TEXT NOT NULL,
        rol TEXT DEFAULT 'OPERADOR',
        password_hash TEXT NOT NULL,
        avatar_initials TEXT,
        activo INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS auditoria_acciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER,
        usuario_nombre TEXT NOT NULL,
        accion TEXT NOT NULL,
        detalle TEXT,
        ip TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chat_mensajes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        emisor_username TEXT NOT NULL,
        receptor_username TEXT NOT NULL,
        mensaje TEXT,
        tipo TEXT DEFAULT 'TEXT',
        archivo_nombre TEXT,
        archivo_ruta TEXT,
        archivo_tamano INTEGER,
        archivo_mime TEXT,
        descargado INTEGER DEFAULT 0,
        leido INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_chat_users ON chat_mensajes(emisor_username, receptor_username);
`);

const CHAT_UPLOADS_DIR = path.join(__dirname, 'data', 'uploads', 'chat');
if (!fs.existsSync(CHAT_UPLOADS_DIR)) {
    fs.mkdirSync(CHAT_UPLOADS_DIR, { recursive: true });
}

// Migración suave para agregar columnas de tareas pendientes y co-defensoría de familia por canal
try { db.exec('ALTER TABLE atenciones ADD COLUMN tarea_pendiente INTEGER DEFAULT 0;'); } catch (e) {}
try { db.exec('ALTER TABLE atenciones ADD COLUMN detalle_pendiente TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE atenciones ADD COLUMN tarea_cumplida_at DATETIME;'); } catch (e) {}
try { db.exec('ALTER TABLE atenciones ADD COLUMN modo_derivacion_familia TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE atenciones ADD COLUMN codefensora_asignada TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE atenciones ADD COLUMN fecha_vencimiento_contestacion TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE atenciones ADD COLUMN detalle_reparticion TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE codefensoras_estado ADD COLUMN orden INTEGER DEFAULT 0;'); } catch (e) {}

// Nueva estructura de rotación de turnos por canal independiente
db.exec(`
    CREATE TABLE IF NOT EXISTS rotacion_turnos_canales (
        canal TEXT PRIMARY KEY,
        last_index INTEGER DEFAULT -1
    );

    CREATE TABLE IF NOT EXISTS orden_rotacion_canales (
        canal TEXT NOT NULL,
        nombre TEXT NOT NULL,
        orden INTEGER DEFAULT 0,
        PRIMARY KEY (canal, nombre)
    );
`);

db.exec(`
    INSERT OR IGNORE INTO rotacion_turnos_canales (canal, last_index) VALUES ('ASESORAMIENTO_GENERAL', -1);
    INSERT OR IGNORE INTO rotacion_turnos_canales (canal, last_index) VALUES ('CAUSA_NUEVA', -1);
    INSERT OR IGNORE INTO rotacion_turnos_canales (canal, last_index) VALUES ('CONTESTACION_DEMANDA', -1);
    INSERT OR IGNORE INTO rotacion_turnos_canales (canal, last_index) VALUES ('ADOPCION', -1);
`);

// Índices
db.exec(`
    CREATE TABLE IF NOT EXISTS catalogos_opciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        categoria TEXT NOT NULL,
        valor TEXT NOT NULL,
        activo INTEGER DEFAULT 1,
        orden INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_catalogos_cat ON catalogos_opciones(categoria);
`);

// Sembrado dinámico de catálogos de opciones del formulario si está vacío
const checkCatalogos = db.prepare('SELECT COUNT(*) as count FROM catalogos_opciones').get();
if (checkCatalogos.count === 0) {
    const seedCatStmt = db.prepare('INSERT INTO catalogos_opciones (categoria, valor, activo, orden) VALUES (?, ?, 1, ?)');
    const defaultCatalogos = [
        { cat: 'actividad', val: 'Atención Personal', ord: 1 },
        { cat: 'actividad', val: 'Atención Telefónica', ord: 2 },
        { cat: 'actividad', val: 'Atención WhatsApp / Digital', ord: 3 },
        { cat: 'actividad', val: 'Mesa de Entrada', ord: 4 },
        { cat: 'actividad', val: 'Oficio / Escrito', ord: 5 },

        { cat: 'defensoria', val: 'CO-DEF. FAMILIA', ord: 1 },
        { cat: 'defensoria', val: '1° DEFENSORIA PENAL', ord: 2 },
        { cat: 'defensoria', val: '2° DEFENSORIA PENAL', ord: 3 },
        { cat: 'defensoria', val: '3° DEFENSORIA PENAL', ord: 4 },
        { cat: 'defensoria', val: 'PENAL', ord: 5 },
        { cat: 'defensoria', val: 'DEF. CIVIL', ord: 6 },
        { cat: 'defensoria', val: 'DEF. EJECUCION', ord: 7 },
        { cat: 'defensoria', val: 'ASESORIA DE NIÑEZ', ord: 8 },
        { cat: 'defensoria', val: 'ASISTENCIA TECNICA', ord: 9 },
        { cat: 'defensoria', val: 'Otro', ord: 10 },

        { cat: 'motivo', val: 'Espontánea', ord: 1 },
        { cat: 'motivo', val: 'Causa Trámite', ord: 2 },
        { cat: 'motivo', val: 'Aud. Fijada', ord: 3 },
        { cat: 'motivo', val: 'Divorcio', ord: 4 },
        { cat: 'motivo', val: 'Ejecución', ord: 5 },
        { cat: 'motivo', val: 'Turno', ord: 6 },
        { cat: 'motivo', val: 'Aud. Imputación', ord: 7 },
        { cat: 'motivo', val: 'Otro', ord: 8 },

        { cat: 'resultado', val: 'Resuelve', ord: 1 },
        { cat: 'resultado', val: 'Deriva a CO-DEF- FAMILIA', ord: 2 },
        { cat: 'resultado', val: 'Deriva a A. Técnica', ord: 3 },
        { cat: 'resultado', val: 'Fija Audiencia', ord: 4 },
        { cat: 'resultado', val: 'Deriva a Niñez / Capacidad', ord: 5 },
        { cat: 'resultado', val: 'Otro', ord: 6 },

        { cat: 'submotivo_familia', val: 'Mediación', ord: 1 },
        { cat: 'submotivo_familia', val: 'Prohibición de Acercamiento / Exclusión', ord: 2 },
        { cat: 'submotivo_familia', val: 'Alimentos / Liquidación / Cese', ord: 3 },
        { cat: 'submotivo_familia', val: 'Filiación / Presunta Filiación', ord: 4 },
        { cat: 'submotivo_familia', val: 'Impugnación / Supresión de Apellido', ord: 5 },
        { cat: 'submotivo_familia', val: 'Guarda Judicial / Tutela / Adopción', ord: 6 },
        { cat: 'submotivo_familia', val: 'Medidas de Protección ETI / Vulnerabilidad', ord: 7 },
        { cat: 'submotivo_familia', val: 'Cuidado Personal / Régimen de Contacto', ord: 8 },
        { cat: 'submotivo_familia', val: 'Determinación de Capacidad', ord: 9 },
        { cat: 'submotivo_familia', val: 'Reintegro', ord: 10 },
        { cat: 'submotivo_familia', val: 'Restitución Internacional', ord: 11 },
        { cat: 'submotivo_familia', val: 'Otro / Asesoramiento General', ord: 12 },

        { cat: 'modo_derivacion_familia', val: 'Asesoramiento General', ord: 1 },
        { cat: 'modo_derivacion_familia', val: 'Causa Nueva', ord: 2 },
        { cat: 'modo_derivacion_familia', val: 'Contestación de Demanda', ord: 3 },
        { cat: 'modo_derivacion_familia', val: 'Guarda Judicial / Tutela / Adopción', ord: 4 },
        { cat: 'modo_derivacion_familia', val: 'Causa en Trámite', ord: 5 },
        { cat: 'modo_derivacion_familia', val: 'Otro', ord: 6 },

        { cat: 'derivado_a', val: 'L. Alvarado', ord: 1 },
        { cat: 'derivado_a', val: 'J.P. Papini', ord: 2 },
        { cat: 'derivado_a', val: 'C. Gimenez', ord: 3 },
        { cat: 'derivado_a', val: 'I. Molina', ord: 4 },
        { cat: 'derivado_a', val: 'S. Camerucci', ord: 5 },
        { cat: 'derivado_a', val: 'A. Sanchez', ord: 6 },
        { cat: 'derivado_a', val: 'ETI / Medidas de Protección', ord: 7 },
        { cat: 'derivado_a', val: 'Psicología / Trabajo Social', ord: 8 },
        { cat: 'derivado_a', val: 'Asesoría de Niñez / Capacidad', ord: 9 },
        { cat: 'derivado_a', val: 'Otras Asistencias Técnicas', ord: 10 }
    ];
    defaultCatalogos.forEach(item => {
        seedCatStmt.run(item.cat, item.val, item.ord);
    });
}

// Asegurar que modo_derivacion_familia tenga sus opciones iniciales incluida "Otro"
try {
    const modoDefaults = [
        'Asesoramiento General',
        'Causa Nueva',
        'Contestación de Demanda',
        'Guarda Judicial / Tutela / Adopción',
        'Causa en Trámite',
        'Otro'
    ];
    modoDefaults.forEach((val, idx) => {
        const exists = db.prepare("SELECT id FROM catalogos_opciones WHERE categoria = 'modo_derivacion_familia' AND valor = ?").get(val);
        if (!exists) {
            db.prepare("INSERT INTO catalogos_opciones (categoria, valor, activo, orden) VALUES ('modo_derivacion_familia', ?, 1, ?)").run(val, idx + 1);
        }
    });
} catch (e) {}

// Restaurar atenciones.csv original si el volumen está vacío
const ORIGINAL_CSV_PATH = path.join(__dirname, 'atenciones.csv');
if (!fs.existsSync(CSV_BACKUP_PATH) && fs.existsSync(ORIGINAL_CSV_PATH)) {
    console.log('🔄 Volumen vacío detectado: Copiando atenciones.csv original al volumen persistente...');
    if (!fs.existsSync(path.join(__dirname, 'data'))) {
        fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
    }
    fs.copyFileSync(ORIGINAL_CSV_PATH, CSV_BACKUP_PATH);
}

// Sembrado automático de atenciones desde atenciones.csv si la tabla está vacía
const checkAtenciones = db.prepare('SELECT COUNT(*) as count FROM atenciones').get();
if (checkAtenciones.count === 0 && fs.existsSync(CSV_BACKUP_PATH)) {
    console.log('📦 Sembrando atenciones iniciales desde atenciones.csv...');
    try {
        const csvContent = fs.readFileSync(CSV_BACKUP_PATH, 'utf8');
        const lines = csvContent.split(/\r\n|\n/);
        
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
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let count = 0;
        let buffer = '';

        db.exec('BEGIN TRANSACTION');

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

            if (cols[0] || cols[2] || cols[3] || cols[7]) {
                count++;
                insertStmt.run(
                    cols[0] ? cols[0].trim() : 'S/F',
                    cols[1] ? cols[1].trim() : 'Atención Personal',
                    cols[2] ? cols[2].trim() : '',
                    cols[3] ? cols[3].trim().toUpperCase() : 'SIN REGISTRO',
                    cols[4] ? cols[4].trim().toUpperCase() : '',
                    cols[5] ? cols[5].trim() : '',
                    cols[6] ? cols[6].trim() : '',
                    cols[7] ? cols[7].trim() : '',
                    cols[8] ? cols[8].trim() : 'Otro',
                    cols[9] ? cols[9].trim() : 'Resuelve',
                    cols[10] ? cols[10].trim() : '',
                    cols[11] ? cols[11].trim() : 'Secretaría',
                    cols[12] ? cols[12].trim() : '',
                    cols[13] ? cols[13].trim() : ''
                );
            }
        }
        db.exec('COMMIT');
        console.log(`✅ ¡Sembrado automático completado! ${count} registros importados a SQLite en <1s.`);
    } catch (e) {
        try { db.exec('ROLLBACK'); } catch (_) {}
        console.error('❌ Error sembrando atenciones desde CSV:', e.message);
    }
}

// Sembrado e inicialización del orden canónico de Co-Defensoras y turnos
try {
    const defaultRoster = [
        { id: 1, nombre: 'Mariela Fokszek' },
        { id: 2, nombre: 'Andrea Lombard' },
        { id: 3, nombre: 'Claudia Perruzzi' },
        { id: 4, nombre: 'Luz Perez' }
    ];

    const existingStates = db.prepare('SELECT nombre, is_presente, motivo_ausencia FROM codefensoras_estado').all();
    const presenceMap = {};
    existingStates.forEach(r => {
        presenceMap[r.nombre] = { is_presente: r.is_presente, motivo_ausencia: r.motivo_ausencia };
    });

    db.exec('DELETE FROM codefensoras_estado;');
    const insertStmt = db.prepare('INSERT INTO codefensoras_estado (id, nombre, is_presente, motivo_ausencia) VALUES (?, ?, ?, ?)');
    defaultRoster.forEach(c => {
        const prev = presenceMap[c.nombre] || { is_presente: 1, motivo_ausencia: '' };
        insertStmt.run(c.id, c.nombre, Number(prev.is_presente), prev.motivo_ausencia || '');
    });

    // Sincronizar última Co-Defensora asignada en cada canal según planillas oficiales:
    // ASESORAMIENTO_GENERAL: última fue Luz Perez (index 3) -> próxima será Mariela Fokszek
    // CAUSA_NUEVA: última fue Mariela Fokszek (index 0) -> próxima será Andrea Lombard
    // CONTESTACION_DEMANDA: última fue Luz Perez (index 3) -> próxima será Mariela Fokszek
    // ADOPCION: última fue Mariela Fokszek (index 0) -> próxima será Andrea Lombard
    db.prepare("INSERT OR REPLACE INTO rotacion_turnos_canales (canal, last_index) VALUES ('ASESORAMIENTO_GENERAL', 3)").run();
    db.prepare("INSERT OR REPLACE INTO rotacion_turnos_canales (canal, last_index) VALUES ('CAUSA_NUEVA', 0)").run();
    db.prepare("INSERT OR REPLACE INTO rotacion_turnos_canales (canal, last_index) VALUES ('CONTESTACION_DEMANDA', 3)").run();
    db.prepare("INSERT OR REPLACE INTO rotacion_turnos_canales (canal, last_index) VALUES ('ADOPCION', 0)").run();
} catch (e) {
    console.warn('Error inicializando orden de co-defensoras:', e.message);
}

const checkUsers = db.prepare('SELECT COUNT(*) as count FROM usuarios').get();
if (checkUsers.count === 0) {
    const seedUserStmt = db.prepare('INSERT INTO usuarios (username, nombre_completo, rol, password_hash, avatar_initials, activo) VALUES (?, ?, ?, ?, ?, 1)');
    seedUserStmt.run('spereyra', 'Sergio M. Pereyra', 'ADMINISTRADOR', 'admin2026', 'SP');
    seedUserStmt.run('jppapini', 'J.P. Papini', 'OPERADOR', 'defensoria2026', 'JP');
    seedUserStmt.run('aalonso', 'A. Alonso', 'OPERADOR', 'defensoria2026', 'AA');
    seedUserStmt.run('imolina', 'I. Molina', 'OPERADOR', 'defensoria2026', 'IM');
    seedUserStmt.run('scamerucci', 'S. Camerucci', 'OPERADOR', 'defensoria2026', 'SC');
    seedUserStmt.run('cgimenez', 'C. Gimenez', 'OPERADOR', 'defensoria2026', 'CG');
    seedUserStmt.run('asanchez', 'A. Sanchez', 'OPERADOR', 'defensoria2026', 'AS');
    seedUserStmt.run('lalvarado', 'L. Alvarado', 'OPERADOR', 'defensoria2026', 'LA');
    seedUserStmt.run('mguerrero', 'Martin Guerrero', 'OPERADOR', '123456', 'MG');
    seedUserStmt.run('mtosetto', 'Marcos Tosetto', 'OPERADOR', '123456', 'MT');
}

function logAudit(usuarioId, usuarioNombre, accion, detalle, ip = '127.0.0.1') {
    try {
        const stmt = db.prepare('INSERT INTO auditoria_acciones (usuario_id, usuario_nombre, accion, detalle, ip) VALUES (?, ?, ?, ?, ?)');
        stmt.run(usuarioId || 0, usuarioNombre || 'SISTEMA', accion, detalle || '', ip);
    } catch (e) {}
}

const MIME_TYPES = {
    '.html': 'text/html; charset=UTF-8',
    '.css': 'text/css; charset=UTF-8',
    '.js': 'text/javascript; charset=UTF-8',
    '.json': 'application/json; charset=UTF-8',
    '.csv': 'text/csv; charset=UTF-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    if (pathname === '/favicon.ico') {
        const iconPath = path.join(PUBLIC_DIR, 'logo_icon.png');
        if (fs.existsSync(iconPath)) {
            res.writeHead(200, { 'Content-Type': 'image/png' });
            res.end(fs.readFileSync(iconPath));
            return;
        } else {
            res.writeHead(204);
            res.end();
            return;
        }
    }

    // REST API Endpoints
    if (pathname === '/api/atenciones') {
        if (req.method === 'GET') return handleGetAtenciones(req, res, parsedUrl);
        if (req.method === 'POST') return handlePostAtencion(req, res);
        if (req.method === 'PUT') return handlePutAtencion(req, res);
        if (req.method === 'DELETE') return handleDeleteAtencion(req, res, parsedUrl);
    }

    if (pathname === '/api/atenciones/tarea-estado' && req.method === 'POST') {
        return handlePostCambiarEstadoTarea(req, res);
    }

    if (pathname === '/api/ciudadanos/historial') {
        if (req.method === 'GET') return handleGetCiudadanoHistorial(req, res, parsedUrl);
    }

    if (pathname === '/api/atenciones/historial-familia') {
        if (req.method === 'GET') return handleGetHistorialFamilia(req, res, parsedUrl);
    }

    if (pathname === '/api/familia/codefensoras') {
        if (req.method === 'GET') return handleGetCodefensoras(req, res);
    }

    if (pathname === '/api/familia/codefensoras/estado') {
        if (req.method === 'POST') return handlePostEstadoCodefensora(req, res);
    }

    if (pathname === '/api/familia/codefensoras/reordenar') {
        if (req.method === 'POST') return handlePostReordenarCodefensora(req, res);
    }

    if (pathname === '/api/familia/codefensoras/reordenar-canal') {
        if (req.method === 'POST') return handlePostReordenarCanalCodefensora(req, res);
    }

    if (pathname === '/api/familia/turnos/asignar-proximo') {
        if (req.method === 'POST') return handlePostAsignarProximoTurno(req, res);
    }

    if (pathname === '/api/familia/proximo-turno') {
        if (req.method === 'GET') return handleGetProximoTurno(req, res, parsedUrl);
    }

    if (pathname === '/api/auth/login' && req.method === 'POST') {
        return handleLogin(req, res);
    }

    if (pathname === '/api/auth/users' && req.method === 'GET') {
        return handleGetPublicUserList(req, res);
    }

    if (pathname === '/api/catalogos' && req.method === 'GET') {
        return handleGetCatalogos(req, res);
    }

    if (pathname === '/api/admin/catalogos') {
        if (req.method === 'GET') return handleAdminGetCatalogos(req, res);
        if (req.method === 'POST') return handleAdminPostCatalogo(req, res);
        if (req.method === 'DELETE') return handleAdminDeleteCatalogo(req, res, parsedUrl);
    }

    if (pathname === '/api/admin/usuarios') {
        if (req.method === 'GET') return handleAdminGetUsuarios(req, res);
        if (req.method === 'POST') return handleAdminPostUsuario(req, res);
    }

    if (pathname === '/api/admin/usuarios/baja' && req.method === 'POST') {
        return handleAdminBajaUsuario(req, res);
    }

    if (pathname === '/api/admin/auditoria' && req.method === 'GET') {
        return handleAdminGetAuditoria(req, res);
    }

    if (pathname === '/api/admin/backup-db' && req.method === 'GET') {
        return handleAdminBackupDB(req, res);
    }

    if (pathname === '/api/admin/rotacion/reset' && req.method === 'POST') {
        return handleAdminResetRotacion(req, res);
    }

    if (pathname === '/api/admin/rotacion/canal' && req.method === 'POST') {
        return handleAdminAjustarCanal(req, res);
    }

    if (pathname === '/api/chat/historial' && req.method === 'GET') {
        return handleGetChatHistorial(req, res, parsedUrl);
    }

    if (pathname === '/api/chat/upload' && req.method === 'POST') {
        return handlePostChatUpload(req, res);
    }

    if (pathname.startsWith('/api/chat/descargar/') && req.method === 'GET') {
        return handleGetChatDescargar(req, res, pathname);
    }

    if (pathname === '/api/chat/marcar-leidos' && req.method === 'POST') {
        return handlePostChatMarcarLeidos(req, res);
    }

    if (pathname === '/api/chat/unread-count' && req.method === 'GET') {
        return handleGetChatUnreadCount(req, res, parsedUrl);
    }

    if (pathname === '/api/usuarios/heartbeat' && req.method === 'POST') {
        return handlePostHeartbeat(req, res);
    }

    if (pathname === '/api/usuarios/online' && req.method === 'GET') {
        return handleGetOnlineUsers(req, res);
    }

    // Servidor Estático
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'dashboard.html' : pathname);
    filePath = path.normalize(filePath);

    if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        res.end('403 Prohibido');
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 No Encontrado</h1>');
            } else {
                res.writeHead(500);
                res.end(`Error del Servidor: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Handlers API REST
function handleGetAtenciones(req, res, parsedUrl) {
    try {
        const query = parsedUrl.searchParams.get('query') || '';
        const defensoria = parsedUrl.searchParams.get('defensoria') || '';
        const resultado = parsedUrl.searchParams.get('resultado') || '';
        const soloPendientes = parsedUrl.searchParams.get('soloPendientes') === 'true';

        let sql = `SELECT * FROM atenciones WHERE 1=1`;
        const params = [];

        if (query) {
            sql += ` AND (dni LIKE ? OR apellidos LIKE ? OR nombres LIKE ? OR expte LIKE ? OR observaciones LIKE ? OR detalle_pendiente LIKE ?)`;
            const q = `%${query}%`;
            params.push(q, q, q, q, q, q);
        }

        if (defensoria) {
            sql += ` AND defensoria = ?`;
            params.push(defensoria);
        }

        if (resultado) {
            sql += ` AND resultado = ?`;
            params.push(resultado);
        }

        if (soloPendientes) {
            sql += ` AND tarea_pendiente = 1`;
        }

        sql += ` ORDER BY id DESC`;

        const stmt = db.prepare(sql);
        const rows = stmt.all(...params);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(JSON.stringify({ success: true, count: rows.length, data: rows }));
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
    }
}

function handleGetCiudadanoHistorial(req, res, parsedUrl) {
    try {
        const dniRaw = parsedUrl.searchParams.get('dni') || '';
        const cleanDni = dniRaw.replace(/[^\d]/g, '').trim();

        if (!cleanDni) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'DNI no proporcionado' }));
            return;
        }

        const stmt = db.prepare('SELECT * FROM atenciones WHERE dni LIKE ? OR REPLACE(dni, ".", "") = ? ORDER BY id DESC');
        const rows = stmt.all(`%${cleanDni}%`, cleanDni);

        if (rows.length > 0) {
            const latest = rows[0];
            res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({
                success: true,
                found: true,
                personalData: {
                    dni: latest.dni,
                    apellidos: latest.apellidos,
                    nombres: latest.nombres,
                    celular: latest.celular
                },
                historyCount: rows.length,
                history: rows
            }));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({
                success: true,
                found: false,
                message: 'Ciudadano no registrado previamente.'
            }));
        }
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
    }
}

function advanceTurnoCanal(canalKey) {
    const canalMap = {
        'Asesoramiento General': 'ASESORAMIENTO_GENERAL',
        'Causa Nueva': 'CAUSA_NUEVA',
        'Contestación de Demanda': 'CONTESTACION_DEMANDA',
        'Guarda Judicial / Tutela / Adopción': 'ADOPCION',
        'Adopción': 'ADOPCION',
        'ADOPCION': 'ADOPCION',
        'ASESORAMIENTO_GENERAL': 'ASESORAMIENTO_GENERAL',
        'CAUSA_NUEVA': 'CAUSA_NUEVA',
        'CONTESTACION_DEMANDA': 'CONTESTACION_DEMANDA'
    };
    const key = canalMap[canalKey];
    if (!key) return;

    const presentes = db.prepare('SELECT nombre FROM codefensoras_estado WHERE is_presente = 1 ORDER BY id ASC').all();
    if (presentes.length === 0) return;

    const rotState = db.prepare('SELECT last_index FROM rotacion_turnos_canales WHERE canal = ?').get(key);
    let lastIndex = rotState ? rotState.last_index : -1;
    const nextIndex = (lastIndex + 1) % presentes.length;
    db.prepare('UPDATE rotacion_turnos_canales SET last_index = ? WHERE canal = ?').run(nextIndex, key);
}

function handleGetHistorialFamilia(req, res, parsedUrl) {
    try {
        const dniRaw = parsedUrl.searchParams.get('dni') || '';
        const expteRaw = parsedUrl.searchParams.get('expte') || '';
        const cleanDni = dniRaw.replace(/[^\d]/g, '').trim();
        const cleanExpte = expteRaw.trim();

        if (!cleanDni && !cleanExpte) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'DNI o Expediente no proporcionado' }));
            return;
        }

        let sql = `SELECT * FROM atenciones WHERE defensoria = 'CO-DEF. FAMILIA' AND (`;
        const params = [];
        const conditions = [];

        if (cleanDni) {
            conditions.push(`(dni LIKE ? OR REPLACE(dni, '.', '') = ?)`);
            params.push(`%${cleanDni}%`, cleanDni);
        }
        if (cleanExpte) {
            conditions.push(`(expte LIKE ?)`);
            params.push(`%${cleanExpte}%`);
        }

        sql += conditions.join(' OR ') + `) ORDER BY id DESC LIMIT 5`;

        const stmt = db.prepare(sql);
        const rows = stmt.all(...params);

        if (rows.length > 0) {
            const lastWithCodefensora = rows.find(r => r.codefensora_asignada || (r.atendido_por && r.atendido_por.startsWith('Dra.')));
            const suggestedCodefensora = lastWithCodefensora ? (lastWithCodefensora.codefensora_asignada || lastWithCodefensora.atendido_por) : '';

            res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({
                success: true,
                found: true,
                suggestedCodefensora: suggestedCodefensora.replace(/^Dra\.\s*/i, ''),
                latestRecord: rows[0],
                history: rows
            }));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ success: true, found: false }));
        }
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
    }
}

function handlePostAtencion(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
        try {
            const data = JSON.parse(body);

            const stmt = db.prepare(`
                INSERT INTO atenciones (
                    fecha, actividad, dni, apellidos, nombres, celular, expte, motivo,
                    defensoria, resultado, observaciones, atendido_por, derivado_a, escritos,
                    tarea_pendiente, detalle_pendiente, modo_derivacion_familia, codefensora_asignada, fecha_vencimiento_contestacion, detalle_reparticion
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const atendidoPorFinal = data.atendidoPor || 'Secretaría';
            const esPendiente = Boolean(data.tareaPendiente) ? 1 : 0;
            const detallePendiente = data.detallePendiente || '';
            const isFamilia = data.defensoria === 'CO-DEF. FAMILIA';
            const modoFamilia = isFamilia ? (data.modoDerivacionFamilia || '') : '';
            const codefensora = isFamilia ? (data.codefensoraAsignada || '') : '';
            const vencimiento = isFamilia ? (data.fechaVencimientoContestacion || '') : '';
            const detalleReparticion = data.resultado === 'Derivado a otra repartición' ? (data.detalleReparticion || '') : '';

            const result = stmt.run(
                data.fecha || new Date().toLocaleDateString('es-AR'),
                data.actividad || 'Atención Personal',
                data.dni || '',
                (data.apellidos || '').toUpperCase(),
                (data.nombres || '').toUpperCase(),
                data.celular || '',
                data.expte || '',
                data.motivo || '',
                data.defensoria || 'Otro',
                data.resultado || 'Resuelve',
                data.observaciones || '',
                atendidoPorFinal,
                data.derivadoA || '',
                data.escritos || '',
                esPendiente,
                detallePendiente,
                modoFamilia,
                codefensora,
                vencimiento,
                detalleReparticion
            );

            if (data.defensoria === 'CO-DEF. FAMILIA' && modoFamilia && modoFamilia !== 'Causa en Trámite' && data.resultado !== 'Resuelve operador') {
                advanceTurnoCanal(modoFamilia);
            }

            try {
                const csvLine = `\n"${data.fecha || ''}","${data.actividad || ''}","${data.dni || ''}","${data.apellidos || ''}","${data.nombres || ''}","${data.celular || ''}","${data.expte || ''}","${data.motivo || ''}","${data.defensoria || ''}","${data.resultado || ''}","${data.observaciones || ''}","${atendidoPorFinal}","${data.derivadoA || ''}","${data.escritos || ''}"`;
                fs.appendFileSync(CSV_BACKUP_PATH, csvLine, 'utf8');
            } catch (e) {}

            logAudit(data.operatorId || 0, atendidoPorFinal, 'CREAR_ATENCION', `Atención creada para ${data.apellidos} ${data.nombres} ${esPendiente ? '[CON TAREA PENDIENTE]' : ''}`);

            const newRecord = {
                id: Number(result.lastInsertRowid),
                fecha: data.fecha || new Date().toLocaleDateString('es-AR'),
                actividad: data.actividad || 'Atención Personal',
                dni: data.dni || '',
                apellidos: (data.apellidos || '').toUpperCase(),
                nombres: (data.nombres || '').toUpperCase(),
                celular: data.celular || '',
                expte: data.expte || '',
                motivo: data.motivo || '',
                defensoria: data.defensoria || 'Otro',
                resultado: data.resultado || 'Resuelve',
                observaciones: data.observaciones || '',
                atendido_por: atendidoPorFinal,
                derivado_a: data.derivadoA || '',
                escritos: data.escritos || '',
                tarea_pendiente: esPendiente,
                detalle_pendiente: detallePendiente,
                modo_derivacion_familia: modoFamilia,
                codefensora_asignada: codefensora,
                fecha_vencimiento_contestacion: vencimiento,
                detalle_reparticion: detalleReparticion
            };
            broadcast('RECORD_CREATED', { record: newRecord, operator: atendidoPorFinal });

            res.writeHead(201, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ success: true, id: result.lastInsertRowid }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
    });
}

function handlePutAtencion(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            console.log('[PUT /api/atenciones] Datos recibidos:', JSON.stringify({
                id: data.id,
                atendidoPor: data.atendidoPor,
                codefensoraAsignada: data.codefensoraAsignada,
                modoDerivacionFamilia: data.modoDerivacionFamilia
            }));
            if (!data.id) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Se requiere ID del registro a actualizar.' }));
                return;
            }

            const stmt = db.prepare(`
                UPDATE atenciones SET
                    fecha = ?,
                    actividad = ?,
                    dni = ?,
                    apellidos = ?,
                    nombres = ?,
                    celular = ?,
                    expte = ?,
                    motivo = ?,
                    defensoria = ?,
                    resultado = ?,
                    observaciones = ?,
                    atendido_por = ?,
                    derivado_a = ?,
                    escritos = ?,
                    tarea_pendiente = ?,
                    detalle_pendiente = ?,
                    modo_derivacion_familia = ?,
                    codefensora_asignada = ?,
                    fecha_vencimiento_contestacion = ?,
                    detalle_reparticion = ?
                WHERE id = ?
            `);

            const atendidoPorFinal = data.atendidoPor || 'Secretaría';
            const esPendiente = Boolean(data.tareaPendiente) ? 1 : 0;
            const detallePendiente = data.detallePendiente || '';
            const isFamilia = data.defensoria === 'CO-DEF. FAMILIA';
            const modoFamilia = isFamilia ? (data.modoDerivacionFamilia || '') : '';
            const codefensora = isFamilia ? (data.codefensoraAsignada || '') : '';
            const vencimiento = isFamilia ? (data.fechaVencimientoContestacion || '') : '';
            const detalleReparticion = data.resultado === 'Derivado a otra repartición' ? (data.detalleReparticion || '') : '';

            stmt.run(
                data.fecha || 'S/F',
                data.actividad || 'Atención Personal',
                data.dni || '',
                (data.apellidos || '').toUpperCase(),
                (data.nombres || '').toUpperCase(),
                data.celular || '',
                data.expte || '',
                data.motivo || '',
                data.defensoria || 'Otro',
                data.resultado || 'Resuelve',
                data.observaciones || '',
                atendidoPorFinal,
                data.derivadoA || '',
                data.escritos || '',
                esPendiente,
                detallePendiente,
                modoFamilia,
                codefensora,
                vencimiento,
                detalleReparticion,
                Number(data.id)
            );

            logAudit(data.operatorId || 0, atendidoPorFinal, 'EDITAR_ATENCION', `Atención N° ${data.id} actualizada para ${data.apellidos} ${data.nombres}`);

            const updatedRecord = {
                id: Number(data.id),
                fecha: data.fecha || 'S/F',
                actividad: data.actividad || 'Atención Personal',
                dni: data.dni || '',
                apellidos: (data.apellidos || '').toUpperCase(),
                nombres: (data.nombres || '').toUpperCase(),
                celular: data.celular || '',
                expte: data.expte || '',
                motivo: data.motivo || '',
                defensoria: data.defensoria || 'Otro',
                resultado: data.resultado || 'Resuelve',
                observaciones: data.observaciones || '',
                atendido_por: atendidoPorFinal,
                derivado_a: data.derivadoA || '',
                escritos: data.escritos || '',
                tarea_pendiente: esPendiente,
                detalle_pendiente: detallePendiente,
                modo_derivacion_familia: modoFamilia,
                codefensora_asignada: codefensora,
                fecha_vencimiento_contestacion: vencimiento
            };
            broadcast('RECORD_UPDATED', { record: updatedRecord });

            res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ success: true, message: 'Registro actualizado correctamente' }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
    });
}

function handleDeleteAtencion(req, res, parsedUrl) {
    try {
        const id = parsedUrl.searchParams.get('id');
        const operatorName = parsedUrl.searchParams.get('operatorName') || 'ADMIN';
        if (!id) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'ID es requerido' }));
            return;
        }

        const stmt = db.prepare('DELETE FROM atenciones WHERE id = ?');
        stmt.run(id);

        logAudit(0, operatorName, 'ELIMINAR_ATENCION', `Atención ID ${id} eliminada por Administrador`);

        broadcast('RECORD_DELETED', { id: Number(id) });

        res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(JSON.stringify({ success: true, message: 'Atención eliminada correctamente' }));
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
    }
}

function handlePostCambiarEstadoTarea(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
        try {
            const { id, tareaPendiente, operatorName } = JSON.parse(body);
            const esPendiente = Boolean(tareaPendiente) ? 1 : 0;
            const cumplidaAt = esPendiente ? null : new Date().toISOString();

            const stmt = db.prepare('UPDATE atenciones SET tarea_pendiente = ?, tarea_cumplida_at = ? WHERE id = ?');
            stmt.run(esPendiente, cumplidaAt, id);

            logAudit(0, operatorName || 'OPERADOR', 'CUMPLIR_TAREA', `Tarea ID ${id} marcada como ${esPendiente ? 'PENDIENTE' : 'CUMPLIDA'}`);

            broadcast('RECORD_UPDATED', { record: { id: Number(id), tarea_pendiente: esPendiente, tarea_cumplida_at: cumplidaAt } });

            res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ success: true, id, tareaPendiente: esPendiente }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
    });
}

function handleGetPublicUserList(req, res) {
    try {
        const rows = db.prepare('SELECT username, nombre_completo, rol, avatar_initials FROM usuarios WHERE activo = 1 ORDER BY nombre_completo ASC').all();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(JSON.stringify({ success: true, data: rows }));
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
    }
}

function handleLogin(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
        try {
            const { username, password } = JSON.parse(body);
            const cleanUser = String(username || '').toLowerCase().trim();
            const cleanPass = String(password || '').trim();

            const user = db.prepare('SELECT * FROM usuarios WHERE username = ? AND activo = 1').get(cleanUser);

            if (!user || user.password_hash !== cleanPass) {
                res.writeHead(401, { 'Content-Type': 'application/json; charset=UTF-8' });
                res.end(JSON.stringify({
                    success: false,
                    error: `Contraseña incorrecta para el usuario ${user ? user.nombre_completo : cleanUser}. (Recuerde: Operarios usen "defensoria2026", Admin use "admin2026")`
                }));
                return;
            }

            logAudit(user.id, user.nombre_completo, 'LOGIN', `Inicio de sesión exitoso como ${user.rol}`);

            res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    nombreCompleto: user.nombre_completo,
                    rol: user.rol,
                    avatarInitials: user.avatar_initials,
                    isAdmin: user.rol === 'ADMINISTRADOR' || user.username === 'spereyra'
                }
            }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
    });
}

function handleAdminGetUsuarios(req, res) {
    try {
        const rows = db.prepare('SELECT id, username, nombre_completo, rol, avatar_initials, activo, created_at FROM usuarios ORDER BY id ASC').all();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(JSON.stringify({ success: true, data: rows }));
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
    }
}

function handleAdminPostUsuario(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            const { username, nombreCompleto, rol, password, adminOperatorName } = data;

            const existing = db.prepare('SELECT id FROM usuarios WHERE username = ?').get(String(username).toLowerCase().trim());
            
            if (existing) {
                const stmt = db.prepare('UPDATE usuarios SET nombre_completo = ?, rol = ?, password_hash = ?, avatar_initials = ? WHERE username = ?');
                const initials = (nombreCompleto.split(' ').map(p => p[0]).join('')).substring(0,2).toUpperCase();
                stmt.run(nombreCompleto, rol || 'OPERADOR', password || 'defensoria2026', initials, username.toLowerCase());
                logAudit(0, adminOperatorName || 'Sergio M. Pereyra (ADMIN)', 'MODIFICAR_USUARIO', `Usuario ${username} modificado (Rol: ${rol})`);
            } else {
                const initials = (nombreCompleto.split(' ').map(p => p[0]).join('')).substring(0,2).toUpperCase();
                const stmt = db.prepare('INSERT INTO usuarios (username, nombre_completo, rol, password_hash, avatar_initials, activo) VALUES (?, ?, ?, ?, ?, 1)');
                stmt.run(username.toLowerCase(), nombreCompleto, rol || 'OPERADOR', password || 'defensoria2026', initials);
                logAudit(0, adminOperatorName || 'Sergio M. Pereyra (ADMIN)', 'CREAR_USUARIO', `Nuevo usuario ${username} (${nombreCompleto}) creado con rol ${rol}`);
            }

            res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ success: true, message: 'Usuario guardado correctamente en SQLite' }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
    });
}

function handleAdminBajaUsuario(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
        try {
            const { id, username, toggleStatus, adminOperatorName } = JSON.parse(body);
            if (username === 'spereyra') {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'No se puede dar de baja al Administrador Principal' }));
                return;
            }

            if (toggleStatus) {
                const user = db.prepare('SELECT activo FROM usuarios WHERE id = ? OR username = ?').get(id || 0, username || '');
                const newStatus = user && user.activo ? 0 : 1;
                db.prepare('UPDATE usuarios SET activo = ? WHERE id = ? OR username = ?').run(newStatus, id || 0, username || '');
                logAudit(0, adminOperatorName || 'ADMIN', 'CAMBIAR_ESTADO_USUARIO', `Usuario ${username} estado cambiado a ${newStatus ? 'Activo' : 'Inactivo'}`);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
                res.end(JSON.stringify({ success: true, message: `Estado del usuario ${username} actualizado correctamente` }));
            } else {
                const stmt = db.prepare('UPDATE usuarios SET activo = 0 WHERE id = ? OR username = ?');
                stmt.run(id || 0, username || '');
                logAudit(0, adminOperatorName || 'Sergio M. Pereyra (ADMIN)', 'BAJA_USUARIO', `Usuario ${username} dado de baja`);

                res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
                res.end(JSON.stringify({ success: true, message: `Usuario ${username} dado de baja correctamente` }));
            }
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
    });
}

function handleAdminBackupDB(req, res) {
    try {
        if (!fs.existsSync(DB_PATH)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, error: 'Base de datos no encontrada' }));
        }

        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `atenciones_backup_${dateStr}.db`;

        const stat = fs.statSync(DB_PATH);
        res.writeHead(200, {
            'Content-Type': 'application/x-sqlite3',
            'Content-Length': stat.size,
            'Content-Disposition': `attachment; filename="${filename}"`
        });

        const readStream = fs.createReadStream(DB_PATH);
        readStream.pipe(res);
        logAudit(0, 'Sergio M. Pereyra (ADMIN)', 'BACKUP_DB', `Descarga manual de copia de seguridad SQLite (${filename})`);
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
    }
}

function handleAdminResetRotacion(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
        try {
            const data = JSON.parse(body || '{}');
            const adminName = data.adminOperatorName || 'Sergio M. Pereyra (ADMIN)';
            
            db.exec("UPDATE rotacion_turnos_canales SET last_index = -1;");
            logAudit(0, adminName, 'RESET_ROTACION', 'Se reiniciaron los turnos Round-Robin a cero para todos los canales de Familia');

            res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ success: true, message: 'Rotación de turnos reiniciada a cero correctamente' }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
    });
}

function handleAdminAjustarCanal(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
        try {
            const data = JSON.parse(body || '{}');
            const { canal, lastIndex, adminOperatorName } = data;

            if (!canal || typeof lastIndex !== 'number') {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Canal y lastIndex son requeridos' }));
                return;
            }

            const stmt = db.prepare('INSERT OR REPLACE INTO rotacion_turnos_canales (canal, last_index) VALUES (?, ?)');
            stmt.run(canal, lastIndex);

            logAudit(0, adminOperatorName || 'ADMIN', 'AJUSTAR_ROTACION_CANAL', `Canal ${canal} ajustado a last_index = ${lastIndex}`);

            res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ success: true, message: `Canal ${canal} actualizado a índice ${lastIndex}` }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
    });
}

function handleGetChatHistorial(req, res, parsedUrl) {
    try {
        const user1 = parsedUrl.searchParams.get('user1') || '';
        const user2 = parsedUrl.searchParams.get('user2') || '';
        if (!user1 || !user2) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, error: 'user1 y user2 son requeridos' }));
        }

        const stmt = db.prepare(`
            SELECT * FROM chat_mensajes 
            WHERE (emisor_username = ? AND receptor_username = ?)
               OR (emisor_username = ? AND receptor_username = ?)
            ORDER BY id ASC LIMIT 200
        `);
        const rows = stmt.all(user1, user2, user2, user1);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(JSON.stringify({ success: true, data: rows }));
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
    }
}

function handlePostChatUpload(req, res) {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
        try {
            const buffer = Buffer.concat(chunks);
            const rawHeader = req.headers['x-file-name'] || 'archivo_adjunto';
            const originalName = decodeURIComponent(rawHeader);
            const fileMime = req.headers['content-type'] || 'application/octet-stream';
            const safeName = Date.now() + '_' + originalName.replace(/[^a-zA-Z0-9_.-]/g, '_');
            const targetPath = path.join(CHAT_UPLOADS_DIR, safeName);

            fs.writeFileSync(targetPath, buffer);

            res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({
                success: true,
                archivoNombre: originalName,
                archivoRuta: targetPath,
                archivoTamano: buffer.length,
                archivoMime: fileMime
            }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
    });
}

function handleGetChatDescargar(req, res, pathname) {
    try {
        const msgId = pathname.split('/').pop();
        const msg = db.prepare('SELECT * FROM chat_mensajes WHERE id = ?').get(msgId);

        if (!msg || !msg.archivo_ruta) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, error: 'Archivo no encontrado' }));
        }

        if (!fs.existsSync(msg.archivo_ruta)) {
            res.writeHead(410, { 'Content-Type': 'application/json; charset=UTF-8' });
            return res.end(JSON.stringify({ success: false, error: 'El archivo ya ha sido descargado y purgado del servidor.' }));
        }

        const stat = fs.statSync(msg.archivo_ruta);
        res.writeHead(200, {
            'Content-Type': msg.archivo_mime || 'application/octet-stream',
            'Content-Length': stat.size,
            'Content-Disposition': `attachment; filename="${encodeURIComponent(msg.archivo_nombre || 'adjunto')}"`
        });

        const readStream = fs.createReadStream(msg.archivo_ruta);
        readStream.pipe(res);

        // BORRADO AUTOMÁTICO EN EL DISCO AL COMPLETAR LA DESCARGA
        res.on('finish', () => {
            try {
                if (fs.existsSync(msg.archivo_ruta)) {
                    fs.unlinkSync(msg.archivo_ruta);
                    console.log(`🗑️ Archivo purgado de disco tras descarga exitosa: ${msg.archivo_nombre}`);
                }
                db.prepare('UPDATE chat_mensajes SET descargado = 1 WHERE id = ?').run(msgId);
                broadcast('CHAT_FILE_PURGED', { messageId: Number(msgId) });
            } catch (e) {
                console.error('Error al purgar archivo descargado:', e.message);
            }
        });
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
    }
}

function handlePostChatMarcarLeidos(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        try {
            const { emisor, receptor } = JSON.parse(body);
            db.prepare('UPDATE chat_mensajes SET leido = 1 WHERE emisor_username = ? AND receptor_username = ? AND leido = 0').run(emisor, receptor);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: e.message }));
        }
    });
}

function handleGetChatUnreadCount(req, res, parsedUrl) {
    try {
        const username = parsedUrl.searchParams.get('username') || '';
        const rows = db.prepare(`
            SELECT emisor_username, COUNT(*) as unread_count 
            FROM chat_mensajes 
            WHERE receptor_username = ? AND leido = 0 
            GROUP BY emisor_username
        `).all(username);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(JSON.stringify({ success: true, data: rows }));
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
    }
}

function handleGetCatalogos(req, res) {
    try {
        const rows = db.prepare('SELECT id, categoria, valor, orden FROM catalogos_opciones WHERE activo = 1 ORDER BY categoria ASC, orden ASC, valor ASC').all();
        const grouped = {};
        rows.forEach(r => {
            if (!grouped[r.categoria]) grouped[r.categoria] = [];
            grouped[r.categoria].push({ id: r.id, valor: r.valor });
        });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(JSON.stringify({ success: true, data: grouped, raw: rows }));
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
    }
}

function handleAdminGetCatalogos(req, res) {
    try {
        const rows = db.prepare('SELECT id, categoria, valor, activo, orden FROM catalogos_opciones ORDER BY categoria ASC, orden ASC, valor ASC').all();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(JSON.stringify({ success: true, data: rows }));
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
    }
}

function handleAdminPostCatalogo(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
        try {
            const { categoria, valor, adminOperatorName } = JSON.parse(body);
            if (!categoria || !valor || !valor.trim()) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Categoría y Valor son requeridos' }));
                return;
            }
            const cleanVal = valor.trim();
            const existing = db.prepare('SELECT id, activo FROM catalogos_opciones WHERE categoria = ? AND LOWER(valor) = LOWER(?)').get(categoria, cleanVal);
            if (existing) {
                db.prepare('UPDATE catalogos_opciones SET activo = 1, valor = ? WHERE id = ?').run(cleanVal, existing.id);
            } else {
                db.prepare('INSERT INTO catalogos_opciones (categoria, valor, activo) VALUES (?, ?, 1)').run(categoria, cleanVal);
            }
            logAudit(0, adminOperatorName || 'ADMIN', 'CREAR_OPCION_CATALOGO', `Agregada opción "${cleanVal}" a categoría ${categoria}`);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ success: true, message: 'Opción guardada correctamente' }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
    });
}

function handleAdminDeleteCatalogo(req, res, parsedUrl) {
    try {
        const id = parsedUrl.searchParams.get('id');
        const adminOperatorName = parsedUrl.searchParams.get('operatorName') || 'ADMIN';
        if (!id) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'ID es requerido' }));
            return;
        }
        const opt = db.prepare('SELECT categoria, valor FROM catalogos_opciones WHERE id = ?').get(id);
        db.prepare('UPDATE catalogos_opciones SET activo = 0 WHERE id = ?').run(id);
        if (opt) {
            logAudit(0, adminOperatorName, 'ELIMINAR_OPCION_CATALOGO', `Desactivada opción "${opt.valor}" de categoría ${opt.categoria}`);
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(JSON.stringify({ success: true, message: 'Opción desactivada correctamente' }));
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
    }
}

function handleAdminGetAuditoria(req, res) {
    try {
        const rows = db.prepare('SELECT * FROM auditoria_acciones ORDER BY id DESC LIMIT 100').all();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(JSON.stringify({ success: true, data: rows }));
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
    }
}

function handleGetCodefensoras(req, res) {
    try {
        const rows = db.prepare('SELECT id, nombre, is_presente, motivo_ausencia, orden FROM codefensoras_estado ORDER BY orden ASC, id ASC').all();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(JSON.stringify({ success: true, data: rows }));
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
    }
}

function handlePostEstadoCodefensora(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            const stmt = db.prepare('UPDATE codefensoras_estado SET is_presente = ?, motivo_ausencia = ? WHERE id = ? OR nombre = ?');
            stmt.run(data.isPresente ? 1 : 0, data.motivoAusencia || '', data.id || 0, data.nombre || '');

            logAudit(0, data.operatorName || 'OPERADOR', 'CAMBIO_PRESENTISMO', `Co-Defensora ${data.nombre} marcada como ${data.isPresente ? 'Presente' : 'Ausente'}`);

            broadcast('PRESENCE_UPDATED', { nombre: data.nombre, isPresente: data.isPresente, motivoAusencia: data.motivoAusencia });

            res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ success: true }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
    });
}

function handlePostReordenarCodefensora(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            if (Array.isArray(data.ordenNombres)) {
                db.exec('BEGIN TRANSACTION');
                const stmt = db.prepare('UPDATE codefensoras_estado SET orden = ? WHERE nombre = ?');
                data.ordenNombres.forEach((nombre, idx) => {
                    stmt.run(idx + 1, nombre);
                });
                db.exec('COMMIT');

                logAudit(0, data.operatorName || 'OPERADOR', 'REORDEN_PRESENTISMO', `Nuevo orden de turnos establecido: ${data.ordenNombres.join(', ')}`);
                broadcast('PRESENCE_UPDATED', { reordered: true, ordenNombres: data.ordenNombres });
            }
            res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ success: true }));
        } catch (err) {
            try { db.exec('ROLLBACK'); } catch(e) {}
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
    });
}

function handlePostReordenarCanalCodefensora(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            const { canalKey, ordenNombres, operatorName } = data;

            if (!canalKey || !Array.isArray(ordenNombres)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Parámetros inválidos' }));
                return;
            }

            const canalMap = {
                'Asesoramiento General': 'ASESORAMIENTO_GENERAL',
                'Causa Nueva': 'CAUSA_NUEVA',
                'Contestación de Demanda': 'CONTESTACION_DEMANDA',
                'Guarda Judicial / Tutela / Adopción': 'ADOPCION',
                'Adopción': 'ADOPCION',
                'ADOPCION': 'ADOPCION',
                'ASESORAMIENTO_GENERAL': 'ASESORAMIENTO_GENERAL',
                'CAUSA_NUEVA': 'CAUSA_NUEVA',
                'CONTESTACION_DEMANDA': 'CONTESTACION_DEMANDA'
            };
            const mappedCanal = canalMap[canalKey] || canalKey;

            // 1. Averiguar quién era la defensora próxima asignada antes del reorden
            const oldRotState = db.prepare('SELECT last_index FROM rotacion_turnos_canales WHERE canal = ?').get(mappedCanal);
            const oldPresentes = db.prepare(`
                SELECT c.nombre, c.is_presente, COALESCE(o.orden, c.orden) as orden
                FROM codefensoras_estado c
                LEFT JOIN orden_rotacion_canales o ON o.canal = ? AND o.nombre = c.nombre
                WHERE c.is_presente = 1
                ORDER BY orden ASC, c.id ASC
            `).all(mappedCanal);

            let currentProxima = null;
            if (oldPresentes.length > 0) {
                let oldLast = oldRotState ? oldRotState.last_index : -1;
                let oldNxt = (oldLast + 1) % oldPresentes.length;
                currentProxima = oldPresentes[oldNxt].nombre;
            }

            db.exec('BEGIN TRANSACTION');
            const stmt = db.prepare('INSERT OR REPLACE INTO orden_rotacion_canales (canal, nombre, orden) VALUES (?, ?, ?)');
            ordenNombres.forEach((nombre, idx) => {
                stmt.run(mappedCanal, nombre, idx + 1);
            });

            // 2. Si existía una defensora próxima, recalcular su last_index para que siga siendo Próxima en el nuevo orden
            if (currentProxima) {
                const newPresentes = db.prepare(`
                    SELECT c.nombre, c.is_presente, COALESCE(o.orden, c.orden) as orden
                    FROM codefensoras_estado c
                    LEFT JOIN orden_rotacion_canales o ON o.canal = ? AND o.nombre = c.nombre
                    WHERE c.is_presente = 1
                    ORDER BY orden ASC, c.id ASC
                `).all(mappedCanal);
                const targetIdx = newPresentes.findIndex(p => p.nombre === currentProxima);
                if (targetIdx !== -1) {
                    const newLastIndex = (targetIdx - 1 + newPresentes.length) % newPresentes.length;
                    db.prepare('INSERT OR REPLACE INTO rotacion_turnos_canales (canal, last_index) VALUES (?, ?)')
                        .run(mappedCanal, newLastIndex);
                }
            }
            db.exec('COMMIT');

            logAudit(0, operatorName || 'OPERADOR', 'REORDEN_CANAL_PRESENTISMO', `Nuevo orden para canal ${mappedCanal}: ${ordenNombres.join(', ')}`);
            broadcast('PRESENCE_UPDATED', { reorderedCanal: mappedCanal, ordenNombres });

            res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ success: true }));
        } catch (err) {
            try { db.exec('ROLLBACK'); } catch(e) {}
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
    });
}

function handlePostAsignarProximoTurno(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            const { canalKey, nombreDefensora, operatorName } = data;

            if (!canalKey || !nombreDefensora) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Parámetros faltantes' }));
                return;
            }

            const canalMap = {
                'Asesoramiento General': 'ASESORAMIENTO_GENERAL',
                'Causa Nueva': 'CAUSA_NUEVA',
                'Contestación de Demanda': 'CONTESTACION_DEMANDA',
                'Guarda Judicial / Tutela / Adopción': 'ADOPCION',
                'Adopción': 'ADOPCION',
                'ADOPCION': 'ADOPCION',
                'ASESORAMIENTO_GENERAL': 'ASESORAMIENTO_GENERAL',
                'CAUSA_NUEVA': 'CAUSA_NUEVA',
                'CONTESTACION_DEMANDA': 'CONTESTACION_DEMANDA'
            };
            const mappedCanal = canalMap[canalKey] || canalKey;

            const presentes = db.prepare(`
                SELECT c.nombre, c.is_presente, COALESCE(o.orden, c.orden) as orden
                FROM codefensoras_estado c
                LEFT JOIN orden_rotacion_canales o ON o.canal = ? AND o.nombre = c.nombre
                WHERE c.is_presente = 1
                ORDER BY orden ASC, c.id ASC
            `).all(mappedCanal);
            const targetIdx = presentes.findIndex(p => p.nombre === nombreDefensora);

            if (targetIdx === -1) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'La defensora seleccionada no está presente' }));
                return;
            }

            const newLastIndex = (targetIdx - 1 + presentes.length) % presentes.length;

            db.prepare('INSERT OR REPLACE INTO rotacion_turnos_canales (canal, last_index) VALUES (?, ?)')
                .run(mappedCanal, newLastIndex);

            logAudit(0, operatorName || 'OPERADOR', 'ASIGNACION_DIRECTA_TURNO', `Próximo turno de ${mappedCanal} asignado a Dra. ${nombreDefensora}`);
            broadcast('PRESENCE_UPDATED', { canalKey: mappedCanal, proximaDefensora: nombreDefensora });

            res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ success: true, proximaDefensora: nombreDefensora, canalKey: mappedCanal }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
    });
}

function handleGetProximoTurno(req, res, parsedUrl) {
    try {
        const rawCanal = parsedUrl ? (parsedUrl.searchParams.get('canal') || 'Asesoramiento General') : 'Asesoramiento General';
        const canalMap = {
            'Asesoramiento General': 'ASESORAMIENTO_GENERAL',
            'Causa Nueva': 'CAUSA_NUEVA',
            'Contestación de Demanda': 'CONTESTACION_DEMANDA',
            'Guarda Judicial / Tutela / Adopción': 'ADOPCION',
            'Adopción': 'ADOPCION',
            'ADOPCION': 'ADOPCION',
            'ASESORAMIENTO_GENERAL': 'ASESORAMIENTO_GENERAL',
            'CAUSA_NUEVA': 'CAUSA_NUEVA',
            'CONTESTACION_DEMANDA': 'CONTESTACION_DEMANDA'
        };
        const canalKey = canalMap[rawCanal] || 'ASESORAMIENTO_GENERAL';

        const getPresentesForCanal = (cKey) => {
            return db.prepare(`
                SELECT c.nombre, c.is_presente, COALESCE(o.orden, c.orden) as orden
                FROM codefensoras_estado c
                LEFT JOIN orden_rotacion_canales o ON o.canal = ? AND o.nombre = c.nombre
                WHERE c.is_presente = 1
                ORDER BY orden ASC, c.id ASC
            `).all(cKey);
        };

        const presentes = getPresentesForCanal(canalKey);
        if (presentes.length === 0) {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ success: false, warning: 'Todas las Co-Defensoras están ausentes.' }));
            return;
        }

        const rotState = db.prepare('SELECT last_index FROM rotacion_turnos_canales WHERE canal = ?').get(canalKey);
        let lastIndex = rotState ? rotState.last_index : -1;
        const nextIndex = (lastIndex + 1) % presentes.length;
        const proximaDefensora = presentes[nextIndex].nombre;

        const canalesList = [
            { key: 'ASESORAMIENTO_GENERAL', label: 'Asesoramiento General', short: 'Ases. General' },
            { key: 'CAUSA_NUEVA', label: 'Causa Nueva', short: 'Causa Nueva' },
            { key: 'CONTESTACION_DEMANDA', label: 'Contestación de Demanda', short: 'Contestación' },
            { key: 'ADOPCION', label: 'Guarda Judicial / Tutela / Adopción', short: 'Adopción / Guarda' }
        ];

        const turnos = {};
        canalesList.forEach(c => {
            const presCanal = getPresentesForCanal(c.key);
            if (presCanal.length > 0) {
                const st = db.prepare('SELECT last_index FROM rotacion_turnos_canales WHERE canal = ?').get(c.key);
                let idx = st ? st.last_index : -1;
                const nxt = (idx + 1) % presCanal.length;
                const nom = presCanal[nxt].nombre;
                turnos[c.key] = nom;
                turnos[c.label] = nom;
                turnos[c.short] = nom;
                if (c.key === 'ADOPCION') {
                    turnos['Adopción'] = nom;
                }
            }
        });

        // Lectura pura sin efectos secundarios en GET
        res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(JSON.stringify({ success: true, proximaDefensora, index: nextIndex, canal: canalKey, turnos }));
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
    }
}

// Gestión de Operarios Conectados en Tiempo Real
const activeSessions = new Map();

function cleanStaleSessions() {
    const now = Date.now();
    for (const [username, session] of activeSessions.entries()) {
        if (now - session.lastSeen > 25000) { // Inactivo por más de 25 segundos
            activeSessions.delete(username);
        }
    }
}

function handlePostHeartbeat(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            if (data.username) {
                const initials = data.avatarInitials || (data.nombreCompleto ? data.nombreCompleto.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'OP');
                activeSessions.set(data.username, {
                    username: data.username,
                    nombreCompleto: data.nombreCompleto || data.username,
                    rol: data.rol || 'OPERADOR',
                    avatarInitials: initials,
                    lastSeen: Date.now()
                });
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: e.message }));
        }
    });
}

function handleGetOnlineUsers(req, res) {
    cleanStaleSessions();
    const users = Array.from(activeSessions.values());
    res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
    res.end(JSON.stringify({ success: true, count: users.length, data: users }));
}

// WebSocket Real-time Server Setup
const wss = new WebSocketServer({ server });

function broadcast(type, payload) {
    const msg = JSON.stringify({ type, payload });
    wss.clients.forEach(client => {
        if (client.readyState === 1) { // OPEN
            client.send(msg);
        }
    });
}

function broadcastOnlineUsers() {
    cleanStaleSessions();
    const users = Array.from(activeSessions.values());
    broadcast('ONLINE_USERS_UPDATED', { count: users.length, data: users });
}

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'IDENTIFY' && data.user && data.user.username) {
                ws.username = data.user.username;
                const initials = data.user.avatarInitials || (data.user.nombreCompleto ? data.user.nombreCompleto.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'OP');
                activeSessions.set(data.user.username, {
                    username: data.user.username,
                    nombreCompleto: data.user.nombreCompleto || data.user.username,
                    rol: data.user.rol || 'OPERADOR',
                    avatarInitials: initials,
                    lastSeen: Date.now()
                });
                broadcastOnlineUsers();
            } else if (data.type === 'CHAT_SEND_MESSAGE') {
                const payload = data.payload || {};
                const { emisor, receptor, mensaje, tipo, archivoNombre, archivoRuta, archivoTamano, archivoMime } = payload;

                if (emisor && receptor) {
                    const stmt = db.prepare(`
                        INSERT INTO chat_mensajes (
                            emisor_username, receptor_username, mensaje, tipo,
                            archivo_nombre, archivo_ruta, archivo_tamano, archivo_mime, descargado, leido
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
                    `);
                    const res = stmt.run(
                        emisor, receptor, mensaje || '', tipo || 'TEXT',
                        archivoNombre || null, archivoRuta || null, archivoTamano || null, archivoMime || null
                    );

                    const insertedMsg = {
                        id: Number(res.lastInsertRowid),
                        emisor_username: emisor,
                        receptor_username: receptor,
                        mensaje: mensaje || '',
                        tipo: tipo || 'TEXT',
                        archivo_nombre: archivoNombre || null,
                        archivo_ruta: archivoRuta || null,
                        archivo_tamano: archivoTamano || null,
                        archivo_mime: archivoMime || null,
                        descargado: 0,
                        leido: 0,
                        created_at: new Date().toISOString()
                    };

                    wss.clients.forEach(client => {
                        if (client.readyState === 1 && (client.username === receptor || client.username === emisor)) {
                            client.send(JSON.stringify({
                                type: 'CHAT_RECEIVE_MESSAGE',
                                payload: insertedMsg
                            }));
                        }
                    });
                }
            }
        } catch (e) {}
    });

    ws.on('close', () => {
        if (ws.username) {
            broadcastOnlineUsers();
        }
    });
});

server.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 Servidor REST API + WebSocket Realtime Activo: http://localhost:${PORT}/dashboard.html`);
    console.log(`==================================================\n`);
});
