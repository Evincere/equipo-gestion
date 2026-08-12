# Chat Directo 1-a-1 y Transferencia Efímera de Archivos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desarrollar un sistema de chat privado directo 1-a-1 entre operarios/administradores con notificaciones en tiempo real (WebSocket), historial en SQLite, interfaz Aero Glass Drawer desplegable y transferencia efímera de archivos adjuntos (hasta 15 MB) con purga automática del disco tras la descarga del receptor.

**Architecture:** Backend REST API + WebSocket en `server.js` respaldado por la tabla `chat_mensajes` en SQLite y almacenamiento efímero en `data/uploads/chat/`. Frontend en JavaScript Vanilla con Arquitectura Hexagonal empaquetado vía `build-bundle.js`.

**Tech Stack:** Node.js, `node:sqlite`, WebSockets (`ws`), Vanilla JS, HTML5, CSS Windows Aero Glass Dark Mode.

## Global Constraints

- Backend en `server.js` utilizando `DatabaseSync` de Node.js.
- Archivos adjuntos guardados en `data/uploads/chat/` con purga automática del disco al completarse `GET /api/chat/descargar/:id`.
- Compilación del frontend mediante `npm run build` (`node build-bundle.js`).

---

### Task 1: Tabla SQLite `chat_mensajes` y Endpoints Backend REST/Upload (`server.js`)

**Files:**
- Modify: [`server.js:70-110`](file:///f:/Apps/equipo-gestion/server.js#L70-L110)
- Modify: [`server.js:450-480`](file:///f:/Apps/equipo-gestion/server.js#L450-L480)
- Modify: [`server.js:1060-1140`](file:///f:/Apps/equipo-gestion/server.js#L1060-L1140)

**Interfaces:**
- Consumes: Endpoints `/api/chat/historial`, `/api/chat/upload`, `/api/chat/descargar/:id`, `/api/chat/marcar-leidos`, `/api/chat/unread-count`.
- Produces: Tabla `chat_mensajes`, archivos temporales en `data/uploads/chat/` y purga física tras descarga.

- [ ] **Step 1: Crear tabla `chat_mensajes` y directorio `data/uploads/chat/` en `server.js`**

En `server.js` inicialización de base de datos:

```javascript
    db.exec(`
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
```

- [ ] **Step 2: Agregar rutas REST para el Chat en `server.js`**

```javascript
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
```

- [ ] **Step 3: Implementar Handlers REST y Purga Efímera de Archivos en `server.js`**

```javascript
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
            const originalName = decodeURIComponent(req.headers['x-file-name'] || 'archivo_adjunto');
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

        // BORRADO AUTOMÁTICO AL FINALIZAR LA DESCARGA
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
```

- [ ] **Step 4: Commit**
```bash
git add server.js
git commit -m "feat: agregar tabla chat_mensajes y endpoints REST para chat y transferencia efimera de archivos"
```

---

### Task 2: Integración WebSocket Real-Time para el Chat (`server.js`)

**Files:**
- Modify: [`server.js:1330-1375`](file:///f:/Apps/equipo-gestion/server.js#L1330-L1375)

**Interfaces:**
- Consumes: Mensajes WebSocket de tipo `CHAT_SEND_MESSAGE`, `CHAT_MARK_READ`.
- Produces: Transmisión instantánea de `CHAT_RECEIVE_MESSAGE` al receptor y actualización de badges.

- [ ] **Step 1: Extender el manejador WebSocket de `server.js`**

En `wss.on('connection')`:

```javascript
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                if (data.type === 'IDENTIFY' && data.user && data.user.username) {
                    ws.username = data.user.username;
                    activeSessions.set(data.user.username, {
                        username: data.user.username,
                        nombreCompleto: data.user.nombreCompleto || data.user.username,
                        rol: data.user.rol || 'OPERADOR',
                        avatarInitials: data.user.avatarInitials || 'OP',
                        lastSeen: Date.now()
                    });
                    broadcastOnlineUsers();
                } else if (data.type === 'CHAT_SEND_MESSAGE') {
                    const { emisor, receptor, mensaje, tipo, archivoNombre, archivoRuta, archivoTamano, archivoMime } = data.payload;

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

                    // Enviar al emisor y al receptor
                    wss.clients.forEach(client => {
                        if (client.readyState === 1 && (client.username === receptor || client.username === emisor)) {
                            client.send(JSON.stringify({
                                type: 'CHAT_RECEIVE_MESSAGE',
                                payload: insertedMsg
                            }));
                        }
                    });
                }
            } catch (e) {}
        });
