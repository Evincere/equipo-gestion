/**
 * Entidad de Dominio: CoDefensoraStatus
 * Responsabilidad: Estado de asistencia y disponibilidad de una Co-Defensora
 */
export class CoDefensoraStatus {
    constructor({ id, nombre, isPresente = true, motivoAusencia = '' }) {
        this.id = id;
        this.nombre = nombre;
        this.isPresente = Boolean(isPresente);
        this.motivoAusencia = motivoAusencia || '';
    }

    togglePresence() {
        this.isPresente = !this.isPresente;
        if (this.isPresente) {
            this.motivoAusencia = '';
        }
    }
}
