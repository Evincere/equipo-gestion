# 🏛️ Especificación de Diseño: Continuación y Vinculación de Trámites Históricos

**Fecha**: 12 de Agosto, 2026  
**Estado**: Aprobado por el usuario  
**Proyecto**: `equipo-gestion` (Ministerio Público de la Defensa - Mendoza)  

---

## 📌 1. Visión General y Objetivos

Esta especificación define la funcionalidad de **Continuación de Trámites Históricos desde la Mesa de Entrada**. Al ingresar el DNI de un ciudadano en el formulario de registro, el operador podrá seleccionar un trámite previo directamente del panel de antecedentes para auto-completar los datos estructurales del expediente y la Co-Defensora asignada, reduciendo la carga duplicada y garantizando la continuidad de la atención.

---

## ⚙️ 2. Reglas del Flujo de Continuación

### A. Botones de Acción en Tarjetas del Historial (`renderCitizenHistoryPanel`)
- En el panel de antecedentes del ciudadano (Paso 1 del formulario de registro), cada tarjeta de atención histórica incluirá dos acciones con botones claros:
  1. **`👁️ Ver Ficha`**: Abre el modal flotante con el detalle completo de esa atención pasada.
  2. **`🔗 Continuar este Trámite`**: Activa la continuidad de esa atención específica en el formulario actual.

### B. Pre-Llenado Inteligente y Formulario Adaptativo
- Al hacer clic en **`🔗 Continuar este Trámite`**:
  - **Defensoría / Área**: Pre-selecciona la Defensoría del trámite histórico (`CO-DEF. FAMILIA` o la que corresponda).
  - **Modo / Causa de Derivación**: Se establece automáticamente en **`Causa en Trámite`**.
  - **Co-Defensora Asignada**: Pre-selecciona a la Co-Defensora asignada previamente en esa causa (ej: *Dra. Andrea Lombard*).
    - *Alerta de Presencia*: Si la Co-Defensora figura **Ausente** en el sistema, se despliega un mensaje informativo en tono ámbar indicando su estado y motivo de ausencia, permitiendo mantenerla o re-asignarla si la urgencia lo amerita.
  - **N° Expediente**: Pre-llena el número de expediente de la atención previa (si existiese).
  - **Materia / Supuesto Especial**: Pre-selecciona la materia del trámite previo.

### C. Banner Cyan de Vinculación y Desvinculación Libre
- Se muestra un banner cyan destacado en la cabecera del formulario de registro:
  > **`🔗 CONTINUANDO TRÁMITE PREVIO (Atención N° X | Dra. Andrea Lombard | Guarda Judicial / Tutela / Adopción)`**
- Incluye el botón **`[Desvincular / Trámite Nuevo]`**, el cual limpia la referencia histórica, restablece el modo derivación y permite iniciar un trámite independiente.
- **Edición Libre**: Todos los campos del formulario permanecen modificables por si el operador necesita actualizar algún dato (ej: ingresar un N° de expediente asignado en el día).

### D. Enfoque del Operador en Carga Diaria
- Al estar los datos estructurales vinculados, el operador solo completa:
  - **Fecha**: Pre-llenada con el día actual.
  - **Actividad**: Atención Personal, Telefónica, etc.
  - **Resultado de la sesión de hoy**: `Entrevista con Codefensor`, `Resuelve operador`, `Derivado a otra repartición`, etc.
  - **Observaciones del avance del día**: Texto libre con el progreso u objetos aportados por el ciudadano (ej: *"Aporta documentación requerida para adopción"*).
  - **Tarea Pendiente**: Si fue requerido programar una acción futura.

---

## 🗄️ 3. Trazabilidad en Base de Datos

Cada nueva atención creada en continuidad guarda la columna `expte`, `defensoria`, `modo_derivacion_familia = 'Causa en Trámite'`, `codefensora_asignada` y `observaciones` propias de la sesión del día, manteniendo la coherencia histórica en la tabla `atenciones` de SQLite.

---

## 🧪 4. Plan de Verificación

1. **Prueba de Selección desde Historial**:
   - Ingresar DNI con antecedentes. Verificar que cada tarjeta exhiba los botones `👁️ Ver Ficha` y `🔗 Continuar este Trámite`.
2. **Prueba de Pre-Llenado y Banner**:
   - Hacer clic en `🔗 Continuar este Trámite`. Confirmar que la Defensoría, Modo, Co-Defensora, Expediente y Materia se pre-llenan correctamente y que se muestra el banner cyan.
3. **Prueba de Desvinculación**:
   - Hacer clic en `Desvincular / Trámite Nuevo` y verificar que el banner desaparece y los campos se resetean a su estado por defecto.
4. **Prueba de Guardado de Avance**:
   - Registrar la atención con observaciones del día y verificar que en el historial se refleje como un nuevo hito vinculado a la misma causa.
