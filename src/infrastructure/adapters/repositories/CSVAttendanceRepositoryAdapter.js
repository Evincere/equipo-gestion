import { AttendanceRepositoryPort } from '../../../domain/ports/AttendanceRepositoryPort.js';
import { Attendance } from '../../../domain/entities/Attendance.js';
import { ATENCIONES_CSV_DATA } from '../../../data/atencionesData.js';

/**
 * Adaptador de Repositorio para CSV (`atenciones.csv`)
 * Soporta carga HTTP fetch() con fallback automático a datos embebidos ATENCIONES_CSV_DATA.
 * Esto garantiza funcionamiento fluido tanto vía Servidor Web como abriendo directamente por file://.
 */
export class CSVAttendanceRepositoryAdapter extends AttendanceRepositoryPort {
    constructor(csvUrl = 'data/atenciones.csv') {
        super();
        this.csvUrl = csvUrl;
        this.cache = [];
    }

    async getAll() {
        if (this.cache.length > 0) {
            return this.cache;
        }

        let csvText = '';
        try {
            const response = await fetch(this.csvUrl);
            if (response.ok) {
                csvText = await response.text();
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (err) {
            console.warn('Carga via fetch falló (o abriendo por file://), usando fallback de datos embebidos:', err.message);
            csvText = ATENCIONES_CSV_DATA;
        }

        if (!csvText) {
            csvText = ATENCIONES_CSV_DATA;
        }

        this.cache = this._parseCSV(csvText);
        return this.cache;
    }

    async save(attendanceEntity) {
        this.cache.unshift(attendanceEntity);
        return attendanceEntity;
    }

    _parseCSV(text) {
        const lines = text.split(/\r\n|\n/);
        if (lines.length < 2) return [];

        const records = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cols = this._parseCSVLine(line);
            if (cols.length < 4) continue;

            const fecha = cols[0] ? cols[0].trim() : '';
            const actividad = cols[1] ? cols[1].trim() : '';
            const dni = cols[2] ? cols[2].trim() : '';
            const apellidos = cols[3] ? cols[3].trim() : '';
            const nombres = cols[4] ? cols[4].trim() : '';
            const celular = cols[5] ? cols[5].trim() : '';
            const expte = cols[6] ? cols[6].trim() : '';
            const motivo = cols[7] ? cols[7].trim() : '';
            const defensoria = cols[8] ? cols[8].trim() : '';
            const resultado = cols[9] ? cols[9].trim() : '';
            const observaciones = cols[10] ? cols[10].trim() : '';
            const atendidoPor = cols[11] ? cols[11].trim() : '';
            const derivadoA = cols[12] ? cols[12].trim() : '';
            const escritos = cols[13] ? cols[13].trim() : '';

            if (fecha || apellidos || dni) {
                records.push(new Attendance({
                    id: i,
                    fecha,
                    actividad,
                    dni,
                    apellidos,
                    nombres,
                    celular,
                    expte,
                    motivo,
                    defensoria,
                    resultado,
                    observaciones,
                    atendidoPor,
                    derivadoA,
                    escritos
                }));
            }
        }
        return records;
    }

    _parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        return result;
    }
}
