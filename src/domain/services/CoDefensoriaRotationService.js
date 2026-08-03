/**
 * Servicio de Dominio: CoDefensoriaRotationService
 * Algoritmo Round-Robin para asignación de turnos equitativos.
 * Filtra automáticamente a las Co-Defensoras ausentes.
 */
export class CoDefensoriaRotationService {
    static getNextAvailable(coDefensorasRoster, lastAssignedIndex = -1) {
        // Filtrar únicamente las presentes
        const presentes = coDefensorasRoster.filter(c => c.isPresente);

        if (presentes.length === 0) {
            return {
                nextDefensora: null,
                nextIndex: lastAssignedIndex,
                warning: 'No hay Co-Defensoras marcadas como presentes actualmente'
            };
        }

        // Calcular el siguiente índice circular entre las presentes
        const nextIndex = (lastAssignedIndex + 1) % presentes.length;
        const nextDefensora = presentes[nextIndex];

        return {
            nextDefensora,
            nextIndex,
            warning: null
        };
    }
}
