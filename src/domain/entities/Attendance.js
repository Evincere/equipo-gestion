import { DNI } from '../value-objects/DNI.js';
import { DefensoriaCategory } from '../value-objects/DefensoriaCategory.js';

/**
 * Entidad de Dominio: Attendance (Atención)
 * Encapsula la lógica fundamental y reglas de una atención institucional
 */
export class Attendance {
    constructor({
        id,
        fecha,
        actividad,
        dni,
        apellidos,
        nombres,
        celular,
        expte,
        motivo,
        defensoria,
        resultado,
        observaciones,
        atendidoPor,
        atendido_por,
        derivadoA,
        derivado_a,
        escritos,
        tareaPendiente,
        tarea_pendiente,
        detallePendiente,
        detalle_pendiente,
        tareaCumplidaAt,
        tarea_cumplida_at,
        modoDerivacionFamilia,
        modo_derivacion_familia,
        codefensoraAsignada,
        codefensora_asignada,
        fechaVencimientoContestacion,
        fecha_vencimiento_contestacion,
        plantillaCodigo,
        plantilla_codigo,
        escritosData,
        escritos_data
    }) {
        this.id = id ? Number(id) : Date.now();
        this.fecha = fecha || 'S/F';
        this.actividad = actividad || 'Atención Personal';
        this.dni = new DNI(dni);
        this.apellidos = (apellidos || 'SIN REGISTRO').toUpperCase();
        this.nombres = (nombres || '').toUpperCase();
        this.celular = celular || '';
        this.expte = expte || '';
        this.motivo = motivo || '';
        this.defensoriaCategory = new DefensoriaCategory(defensoria);
        this.resultado = resultado || 'Resuelve';
        this.observaciones = observaciones || '';
        this.atendidoPor = atendidoPor || atendido_por || 'Secretaría';
        this.derivadoA = derivadoA || derivado_a || '';
        this.escritos = escritos || '';
        this.tareaPendiente = Boolean(tareaPendiente !== undefined ? tareaPendiente : tarea_pendiente);
        this.detallePendiente = detallePendiente || detalle_pendiente || '';
        this.tareaCumplidaAt = tareaCumplidaAt || tarea_cumplida_at || null;
        this.modoDerivacionFamilia = modoDerivacionFamilia || modo_derivacion_familia || '';
        this.codefensoraAsignada = codefensoraAsignada || codefensora_asignada || '';
        this.fechaVencimientoContestacion = fechaVencimientoContestacion || fecha_vencimiento_contestacion || '';
        this.plantillaCodigo = plantillaCodigo || plantilla_codigo || '';
        this.escritosData = escritosData || escritos_data || '';
    }

    get fullName() {
        return `${this.apellidos} ${this.nombres}`.trim();
    }

    isDerivacionTecnica() {
        return (this.resultado && this.resultado.toLowerCase().includes('técnica')) ||
               (this.derivadoA && this.derivadoA.toLowerCase().includes('técnica'));
    }

    hasEscritos() {
        return Boolean(this.escritos && this.escritos.trim().length > 0);
    }

    hasPendingTask() {
        return Boolean(this.tareaPendiente);
    }
}
