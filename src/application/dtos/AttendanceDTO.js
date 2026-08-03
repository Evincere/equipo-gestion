/**
 * DTO (Data Transfer Object)
 * Convierte Entidades de Dominio en objetos planos seguros y formateados para la UI
 */
export class AttendanceDTO {
    static fromEntity(entity) {
        return {
            id: entity.id,
            fecha: entity.fecha,
            actividad: entity.actividad,
            fullName: entity.fullName,
            dniFormatted: entity.dni.format(),
            dniRaw: entity.dni.raw,
            expte: entity.expte,
            motivo: entity.motivo,
            defensoriaName: entity.defensoriaCategory.name,
            defensoriaBadgeClass: entity.defensoriaCategory.getBadgeStyleClass(),
            resultado: entity.resultado,
            atendidoPor: entity.atendidoPor,
            observaciones: entity.observaciones,
            celular: entity.celular,
            escritos: entity.escritos,
            isDerivacionTecnica: entity.isDerivacionTecnica(),
            hasEscritos: entity.hasEscritos()
        };
    }
}
