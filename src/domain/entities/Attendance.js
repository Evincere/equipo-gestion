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
        derivadoA,
        escritos
    }) {
        this.id = id || Date.now();
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
        this.atendidoPor = atendidoPor || 'Secretaría';
        this.derivadoA = derivadoA || '';
        this.escritos = escritos || '';
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
}
