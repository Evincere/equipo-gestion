/**
 * Servicio de Dominio: DocumentRenderService
 * Se encarga de interpolar las variables de una plantilla con los datos del ciudadano,
 * causa y campos dinámicos, formateando fechas legales y estructuras formales sin emoticonos ni íconos.
 */
class DocumentRenderService {
    /**
     * Mapeo de funcionarios de las Defensorías Penales de la 2da Circunscripción (San Rafael)
     */
    static getDefensoriaPenalOfficials(defensoriaName = '', firmanteTipo = 'titular') {
        const defStr = (defensoriaName || '').toUpperCase();
        let defensor = 'Defensor/a Oficial';
        let codefensora = 'Codefensor/a';
        let defensorCargo = 'Defensor Oficial';
        let codefensoraCargo = 'Codefensora Penal';

        if (defStr.includes('1') || defStr.includes('PRIMERA')) {
            defensor = 'Dr. Jorge Luque';
            defensorCargo = 'Defensor Oficial - 1ª Defensoría Penal';
            codefensora = 'Dra. Lourdes Braggio';
            codefensoraCargo = 'Codefensora - 1ª Defensoría Penal';
        } else if (defStr.includes('2') || defStr.includes('SEGUNDA')) {
            defensor = 'Dra. Daniela García';
            defensorCargo = 'Defensora Oficial - 2ª Defensoría Penal';
            codefensora = 'Dra. Macarena Orozco';
            codefensoraCargo = 'Codefensora - 2ª Defensoría Penal';
        } else if (defStr.includes('3') || defStr.includes('TERCERA')) {
            defensor = 'Dr. Jorge Miguel Vitale';
            defensorCargo = 'Defensor Oficial - 3ª Defensoría Penal';
            codefensora = 'Dra. Sofia Camerucci';
            codefensoraCargo = 'Codefensora - 3ª Defensoría Penal';
        } else if (defStr.includes('JUVENIL') || defStr.includes('MENOR')) {
            defensor = 'Dr. Facundo Rodriguez';
            defensorCargo = 'Defensor Oficial - Defensoría Penal Juvenil';
            codefensora = 'Dra. Silvina Agüero';
            codefensoraCargo = 'Codefensora - Defensoría Penal Juvenil';
        } else if (defStr.includes('EJECUCI')) {
            defensor = 'Dr. Facundo Rodriguez';
            defensorCargo = 'Defensor Oficial - Ejecución Penal';
            codefensora = '';
            codefensoraCargo = '';
        }

        let funcionarioTexto = `${defensor}, en mi carácter de ${defensorCargo}`;
        let firmaNombre = defensor;
        let firmaCargo = defensorCargo;

        const fTipo = (firmanteTipo || 'titular').toLowerCase();
        if (fTipo === 'codefensor' || fTipo === 'codefensora' || fTipo.includes('codefens')) {
            funcionarioTexto = `${codefensora}, en mi carácter de ${codefensoraCargo}`;
            firmaNombre = codefensora;
            firmaCargo = codefensoraCargo;
        } else if (fTipo === 'ambos') {
            funcionarioTexto = `${defensor} y ${codefensora}, en ejercicio de la defensa técnica`;
            firmaNombre = `${defensor} / ${codefensora}`;
            firmaCargo = 'Defensa Técnica Oficial';
        }

        return {
            defensor,
            defensorCargo,
            codefensora,
            codefensoraCargo,
            funcionarioTexto,
            firmaNombre,
            firmaCargo
        };
    }

    /**
     * Formatea una fecha a estilo judicial formal: "15 de agosto de 2026"
     */
    static formatFechaLegal(dateInput = null) {
        let d = dateInput;
        if (!d) {
            d = new Date();
        } else if (typeof d === 'string') {
            if (d.includes('/')) {
                const parts = d.split('/');
                if (parts.length === 3) {
                    d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
                }
            } else {
                d = new Date(d);
            }
        }
        if (isNaN(d.getTime())) d = new Date();

        const meses = [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];

        const dia = d.getDate();
        const mes = meses[d.getMonth()];
        const anio = d.getFullYear();

        return `${dia} de ${mes} de ${anio}`;
    }

