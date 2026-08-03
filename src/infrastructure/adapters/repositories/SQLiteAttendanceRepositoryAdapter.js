import { AttendanceRepositoryPort } from '../../../domain/ports/AttendanceRepositoryPort.js';
import { Attendance } from '../../../domain/entities/Attendance.js';
import { ATENCIONES_CSV_DATA } from '../../../data/atencionesData.js';

/**
 * Adaptador de Repositorio para Base de Datos SQLite (vía REST API)
 * Implementa el puerto AttendanceRepositoryPort (DIP / OCP)
 * Permite persistencia real compartida para todo el personal de la oficina
 */
export class SQLiteAttendanceRepositoryAdapter extends AttendanceRepositoryPort {
    constructor(apiUrl = '/api/atenciones') {
        super();
        this.apiUrl = apiUrl;
        this.cache = [];
    }

    async getAll() {
        try {
            const response = await fetch(this.apiUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const result = await response.json();
            if (result.success && Array.isArray(result.data)) {
                this.cache = result.data.map(row => this._mapRowToEntity(row));
                return this.cache;
            } else {
                throw new Error('Respuesta inválida del servidor API');
            }
        } catch (error) {
            console.warn('⚠️ No se pudo conectar a la API SQLite (server.js no disponible o modo file://). Usando fallback local:', error.message);
            return this._getFallbackRecords();
        }
    }

    async save(attendanceEntity) {
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fecha: attendanceEntity.fecha,
                    actividad: attendanceEntity.actividad,
                    dni: attendanceEntity.dni.raw,
                    apellidos: attendanceEntity.apellidos,
                    nombres: attendanceEntity.nombres,
                    celular: attendanceEntity.celular,
                    expte: attendanceEntity.expte,
                    motivo: attendanceEntity.motivo,
                    defensoria: attendanceEntity.defensoriaCategory.name,
                    resultado: attendanceEntity.resultado,
                    observaciones: attendanceEntity.observaciones,
                    atendidoPor: attendanceEntity.atendidoPor,
                    derivadoA: attendanceEntity.derivadoA,
                    escritos: attendanceEntity.escritos
                })
            });

            if (response.ok) {
                const resData = await response.json();
                if (resData.success && resData.id) {
                    attendanceEntity.id = resData.id;
                }
            }
        } catch (error) {
            console.warn('⚠️ No se pudo guardar en SQLite vía API, guardando en memoria local:', error.message);
        }

        this.cache.unshift(attendanceEntity);
        return attendanceEntity;
    }

    _mapRowToEntity(row) {
        return new Attendance({
            id: row.id,
            fecha: row.fecha,
            actividad: row.actividad,
            dni: row.dni,
            apellidos: row.apellidos,
            nombres: row.nombres,
            celular: row.celular,
            expte: row.expte,
            motivo: row.motivo,
            defensoria: row.defensoria,
            resultado: row.resultado,
            observaciones: row.observaciones,
            atendidoPor: row.atendido_por,
            derivadoA: row.derivado_a,
            escritos: row.escritos
        });
    }

    _getFallbackRecords() {
        if (this.cache.length > 0) return this.cache;
        
        const lines = ATENCIONES_CSV_DATA.split(/\r\n|\n/);
        const records = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cols = this._parseCSVLine(line);
            if (cols.length < 4) continue;

            if (cols[0] || cols[3] || cols[2]) {
                records.push(new Attendance({
                    id: i,
                    fecha: cols[0] ? cols[0].trim() : '',
                    actividad: cols[1] ? cols[1].trim() : '',
                    dni: cols[2] ? cols[2].trim() : '',
                    apellidos: cols[3] ? cols[3].trim() : '',
                    nombres: cols[4] ? cols[4].trim() : '',
                    celular: cols[5] ? cols[5].trim() : '',
                    expte: cols[6] ? cols[6].trim() : '',
                    motivo: cols[7] ? cols[7].trim() : '',
                    defensoria: cols[8] ? cols[8].trim() : '',
                    resultado: cols[9] ? cols[9].trim() : '',
                    observaciones: cols[10] ? cols[10].trim() : '',
                    atendidoPor: cols[11] ? cols[11].trim() : '',
                    derivadoA: cols[12] ? cols[12].trim() : '',
                    escritos: cols[13] ? cols[13].trim() : ''
                }));
            }
        }
        this.cache = records;
        return this.cache;
    }

    _parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') inQuotes = !inQuotes;
            else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
            else current += char;
        }
        result.push(current);
        return result;
    }
}
