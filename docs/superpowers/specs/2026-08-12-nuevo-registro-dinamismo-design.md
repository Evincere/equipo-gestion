# 🏛️ Especificación de Diseño: Dinamismo del Formulario de Registro y Flujo de Antecedentes

**Fecha**: 12 de Agosto, 2026  
**Estado**: Aprobado por el usuario  
**Proyecto**: `equipo-gestion` (Ministerio Público de la Defensa - Mendoza)  

---

## 📌 1. Visión General y Objetivos

Esta especificación establece las reglas del **Formulario Adaptativo de Registro de Atenciones** para optimizar la carga de datos por el operador de mesa de entrada, eliminando duplicaciones visuales, contextualizando las materias y motivos al Fuero de Familia y adecuando las opciones de resultado de la atención.

---

## ⚙️ 2. Reglas del Formulario Adaptativo

### A. Ocultamiento Dinámico `MODO DE DERIVACIÓN` ➡️ `SUPUESTO ESPECIAL / MATERIA`
- Al seleccionar **`CO-DEF. FAMILIA`**:
  - Si la Causa de Derivación es **`Guarda Judicial / Tutela / Adopción`**:
    - Se **oculta el contenedor `#familySubmotivoGroup`** (*SUPUESTO ESPECIAL / MATERIA*) de la pantalla para evitar duplicidad.
    - El sistema asigna internamente `submotivo = "Guarda Judicial / Tutela / Adopción"`.
  - Si la Causa de Derivación es cualquier otra (*Asesoramiento General*, *Causa Nueva*, *Contestación de Demanda*, *Causa en Trámite*, *Otro*):
    - Se **mantiene visible** `#familySubmotivoGroup` para seleccionar la materia específica (Mediación, Alimentos, Cuidado Personal, Filiación, etc.).

### B. Contextualización del Campo `MOTIVO GENERAL`
- Cuando la Defensoría / Área sea **`CO-DEF. FAMILIA`**:
  - El desplegable `#newMotivo` muestra exclusivamente opciones pertinentes a Familia:
    1. `Espontánea`
    2. `Causa en Trámite`
    3. `Turno`
    4. `Otro`
  - Se remueven las opciones no pertinentes (*Divorcio*, *Ejecución*, *Aud. Imputación*).
- Para otras áreas/defensorías:
  - Se mantiene la lista completa de motivos generales.

### C. Opciones de `RESULTADO` y Especificación de Repartición
- Cuando la Defensoría / Área sea **`CO-DEF. FAMILIA`**:
  - El desplegable `#newResultado` ofrece únicamente:
    1. **`Resuelve operador`**: La atención finaliza en mesa de entrada con la intervención del operador sin derivación a Co-Defensora.
    2. **`Entrevista con Codefensor`**: El ciudadano es derivado efectivamente a ser entrevistado por la Co-Defensora asignada.
    3. **`Derivado a otra repartición`**: Al seleccionar esta opción, se despliega un campo de texto adicional `#reparticionDetalleGroup` con el placeholder `Especificar repartición (Ej: ETI, Asesoría de Niñez, Registro Civil)...`.
    4. **`Otro`**.

### D. Interacción con Antecedentes del Ciudadano
- La búsqueda primaria por DNI en el Paso 1 rescata atenciones previas de SQLite:
  - Si viene por **`Causa en Trámite`**, pre-selecciona a la Co-Defensora previamente vinculada a la causa (con alerta visual si está ausente).
  - Si viene por **`Causa Nueva`**, **`Asesoramiento General`** o **`Guarda Judicial / Tutela / Adopción`**, obtiene la recomendación del algoritmo Round-Robin.
  - El operador puede modificar manualmente la Co-Defensora sugerida si es necesario.
  - Al guardar, el registro se vincula al DNI actualizando el historial del ciudadano para consultas futuras.

---

## 🗄️ 3. Cambios en Base de Datos y Persistencia

Se asegura la existencia de la columna `detalle_reparticion` en la tabla `atenciones`:
```sql
ALTER TABLE atenciones ADD COLUMN detalle_reparticion TEXT;
```

---

## 🧪 4. Plan de Verificación

1. **Prueba de Ocultamiento de Materia**:
   - Seleccionar `CO-DEF. FAMILIA` y derivación `Guarda Judicial / Tutela / Adopción`. Confirmar que el contenedor `#familySubmotivoGroup` desaparece de la vista.
   - Cambiar a `Causa Nueva` y confirmar que `#familySubmotivoGroup` vuelve a aparecer.
2. **Prueba de Motivo General**:
   - Seleccionar `CO-DEF. FAMILIA` y verificar que `#newMotivo` solo ofrece `Espontánea`, `Causa en Trámite`, `Turno`, `Otro`.
3. **Prueba de Resultado y Repartición**:
   - Seleccionar `CO-DEF. FAMILIA` y elegir `Derivado a otra repartición`. Confirmar que aparece el campo de texto y se guarda `detalle_reparticion` en SQLite.
4. **Build & Bundle Check**:
   - Ejecutar `npm run build` para asegurar la compilación de `dashboard-bundle.js`.