```

- [ ] **Step 2: Commit**
```bash
git add server.js
git commit -m "feat: integrar transmision de mensajes de chat en tiempo real via WebSocket"
```

---

### Task 3: Estructura HTML y Estilos Aero Glass Drawer (`dashboard.html` & `dashboard.css`)

**Files:**
- Modify: [`dashboard.html:20-30`](file:///f:/Apps/equipo-gestion/dashboard.html#L20-L30)
- Modify: [`dashboard.html:420-435`](file:///f:/Apps/equipo-gestion/dashboard.html#L420-L435)
- Modify: [`dashboard.css:550-620`](file:///f:/Apps/equipo-gestion/dashboard.css#L550-L620)

**Interfaces:**
- Produces: Botón `#btnOpenChatDrawer` en topbar, marcado de `#chatDrawer` en HTML y estilos CSS Aero Glass en `dashboard.css`.

- [ ] **Step 1: Agregar el botón de Chat en la barra de título Aero de `dashboard.html`**

```html
<button class="caption-btn" id="btnOpenChatDrawer" title="Chat Interno Directo" style="position: relative; width: auto; padding: 0 0.6rem; display: flex; align-items: center; gap: 0.35rem; font-size: 0.82rem;">
    <i class="ri-chat-3-line"></i> Chat
    <span class="badge badge-familia" id="chatGlobalUnreadBadge" style="display: none; font-size: 0.65rem; padding: 0.1rem 0.35rem; background: #EF4444; color: #FFF;">0</span>
</button>
```

- [ ] **Step 2: Agregar el marcado del Drawer Flotante `#chatDrawer` en `dashboard.html`**

```html
<!-- Drawer Lateral Flotante de Chat 1-a-1 -->
<div class="chat-drawer-overlay" id="chatDrawerOverlay">
    <div class="chat-drawer aero-glass-drawer" id="chatDrawer">
        <div class="chat-drawer-header">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="ri-chat-3-fill" style="color: var(--mpd-cyan); font-size: 1.25rem;"></i>
                <h4 style="margin: 0; font-size: 1rem; color: #FFF;" id="chatDrawerTitle">Chat Interno Operarios</h4>
            </div>
            <button class="modal-close-btn" id="btnCloseChatDrawer"><i class="ri-close-line"></i></button>
        </div>

        <div class="chat-drawer-body">
            <!-- Sub-panel 1: Lista de Operarios -->
            <div class="chat-contacts-list" id="chatContactsList">
                <!-- Renderizado de operarios en línea y mensajes no leídos -->
            </div>

            <!-- Sub-panel 2: Ventana de Conversación Directa -->
            <div class="chat-conversation-view" id="chatConversationView" style="display: none;">
                <div class="chat-conv-header">
                    <button class="btn btn-secondary" id="btnBackToContacts" style="padding: 0.2rem 0.5rem; font-size: 0.78rem;">
                        <i class="ri-arrow-left-line"></i> Volver
                    </button>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div class="avatar" id="activeChatAvatar" style="width: 28px; height: 28px; font-size: 0.7rem;">OP</div>
                        <span id="activeChatName" style="font-weight: 600; font-size: 0.88rem; color: #FFF;">Operador</span>
                    </div>
                </div>

                <div class="chat-messages-area" id="chatMessagesArea">
                    <!-- Burbujas de mensajes -->
                </div>

                <!-- Input y Adjuntar Archivo -->
                <div class="chat-input-bar">
                    <input type="file" id="chatFileInput" style="display: none;" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.zip">
                    <button type="button" class="btn-chat-attach" id="btnAttachFile" title="Adjuntar Archivo (Máx 15MB)">
                        <i class="ri-attachment-line"></i>
                    </button>
                    <input type="text" id="chatTextInput" placeholder="Escribe un mensaje directo..." class="form-control" style="font-size: 0.85rem;">
                    <button type="button" class="btn btn-primary" id="btnSendChatMessage" style="padding: 0.5rem 0.75rem;">
                        <i class="ri-send-plane-fill"></i>
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>
```

- [ ] **Step 3: Agregar estilos en `dashboard.css`**

