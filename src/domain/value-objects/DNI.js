/**
 * Objeto de Valor: DNI
 * Responsabilidad: Encapsular formato y validación de documentos
 */
export class DNI {
    constructor(value) {
        this._raw = value ? String(value).trim() : '';
        this._clean = this._raw.replace(/[^\d]/g, '');
    }

    get raw() {
        return this._raw;
    }

    get clean() {
        return this._clean;
    }

    isValid() {
        return this._clean.length >= 7 && this._clean.length <= 9;
    }

    format() {
        if (!this._clean) return 'SIN DNI';
        return this._clean.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }
}
