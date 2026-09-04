# 🏛️ Especificación de Diseño: Vinculación y Asignación de Defensora y Co-Defensoras en Defensoría Civil

**Fecha**: 4 de Septiembre, 2026  
**Estado**: Aprobado por el usuario  
**Proyecto**: `equipo-gestion` (Ministerio Público de la Defensa - Mendoza)  
**Autor**: Antigravity Pair Programmer & Usuario  

---

## 📌 1. Visión General y Objetivos

En el sistema de gestión de atenciones del Ministerio Público de la Defensa, actualmente al registrar una atención para el fuero de **Defensoría Civil (`DEF. CIVIL`)**, únicamente queda asentado el Operador de Mesa de Entrada que abre el registro (`atendido_por`), sin posibilidad de vincular a la **Defensora Civil Titular** ni a las **Co-Defensoras Civiles**.

Esta especificación establece la solución integral para:
1. **Permitir la vinculación directa de profesionales de Defensoría Civil**:
   - **Dra. Jorgelina Bayón** (Defensora Civil)
   - **Dra. Alejandra Di Menza** (Co-Defensora Civil)
   - **Dra. Laura Alvarado** (Co-Defensora Civil)
   - Opción vacía o sin asignar cuando el trámite es resuelto íntegramente por el operador en mesa.
2. **Sugerencia inteligente por historial / Causa en Trámite**:
   - Cuando el ciudadano comparece y se detecta en su historial que ya fue atendido en `DEF. CIVIL` por alguna de las profesionales, el sistema preselecciona automáticamente a esa misma defensora/codefensora, garantizando continuidad de la defensa y agilidad en mesa de entrada.
   - El operador siempre mantiene la potestad de confirmar, cambiar la profesional o dejar el campo vacío.
3. **Identificación visual en la tabla principal y modal de detalle**:
   - En la columna de atención de la tabla principal, si existe profesional asignada en `DEF. CIVIL`, se exhibe su nombre destacado en color celeste (`#38BDF8`) con el rótulo del operador en gris debajo (`Operador: [Nombre]`).
   - En la ficha de detalle y modal de edición se visualiza y edita la asignación.
4. **Búsqueda y filtrado en tiempo real**:
   - El buscador general permite localizar y filtrar las atenciones asociadas a cada una de las profesionales de civil por nombre y apellido.

---

## 🏗️ 2. Arquitectura y Componentes Afectados

```mermaid
graph TD
    A[Modal Nueva / Editar Atención (public/index.html)] -->|POST / PUT /api/atenciones| B[server.js REST API]
    B -->|Persistencia en atenciones.db| C[(SQLite Database)]
    B -->|WebSocket broadcast| D[Clientes Conectados / Dashboard]
    D -->|Renderizado con badge celeste| E[Tabla Principal de Atenciones]
    D -->|Filtro en tiempo real| F[Buscador de Dashboard]
```

### Componentes a Modificar:

1. **`public/index.html`**:
   - Dentro del contenedor `#fueroCivilSection`, incorporar el selector `#newDefensoraCivil` con su label, icono de usuario y badge dinámico `#defensoraCivilBadgeStatus` (`Sugerida por Historial`).
2. **`scripts/build-bundle.js`**:
   - Referenciar el elemento `#newDefensoraCivil` y `#defensoraCivilBadgeStatus` en `DashboardViewController`.
   - Modificar `handleFueroChange()` para mostrar/ocultar y gestionar el valor del selector al alternar de fuero.
   - Modificar `handleCitizenSearch()` / procesamiento de historial para preseleccionar la defensora civil si se detectan atenciones previas en `DEF. CIVIL`.
   - Modificar `openEditRecordModal()` para cargar y preseleccionar la profesional asignada al editar una atención civil existente.
   - Modificar el envío del formulario (`submitBtn`) para extraer el valor de `#newDefensoraCivil` y enviarlo como `codefensoraAsignada` en `POST` y `PUT`.
   - Actualizar el renderizado de la tabla principal (`updateView`) para que cuando `dto.defensoriaName === 'DEF. CIVIL'` y tenga profesional asignada, se muestre su nombre en color celeste `#38BDF8` y abajo el operador de mesa.
   - Actualizar el modal de detalle para mostrar el bloque de *Defensora / Co-Defensora Civil Asignada*.
   - Asegurar que el filtro/buscador indexe el campo de la profesional asignada en civil.
3. **`server.js`**:
   - Modificar `handlePostAtencion`: permitir que `codefensora = (isFamilia || isCivil) ? (data.codefensoraAsignada || '') : '';`.
   - Modificar `handlePutAtencion`: actualizar y persistir `codefensora_asignada` cuando el fuero sea `DEF. CIVIL`.
4. **`public/dashboard.html` y `public/js/dashboard-bundle.js`**:
   - Sincronizados automáticamente al ejecutar `node scripts/build-bundle.js`.

---

## 🗄️ 3. Contratos de Datos y Esquema

### Valores del Selector Civil (`newDefensoraCivil`):
- `""`: `-- Sin asignar (Resuelve Operador en Mesa) --`
- `"Jorgelina Bayón"`: `Dra. Jorgelina Bayón (Defensora Civil)`
- `"Alejandra Di Menza"`: `Dra. Alejandra Di Menza (Co-Defensora)`
- `"Laura Alvarado"`: `Dra. Laura Alvarado (Co-Defensora)`

### Mapeo en Base de Datos:
Se reutiliza la columna existente `codefensora_asignada TEXT` en la tabla `atenciones`, evitando migraciones de esquema y manteniendo total retrocompatibilidad.

- En `POST /api/atenciones` y `PUT /api/atenciones`:
  ```json
  {
    "id": 123,
    "defensoria": "DEF. CIVIL",
    "motivo": "Determinación de Capacidad",
    "resultado": "Entrevista con Defensor/a",
    "atendidoPor": "Sergio M. Pereyra",
    "codefensoraAsignada": "Jorgelina Bayón"
  }
  ```

---

## 🔍 4. Casos de Prueba y Verificación

1. **Creación de nueva atención en Defensoría Civil con asignación**:
   - Seleccionar `DEF. CIVIL`.
   - Elegir a *Dra. Jorgelina Bayón*.
   - Guardar atención y verificar que en la tabla aparezca `Dra. Jorgelina Bayón` en celeste y debajo `Operador: [Nombre]`.
2. **Creación sin asignación (Resuelta en mesa)**:
   - Seleccionar `DEF. CIVIL` dejando el selector en *Sin asignar*.
   - Guardar y verificar que aparezca únicamente el nombre del operador.
3. **Sugerencia automática por historial**:
   - Ingresar un DNI previamente vinculado a *Dra. Laura Alvarado* en Civil.
   - Verificar que el selector se complete automáticamente y aparezca la insignia `Sugerida por Historial`.
4. **Edición de atención existente**:
   - Abrir el modal de edición de una atención de Civil.
   - Modificar de *Dra. Alejandra Di Menza* a *Dra. Jorgelina Bayón*.
   - Guardar y verificar persistencia en SQLite y actualización inmediata en la tabla.
5. **Búsqueda**:
   - Escribir *"Alvarado"* o *"Bayón"* en el buscador del dashboard y verificar filtrado en tiempo real.
