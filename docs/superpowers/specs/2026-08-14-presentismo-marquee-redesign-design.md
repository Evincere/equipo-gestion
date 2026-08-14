# Design Spec: Rediseño del Panel de Presentismo y Turnos Rotativos (Marquee Ticker Compacto)

**Fecha**: 2026-08-14  
**Proyecto**: Sistema de Gestión de Atenciones - Defensoría Pública (Mendoza)  
**Módulo**: Dashboard principal (`presence-panel`)  

---

## 1. Contexto y Objetivos

Actualmente, el panel de **Presentismo Co-Defensoría de Familia (Turnos Rotativos)** ocupa un espacio vertical considerable en la zona superior del dashboard (~120px). Contiene dos filas separadas:
1. Indicadores de la próxima co-defensora de turno asignada según el motivo (Asesoría General, Causa Nueva, Contestación, Adopción).
2. Lista de co-defensoras presentes (pills verdes).

Esta información es muy relevante al iniciar la jornada, pero durante el día permanece estática (o cambia automáticamente sin requerir intervención directa del operador). Para liberar espacio de pantalla sin perder visibilidad, se rediseñará este panel convirtiéndolo en un **Cintillo Marquee Horizontal Autónomo**, ultra-compacto (~42px de alto), con **Edge Fade Masks** y **Pills Unificados Inteligentes**.

---

## 2. Especificación de Diseño Visual y Funcional

### A. Marquee Ticker Horizontal
- **Scroll Infinito fluido**: Implementado exclusivamente mediante CSS `@keyframes translateX(-50%)` animando sobre la pista interna duplicada (2x exactos de la lista de pills). Sin etiquetas obsoletas `<marquee>`.
- **Desvanecimiento en bordes (Edge Fade Masks)**: Uso de `mask-image` (y `-webkit-mask-image`) con `linear-gradient(to right, transparent, black 6%, black 94%, transparent)` para que los pills aparezcan y desaparezcan gradualmente en los extremos de la barra sin corte rígido.
- **Pausa al interactuar**: Al pasar el puntero sobre cualquier pill o sobre la pista (`:hover`), la animación entra en `animation-play-state: paused`.
- **Accesibilidad**: Soporte para `@media (prefers-reduced-motion: reduce)`, el cual desactiva la animación por CSS y habilita el deslazamiento manual mediante scrollbar horizontal discreto / wheel / swipe.

### B. Badges / Pills Unificados Inteligentes
En lugar de tener dos conjuntos separados de elementos, cada defensora se representa con un único **Pill Unificado**:
- **Dot de Asistencia**:
  - `Verde (#4ADE80)` con pulso sutil si está **Presente**.
  - `Gris/Rojo (#64748B / #EF4444)` si está **Ausente**.
- **Nombre del Profesional**: Nombre formateado (ej. `Dra. Mariela Fokszek`).
- **Color de Especialidad de Turno (Borde / Acento)**:
  - **Asesoría General**: Magenta / Rosa (`#EC4899`)
  - **Causa Nueva**: Cyan / Azul (`#0EA5E9`)
  - **Contestación**: Dorado / Ámbar (`#F59E0B`)
  - **Adopción / Guarda**: Púrpura / Violeta (`#8B5CF6`)
- **Micro-Etiqueta / Chip de Turno**: Chip compacto dentro del pill que indica la especialidad activa que le corresponde por turno rotativo (ej. `[Ases. Gen.]`, `[Causa Nva.]`).
- **Interactividad**: Hacer clic sobre cualquier pill mantiene la capacidad del operador de cambiar el estado de presentismo (Presente / Ausente).

### C. Botón de Control y Modo Cuadrícula (Grid View)
- A la derecha del cintillo se ubica un botón discreto: **"Ver Equipo / Cuadrícula"** (`btnExpandPresence`).
- Al presionar este botón, se abre un modal sutil (`presenceGridModal`) o panel desplegable en cuadrícula donde el operador puede inspeccionar rápidamente todo el equipo, filtrar por nombre o modificar masivamente el presentismo de la jornada.

---

## 3. Arquitectura de Componentes y Modificaciones

### 1. `dashboard.html`
- Sustituir la estructura actual de `.presence-panel` por la nueva estructura del Marquee:
  ```html
  <div class="presence-marquee-container">
      <div class="presence-marquee-header">
          <span class="presence-marquee-title">
              <i class="ri-user-follow-line"></i> Turnos & Presentismo
          </span>
      </div>
      <div class="presence-marquee-wrapper" id="presenceMarqueeWrapper">
          <div class="presence-marquee-track" id="presenceMarqueeTrack">
              <!-- Se inyectan los pills duplicados desde JS -->
          </div>
      </div>
      <button class="btn-expand-presence" id="btnExpandPresence" title="Ver todo el equipo en cuadrícula">
          <i class="ri-grid-fill"></i>
      </button>
  </div>
  ```
- Agregar el modal `presenceGridModal` al final del documento.

### 2. `dashboard.css`
- Definir la animación de marquee y la máscara de desvanecimiento:
  ```css
  .presence-marquee-wrapper {
      position: relative;
      overflow: hidden;
      mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%);
      -webkit-mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%);
  }
  .presence-marquee-track {
      display: flex;
      gap: 0.75rem;
      width: max-content;
      animation: marqueeScroll 35s linear infinite;
  }
  .presence-marquee-track:hover {
      animation-play-state: paused;
  }
  @keyframes marqueeScroll {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
  }
  ```
- Estilos para los pills unificados (`presence-pill-unified`), sus variantes de color (`duty-asesoria`, `duty-causa`, `duty-contestacion`, `duty-adopcion`), los dots de presencia y los micro-chips.

### 3. Lógica JS (`build-bundle.js` / `dashboard-bundle.js` / `server.js` si requiere auditoría)
- Actualizar `renderPresenceRoster()` en el frontend:
  - Mapear la lista de defensoras y cruzar la información de turnos vigentes con su estado `isPresente`.
  - Generar el HTML de los pills unificados.
  - Duplicar el array de pills en el DOM dentro de `presenceMarqueeTrack` para lograr el bucle sin saltos (seamless loop).
  - Vincular event listeners de clic para alternar presentismo y actualizar en tiempo real vía WebSocket / API.

---

## 4. Plan de Verificación

1. **Verificación Estética & Animación**:
   - Comprobar que el cintillo tiene un alto compacto (~42px) y que los bordes izquierdo y derecho se desvanecen suavemente con la máscara gradiente.
   - Verificar que al posar el ratón sobre cualquier pill la animación se detiene para permitir la lectura y el clic.
   - Probar `@media (prefers-reduced-motion)` en inspector para asegurar la desactivación accesible del movimiento.
2. **Verificación de Datos y Colores**:
   - Confirmar que los color-codes (Rosa, Azul, Dorado, Púrpura) coinciden con los motivos de turno correspondiente.
   - Comprobar que el punto de presencia verde/rojo refleja con precisión el estado guardado.
3. **Verificación de Interactividad**:
   - Hacer clic en un pill dentro del Marquee para cambiar la asistencia y verificar que se notifica correctamente vía WebSocket / Toast y auditoría.
   - Probar la apertura y funcionalidad del modal de cuadrícula (`btnExpandPresence`).