```css
/* CHAT DRAWER AERO GLASS */
.chat-drawer-overlay {
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(11, 19, 41, 0.5);
    backdrop-filter: blur(8px);
    z-index: 99990;
    opacity: 0; pointer-events: none;
    transition: opacity 0.3s ease;
}
.chat-drawer-overlay.active {
    opacity: 1; pointer-events: auto;
}
.chat-drawer {
    position: absolute;
    top: 0; right: -420px; width: 400px; height: 100%;
    background: rgba(15, 23, 42, 0.88);
    backdrop-filter: blur(25px);
    border-left: 1px solid var(--aero-glass-border);
    box-shadow: -10px 0 35px rgba(0, 0, 0, 0.6);
    display: flex; flex-direction: column;
    transition: right 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.chat-drawer-overlay.active .chat-drawer { right: 0; }
.chat-drawer-header {
    padding: 1rem 1.25rem; border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex; justify-content: space-between; align-items: center;
}
.chat-drawer-body { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.chat-contacts-list { flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
.chat-contact-item {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.75rem 1rem; border-radius: 8px; background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06); cursor: pointer; transition: all 0.2s ease;
}
.chat-contact-item:hover { background: rgba(56, 189, 248, 0.15); border-color: var(--mpd-cyan-glow); }
.chat-conversation-view { flex: 1; display: flex; flex-direction: column; }
.chat-conv-header { padding: 0.75rem 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; align-items: center; gap: 0.75rem; }
.chat-messages-area { flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
.chat-bubble { max-width: 82%; padding: 0.6rem 0.85rem; border-radius: 12px; font-size: 0.85rem; line-height: 1.4; word-break: break-word; }
.chat-bubble.sent { align-self: flex-end; background: linear-gradient(135deg, #0EA5E9, #0284C7); color: #FFF; border-bottom-right-radius: 2px; }
.chat-bubble.received { align-self: flex-start; background: rgba(255, 255, 255, 0.08); color: #E2E8F0; border-bottom-left-radius: 2px; border: 1px solid rgba(255, 255, 255, 0.1); }
.chat-input-bar { padding: 0.75rem 1rem; border-top: 1px solid rgba(255, 255, 255, 0.1); display: flex; gap: 0.5rem; align-items: center; }
.btn-chat-attach { background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); color: var(--mpd-cyan); padding: 0.5rem 0.75rem; border-radius: 6px; cursor: pointer; }
.btn-chat-attach:hover { background: rgba(56, 189, 248, 0.2); color: #FFF; }
```

- [ ] **Step 4: Commit**
```bash
git add dashboard.html dashboard.css
git commit -m "feat: agregar estructura HTML y estilos CSS para el Chat Drawer Aero Glass"
```

---

### Task 4: Lógica Frontend de Chat y Archivos (`build-bundle.js` -> `dashboard-bundle.js`)

