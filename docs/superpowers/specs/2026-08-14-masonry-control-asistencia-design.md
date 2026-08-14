# Design Spec: Rediseño de Pestaña "Control Asistencia" con Muro Masonry (Pinterest-Style)

**Fecha**: 2026-08-14  
**Proyecto**: Sistema de Gestión de Atenciones - Defensoría Pública (Mendoza)  
**Módulo**: Modal de Operaciones de Presentismo (`presenceGridModal` - Pestaña `presenceGridSection`)  

---

## 1. Contexto y Objetivos

La pestaña de **Control Asistencia** utilizaba anteriormente pills redondeados horizontales estrechos que, al contener múltiples micro-etiquetas de especialidad (ej. `ASES. GEN. | CONTESTACIÓN`), provocaban desbordamiento visual de texto, solapamiento y una apariencia poco profesional.

Se rediseñará esta pestaña reemplazando la cuadrícula apretada por un **Muro Masonry (Estilo Pinterest)** con **Tarjetas Ejecutivas de Defensora**, donde cada profesional se presenta en una tarjeta espaciosa de 2 columnas con avatar, switch de presencia y chips verticales sin compresión de texto.

---

## 2. Especificación de Diseño Visual y Funcional

### A. Layout Muro Masonry (Pinterest-Style)
- **CSS Nativo Primero**:
  ```css
  .presence-masonry-container {
      column-count: 2;
      column-gap: 0.85rem;
  }
  
  @supports (grid-template-rows: masonry) {
      .presence-masonry-container {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          grid-template-rows: masonry;
          gap: 0.85rem;
          column-count: initial;
      }
  }
  ```
- **Fallback Multi-columna CSS**:
  - `column-count: 2; column-gap: 0.85rem;`
  - Cada tarjeta utiliza `break-inside: avoid; margin-bottom: 0.85rem; display: inline-block; width: 100%;` para evitar cortes entre columnas.

---

### B. Estructura de la Tarjeta de Defensora (`presence-card-masonry`)
Cada tarjeta posee las siguientes secciones:
1. **Header de la Tarjeta**:
   - **Avatar/Icono**: Avatar en círculo con icono de perfil profesional (`ri-user-star-line`).
   - **Nombre de la Defensora**: Nombre formateado (`Dra. Mariela Fokszek`).
   - **Switch / Toggle de Asistencia**: Switch visual a la derecha (`.switch-toggle`) o badge interactivo (`Presente` / `Ausente`).
2. **Cuerpo de Turnos Asignados**:
   - Si la defensora no tiene turnos rotativos asignados en el día: se muestra una micro-leyenda *"Sin turno rotativo asignado hoy"*.
   - Si tiene turnos asignados: se genera un contenedor de etiquetas verticales (`.card-duty-list`) donde cada motivo de turno aparece en un chip independiente de ancho completo:
     - **Asesoría General**: Magenta/Rosa (`#EC4899`) con icono `ri-file-user-line`
     - **Causa Nueva**: Azul/Cyan (`#0EA5E9`) with icon `ri-folder-add-line`
     - **Contestación**: Dorado/Ámbar (`#F59E0B`) with icon `ri-edit-2-line`
     - **Adopción / Guarda**: Púrpura/Violeta (`#8B5CF6`) with icon `ri-heart-add-line`
3. **Interactividad**:
   - Hacer clic en la tarjeta o en el switch alterna inmediatamente la presencia del profesional (`isPresente`).

---

## 3. Arquitectura de Cambios por Archivo

1. **`dashboard.html`**:
   - Actualizar el contenedor `#presenceGridContainer` en `dashboard.html` para usar la clase `.presence-masonry-container`.

2. **`dashboard.css`**:
   - Estilos para `.presence-masonry-container`, `.presence-card-masonry`, `.card-header`, `.card-duty-list`, `.duty-badge-block`, y el switch de asistencia.
   - Reglas de `@supports (grid-template-rows: masonry)` y el fallback multi-columna.

3. **`build-bundle.js` / `dashboard-bundle.js`**:
   - Actualizar la función `renderPresenceRoster()` para generar las nuevas tarjetas ejecutive Masonry en lugar de los pills simplificados en el contenedor de asistencia.
   - Preservar la funcionalidad del Marquee Ticker en la parte superior y la lista Drag & Drop en la pestaña secundaria.

---

## 4. Plan de Verificación

1. **Verificación Estética & Layout Masonry**:
   - Abrir la pestaña "Control Asistencia" y verificar la distribución en 2 columnas estilo Masonry.
   - Confirmar que las tarjetas con múltiples asignaciones de turno muestran sus chips verticales sin cortar o desbordar texto.
2. **Verificación de Interactividad**:
   - Hacer clic en cualquier tarjeta/switch y verificar que cambia de estado visual (Presente -> Ausente) y actualiza el Marquee Ticker y la base de datos.
3. **Verificación Responsive & Fallback**:
   - Probar la vista en navegadores con y sin soporte nativo de `grid-template-rows: masonry` (usando la propiedad multi-column CSS fallback).
