/**
 * Objeto de Valor: DefensoriaCategory
 * Responsabilidad: Categorización institucionales y clasificación por colores/badges
 */
export class DefensoriaCategory {
    static FAMILIA = 'CO-DEF. FAMILIA';
    static CIVIL = 'DEF. CIVIL';
    static PENAL_GENERAL = 'PENAL';
    static PENAL_1 = '1° DEFENSORIA PENAL';
    static PENAL_2 = '2° DEFENSORIA PENAL';
    static PENAL_3 = '3° DEFENSORIA PENAL';
    static EJECUCION = 'EJECUCIÓN PENAL';
    static MENORES = 'DEF. MENORES';
    static OTRO = 'Otro';

    constructor(value) {
        this._name = value ? String(value).trim() : 'Otro';
    }

    get name() {
        return this._name;
    }

    getBadgeStyleClass() {
        const nameUpper = this._name.toUpperCase();
        if (nameUpper.includes('FAMILIA')) return 'badge-familia';
        if (nameUpper.includes('CIVIL')) return 'badge-civil';
        if (nameUpper.includes('PENAL') && !nameUpper.includes('EJECUCIÓN')) return 'badge-penal';
        if (nameUpper.includes('EJECUCIÓN')) return 'badge-ejecucion';
        return 'badge-otro';
    }
}