    /**
     * Renderiza el texto del cuerpo reemplazando todos los placeholders {{KEY}}
     * @param {string} cuerpoTemplate 
     * @param {Object} data 
     * @returns {string} Texto renderizado sin emojis ni caracteres inapropiados
     */
    static renderTemplate(cuerpoTemplate, data = {}) {
        if (!cuerpoTemplate) return '';

        const ciudadanoNombre = `${(data.apellidos || '').trim().toUpperCase()} ${(data.nombres || '').trim().toUpperCase()}`.trim() || '____________________';
        const dni = data.dni ? String(data.dni).replace(/[^\d]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '__________';
        const expte = data.expte ? data.expte.trim() : 'S/N°';
        const defensoria = data.defensoria ? data.defensoria.trim() : 'Defensoría Oficial';
        const celular = data.celular ? data.celular.trim() : (data.TELEFONO_CONTACTO || 'Sin registrar');
        const operador = data.atendidoPor || data.atendido_por || 'Mesa de Entrada';
        const fechaLegal = this.formatFechaLegal(data.fecha);
        const fechaCorta = data.fecha || new Date().toLocaleDateString('es-AR');

        const officials = this.getDefensoriaPenalOfficials(defensoria, data.FIRMANTE_DEFENSA || data.firmante_defensa);

        const context = {
            CIUDADANO_NOMBRE: ciudadanoNombre,
            DNI: dni,
            EXPTE: expte,
            DEFENSORIA: defensoria,
            CELULAR: celular,
            OPERADOR: operador,
            FECHA_LEGAL: fechaLegal,
            FECHA_CORTA: fechaCorta,
            FUNCIONARIO_DEFENSA: officials.funcionarioTexto,
            DEFENSOR_OFICIAL: officials.defensor,
            CODEFENSORA: officials.codefensora,
            ...data
        };

        let result = cuerpoTemplate;

        // Reemplazar cada clave del contexto
        Object.keys(context).forEach(key => {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            const val = context[key] !== undefined && context[key] !== null ? String(context[key]) : '';
            result = result.replace(regex, val);
        });

        // Limpiar cualquier emoji residual para mantener la solemnidad judicial
        result = result.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

        return result;
    }

    /**
     * Genera el HTML completo para impresión / descarga en PDF con membrete oficial del MPD
     */
    static generatePrintableHtml({
        titulo,
        sumario,
        cuerpoTexto,
        ciudadanoNombre,
        dni,
        expte,
        defensoria,
        operador,
        fecha,
        firmanteTipo
    }) {
        const fechaLegal = this.formatFechaLegal(fecha);
        const dniFormat = dni ? String(dni).replace(/[^\d]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
        const officials = this.getDefensoriaPenalOfficials(defensoria, firmanteTipo);

        // Limpiar emojis del texto final
        const textoLimpio = (cuerpoTexto || '').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

        return `
        <div class="escrito-print-document" style="font-family: Times, 'Times New Roman', serif; color: #111; line-height: 1.5; font-size: 12pt; max-width: 800px; margin: 0 auto; padding: 15mm 15mm; background: #fff;">
            <!-- Membrete Oficial MPD -->
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0b1329; padding-bottom: 12px; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 14px;">
                    <img src="assets/images/Logo sin fondo 3-recortado.PNG" alt="MPD Logo" style="height: 60px; object-fit: contain;" onerror="this.onerror=null;this.src='assets/images/logo_horizontal.png';">
                    <div>
                        <div style="font-size: 13pt; font-weight: bold; letter-spacing: 0.5px; color: #0b1329; text-transform: uppercase;">Ministerio Público de la Defensa</div>
                        <div style="font-size: 10.5pt; font-weight: 600; color: #334155;">Poder Judicial de la Provincia de Mendoza</div>
                        <div style="font-size: 9pt; color: #64748b; font-style: italic;">Segunda Circunscripción Judicial - San Rafael</div>
                    </div>
                </div>
                <div style="text-align: right; font-size: 9.5pt; color: #475569;">
                    <div><strong>Expte:</strong> ${expte || 'S/N°'}</div>
                    <div><strong>Defensoría:</strong> ${defensoria || 'Oficial'}</div>
                </div>
            </div>

            <!-- Sumario Cuadro Formal -->
            <div style="display: flex; justify-content: flex-end; margin-bottom: 25px;">
                <div style="border: 1.5px solid #000; padding: 8px 16px; font-size: 10.5pt; font-weight: bold; text-transform: uppercase; background: #f8fafc; letter-spacing: 0.5px;">
                    SUMARIO: ${sumario || 'PRESENTA ESCRITO JUDICIAL'}
                </div>
            </div>

            <!-- Título del Documento -->
            <div style="text-align: center; margin-bottom: 25px;">
                <h3 style="margin: 0; font-size: 13.5pt; text-transform: uppercase; text-decoration: underline; letter-spacing: 0.5px;">
                    ${titulo || 'ESCRITO JUDICIAL'}
                </h3>
            </div>

            <!-- Cuerpo del Escrito -->
            <div style="text-align: justify; white-space: pre-wrap; font-size: 11.5pt; line-height: 1.6; margin-bottom: 45px;">
${textoLimpio}
            </div>

            <!-- Bloque de Firmas -->
            <div style="margin-top: 50px; display: flex; justify-content: space-between; align-items: flex-end; page-break-inside: avoid;">
                <div style="text-align: center; width: 45%; border-top: 1px solid #000; padding-top: 8px;">
                    <div style="font-weight: bold; font-size: 10pt;">${ciudadanoNombre || 'COMPARECIENTE / ASISTIDO'}</div>
                    <div style="font-size: 9pt;">D.N.I. N° ${dniFormat}</div>
                    <div style="font-size: 8.5pt; color: #64748b; font-style: italic;">Firma del Asistido / Compareciente</div>
                </div>
                <div style="text-align: center; width: 45%; border-top: 1px solid #000; padding-top: 8px;">
                    <div style="font-weight: bold; font-size: 10pt;">${officials.firmaNombre}</div>
                    <div style="font-size: 9pt;">${officials.firmaCargo}</div>
                    <div style="font-size: 8.5pt; color: #64748b; font-style: italic;">Ministerio Público de la Defensa</div>
                </div>
            </div>
        </div>
        `;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DocumentRenderService };
}