**Files:**
- Modify: [`build-bundle.js:1250-1350`](file:///f:/Apps/equipo-gestion/build-bundle.js#L1250-L1350)

**Interfaces:**
- Produces: Manejo de Drawer de Chat, selección de contacto, envío de mensajes y archivos adjuntos con refresco de unread badges.

- [ ] **Step 1: Agregar métodos del módulo de Chat en `build-bundle.js`**

En `DashboardViewController`:

```javascript
        initChatModule() {
            this.btnOpenChatDrawer = document.getElementById('btnOpenChatDrawer');
            this.btnCloseChatDrawer = document.getElementById('btnCloseChatDrawer');
            this.chatDrawerOverlay = document.getElementById('chatDrawerOverlay');
            this.chatContactsList = document.getElementById('chatContactsList');
            this.chatConversationView = document.getElementById('chatConversationView');
            this.btnBackToContacts = document.getElementById('btnBackToContacts');
            this.chatMessagesArea = document.getElementById('chatMessagesArea');
            this.chatTextInput = document.getElementById('chatTextInput');
            this.btnSendChatMessage = document.getElementById('btnSendChatMessage');
            this.btnAttachFile = document.getElementById('btnAttachFile');
            this.chatFileInput = document.getElementById('chatFileInput');
            this.activeChatUsername = null;

            if (this.btnOpenChatDrawer) {
                this.btnOpenChatDrawer.addEventListener('click', () => this.openChatDrawer());
            }
            if (this.btnCloseChatDrawer) {
                this.btnCloseChatDrawer.addEventListener('click', () => this.closeChatDrawer());
            }
            if (this.chatDrawerOverlay) {
                this.chatDrawerOverlay.addEventListener('click', (e) => {
                    if (e.target === this.chatDrawerOverlay) this.closeChatDrawer();
                });
            }
            if (this.btnBackToContacts) {
                this.btnBackToContacts.addEventListener('click', () => {
                    this.activeChatUsername = null;
                    this.chatConversationView.style.display = 'none';
                    this.chatContactsList.style.display = 'flex';
                    this.loadChatContacts();
                });
            }
            if (this.btnSendChatMessage) {
                this.btnSendChatMessage.addEventListener('click', () => this.sendChatMessage());
            }
            if (this.chatTextInput) {
                this.chatTextInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.sendChatMessage();
                });
            }
            if (this.btnAttachFile && this.chatFileInput) {
                this.btnAttachFile.addEventListener('click', () => this.chatFileInput.click());
                this.chatFileInput.addEventListener('change', () => this.handleFileSelected());
            }
        }

        async openChatDrawer() {
            if (this.chatDrawerOverlay) this.chatDrawerOverlay.classList.add('active');
            await this.loadChatContacts();
        }

        closeChatDrawer() {
            if (this.chatDrawerOverlay) this.chatDrawerOverlay.classList.remove('active');
        }

        async loadChatContacts() {
            if (!this.chatContactsList) return;
            try {
                const usersRes = await fetch(getApiUrl('/api/auth/users'));
                const unreadRes = await fetch(getApiUrl('/api/chat/unread-count?username=' + encodeURIComponent(this.currentUser ? this.currentUser.username : '')));
                const onlineRes = await fetch(getApiUrl('/api/usuarios/online'));

                const usersData = usersRes.ok ? (await usersRes.json()).data : [];
                const unreadData = unreadRes.ok ? (await unreadRes.json()).data : [];
                const onlineData = onlineRes.ok ? (await onlineRes.json()).data : [];

                const unreadMap = {};
                (unreadData || []).forEach(r => unreadMap[r.emisor_username] = r.unread_count);
                const onlineMap = {};
                (onlineData || []).forEach(o => onlineMap[o.username] = true);

                let html = '';
                (usersData || []).forEach(u => {
                    if (this.currentUser && u.username === this.currentUser.username) return;
                    const isOnline = Boolean(onlineMap[u.username]);
                    const unread = unreadMap[u.username] || 0;
                    const initials = (u.nombre_completo.split(' ').map(p => p[0]).join('')).substring(0, 2).toUpperCase();

                    html += `<div class="chat-contact-item" data-username="${u.username}" data-name="${u.nombre_completo}">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div style="position: relative;">
                                <div class="avatar" style="width: 34px; height: 34px; font-size: 0.8rem; font-weight: 700;">${initials}</div>
                                <span style="position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; border-radius: 50%; background: ${isOnline ? '#4ADE80' : '#64748B'}; border: 2px solid #0F172A;"></span>
                            </div>
                            <div>
                                <span style="display: block; font-size: 0.88rem; font-weight: 600; color: #FFF;">${u.nombre_completo}</span>
                                <span style="font-size: 0.72rem; color: ${isOnline ? '#4ADE80' : '#64748B'};">${isOnline ? 'En línea' : 'Desconectado'}</span>
                            </div>
                        </div>
                        ${unread > 0 ? `<span class="badge badge-familia" style="background: #EF4444; color: #FFF; font-size: 0.7rem;">${unread} nuevo(s)</span>` : ''}
                    </div>`;
                });

                this.chatContactsList.innerHTML = html;

                this.chatContactsList.querySelectorAll('.chat-contact-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const uname = item.getAttribute('data-username');
                        const name = item.getAttribute('data-name');
                        this.openConversation(uname, name);
                    });
                });
            } catch(e) {}
        }

        async openConversation(username, name) {
            this.activeChatUsername = username;
            document.getElementById('activeChatName').textContent = name;
            document.getElementById('activeChatAvatar').textContent = (name.split(' ').map(p => p[0]).join('')).substring(0, 2).toUpperCase();

            this.chatContactsList.style.display = 'none';
            this.chatConversationView.style.display = 'flex';

            await fetch(getApiUrl('/api/chat/marcar-leidos'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emisor: username, receptor: this.currentUser ? this.currentUser.username : '' })
            });

            await this.loadChatMessages();
        }

        async loadChatMessages() {
            if (!this.activeChatUsername || !this.chatMessagesArea) return;
            try {
                const res = await fetch(getApiUrl(`/api/chat/historial?user1=${encodeURIComponent(this.currentUser ? this.currentUser.username : '')}&user2=${encodeURIComponent(this.activeChatUsername)}`));
                if (res.ok) {
                    const json = await res.json();
                    if (json.success && Array.isArray(json.data)) {
                        let html = '';
                        json.data.forEach(m => {
                            const isSent = this.currentUser && m.emisor_username === this.currentUser.username;
                            const bubbleClass = isSent ? 'sent' : 'received';

                            let contentHtml = '';
                            if (m.tipo === 'FILE') {
                                if (m.descargado) {
                                    contentHtml = `<div style="display: flex; align-items: center; gap: 0.5rem; color: #94A3B8; font-size: 0.8rem;">
                                        <i class="ri-checkbox-circle-fill" style="color: #4ADE80;"></i>
                                        <span>Archivo <strong>${m.archivo_nombre}</strong> descargado y purgado del servidor.</span>
                                    </div>`;
                                } else {
                                    contentHtml = `<div style="display: flex; flex-direction: column; gap: 0.35rem;">
                                        <div style="font-weight: 600; font-size: 0.82rem;"><i class="ri-file-download-line"></i> ${m.archivo_nombre}</div>
                                        <div style="font-size: 0.72rem; opacity: 0.8;">Tamaño: ${(m.archivo_tamano / 1024).toFixed(1)} KB</div>
                                        <a href="${getApiUrl('/api/chat/descargar/' + m.id)}" target="_blank" class="btn btn-secondary" style="font-size: 0.75rem; padding: 0.25rem 0.5rem; text-decoration: none; margin-top: 0.25rem; display: inline-flex; align-items: center; gap: 0.3rem;">
                                            <i class="ri-download-line"></i> Descargar (Borrado Automático)
                                        </a>
                                    </div>`;
                                }
                            } else {
                                contentHtml = m.mensaje;
                            }

                            html += `<div class="chat-bubble ${bubbleClass}">
                                ${contentHtml}
                            </div>`;
                        });
                        this.chatMessagesArea.innerHTML = html;
                        this.chatMessagesArea.scrollTop = this.chatMessagesArea.scrollHeight;
                    }
                }
            } catch(e) {}
        }

        async sendChatMessage() {
            const text = this.chatTextInput ? this.chatTextInput.value.trim() : '';
            if (!text || !this.activeChatUsername || !this.socket) return;

            const payload = {
                emisor: this.currentUser.username,
                receptor: this.activeChatUsername,
                mensaje: text,
                tipo: 'TEXT'
            };

            this.socket.send(JSON.stringify({ type: 'CHAT_SEND_MESSAGE', payload }));
            this.chatTextInput.value = '';
        }

        async handleFileSelected() {
            const file = this.chatFileInput ? this.chatFileInput.files[0] : null;
            if (!file || !this.activeChatUsername) return;

            if (file.size > 15 * 1024 * 1024) {
                showToast('El archivo supera el límite de 15 MB', 'error');
                return;
            }

            try {
                showToast('Subiendo archivo adjunto...', 'info');
                const uploadRes = await fetch(getApiUrl('/api/chat/upload'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': file.type || 'application/octet-stream',
                        'X-File-Name': encodeURIComponent(file.name)
                    },
                    body: file
                });

                if (uploadRes.ok) {
                    const upData = await uploadRes.json();
                    if (upData.success) {
                        const payload = {
                            emisor: this.currentUser.username,
                            receptor: this.activeChatUsername,
                            mensaje: 'Envió un archivo adjunto: ' + upData.archivoNombre,
                            tipo: 'FILE',
                            archivoNombre: upData.archivoNombre,
                            archivoRuta: upData.archivoRuta,
                            archivoTamano: upData.archivoTamano,
                            archivoMime: upData.archivoMime
                        };
                        this.socket.send(JSON.stringify({ type: 'CHAT_SEND_MESSAGE', payload }));
                        showToast('Archivo adjuntado correctamente', 'success');
                    }
                }
            } catch(e) {
                showToast('Error al subir archivo adjunto', 'error');
            }
            this.chatFileInput.value = '';
        }
```

- [ ] **Step 2: Invocar `this.initChatModule()` en `onLoginSuccess()`**

- [ ] **Step 3: Compilar bundle con `npm run build`**

- [ ] **Step 4: Commit**
```bash
git add build-bundle.js dashboard-bundle.js
git commit -m "feat: implementar logica frontend de chat 1-a-1 y transferencia efimera de archivos"
```

---

### Task 5: Compilación y Verificación E2E de Chat y Borrado Efímero de Archivos

- [ ] **Step 1: Compilar la aplicación**

Run: `npm run build`  
Expected: `dashboard-bundle.js` actualizado sin errores.

- [ ] **Step 2: Probar el flujo completo e iniciar el servidor**

Run: `node server.js`  
Probar:
1. Iniciar sesión como `spereyra` y abrir el Chat Drawer `#btnOpenChatDrawer`.
2. Enviar mensaje de prueba a `aalonso`.
3. Subir archivo de prueba (`test.pdf`).
4. Simular descarga en `GET /api/chat/descargar/:id` y verificar que el archivo es purgado físicamente del disco del servidor.

- [ ] **Step 3: Commit final**
```bash
git add .
git commit -m "chore: finalizacion y verificacion e2e del modulo de chat directo y borrado automatico de adjuntos"
```
