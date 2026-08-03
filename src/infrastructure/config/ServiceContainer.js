import { SQLiteAttendanceRepositoryAdapter } from '../adapters/repositories/SQLiteAttendanceRepositoryAdapter.js';
import { GetAttendanceSummaryUseCase } from '../../application/use-cases/GetAttendanceSummaryUseCase.js';
import { SearchAttendancesUseCase } from '../../application/use-cases/SearchAttendancesUseCase.js';
import { CreateAttendanceUseCase } from '../../application/use-cases/CreateAttendanceUseCase.js';
import { DashboardViewController } from '../adapters/ui/controllers/DashboardViewController.js';

/**
 * Contenedor de Inyección de Dependencias (Dependency Injection Container - DIP)
 * Instancia y conecta la Base de Datos SQLite, Puertos y Casos de Uso
 */
export class ServiceContainer {
    static create() {
        // 1. Instanciar Adaptador Concreto de SQLite (Multi-usuario)
        const attendanceRepository = new SQLiteAttendanceRepositoryAdapter('/api/atenciones');

        // 2. Instanciar Casos de Uso inyectando dependencias
        const getSummaryUseCase = new GetAttendanceSummaryUseCase();
        const searchAttendancesUseCase = new SearchAttendancesUseCase();
        const createAttendanceUseCase = new CreateAttendanceUseCase(attendanceRepository);

        // 3. Instanciar Controlador UI inyectando Casos de Uso y Repositorio
        const viewController = new DashboardViewController({
            getSummaryUseCase,
            searchAttendancesUseCase,
            createAttendanceUseCase,
            attendanceRepository
        });

        return {
            attendanceRepository,
            getSummaryUseCase,
            searchAttendancesUseCase,
            createAttendanceUseCase,
            viewController
        };
    }
}
