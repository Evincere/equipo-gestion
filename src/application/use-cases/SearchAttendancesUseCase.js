import { AttendanceDTO } from '../dtos/AttendanceDTO.js';

/**
 * Caso de Uso: Buscar y Filtrar Atenciones
 * Responsabilidad: Filtrar la lista de atenciones por query global, área y resultado
 */
function parseDate(dateStr) {
    if (!dateStr) return 0;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        let year = parseInt(parts[2], 10);
        if (year < 100) year += 2000;
        return new Date(year, parseInt(parts[1], 10) - 1, parseInt(parts[0], 10)).getTime();
    }
    return 0;
}

export class SearchAttendancesUseCase {
    execute(attendances, { query = '', defensoria = '', resultado = '' }) {
        const q = query.toLowerCase().trim();
        const filtered = attendances.filter(item => {
            const matchesQuery = !q ||
                item.dni.raw.toLowerCase().includes(q) ||
                item.apellidos.toLowerCase().includes(q) ||
                item.nombres.toLowerCase().includes(q) ||
                item.expte.toLowerCase().includes(q) ||
                item.observaciones.toLowerCase().includes(q) ||
                (item.detallePendiente && item.detallePendiente.toLowerCase().includes(q));

            const matchesDefensoria = !defensoria || item.defensoriaCategory.name === defensoria;
            
            let matchesResultado = true;
            if (resultado === 'PENDIENTE') {
                matchesResultado = item.tareaPendiente === true;
            } else if (resultado) {
                matchesResultado = item.resultado === resultado;
            }

            return matchesQuery && matchesDefensoria && matchesResultado;
        });

        filtered.sort((a, b) => {
            const dateB = parseDate(b.fecha);
            const dateA = parseDate(a.fecha);
            if (dateB !== dateA) return dateB - dateA;
            return b.id - a.id;
        });

        return filtered.map(entity => AttendanceDTO.fromEntity(entity));
    }
}
