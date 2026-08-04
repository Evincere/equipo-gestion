/**
 * Caso de Uso: Obtener Resumen Estadístico (KPIs)
 * Responsabilidad: Calcular totales, derivaciones técnicas y escritos registrados
 */
    function normalizeDateStr(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            let day = parts[0].padStart(2, '0');
            let month = parts[1].padStart(2, '0');
            let year = parts[2];
            if (year.length === 2) year = '20' + year;
            return `${day}/${month}/${year}`;
        }
        return dateStr;
    }

export class GetAttendanceSummaryUseCase {
    execute(attendances) {
        const total = attendances.length;
        const derivacionesTecnica = attendances.filter(a => a.isDerivacionTecnica()).length;
        const escritosCount = attendances.filter(a => a.hasEscritos()).length;

        // Calcular atenciones del día
        const todayStr = normalizeDateStr(new Date().toLocaleDateString('es-AR'));
        
        const todayAttendances = attendances.filter(a => normalizeDateStr(a.fecha) === todayStr);
        const totalToday = todayAttendances.length;

        // Discriminar por operador
        const operatorBreakdown = {};
        todayAttendances.forEach(a => {
            const operator = a.atendidoPor || 'Secretaría';
            operatorBreakdown[operator] = (operatorBreakdown[operator] || 0) + 1;
        });

        // O también podríamos considerar las pendientes (eso ya estaba en otra parte, bundle lo calculaba así o no, wait...)
        // Pendientes no estaba acá.

        return {
            total,
            derivacionesTecnica,
            escritosCount,
            totalToday,
            operatorBreakdown
        };
    }
}
