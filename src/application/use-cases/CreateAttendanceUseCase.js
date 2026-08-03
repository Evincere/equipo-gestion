import { Attendance } from '../../domain/entities/Attendance.js';
import { AttendanceDTO } from '../dtos/AttendanceDTO.js';

/**
 * Caso de Uso: Crear / Registrar Nueva Atención
 * Responsabilidad: Instanciar la entidad, validar reglas y persistir mediante el puerto
 */
export class CreateAttendanceUseCase {
    constructor(attendanceRepositoryPort) {
        this.repository = attendanceRepositoryPort;
    }

    async execute(formData) {
        const entity = new Attendance(formData);
        
        // Regla de Negocio: Validar DNI si está presente
        if (formData.dni && !entity.dni.isValid()) {
            console.warn(`El DNI ingresado (${formData.dni}) tiene formato inusual, pero será registrado.`);
        }

        const savedEntity = await this.repository.save(entity);
        return AttendanceDTO.fromEntity(savedEntity);
    }
}
