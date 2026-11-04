# Enrutamiento Dedicado `/gestion` en Traefik (VPS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configurar el enrutamiento dedicado `/gestion` en Traefik para acceder al sistema en `https://vps-4778464-x.dattaweb.com/gestion/`, evitando el bloqueo por FortiGuard Dynamic DNS, y adaptar el frontend para resolver peticiones relativas y llamadas API bajo este subpath.

**Architecture:** Traefik en la VPS captura `Host(vps-4778464-x.dattaweb.com) && PathPrefix(/gestion)`, elimina el prefijo `/gestion` mediante el middleware `stripPrefix` y reenvía el tráfico limpio al servicio Docker `equipogestion-dashboard-nmcufv:3000`. El frontend (`scripts/build-bundle.js`) detecta si corre bajo `/gestion` y prefija automáticamente las llamadas AJAX (`getApiUrl`) y la conexión WebSocket.

**Tech Stack:** Node.js, Traefik v3, Docker Swarm / Dokploy, Vanilla JS frontend bundle.

## Global Constraints

- Compatibilidad total y preservación del entorno local: `http://10.5.6.78:3000` debe seguir funcionando sin alteraciones.
- Cero impacto en la web institucional que corre en `https://vps-4778464-x.dattaweb.com/` y su API en `/api`.
- Reutilizar el certificado SSL Let's Encrypt ya configurado en Traefik para `vps-4778464-x.dattaweb.com`.
- Preservar la integridad de la base de datos SQLite en producción (`atenciones.db`).

---

### Task 1: Adaptar Prefijo Dinámico en Frontend (`scripts/build-bundle.js` y Bundle)

**Files:**
- Modify: `scripts/build-bundle.js:15-30`, `scripts/build-bundle.js:1900-1920`
- Generate: `public/js/dashboard-bundle.js`
- Test: `test-bundle-prefix.js`

**Interfaces:**
- `getApiUrl(endpoint: string): string` -> si `window.location.pathname.startsWith('/gestion')`, retorna `'/gestion' + endpoint`, sino retorna `endpoint`.
- `initWebSocketConnection()` -> usa prefijo `'/gestion'` si `window.location.pathname.startsWith('/gestion')`.

- [ ] **Step 1: Escribir prueba de verificación de la lógica de prefijo**

Crear script `scratch/test-prefix-logic.js`:
```javascript
const assert = require('assert');

function getApiUrl(endpoint, pathname = '/', protocol = 'http:') {
    if (protocol === 'file:') {
        return 'http://localhost:3000' + endpoint;
    }
    const isGestion = pathname.startsWith('/gestion');
    return (isGestion ? '/gestion' : '') + endpoint;
}

// Pruebas
assert.strictEqual(getApiUrl('/api/atenciones', '/'), '/api/atenciones');
assert.strictEqual(getApiUrl('/api/atenciones', '/dashboard.html'), '/api/atenciones');
assert.strictEqual(getApiUrl('/api/atenciones', '/gestion/'), '/gestion/api/atenciones');
assert.strictEqual(getApiUrl('/api/atenciones', '/gestion/dashboard.html'), '/gestion/api/atenciones');
assert.strictEqual(getApiUrl('/api/login', '/gestion', 'http:'), '/gestion/api/login');
assert.strictEqual(getApiUrl('/api/test', '/', 'file:'), 'http://localhost:3000/api/test');

console.log('✅ Todas las pruebas de prefijo de getApiUrl pasaron con éxito.');
```

- [ ] **Step 2: Ejecutar prueba unitaria para verificar lógica**

Comando: `node scratch/test-prefix-logic.js`  
Salida esperada: `✅ Todas las pruebas de prefijo de getApiUrl pasaron con éxito.`

- [ ] **Step 3: Modificar `scripts/build-bundle.js`**

Modificar la definición de `getApiUrl` e `initWebSocketConnection` en `scripts/build-bundle.js`:
En `getApiUrl`:
```javascript
    function getApiUrl(endpoint) {
        if (window.location.protocol === 'file:') {
            return 'http://localhost:3000' + endpoint;
        }
        const isGestion = window.location.pathname.startsWith('/gestion');
        return (isGestion ? '/gestion' : '') + endpoint;
    }
```

En `initWebSocketConnection`:
```javascript
            const isGestion = window.location.pathname.startsWith('/gestion');
            const wsPrefix = isGestion ? '/gestion' : '';
            if (window.location.protocol === 'file:') {
                wsUrl = 'ws://localhost:3000';
            } else {
                wsUrl = `${protocol}//${window.location.host}${wsPrefix}`;
            }
