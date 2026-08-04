const http = require('http');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'atenciones.db');
const CSV_BACKUP_PATH = path.join(__dirname, 'atenciones.csv');

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
`);

// Migración suave para agregar columnas de tareas pendientes
try { db.exec('ALTER TABLE atenciones ADD COLUMN tarea_pendiente INTEGER DEFAULT 0;'); } catch (e) {}
try { db.exec('ALTER TABLE atenciones ADD COLUMN detalle_pendiente TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE atenciones ADD COLUMN tarea_cumplida_at DATETIME;'); } catch (e) {}

// Índices
db.exec(`
    CREATE INDEX IF NOT EXISTS idx_atenciones_dni ON atenciones(dni);
    CREATE INDEX IF NOT EXISTS idx_atenciones_expte ON atenciones(expte);
    CREATE INDEX IF NOT EXISTS idx_atenciones_defensoria ON atenciones(defensoria);
    CREATE INDEX IF NOT EXISTS idx_atenciones_apellidos ON atenciones(apellidos);
    CREATE INDEX IF NOT EXISTS idx_atenciones_pendiente ON atenciones(tarea_pendiente);
`);

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
        console.log(`✅ ¡Sembrado automático completado! ${count} registros importados a SQLite.`);
    } catch (e) {
        console.error('❌ Error sembrando atenciones desde CSV:', e.message);
    }
}

// Sembrado inicial de Co-Defensoras y Usuarios si están vacías
const checkCodefensoras = db.prepare('SELECT COUNT(*) as count FROM codefensoras_estado').get();
if (checkCodefensoras.count === 0) {
    const seedStmt = db.prepare('INSERT INTO codefensoras_estado (nombre, is_presente) VALUES (?, 1)');
    seedStmt.run('Claudia Perruzzi');
    seedStmt.run('Andrea Lombard');
    seedStmt.run('Luz Perez');
    seedStmt.run('Mariela Fokszek');
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
        if (req.method === 'DELETE') return handleDeleteAtencion(req, res, parsedUrl);
    }

    if (pathname === '/api/atenciones/tarea-estado' && req.method === 'POST') {
        return handlePostCambiarEstadoTarea(req, res);
    }

    if (pathname === '/api/ciudadanos/historial') {
        if (req.method === 'GET') return handleGetCiudadanoHistorial(req, res, parsedUrl);
    }

    if (pathname === '/api/familia/codefensoras') {
        if (req.method === 'GET') return handleGetCodefensoras(req, res);
    }

    if (pathname === '/api/familia/codefensoras/estado') {
        if (req.method === 'POST') return handlePostEstadoCodefensora(req, res);
    }

    if (pathname === '/api/familia/proximo-turno') {
        if (req.method === 'GET') return handleGetProximoTurno(req, res);
    }

    if (pathname === '/api/auth/login' && req.method === 'POST') {
        return handleLogin(req, res);
    }

    if (pathname === '/api/auth/users' && req.method === 'GET') {
        return handleGetPublicUserList(req, res);
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

        sql += ` ORDER BY id DESC LIMIT 1000`;

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
                    tarea_pendiente, detalle_pendiente
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const atendidoPorFinal = data.atendidoPor || 'Secretaría';
            const esPendiente = Boolean(data.tareaPendiente) ? 1 : 0;
            const detallePendiente = data.detallePendiente || '';

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
                detallePendiente
            );

            try {
                const csvLine = `\n"${data.fecha || ''}","${data.actividad || ''}","${data.dni || ''}","${data.apellidos || ''}","${data.nombres || ''}","${data.celular || ''}","${data.expte || ''}","${data.motivo || ''}","${data.defensoria || ''}","${data.resultado || ''}","${data.observaciones || ''}","${atendidoPorFinal}","${data.derivadoA || ''}","${data.escritos || ''}"`;
                fs.appendFileSync(CSV_BACKUP_PATH, csvLine, 'utf8');
            } catch (e) {}

            logAudit(data.operatorId || 0, atendidoPorFinal, 'CREAR_ATENCION', `Atención creada para ${data.apellidos} ${data.nombres} ${esPendiente ? '[CON TAREA PENDIENTE]' : ''}`);

            res.writeHead(201, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ success: true, id: result.lastInsertRowid }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
    });
}

function handleDeleteAtencion(req, res, parsedUrl) {
    try {
        const id = parsedUrl.searchParams.get('id');
        if (!id) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'ID es requerido' }));
            return;
        }

        const stmt = db.prepare('DELETE FROM atenciones WHERE id = ?');
        stmt.run(id);

        logAudit(0, 'OPERADOR', 'ELIMINAR_ATENCION', `Atención ID ${id} eliminada`);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(JSON.stringify({ success: true, message: 'Atención eliminada correctamente' }));
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
    }
}

function handlePutAtencion(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            if (!data.id) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'ID es requerido para actualizar' }));
                return;
            }

            const stmt = db.prepare(`
                UPDATE atenciones SET
                    fecha = ?, actividad = ?, dni = ?, apellidos = ?, nombres = ?,
                    celular = ?, expte = ?, motivo = ?, defensoria = ?, resultado = ?,
                    observaciones = ?, atendido_por = ?, derivado_a = ?, escritos = ?,
                    tarea_pendiente = ?, detalle_pendiente = ?
                WHERE id = ?
            `);

            const esPendiente = Boolean(data.tareaPendiente) ? 1 : 0;

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
                data.atendidoPor || 'Secretaría',
                data.derivadoA || '',
                data.escritos || '',
                esPendiente,
                data.detallePendiente || '',
                data.id
            );

            logAudit(0, 'OPERADOR', 'EDITAR_ATENCION', `Atención ID ${data.id} editada correctamente`);

            res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ success: true, message: 'Atención actualizada correctamente' }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
    });
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
            const { id, username, adminOperatorName } = JSON.parse(body);
            if (username === 'spereyra') {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'No se puede dar de baja al Administrador Principal' }));
                return;
            }

            const stmt = db.prepare('UPDATE usuarios SET activo = 0 WHERE id = ? OR username = ?');
            stmt.run(id || 0, username || '');
            logAudit(0, adminOperatorName || 'Sergio M. Pereyra (ADMIN)', 'BAJA_USUARIO', `Usuario ${username} dado de baja`);

            res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ success: true, message: `Usuario ${username} dado de baja correctamente` }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
    });
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
        const rows = db.prepare('SELECT id, nombre, is_presente, motivo_ausencia FROM codefensoras_estado ORDER BY id ASC').all();
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

            res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ success: true }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
    });
}

function handleGetProximoTurno(req, res) {
    try {
        const presentes = db.prepare('SELECT nombre FROM codefensoras_estado WHERE is_presente = 1 ORDER BY id ASC').all();
        if (presentes.length === 0) {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
            res.end(JSON.stringify({ success: false, warning: 'Todas las Co-Defensoras están ausentes.' }));
            return;
        }

        const rotState = db.prepare('SELECT last_index FROM rotacion_turnos WHERE id = 1').get();
        let lastIndex = rotState ? rotState.last_index : -1;
        const nextIndex = (lastIndex + 1) % presentes.length;
        const proximaDefensora = presentes[nextIndex].nombre;

        db.prepare('UPDATE rotacion_turnos SET last_index = ? WHERE id = 1').run(nextIndex);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(JSON.stringify({ success: true, proximaDefensora, index: nextIndex }));
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
    }
}

server.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 Servidor REST API + Tareas Pendientes Activo: http://localhost:${PORT}/dashboard.html`);
    console.log(`==================================================\n`);
});
