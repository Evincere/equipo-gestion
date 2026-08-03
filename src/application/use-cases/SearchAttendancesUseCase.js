import { AttendanceDTO } from '../dtos/AttendanceDTO.js';

/**
 * Caso de Uso: Buscar y Filtrar Atenciones
 * Responsabilidad: Filtrar la lista de atenciones por query global, área y resultado
 */
export class SearchAttendancesUseCase {
    execute(attendances, { query = '', defensoria = '', resultado = '' }) {
        const q = query.toLowerCase().trim();

        const filtered = attendances.filter(item => {
            const matchesQuery = !q ||
                item.dni.raw.toLowerCase().includes(q) ||
                item.apellidos.toLowerCase().includes(q) ||
                item.nombres.toLowerCase().includes(q) ||
                item.expte.toLowerCase().includes(q) ||
                item.observaciones.toLowerCase().includes(q);

            const matchesDefensoria = !defensoria || item.defensoriaCategory.name === defensoria;
            const matchesResultado = !resultado || item.resultado === resultado;

            return matchesQuery && matchesDefensoria && matchesResultado;
        });

        return filtered.map(entity => AttendanceDTO.fromEntity(entity));
    }
}