```

- [ ] **Step 4: Compilar bundle y verificar sintaxis**

Comando: `npm run build`  
Comando: `node -c public/js/dashboard-bundle.js`  
Salida esperada: Generación exitosa de `public/js/dashboard-bundle.js` sin errores de sintaxis.

- [ ] **Step 5: Commit de cambios locales**

```bash
git add scripts/build-bundle.js public/js/dashboard-bundle.js
git commit -m "feat(frontend): soporte de prefijo dinamico /gestion para api y websockets"
```

---

### Task 2: Configurar Ruteo Dinámico en Traefik (VPS)

**Files:**
- Create en VPS: `/etc/dokploy/traefik/dynamic/equipogestion-gestion.yml`

**Interfaces:**
- Router HTTP (web): `Host('vps-4778464-x.dattaweb.com') && PathPrefix('/gestion')` -> redirige a HTTPS.
- Router HTTPS (websecure): `Host('vps-4778464-x.dattaweb.com') && PathPrefix('/gestion')` con middleware `stripPrefix` -> service `equipogestion-dashboard-nmcufv-service-7`.

- [ ] **Step 1: Crear archivo de configuración dinámica en Traefik en la VPS**

Escribir vía SSH a `/etc/dokploy/traefik/dynamic/equipogestion-gestion.yml`:
```yaml
http:
  routers:
    equipogestion-gestion-web:
      rule: Host(`vps-4778464-x.dattaweb.com`) && PathPrefix(`/gestion`)
      service: equipogestion-dashboard-nmcufv-service-7
      middlewares:
        - redirect-to-https
      entryPoints:
        - web

    equipogestion-gestion-websecure:
      rule: Host(`vps-4778464-x.dattaweb.com`) && PathPrefix(`/gestion`)
      service: equipogestion-dashboard-nmcufv-service-7
      middlewares:
        - equipogestion-strip-gestion
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt

  middlewares:
    equipogestion-strip-gestion:
      stripPrefix:
        prefixes:
          - "/gestion"
```

- [ ] **Step 2: Probar resolución y enrutamiento con curl local en la VPS**

Ejecutar en la VPS:
```bash
curl -skI https://127.0.0.1:443/gestion/ -H "Host: vps-4778464-x.dattaweb.com"
```
Salida esperada: `HTTP/2 200` (o `HTTP/1.1 200`) con `content-type: text/html`.

---

### Task 3: Desplegar el Bundle Actualizado en la VPS

**Files:**
- Remote: `/etc/dokploy/applications/equipogestion-dashboard-nmcufv/code/public/js/dashboard-bundle.js`
- Remote container: `equipogestion-dashboard-nmcufv`

- [ ] **Step 1: Copiar el bundle actualizado a la VPS**

Copiar `public/js/dashboard-bundle.js` y `scripts/build-bundle.js` al directorio del código de Dokploy en la VPS:
```powershell
scp public/js/dashboard-bundle.js root@149.50.132.23:/etc/dokploy/applications/equipogestion-dashboard-nmcufv/code/public/js/dashboard-bundle.js
scp scripts/build-bundle.js root@149.50.132.23:/etc/dokploy/applications/equipogestion-dashboard-nmcufv/code/scripts/build-bundle.js
```

- [ ] **Step 2: Copiar el bundle dentro del contenedor en ejecución**

Copiar directamente al contenedor activo para que el cambio sea inmediato sin caída de servicio:
```bash
CONTAINER_ID=$(docker ps -q -f name=equipogestion-dashboard-nmcufv.1)
docker cp /etc/dokploy/applications/equipogestion-dashboard-nmcufv/code/public/js/dashboard-bundle.js $CONTAINER_ID:/app/public/js/dashboard-bundle.js
```

- [ ] **Step 3: Verificar que el bundle servido incluya el prefijo dinámico**

Comando:
```bash
curl -sk https://vps-4778464-x.dattaweb.com/gestion/js/dashboard-bundle.js | grep "isGestion"
```
Salida esperada: Debe encontrar la coincidencia `isGestion = window.location.pathname.startsWith('/gestion')`.

---

### Task 4: Verificación Integral de Acceso y Pruebas End-to-End

**Files:** N/A (Verificación)

- [ ] **Step 1: Verificar acceso desde la red de la oficina (sin bloqueos de Fortinet)**

Comando PowerShell:
```powershell
Invoke-WebRequest -Uri "https://vps-4778464-x.dattaweb.com/gestion/" -UseBasicParsing | Select-Object StatusCode
```
Salida esperada: `StatusCode: 200`.

- [ ] **Step 2: Verificar llamadas a la API a través del subpath `/gestion`**

Comando PowerShell:
```powershell
Invoke-WebRequest -Uri "https://vps-4778464-x.dattaweb.com/gestion/health" -UseBasicParsing | Select-Object StatusCode, Content
```
Salida esperada: `StatusCode: 200` y `{"status":"ok",...}`.

- [ ] **Step 3: Verificar que la web institucional no fue afectada**

Comando PowerShell:
```powershell
Invoke-WebRequest -Uri "https://vps-4778464-x.dattaweb.com/" -UseBasicParsing | Select-Object StatusCode
Invoke-WebRequest -Uri "https://vps-4778464-x.dattaweb.com/api" -UseBasicParsing -SkipHttpErrorCheck | Select-Object StatusCode
```
Salida esperada: Ambos responden normalmente según la configuración previa.
