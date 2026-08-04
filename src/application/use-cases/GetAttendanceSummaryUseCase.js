/**
 * Caso de Uso: Obtener Resumen Estadístico (KPIs)
 * Responsabilidad: Calcular totales, derivaciones técnicas y escritos registrados
 */
export class GetAttendanceSummaryUseCase {
    execute(attendances) {
        const total = attendances.length;
        const derivacionesTecnica = attendances.filter(a => a.isDerivacionTecnica()).length;
        const escritosCount = attendances.filter(a => a.hasEscritos()).length;

        // Calcular atenciones del día
        const todayStr = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Mendoza' }); // Usar timezone de Mendoza si es posible, o fallback
        const todayStrFallback = new Date().toLocaleDateString('es-AR');
        
        const todayAttendances = attendances.filter(a => a.fecha === todayStr || a.fecha === todayStrFallback);
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
