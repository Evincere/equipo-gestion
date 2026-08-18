/**
 * Entidad de Dominio: PlantillaEscrito
 * Modela las plantillas predefinidas y configurables para generación de escritos judiciales.
 */
class PlantillaEscrito {
    constructor({
        id = null,
        codigo,
        titulo,
        categoria = 'PENAL',
        sumario,
        destinatarioDefault = 'SEÑOR/A DEFENSOR/A OFICIAL',
        cuerpoTemplate,
        camposDinamicos = [],
        activo = 1,
        createdAt = null,
        updatedAt = null
    }) {
        if (!codigo || typeof codigo !== 'string') {
            throw new Error('El código de la plantilla es obligatorio.');
        }
        if (!titulo || typeof titulo !== 'string') {
            throw new Error('El título de la plantilla es obligatorio.');
        }
        if (!cuerpoTemplate || typeof cuerpoTemplate !== 'string') {
            throw new Error('El cuerpo/plantilla de texto es obligatorio.');
        }

        this.id = id ? Number(id) : null;
        this.codigo = codigo.trim().toLowerCase();
        this.titulo = titulo.trim();
        this.categoria = categoria.trim().toUpperCase();
        this.sumario = (sumario || '').trim().toUpperCase();
        this.destinatarioDefault = destinatarioDefault || 'SEÑOR/A DEFENSOR/A OFICIAL';
        this.cuerpoTemplate = cuerpoTemplate;
        
        // camposDinamicos puede venir como array o como string JSON
        if (typeof camposDinamicos === 'string') {
            try {
                this.camposDinamicos = JSON.parse(camposDinamicos);
            } catch (e) {
                this.camposDinamicos = [];
            }
        } else if (Array.isArray(camposDinamicos)) {
            this.camposDinamicos = camposDinamicos;
        } else {
            this.camposDinamicos = [];
        }

        this.activo = Boolean(Number(activo));
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    /**
     * Retorna la lista de placeholders detectados en el cuerpo {{PLACEHOLDER}}
     */
    extractPlaceholders() {
        const matches = this.cuerpoTemplate.match(/\{\{([A-Z0-9_]+)\}\}/g) || [];
        return [...new Set(matches.map(m => m.replace(/[{}]/g, '')))];
    }

    toJSON() {
        return {
            id: this.id,
            codigo: this.codigo,
            titulo: this.titulo,
            categoria: this.categoria,
            sumario: this.sumario,
            destinatarioDefault: this.destinatarioDefault,
            cuerpoTemplate: this.cuerpoTemplate,
            camposDinamicos: this.camposDinamicos,
            activo: this.activo ? 1 : 0,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PlantillaEscrito };
}
