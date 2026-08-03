/**
 * Objeto de Valor: FamilySubmotivo
 * Supuestos de atención de la Co-Defensoría de Familia
 */
export class FamilySubmotivo {
    static SUBMOTIVOS = [
        'Mediación',
        'Prohibición de Acercamiento / Exclusión',
        'Alimentos / Liquidación / Cese',
        'Filiación / Presunta Filiación',
        'Impugnación / Supresión de Apellido',
        'Guarda Judicial / Tutela / Adopción',
        'Medidas de Protección ETI / Vulnerabilidad',
        'Cuidado Personal / Régimen de Contacto',
        'Determinación de Capacidad',
        'Otro / Asesoramiento General'
    ];

    constructor(value) {
        this.value = value && FamilySubmotivo.SUBMOTIVOS.includes(value) ? value : 'Otro / Asesoramiento General';
    }
}
