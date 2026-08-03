/**
 * Puerto / Interfaz de Repositorio (DIP - Inversión de Dependencias)
 * Define el contrato que cualquier adaptador de datos (CSV, SQL, REST) debe cumplir.
 */
export class AttendanceRepositoryPort {
    async getAll() {
        throw new Error('Método getAll() debe ser implementado por el adaptador');
    }

    async save(attendanceEntity) {
        throw new Error('Método save() debe ser implementado por el adaptador');
    }
}
