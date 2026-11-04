# Diseño: Enrutamiento Dedicado `/gestion` en Traefik (VPS)

**Fecha:** 2026-11-04  
**Objetivo:** Permitir el acceso al sistema de gestión a través de `https://vps-4778464-x.dattaweb.com/gestion/` para evitar el bloqueo del firewall judicial (FortiGuard / Dynamic DNS en `*.sslip.io`), conviviendo con la web institucional alojada en el mismo dominio.

---

## 1. Arquitectura y Ruteo (Traefik)

En el servidor remoto (VPS de DonWeb), Traefik gestiona el tráfico entrante en los puertos 80 y 443 con certificado SSL Let's Encrypt para `vps-4778464-x.dattaweb.com`.

### Archivo de Configuración Dinámica de Traefik
Ubicación: `/etc/dokploy/traefik/dynamic/equipogestion-gestion.yml`

```yaml
http:
  routers:
    equipogestion-gestion-router-web:
      rule: Host(`vps-4778464-x.dattaweb.com`) && PathPrefix(`/gestion`)
      service: equipogestion-dashboard-nmcufv-service-7
      middlewares:
        - redirect-to-https
      entryPoints:
        - web

    equipogestion-gestion-router-websecure:
      rule: Host(`vps-4778464-x.dattaweb.com`) && PathPrefix(`/gestion`)
      service: equipogestion-dashboard-nmcufv-service-7
      middlewares:
        - equipogestion-gestion-stripprefix
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt

  middlewares:
    equipogestion-gestion-stripprefix:
      stripPrefix:
        prefixes:
          - "/gestion"
```

### Comportamiento de Ruteo:
1. Petición externa: `https://vps-4778464-x.dattaweb.com/gestion/...`
2. Traefik remueve el prefijo `/gestion` mediante `stripPrefix`.
3. El contenedor Docker de `equipogestion-dashboard-nmcufv:3000` recibe la petición como ruta raíz (`/`, `/api/atenciones`, etc.).
4. No colisiona con `mpdwebinstitucional-backend` (que escucha en `Host(...) && PathPrefix(/api)`), ya que las llamadas de gestión hacia el exterior estarán bajo `/gestion/api/...`.

---

## 2. Adaptación del Frontend (`scripts/build-bundle.js` & `public/js/dashboard-bundle.js`)

Todos los recursos estáticos en `public/index.html` ya son relativos (`css/dashboard.css`, `assets/...`, `js/...`), por lo que al acceder a `/gestion/` se resuelven automáticamente a `/gestion/css/...`, `/gestion/assets/...`, etc.

Para las llamadas AJAX y WebSocket:
1. **Función `getApiUrl(endpoint)`**:
   ```javascript
   function getApiUrl(endpoint) {
       if (window.location.protocol === 'file:') {
           return 'http://localhost:3000' + endpoint;
       }
       const basePath = window.location.pathname.startsWith('/gestion') ? '/gestion' : '';
       return basePath + endpoint;
   }
   ```
2. **Conexión WebSocket (`initWebSocketConnection`)**:
   ```javascript
   const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
   let wsUrl = '';
   if (window.location.protocol === 'file:') {
       wsUrl = 'ws://localhost:3000';
   } else {
       const wsPrefix = window.location.pathname.startsWith('/gestion') ? '/gestion' : '';
       wsUrl = `${protocol}//${window.location.host}${wsPrefix}`;
   }
   ```
3. **Regeneración de assets**:
   Ejecutar `npm run build` para actualizar `public/js/dashboard-bundle.js`.

---

## 3. Manejo de Redirección con Trailing Slash

Si un usuario escribe en el navegador `https://vps-4778464-x.dattaweb.com/gestion` (sin la barra final), el navegador interpretaría las rutas relativas contra la raíz en lugar de `/gestion/`.

* En `server.js` o middleware Traefik, si la URL entrante no tiene barra final y corresponde al alias de dashboard, se asegura que las referencias relativas funcionen o se redirija a `/gestion/`.

---

## 4. Plan de Verificación

1. **Compilación local**:
   * Ejecutar `npm run build` y verificar que no haya errores de sintaxis en el bundle.
2. **Aplicación en VPS**:
   * Desplegar el archivo dinámico en Traefik `/etc/dokploy/traefik/dynamic/equipogestion-gestion.yml`.
   * Actualizar el código y bundle en `/etc/dokploy/applications/equipogestion-dashboard-nmcufv/code` o reconstruir el contenedor.
3. **Prueba de Red y Firewall**:
   * Probar `curl -skI https://vps-4778464-x.dattaweb.com/gestion/`.
   * Probar carga del HTML y bundle desde la red de la oficina.
   * Probar login y carga de datos de la API (`/gestion/api/atenciones`).
   * Verificar que la web institucional (`https://vps-4778464-x.dattaweb.com/` y `/api`) continúe funcionando sin perturbaciones.
