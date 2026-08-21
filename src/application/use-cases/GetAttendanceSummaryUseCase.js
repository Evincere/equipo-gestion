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

export class GetAttendanceSummaryUseCase {
    execute(attendances) {
        const now = new Date();
        const todayStr = normalizeDateStr(now.toLocaleDateString('es-AR'));

        const currentDay = now.getDay();
        const distanceToMonday = (currentDay === 0 ? 6 : currentDay - 1);
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMonday);
        startOfWeek.setHours(0, 0, 0, 0);

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);

        const startOfYear = new Date(now.getFullYear(), 0, 1);
        startOfYear.setHours(0, 0, 0, 0);

        let totalToday = 0;
        let totalWeek = 0;
        let totalMonth = 0;
        let totalYear = 0;

        const operatorBreakdownToday = {};
        const operatorBreakdownWeek = {};
        const operatorBreakdownMonth = {};

        attendances.forEach(a => {
            const isToday = normalizeDateStr(a.fecha) === todayStr;
            const op = a.atendidoPor || 'Secretaría';

            if (isToday) {
                totalToday++;
                operatorBreakdownToday[op] = (operatorBreakdownToday[op] || 0) + 1;
            }

            const ts = parseDate(a.fecha);
            if (ts > 0) {
                const dateObj = new Date(ts);
                if (dateObj >= startOfWeek) {
                    totalWeek++;
                    operatorBreakdownWeek[op] = (operatorBreakdownWeek[op] || 0) + 1;
                }
                if (dateObj >= startOfMonth && dateObj.getFullYear() === now.getFullYear() && dateObj.getMonth() === now.getMonth()) {
                    totalMonth++;
                    operatorBreakdownMonth[op] = (operatorBreakdownMonth[op] || 0) + 1;
                }
                if (dateObj >= startOfYear && dateObj.getFullYear() === now.getFullYear()) {
                    totalYear++;
                }
            }
        });

        return {
            total: attendances.length,
            totalYear,
            totalMonth,
            totalWeek,
            totalToday,
            derivacionesTecnica: attendances.filter(a => a.isDerivacionTecnica && a.isDerivacionTecnica()).length,
            escritosCount: attendances.filter(a => a.hasEscritos && a.hasEscritos()).length,
            operatorBreakdown: operatorBreakdownToday,
            operatorBreakdownToday,
            operatorBreakdownWeek,
            operatorBreakdownMonth
        };
    }
}
