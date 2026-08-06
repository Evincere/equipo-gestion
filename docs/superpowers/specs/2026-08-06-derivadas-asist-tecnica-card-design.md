# Especificación de Diseño: Card Interactiva y Desglose de "Derivadas Asist. Técnica"

**Fecha:** 06/08/2026  
**Módulo:** Dashboard / Tarjetas de Indicadores (KPIs)  
**Estado:** Aprobado por el usuario  

---

## 1. Contexto y Propósito

Actualmente, la tarjeta (card) **"DERIVADAS ASIST. TÉCNICA"** en el Dashboard únicamente muestra la cifra total de atenciones que fueron derivadas a asistencia técnica o interdisciplinaria (ETI, Trabajo Social, Psicología, Asesorías, etc.).

El objetivo de esta mejora es otorgar interactividad a dicha tarjeta para permitir al operador:
1. **Filtrar la tabla principal al instante** haciendo clic sobre la card para ver solo las derivaciones a asistencia técnica.
2. **Visualizar un desglose detallado por áreas u organismos técnicos** a través de un panel desplegable (popover).
3. **Filtrar por áreas específicas** haciendo clic en cualquiera de las subdivisiones del desglose.

---

## 2. Componentes e Interfaz de Usuario (UI)

### 2.1 Modificaciones en `dashboard.html`
- **Contenedor de la Card:**
  - Se añade un ID explícito `cardDerivadasTecnica` y estilos para estado interactivo (`cursor: pointer`).
  - Se incorpora un botón de desglose `<button id="btnToggleTecnicaBreakdown">` con icono `ri-pie-chart-line`.
  - Se agrega un contenedor desplegable `<div id="tecnicaBreakdownPopover">` posicionado de manera flotante respecto a la card.

### 2.2 Desglose por Áreas Técnicas
El panel desplegable contendrá una lista categorizada con los siguientes rubros:
- 🏢 **ETI / Medidas de Protección**
- 🧠 **Psicología / Trabajo Social**
- ⚖️ **Asesoría de Niñez / Capacidad**
- 📋 **Otras Asistencias Técnicas**

Cada ítem mostrará la cantidad de registros asociados y responderá al clic del operador para aplicar un filtro secundario específico.

### 2.3 Indicador Visual de Filtro Activo
- Cuando un filtro derivado de esta card esté activo:
  - La card adoptará una clase CSS `.active-filter-card` (resaltado con borde luminoso magenta).
  - Se mostrará una etiqueta/badge flotante *"Filtro: Asistencia Técnica"* con botón "X" para restablecer la vista normal.

---

## 3. Lógica de Aplicación (`build-bundle.js` / `DashboardViewController`)

### 3.1 Manejo de Estado
Se incorporan las siguientes propiedades al controlador principal:
- `activeTecnicaFilter`: `boolean` (indica si el filtro por derivación técnica general está activo).
- `activeTecnicaCategory`: `string | null` (almacena la categoría técnica específica seleccionada en el desglose).

### 3.2 Reglas de Filtrado
En el método `matchesFilters(entity)`:
- Si `activeTecnicaFilter` es `true`, el registro debe cumplir `entity.isDerivacionTecnica() === true`.
- Si `activeTecnicaCategory` posee valor, el registro debe contener términos relacionados a esa área específica en sus campos `resultado`, `derivadoA` o `motivo`.

### 3.3 Cálculo del Desglose en `updateSummaryView()`
- Se escanean los registros activos y se categorizan en las 4 áreas principales analizando patrones de texto.
- Se actualizan dinámicamente los contadores en el popover `tecnicaBreakdownPopover`.

---

## 4. Plan de Verificación

1. **Prueba de Clic en Card:** Verificar que al hacer clic en la tarjeta, la tabla filtra inmediatamente y muestra el badge de filtro activo.
2. **Prueba de Desglose:** Abrir el popover y comprobar que los conteos sumen el total indicado en la card.
3. **Prueba de Filtro por Categoría:** Hacer clic en "ETI / Medidas de Protección" y verificar que la tabla muestre solo esos registros.
4. **Prueba de Limpieza de Filtro:** Verificar que al hacer un segundo clic en la card o en el botón "X", la tabla retorne a la vista normal.
