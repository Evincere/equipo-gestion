/**
 * Caso de Uso: Obtener Resumen Estadístico (KPIs)
 * Responsabilidad: Calcular totales, derivaciones técnicas y escritos registrados
 */
export class GetAttendanceSummaryUseCase {
    execute(attendances) {
        const total = attendances.length;
        const derivacionesTecnica = attendances.filter(a => a.isDerivacionTecnica()).length;
        const escritosCount = attendances.filter(a => a.hasEscritos()).length;

        return {
            total,
            derivacionesTecnica,
            escritosCount
        };
    }
}
