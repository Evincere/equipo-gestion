const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
const csvPath = path.join(dataDir, 'atenciones.csv');
const csvContent = fs.existsSync(csvPath) ? fs.readFileSync(csvPath, 'utf8') : '';

const bundleContent = `/* ==========================================================================
   JUSTICIA & GESTIÓN - BUNDLE AUTÓNOMO CON MÓDULO DE TAREAS PENDIENTES Y CUMPLIMIENTO
   ========================================================================== */

(function() {
    console.log('🚀 Cargando Sistema de Gestión de Atenciones (Módulo Tareas Pendientes Habilitado)');

    const SESSION_STORAGE_KEY = 'mpd_user_session';

    function getApiUrl(endpoint) {
        if (window.location.protocol === 'file:') {
            return 'http://localhost:3000' + endpoint;
        }
        return endpoint;
    }

    function fixMojibake(str) {
        if (!str) return '';
        // Intentar decodificación nativa si fue leido erróneamente como UTF-8
        try {
            return decodeURIComponent(escape(str));
        } catch (e) {}
        
        return str
            .replace(/Ã‘/g, 'Ñ').replace(/Ã’/g, 'Ó').replace(/Ã“/g, 'Ó').replace(/Ã±/g, 'ñ')
            .replace(/Ã¡/g, 'á').replace(/Ã©/g, 'é').replace(/Ã­/g, 'í').replace(/Ã/g, 'Í')
            .replace(/Ã³/g, 'ó').replace(/Ãº/g, 'ú').replace(/Ãš/g, 'Ú').replace(/NÂ°/g, 'N°').replace(/Â°/g, '°');
    }

    function showToast(message, type = 'success', duration = 3500) {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = 'toast-notification toast-' + type;

        let iconClass = 'ri-checkbox-circle-fill';
        if (type === 'error') iconClass = 'ri-error-warning-fill';
        if (type === 'info') iconClass = 'ri-information-fill';

        toast.innerHTML = '<i class="' + iconClass + ' toast-icon" style="font-size: 1.25rem;"></i><span>' + message + '</span>';
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-hiding');
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, duration);
    }

    function showConfirm(title, message, onConfirm) {
        const modal = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmModalTitle');
        const msgEl = document.getElementById('confirmModalMessage');
        const btnCancel = document.getElementById('btnConfirmCancel');
        const btnOk = document.getElementById('btnConfirmOk');

        if (!modal || !titleEl || !msgEl || !btnCancel || !btnOk) {
            if (confirm(message || title)) onConfirm();
            return;
        }

        titleEl.textContent = title || '¿Confirmar Acción?';
        msgEl.textContent = message || '¿Estás seguro de realizar esta acción?';

        modal.style.zIndex = '100000';
        modal.classList.add('active');

        const handleOk = () => {
            modal.classList.remove('active');
            cleanup();
            if (typeof onConfirm === 'function') onConfirm();
        };

        const handleCancel = () => {
            modal.classList.remove('active');
            cleanup();
        };

        const cleanup = () => {
            btnOk.removeEventListener('click', handleOk);
            btnCancel.removeEventListener('click', handleCancel);
        };

        btnOk.addEventListener('click', handleOk);
        btnCancel.addEventListener('click', handleCancel);
    }

    function parseDate(dateStr) {
        if (!dateStr) return 0;
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            let year = parseInt(parts[2], 10);
            if (year < 100) year += 2000;
            return new Date(year, parseInt(parts[1], 10) - 1, parseInt(parts[0], 10)).getTime();
        }
        return 0;
    }

    function normalizeDateStr(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            let day = parts[0].padStart(2, '0');
            let month = parts[1].padStart(2, '0');
            let year = parts[2];
            if (year.length === 2) year = '20' + year;
            return \`\${day}/\${month}/\${year}\`;
        }
        return dateStr;
    }

    // 1. Value Object DNI
    class DNI {
        constructor(value) {
            this._raw = value ? String(value).trim() : '';
            this._clean = this._raw.replace(/[^\\d]/g, '');
        }
        get raw() { return this._raw; }
        get clean() { return this._clean; }
        isValid() { return this._clean.length >= 7 && this._clean.length <= 9; }
        format() {
            if (!this._clean) return 'SIN DNI';
            return this._clean.replace(/\\B(?=(\\d{3})+(?!\\d))/g, ".");
        }
    }

    // 2. Value Object DefensoriaCategory
    class DefensoriaCategory {
        constructor(value) {
            this._name = value ? fixMojibake(String(value).trim()) : 'Otro';
        }
        get name() { return this._name; }
        getBadgeStyleClass() {
            const nameUpper = this._name.toUpperCase();
            if (nameUpper.includes('FAMILIA')) return 'badge-familia';
            if (nameUpper.includes('CIVIL')) return 'badge-civil';
            if (nameUpper.includes('PENAL') && !nameUpper.includes('EJECUCIÓN')) return 'badge-penal';
            if (nameUpper.includes('EJECUCIÓN')) return 'badge-ejecucion';
            return 'badge-otro';
        }
    }

    // 3. Entidad User
    class User {
        constructor({ id, username, nombreCompleto, rol, avatarInitials, isAdmin }) {
            this.id = id || Date.now();
            this.username = username ? String(username).toLowerCase().trim() : '';
            this.nombreCompleto = nombreCompleto || 'Usuario';
            this.rol = rol || 'OPERADOR';
            this.avatarInitials = avatarInitials || 'US';
            this._isAdmin = Boolean(isAdmin || this.rol === 'ADMINISTRADOR' || this.username === 'spereyra');
        }
        isAdmin() { return this._isAdmin; }
        canAccessConfig() { return this._isAdmin; }
        toJSON() {
            return {
                id: this.id,
                username: this.username,
                nombreCompleto: this.nombreCompleto,
                rol: this.rol,
                avatarInitials: this.avatarInitials,
                isAdmin: this._isAdmin
            };
        }
    }

    // 4. Entidad PlantillaEscrito y Servicio DocumentRenderService
    class PlantillaEscrito {
        constructor({ id, codigo, titulo, categoria, sumario, destinatario_default, destinatarioDefault, cuerpo_template, cuerpoTemplate, campos_dinamicos, camposDinamicos, activo, created_at, updated_at }) {
            this.id = id ? Number(id) : null;
            this.codigo = (codigo || '').toLowerCase().trim();
            this.titulo = fixMojibake(titulo || '').trim();
            this.categoria = (categoria || 'PENAL').toUpperCase().trim();
            this.sumario = fixMojibake(sumario || '').toUpperCase().trim();
            this.destinatarioDefault = fixMojibake(destinatario_default || destinatarioDefault || 'SEÑOR/A DEFENSOR/A OFICIAL');
            this.cuerpoTemplate = fixMojibake(cuerpo_template || cuerpoTemplate || '');
            
            const rawCampos = campos_dinamicos !== undefined ? campos_dinamicos : camposDinamicos;
            if (typeof rawCampos === 'string') {
                try {
                    this.camposDinamicos = JSON.parse(rawCampos);
                } catch(e) {
                    this.camposDinamicos = [];
                }
            } else if (Array.isArray(rawCampos)) {
                this.camposDinamicos = rawCampos;
            } else {
                this.camposDinamicos = [];
            }
            this.activo = Boolean(Number(activo !== undefined ? activo : 1));
            this.createdAt = created_at;
            this.updatedAt = updated_at;
        }
    }

    class DocumentRenderService {
        static formatFechaLegal(dateInput) {
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

            return d.getDate() + ' de ' + meses[d.getMonth()] + ' de ' + d.getFullYear();
        }

        static getDefensoriaPenalOfficials(defensoriaName, firmanteTipo) {
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

            let funcionarioTexto = defensor + ', en mi carácter de ' + defensorCargo;
            let firmaNombre = defensor;
            let firmaCargo = defensorCargo;

            const fTipo = (firmanteTipo || 'titular').toLowerCase();
            if (fTipo === 'codefensor' || fTipo === 'codefensora' || fTipo.includes('codefens')) {
                funcionarioTexto = codefensora + ', en mi carácter de ' + codefensoraCargo;
                firmaNombre = codefensora;
                firmaCargo = codefensoraCargo;
            } else if (fTipo === 'ambos') {
                funcionarioTexto = defensor + ' y ' + codefensora + ', en ejercicio de la defensa técnica';
                firmaNombre = defensor + ' / ' + codefensora;
                firmaCargo = 'Defensa Técnica Oficial';
            }

            return {
                defensor: defensor,
                defensorCargo: defensorCargo,
                codefensora: codefensora,
                codefensoraCargo: codefensoraCargo,
                funcionarioTexto: funcionarioTexto,
                firmaNombre: firmaNombre,
                firmaCargo: firmaCargo
            };
        }

        static renderTemplate(cuerpoTemplate, data) {
            if (!cuerpoTemplate) return '';
            const dataObj = data || {};
            const ciudadanoNombre = ((dataObj.apellidos || '').trim().toUpperCase() + ' ' + (dataObj.nombres || '').trim().toUpperCase()).trim() || '____________________';
            const dniFormat = dataObj.dni ? String(dataObj.dni).replace(/[^0-9]/g, '').replace(/\\B(?=([0-9]{3})+(?![0-9]))/g, '.') : '__________';
            const expte = dataObj.expte ? dataObj.expte.trim() : 'S/N°';
            const defensoria = dataObj.defensoria ? dataObj.defensoria.trim() : 'Defensoría Oficial';
            const celular = dataObj.celular ? dataObj.celular.trim() : (dataObj.TELEFONO_CONTACTO || 'Sin registrar');
            const operador = dataObj.atendidoPor || dataObj.atendido_por || 'Mesa de Entrada';
            const fechaLegal = this.formatFechaLegal(dataObj.fecha);
            const fechaCorta = dataObj.fecha || new Date().toLocaleDateString('es-AR');

            const officials = this.getDefensoriaPenalOfficials(defensoria, dataObj.FIRMANTE_DEFENSA || dataObj.firmante_defensa);

            const context = Object.assign({
                CIUDADANO_NOMBRE: ciudadanoNombre,
                DNI: dniFormat,
                EXPTE: expte,
                DEFENSORIA: defensoria,
                CELULAR: celular,
                OPERADOR: operador,
                FECHA_LEGAL: fechaLegal,
                FECHA_CORTA: fechaCorta,
                FUNCIONARIO_DEFENSA: officials.funcionarioTexto,
                DEFENSOR_OFICIAL: officials.defensor,
                CODEFENSORA: officials.codefensora
            }, dataObj);

            let result = cuerpoTemplate;
            Object.keys(context).forEach(key => {
                const regex = new RegExp('\\{\\{' + key + '\\}\\}', 'g');
                const val = context[key] !== undefined && context[key] !== null ? String(context[key]) : '';
                result = result.replace(regex, val);
            });

            // Limpiar cualquier emoji residual para mantener la solemnidad judicial
            result = result.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

            return result;
        }

        static generatePrintableHtml(params) {
            const fechaLegal = this.formatFechaLegal(params.fecha);
            const dniFormat = params.dni ? String(params.dni).replace(/[^0-9]/g, '').replace(/\\B(?=([0-9]{3})+(?![0-9]))/g, '.') : '';
            const officials = this.getDefensoriaPenalOfficials(params.defensoria, params.firmanteTipo);
            const textoLimpio = (params.cuerpoTexto || '').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

            return '<div class="escrito-print-document" style="font-family: Times, serif; color: #111; line-height: 1.5; font-size: 12pt; max-width: 800px; margin: 0 auto; padding: 15mm 15mm; background: #fff;">' +
                '<div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0b1329; padding-bottom: 12px; margin-bottom: 20px;">' +
                    '<div style="display: flex; align-items: center; gap: 14px;">' +
                        '<img src="assets/images/Logo sin fondo 3-recortado.PNG" alt="MPD Logo" style="height: 60px; object-fit: contain;" onerror="this.onerror=null;this.src=&quot;assets/images/logo_horizontal.png&quot;;">' +
                        '<div>' +
                            '<div style="font-size: 13pt; font-weight: bold; letter-spacing: 0.5px; color: #0b1329; text-transform: uppercase;">Ministerio Público de la Defensa</div>' +
                            '<div style="font-size: 10.5pt; font-weight: 600; color: #334155;">Poder Judicial de la Provincia de Mendoza</div>' +
                            '<div style="font-size: 9pt; color: #64748b; font-style: italic;">Segunda Circunscripción Judicial - San Rafael</div>' +
                        '</div>' +
                    '</div>' +
                    '<div style="text-align: right; font-size: 9.5pt; color: #475569;">' +
                        '<div><strong>Expte:</strong> ' + (params.expte || 'S/N°') + '</div>' +
                        '<div><strong>Defensoría:</strong> ' + (params.defensoria || 'Oficial') + '</div>' +
                    '</div>' +
                '</div>' +

                '<div style="display: flex; justify-content: flex-end; margin-bottom: 25px;">' +
                    '<div style="border: 1.5px solid #000; padding: 8px 16px; font-size: 10.5pt; font-weight: bold; text-transform: uppercase; background: #f8fafc; letter-spacing: 0.5px;">' +
                        'SUMARIO: ' + (params.sumario || 'PRESENTA ESCRITO JUDICIAL') +
                    '</div>' +
                '</div>' +

                '<div style="text-align: center; margin-bottom: 25px;">' +
                    '<h3 style="margin: 0; font-size: 13.5pt; text-transform: uppercase; text-decoration: underline; letter-spacing: 0.5px;">' +
                        (params.titulo || 'ESCRITO JUDICIAL') +
                    '</h3>' +
                '</div>' +

                '<div style="text-align: justify; white-space: pre-wrap; font-size: 11.5pt; line-height: 1.6; margin-bottom: 45px;">' +
                    textoLimpio +
                '</div>' +

                '<div style="margin-top: 50px; display: flex; justify-content: space-between; align-items: flex-end; page-break-inside: avoid;">' +
                    '<div style="text-align: center; width: 45%; border-top: 1px solid #000; padding-top: 8px;">' +
                        '<div style="font-weight: bold; font-size: 10pt;">' + (params.ciudadanoNombre || 'COMPARECIENTE / ASISTIDO') + '</div>' +
                        '<div style="font-size: 9pt;">D.N.I. N° ' + dniFormat + '</div>' +
                        '<div style="font-size: 8.5pt; color: #64748b; font-style: italic;">Firma del Asistido / Compareciente</div>' +
                    '</div>' +
                    '<div style="text-align: center; width: 45%; border-top: 1px solid #000; padding-top: 8px;">' +
                        '<div style="font-weight: bold; font-size: 10pt;">' + officials.firmaNombre + '</div>' +
                        '<div style="font-size: 9pt;">' + officials.firmaCargo + '</div>' +
                        '<div style="font-size: 8.5pt; color: #64748b; font-style: italic;">Ministerio Público de la Defensa</div>' +
                    '</div>' +
                '</div>' +
            '</div>';
        }
    }

    // 4. Entidad Attendance
    class Attendance {
        constructor({ id, fecha, actividad, dni, apellidos, nombres, celular, expte, motivo, defensoria, resultado, observaciones, atendidoPor, atendido_por, derivadoA, escritos, tarea_pendiente, tareaPendiente, detalle_pendiente, detallePendiente, tarea_cumplida_at, tareaCumplidaAt, modo_derivacion_familia, modoDerivacionFamilia, codefensora_asignada, codefensoraAsignada, fecha_vencimiento_contestacion, fechaVencimientoContestacion, plantilla_codigo, plantillaCodigo, escritos_data, escritosData }) {
            this.id = Number(id) || Date.now();
            this.fecha = fecha || 'S/F';
            this.actividad = fixMojibake(actividad) || 'Atención Personal';
            this.dni = new DNI(dni);
            this.apellidos = fixMojibake(apellidos || 'SIN REGISTRO').toUpperCase();
            this.nombres = fixMojibake(nombres || '').toUpperCase();
            this.celular = celular || '';
            this.expte = expte || '';
            this.motivo = fixMojibake(motivo);
            this.defensoriaCategory = new DefensoriaCategory(defensoria);
            this.resultado = fixMojibake(resultado) || 'Resuelve';
            this.observaciones = fixMojibake(observaciones);
            this.atendidoPor = fixMojibake(atendidoPor || atendido_por) || 'Secretaría';
            this.derivadoA = fixMojibake(derivadoA);
            this.escritos = fixMojibake(escritos);

            this.tareaPendiente = Boolean(tarea_pendiente || tareaPendiente);
            this.detallePendiente = fixMojibake(detalle_pendiente || detallePendiente || '');
            this.tareaCumplidaAt = tarea_cumplida_at || tareaCumplidaAt || null;

            this.modoDerivacionFamilia = modo_derivacion_familia || modoDerivacionFamilia || '';
            this.codefensoraAsignada = codefensora_asignada || codefensoraAsignada || '';
            this.fechaVencimientoContestacion = fecha_vencimiento_contestacion || fechaVencimientoContestacion || '';
            this.plantillaCodigo = plantilla_codigo || plantillaCodigo || '';
            this.escritosData = escritos_data || escritosData || '';
        }
        get fullName() { return \`\${this.apellidos} \${this.nombres}\`.trim(); }
        isDerivacionTecnica() {
            return (this.resultado && this.resultado.toLowerCase().includes('técnica')) ||
                   (this.derivadoA && this.derivadoA.toLowerCase().includes('técnica'));
        }
        hasEscritos() { return Boolean(this.escritos && this.escritos.trim().length > 0); }
    }

    // 5. DTO
    class AttendanceDTO {
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
                hasEscritos: entity.hasEscritos(),
                tareaPendiente: entity.tareaPendiente,
                detallePendiente: entity.detallePendiente,
                tareaCumplidaAt: entity.tareaCumplidaAt,
                modoDerivacionFamilia: entity.modoDerivacionFamilia,
                codefensoraAsignada: entity.codefensoraAsignada,
                fechaVencimientoContestacion: entity.fechaVencimientoContestacion,
                plantillaCodigo: entity.plantillaCodigo,
                escritosData: entity.escritosData
            };
        }
    }

    // 6. Casos de Uso
    class GetAttendanceSummaryUseCase {
        execute(attendances) {
            const now = new Date();
            const todayStr = normalizeDateStr(now.toLocaleDateString('es-AR'));
            
            const currentDay = now.getDay();
            const distanceToMonday = (currentDay === 0 ? 6 : currentDay - 1);
            const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMonday);
            startOfWeek.setHours(0, 0, 0, 0);

            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            startOfMonth.setHours(0, 0, 0, 0);

            const startOfYear = new Date(now.getFullYear(), 0, 1);
            startOfYear.setHours(0, 0, 0, 0);

            let totalToday = 0;
            let totalWeek = 0;
            let totalMonth = 0;
            let totalYear = 0;
            const operatorBreakdownToday = {};
            const operatorBreakdownWeek = {};
            const operatorBreakdownMonth = {};

            let pendientesHoy = 0;
            let pendientesSemana = 0;
            let pendientesAntiguas = 0;
            const pendingOperatorBreakdown = {};

            attendances.forEach(a => {
                const isToday = normalizeDateStr(a.fecha) === todayStr;
                const op = a.atendidoPor || 'Secretaría';

                if (isToday) {
                    totalToday++;
                    operatorBreakdownToday[op] = (operatorBreakdownToday[op] || 0) + 1;
                }

                const ts = parseDate(a.fecha);
                if (ts > 0) {
                    const dateObj = new Date(ts);
                    if (dateObj >= startOfWeek) {
                        totalWeek++;
                        operatorBreakdownWeek[op] = (operatorBreakdownWeek[op] || 0) + 1;
                    }
                    if (dateObj >= startOfMonth && dateObj.getFullYear() === now.getFullYear() && dateObj.getMonth() === now.getMonth()) {
                        totalMonth++;
                        operatorBreakdownMonth[op] = (operatorBreakdownMonth[op] || 0) + 1;
                    }
                    if (dateObj >= startOfYear && dateObj.getFullYear() === now.getFullYear()) {
                        totalYear++;
                    }
                }

                if (a.tareaPendiente) {
                    const op = a.atendidoPor || 'Secretaría';
                    pendingOperatorBreakdown[op] = (pendingOperatorBreakdown[op] || 0) + 1;

                    if (isToday) {
                        pendientesHoy++;
                    } else if (ts > 0 && new Date(ts) >= startOfWeek) {
                        pendientesSemana++;
                    } else {
                        pendientesAntiguas++;
                    }
                }
            });

            const tecnicaBreakdown = {};
            let totalAsesoramientos = 0;
            let asesFamilia = 0;
            let asesOtros = 0;

            attendances.forEach(a => {
                if (a.isDerivacionTecnica()) {
                    const dest = (a.derivadoA && a.derivadoA.trim()) ? a.derivadoA.trim() : 'Sin Especificar';
                    tecnicaBreakdown[dest] = (tecnicaBreakdown[dest] || 0) + 1;
                }

                const resStr = String(a.resultado || '');
                const modoStr = String(a.modoDerivacionFamilia || '');
                const motStr = String(a.motivo || '');
                const isAses = (resStr.includes('Asesoramiento') || modoStr.includes('Asesoramiento') || motStr.includes('Asesoramiento General'));
                if (isAses) {
                    totalAsesoramientos++;
                    const def = a.defensoriaCategory ? a.defensoriaCategory.name : (a.defensoria || '');
                    if (def === 'CO-DEF. FAMILIA') {
                        asesFamilia++;
                    } else {
                        asesOtros++;
                    }
                }
            });

            return {
                total: attendances.length,
                totalYear,
                totalMonth,
                totalWeek,
                totalToday,
                totalAsesoramientos,
                asesFamilia,
                asesOtros,
                derivacionesTecnica: attendances.filter(a => a.isDerivacionTecnica()).length,
                escritosCount: attendances.filter(a => a.hasEscritos()).length,
                pendientesCount: attendances.filter(a => a.tareaPendiente).length,
                pendientesHoy,
                pendientesSemana,
                pendientesAntiguas,
                operatorBreakdown: operatorBreakdownToday,
                operatorBreakdownToday,
                operatorBreakdownWeek,
                operatorBreakdownMonth,
                pendingOperatorBreakdown,
                tecnicaBreakdown
            };
        }
    }

    class SearchAttendancesUseCase {
        execute(attendances, { query = '', defensoria = '', resultado = '', soloTecnica = false, tecnicaCategory = null }) {
            const norm = (str) => String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const qRaw = norm(query).trim();
            const qClean = qRaw.replace(/[^a-z0-9]/g, '');
            const qWords = qRaw.split(/\\s+/).filter(Boolean);

            const filtered = attendances.filter(item => {
                let matchesQuery = true;
                if (qRaw) {
                    const idStr = String(item.id || '');
                    const dniClean = item.dni ? item.dni.clean : '';
                    const dniRaw = item.dni ? item.dni.raw : '';
                    const apellidos = norm(item.apellidos);
                    const nombres = norm(item.nombres);
                    const fullName1 = apellidos + ' ' + nombres;
                    const fullName2 = nombres + ' ' + apellidos;
                    const expte = norm(item.expte);
                    const motivo = norm(item.motivo);
                    const defensoriaName = item.defensoriaCategory ? norm(item.defensoriaCategory.name) : '';
                    const resName = norm(item.resultado);
                    const obs = norm(item.observaciones);
                    const detPend = norm(item.detallePendiente);
                    const atendido = norm(item.atendidoPor);
                    const codef = norm(item.codefensoraAsignada);

                    const searchBlob = [idStr, dniClean, dniRaw, fullName1, fullName2, expte, motivo, defensoriaName, resName, obs, detPend, atendido, codef].join(' ');
                    const searchBlobClean = searchBlob.replace(/[^a-z0-9]/g, '');

                    matchesQuery = (qClean.length > 0 && searchBlobClean.includes(qClean)) ||
                                   qWords.every(word => searchBlob.includes(word));
                }

                const matchesDefensoria = !defensoria || (item.defensoriaCategory && item.defensoriaCategory.name === defensoria);
                
                let matchesResultado = true;
                if (resultado === 'PENDIENTE') {
                    matchesResultado = item.tareaPendiente === true;
                } else if (resultado) {
                    matchesResultado = item.resultado === resultado;
                }

                let matchesTecnica = true;
                if (soloTecnica) {
                    matchesTecnica = item.isDerivacionTecnica();
                    if (matchesTecnica && tecnicaCategory) {
                        const dest = (item.derivadoA && item.derivadoA.trim()) ? item.derivadoA.trim() : 'Sin Especificar';
                        matchesTecnica = (dest === tecnicaCategory);
                    }
                }

                return matchesQuery && matchesDefensoria && matchesResultado && matchesTecnica;
            });

            // Ordenar por ID descendente (el más reciente siempre primero)
            filtered.sort((a, b) => b.id - a.id);
            
            return filtered.map(entity => AttendanceDTO.fromEntity(entity));
        }
    }

    class CreateAttendanceUseCase {
        constructor(repository) { this.repository = repository; }
        async execute(formData) {
            const entity = new Attendance(formData);
            const saved = await this.repository.save(entity);
            return AttendanceDTO.fromEntity(saved);
        }
    }

    // 7. Adaptador Repositorio SQLite
    const EMBEDDED_CSV = ${JSON.stringify(csvContent)};

    class SQLiteAttendanceRepositoryAdapter {
        constructor(apiUrl = '/api/atenciones') {
            this.apiUrl = apiUrl;
            this.cache = [];
        }

        async getAll() {
            try {
                const res = await fetch(getApiUrl(this.apiUrl));
                if (res.ok) {
                    const result = await res.json();
                    if (result.success && Array.isArray(result.data)) {
                        this.cache = result.data.map(row => new Attendance({
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
                            escritos: row.escritos,
                            tarea_pendiente: row.tarea_pendiente,
                            detalle_pendiente: row.detalle_pendiente,
                            tarea_cumplida_at: row.tarea_cumplida_at,
                            modo_derivacion_familia: row.modo_derivacion_familia,
                            codefensora_asignada: row.codefensora_asignada,
                            fecha_vencimiento_contestacion: row.fecha_vencimiento_contestacion,
                            plantilla_codigo: row.plantilla_codigo,
                            escritos_data: row.escritos_data
                        }));

                        this.cache.sort((a, b) => b.id - a.id);
                        return this.cache;
                    }
                }
            } catch(e) {
                console.warn('Carga remota falló, usando datos embebidos:', e.message);
            }
            return this._getFallbackRecords();
        }

        async save(entity) {
            try {
                const res = await fetch(getApiUrl(this.apiUrl), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fecha: entity.fecha,
                        actividad: entity.actividad,
                        dni: entity.dni.raw,
                        apellidos: entity.apellidos,
                        nombres: entity.nombres,
                        celular: entity.celular,
                        expte: entity.expte,
                        motivo: entity.motivo,
                        defensoria: entity.defensoriaCategory.name,
                        resultado: entity.resultado,
                        observaciones: entity.observaciones,
                        atendidoPor: entity.atendidoPor,
                        derivadoA: entity.derivadoA,
                        escritos: entity.escritos,
                        tareaPendiente: entity.tareaPendiente,
                        detallePendiente: entity.detallePendiente,
                        modoDerivacionFamilia: entity.modoDerivacionFamilia,
                        codefensoraAsignada: entity.codefensoraAsignada,
                        fechaVencimientoContestacion: entity.fechaVencimientoContestacion,
                        plantillaCodigo: entity.plantillaCodigo,
                        escritosData: entity.escritosData,
                        operatorId: entity.operatorId || 0
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.id) entity.id = Number(data.id);
                } else {
                    const errText = await res.text();
                    throw new Error('HTTP ' + res.status + ' al guardar: ' + errText);
                }
            } catch(e) {
                console.error('Error enviando registro a API:', e.message);
                throw e;
            }
            this.cache.unshift(entity);
            return entity;
        }

        async update(entity) {
            try {
                await fetch(getApiUrl(this.apiUrl), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: entity.id,
                        fecha: entity.fecha,
                        actividad: entity.actividad,
                        dni: entity.dni.raw,
                        apellidos: entity.apellidos,
                        nombres: entity.nombres,
                        celular: entity.celular,
                        expte: entity.expte,
                        motivo: entity.motivo,
                        defensoria: entity.defensoriaCategory.name,
                        resultado: entity.resultado,
                        observaciones: entity.observaciones,
                        atendidoPor: entity.atendidoPor,
                        derivadoA: entity.derivadoA,
                        escritos: entity.escritos,
                        tareaPendiente: entity.tareaPendiente,
                        detallePendiente: entity.detallePendiente,
                        modoDerivacionFamilia: entity.modoDerivacionFamilia,
                        codefensoraAsignada: entity.codefensoraAsignada,
                        fechaVencimientoContestacion: entity.fechaVencimientoContestacion,
                        plantillaCodigo: entity.plantillaCodigo,
                        escritosData: entity.escritosData
                    })
                });
            } catch(e) {
                console.warn('Error enviando actualización a API:', e.message);
            }
            const idx = this.cache.findIndex(e => e.id === entity.id);
            if (idx !== -1) {
                this.cache[idx] = entity;
            }
            return entity;
        }

        _getFallbackRecords() {
            if (this.cache.length > 0) return this.cache;
            const lines = EMBEDDED_CSV.split(/\\r\\n|\\n/);
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
            records.sort((a, b) => b.id - a.id);
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

    // 8. Controlador de Vista UI
    class DashboardViewController {
        constructor({ getSummaryUseCase, searchAttendancesUseCase, createAttendanceUseCase, attendanceRepository }) {
            this.getSummaryUseCase = getSummaryUseCase;
            this.searchAttendancesUseCase = searchAttendancesUseCase;
            this.createAttendanceUseCase = createAttendanceUseCase;
            this.repository = attendanceRepository;
            
            this.currentUser = null;
            this.rawEntities = [];
            this.currentDTOs = [];
            this.codefensorasRoster = [];
            this.proximaDefensoriaTurno = '';

            this.currentPage = 1;
            this.pageSize = 25;

            this.initDOM();
        }

        initDOM() {
            this.loginModal = document.getElementById('loginModal');
            this.loginForm = document.getElementById('loginForm');
            this.loginUserSelect = document.getElementById('loginUserSelect');
            this.loginPassword = document.getElementById('loginPassword');
            this.loginErrorMessage = document.getElementById('loginErrorMessage');
            
            this.confirmLogoutModal = document.getElementById('confirmLogoutModal');
            this.btnConfirmLogout = document.getElementById('btnConfirmLogout');
            this.btnCancelLogout = document.getElementById('btnCancelLogout');

            this.userAvatar = document.getElementById('userAvatar');
            this.userName = document.getElementById('userName');
            this.userRole = document.getElementById('userRole');
            this.btnLogoutUser = document.getElementById('btnLogoutUser');
            this.navItemConfig = document.getElementById('navItemConfig');
            this.navItemDashboard = document.getElementById('navItemDashboard');

            this.viewDashboardSection = document.getElementById('viewDashboardSection');
            this.viewConfigSection = document.getElementById('viewConfigSection');
            this.adminUserForm = document.getElementById('adminUserForm');
            this.adminUsersTableBody = document.getElementById('adminUsersTableBody');
            this.adminAuditTableBody = document.getElementById('adminAuditTableBody');
            this.btnDownloadBackup = document.getElementById('btnDownloadBackup');

            this.newDniInput = document.getElementById('newDni');
            this.btnSearchDni = document.getElementById('btnSearchDni');
            this.dniStatusBadge = document.getElementById('dniStatusBadge');
            this.dniQuickActionsBar = document.getElementById('dniQuickActionsBar');
            this.btnQuickNuevaCausa = document.getElementById('btnQuickNuevaCausa');
            this.btnQuickContinuarCausa = document.getElementById('btnQuickContinuarCausa');
            this.btnQuickVerHistorial = document.getElementById('btnQuickVerHistorial');
            this.quickHistoryCount = document.getElementById('quickHistoryCount');
            this.linkedHistoryBanner = document.getElementById('linkedHistoryBanner');
            this.linkedHistoryBannerText = document.getElementById('linkedHistoryBannerText');
            this.btnUnlinkHistory = document.getElementById('btnUnlinkHistory');

            this.citizenHistoryDrawerOverlay = document.getElementById('citizenHistoryDrawerOverlay');
            this.citizenHistoryDrawer = document.getElementById('citizenHistoryDrawer');
            this.btnCloseHistoryDrawer = document.getElementById('btnCloseHistoryDrawer');
            this.drawerCitizenName = document.getElementById('drawerCitizenName');
            this.drawerCitizenDni = document.getElementById('drawerCitizenDni');
            this.drawerHistoryList = document.getElementById('drawerHistoryList');

            this.newApellidosInput = document.getElementById('newApellidos');
            this.newNombresInput = document.getElementById('newNombres');
            this.newCelularInput = document.getElementById('newCelular');
            this.newFechaInput = document.getElementById('newFecha');
            this.newActividadSelect = document.getElementById('newActividad');
            this.newDefensoriaSelect = document.getElementById('newDefensoria');
            this.newExpteInput = document.getElementById('newExpte');

            this.fueroActiveBadge = document.getElementById('fueroActiveBadge');
            this.fueroFamiliaSection = document.getElementById('fueroFamiliaSection');
            this.fueroPenalSection = document.getElementById('fueroPenalSection');
            this.fueroCivilSection = document.getElementById('fueroCivilSection');

            this.newTipoTramiteFamilia = document.getElementById('newTipoTramiteFamilia');
            this.newMateriaFamilia = document.getElementById('newMateriaFamilia');
            this.newTramitePenal = document.getElementById('newTramitePenal');
            this.newTramiteCivil = document.getElementById('newTramiteCivil');

            this.codefensoraBadgeStatus = document.getElementById('codefensoraBadgeStatus');
            this.newCodefensoraAsignada = document.getElementById('newCodefensoraAsignada');
            this.codefensoraHint = document.getElementById('codefensoraHint');
            this.fechaVencimientoGroup = document.getElementById('fechaVencimientoGroup');
            this.newFechaVencimientoContestacion = document.getElementById('newFechaVencimientoContestacion');

            this.newResultadoSelect = document.getElementById('newResultado');
            this.reparticionDetalleGroup = document.getElementById('reparticionDetalleGroup');
            this.newReparticionDetalle = document.getElementById('newReparticionDetalle');
            this.newTareaPendiente = document.getElementById('newTareaPendiente');
            this.newDetallePendiente = document.getElementById('newDetallePendiente');
            this.newAtendidoPorInput = document.getElementById('newAtendidoPor');
            this.newObservacionesInput = document.getElementById('newObservaciones');

            this.tableBody = document.getElementById('tableBody');
            this.searchInput = document.getElementById('searchInput');
            this.filterDefensoria = document.getElementById('filterDefensoria');
            this.filterResultado = document.getElementById('filterResultado');
            this.kpiTotal = document.getElementById('kpiTotal');
            this.kpiMes = document.getElementById('kpiMes');
            this.kpiSemana = document.getElementById('kpiSemana');
            this.kpiHoy = document.getElementById('kpiHoy');
            this.cardTotalAtenciones = document.getElementById('cardTotalAtenciones');
            this.operatorTooltip = document.getElementById('operatorTooltip');
            this.operatorTooltipTotalBadge = document.getElementById('operatorTooltipTotalBadge');
            this.operatorBreakdownList = document.getElementById('operatorBreakdownList');
            this.selectedOperatorPeriod = 'today';
            this.latestSummary = null;
            
            this.kpiAsesoramiento = document.getElementById('kpiAsesoramiento');
            this.kpiAsesFamilia = document.getElementById('kpiAsesFamilia');
            this.kpiAsesOtros = document.getElementById('kpiAsesOtros');
            this.cardAsesoramientoGeneral = document.getElementById('cardAsesoramientoGeneral');

            this.kpiEscritos = document.getElementById('kpiEscritos');
            this.kpiPendientes = document.getElementById('kpiPendientes');
            this.cardTareasPendientes = document.getElementById('cardTareasPendientes');
            this.pendingOperatorTooltip = document.getElementById('pendingOperatorTooltip');
            this.pendingOperatorBreakdownList = document.getElementById('pendingOperatorBreakdownList');
            this.kpiPendientesHoy = document.getElementById('kpiPendientesHoy');
            this.kpiPendientesSemana = document.getElementById('kpiPendientesSemana');
            this.kpiPendientesAntiguas = document.getElementById('kpiPendientesAntiguas');

            this.pageSizeSelect = document.getElementById('pageSizeSelect');
            this.btnPrevPage = document.getElementById('btnPrevPage');
            this.btnNextPage = document.getElementById('btnNextPage');
            this.pageIndicator = document.getElementById('pageIndicator');
            this.pageStart = document.getElementById('pageStart');
            this.pageEnd = document.getElementById('pageEnd');
            this.totalRecordsCount = document.getElementById('totalRecordsCount');

            this.detailModal = document.getElementById('detailModal');
            this.detailModalBody = document.getElementById('detailModalBody');
            this.btnCloseDetailModal = document.getElementById('btnCloseDetailModal');
            this.newRecordModal = document.getElementById('newRecordModal');
            this.newRecordForm = document.getElementById('newRecordForm');
            this.btnNewRecord = document.getElementById('btnNewRecord');
            this.btnNavNuevaAtencion = document.getElementById('btnNavNuevaAtencion');
            this.btnCloseNewModal = document.getElementById('btnCloseNewModal');
            this.presenceRosterContainer = document.getElementById('presenceRosterContainer');
            this.presenceMarqueeTrack = document.getElementById('presenceMarqueeTrack');
            this.btnExpandPresence = document.getElementById('btnExpandPresence');
            this.presenceGridModal = document.getElementById('presenceGridModal');
            this.presenceGridContainer = document.getElementById('presenceGridContainer');
            this.presenceReorderContainer = document.getElementById('presenceReorderContainer');
            this.dndLiveRegion = document.getElementById('dndLiveRegion');
            this.btnClosePresenceGridModal = document.getElementById('btnClosePresenceGridModal');
            this.currentTurnos = {};
            this.turnIndicatorBadge = document.getElementById('turnIndicatorBadge');
            this.turnIndicatorContainer = document.getElementById('turnIndicatorContainer');

            this.btnOnlineUsers = document.getElementById('btnOnlineUsers');
            this.onlineUsersPopover = document.getElementById('onlineUsersPopover');
            this.onlineUsersCountText = document.getElementById('onlineUsersCountText');
            this.onlineUsersBadgeCount = document.getElementById('onlineUsersBadgeCount');
            this.onlineUsersList = document.getElementById('onlineUsersList');
            
            this.currentDateText = document.getElementById('currentDateText');
            this.currentTimeText = document.getElementById('currentTimeText');
            this.activeCatalogCategory = 'actividad';

            // Módulo de Confección de Escritos Judiciales y Plantillas
            this.plantillasEscritos = [];
            this.activePlantilla = null;
            this.escritoDynamicValues = {};

            this.sectionConfeccionEscrito = document.getElementById('sectionConfeccionEscrito');
            this.toggleEscritoPanel = document.getElementById('toggleEscritoPanel');
            this.escritoPanelContent = document.getElementById('escritoPanelContent');
            this.btnToggleEscrito = document.getElementById('btnToggleEscrito');
            this.escritoChevronIcon = document.getElementById('escritoChevronIcon');
            this.escritoStatusBadge = document.getElementById('escritoStatusBadge');
            this.selectPlantillaEscrito = document.getElementById('selectPlantillaEscrito');
            this.escritoCamposDinamicosWrapper = document.getElementById('escritoCamposDinamicosWrapper');
            this.escritoCamposDinamicosContainer = document.getElementById('escritoCamposDinamicosContainer');
            this.escritoPreviewSection = document.getElementById('escritoPreviewSection');
            this.previewHeaderExpte = document.getElementById('previewHeaderExpte');
            this.previewHeaderDefensoria = document.getElementById('previewHeaderDefensoria');
            this.previewSumarioBadge = document.getElementById('previewSumarioBadge');
            this.escritoTextoEditor = document.getElementById('escritoTextoEditor');
            this.btnCopiarTextoEscrito = document.getElementById('btnCopiarTextoEscrito');
            this.btnImprimirEscrito = document.getElementById('btnImprimirEscrito');
            this.btnDescargarPdfEscrito = document.getElementById('btnDescargarPdfEscrito');
            this.btnMarcarPendienteEscrito = document.getElementById('btnMarcarPendienteEscrito');

            this.adminPlantillasTableBody = document.getElementById('adminPlantillasTableBody');
            this.adminPlantillaForm = document.getElementById('adminPlantillaForm');
            this.btnAdminNuevaPlantilla = document.getElementById('btnAdminNuevaPlantilla');
            this.btnCancelEditPlantilla = document.getElementById('btnCancelEditPlantilla');
            this.printEscritoContainer = document.getElementById('printEscritoContainer');
        }

        async init() {
            this.bindEvents();
            this.startClock();
            await this.loadPublicUsersForLogin();

            const savedSession = localStorage.getItem(SESSION_STORAGE_KEY);
            if (savedSession) {
                try {
                    const parsed = JSON.parse(savedSession);
                    this.currentUser = new User(parsed);
                    this.loginModal.classList.remove('active');
                    await this.onLoginSuccess();
                    return;
                } catch(e) {}
            }

            this.loginModal.classList.add('active');
        }

        bindEvents() {
            if (this.btnExpandPresence && this.presenceGridModal) {
                this.btnExpandPresence.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.presenceGridModal.classList.add('active');
                });
            }
            if (this.btnClosePresenceGridModal && this.presenceGridModal) {
                this.btnClosePresenceGridModal.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.presenceGridModal.classList.remove('active');
                });
            }
            if (this.presenceGridModal) {
                this.presenceGridModal.addEventListener('click', (e) => {
                    if (e.target === this.presenceGridModal) {
                        this.presenceGridModal.classList.remove('active');
                    }
                });

                const tabBtns = this.presenceGridModal.querySelectorAll('.modal-tab-btn');
                tabBtns.forEach(btn => {
                    btn.addEventListener('click', () => {
                        tabBtns.forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        const targetId = btn.getAttribute('data-target');
                        this.presenceGridModal.querySelectorAll('.modal-tab-section').forEach(sec => {
                            sec.style.display = (sec.id === targetId) ? 'block' : 'none';
                        });
                    });
                });
            }

            if (this.btnOnlineUsers && this.onlineUsersPopover) {
                this.btnOnlineUsers.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const triggerIcon = e.target.closest('#btnIconChatTrigger');
                    if (triggerIcon) {
                        this.onlineUsersPopover.style.display = 'none';
                        this.openChatDrawer();
                        return;
                    }
                    const isVisible = this.onlineUsersPopover.style.display === 'block';
                    this.onlineUsersPopover.style.display = isVisible ? 'none' : 'block';
                });

                document.addEventListener('click', (e) => {
                    if (this.onlineUsersPopover && !this.onlineUsersPopover.contains(e.target) && !this.btnOnlineUsers.contains(e.target)) {
                        this.onlineUsersPopover.style.display = 'none';
                    }
                });
            }
            if (this.loginUserSelect && this.loginPassword) {
                this.loginUserSelect.addEventListener('change', () => {
                    this.loginPassword.value = '';
                });
            }

            if (this.loginForm) {
                this.loginForm.addEventListener('submit', (e) => this.handleLoginSubmit(e));
            }

            if (this.btnLogoutUser) {
                this.btnLogoutUser.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.confirmLogoutModal.classList.add('active');
                });
            }

            if (this.btnCloseApp) {
                this.btnCloseApp.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.confirmLogoutModal.classList.add('active');
                });
            }

            if (this.btnCancelLogout) {
                this.btnCancelLogout.addEventListener('click', () => {
                    this.confirmLogoutModal.classList.remove('active');
                });
            }

            if (this.btnConfirmLogout) {
                this.btnConfirmLogout.addEventListener('click', () => {
                    this.confirmLogoutModal.classList.remove('active');
                    this.logoutUser();
                });
            }

            if (this.btnDownloadBackup) {
                this.btnDownloadBackup.addEventListener('click', () => {
                    showToast('Iniciando descarga de copia de seguridad SQLite...', 'info');
                    window.location.href = getApiUrl('/api/admin/backup-db');
                });
            }

            if (this.pageSizeSelect) {
                this.pageSizeSelect.addEventListener('change', () => {
                    this.pageSize = parseInt(this.pageSizeSelect.value, 10) || 25;
                    this.currentPage = 1;
                    this.renderPaginatedTable();
                });
            }

            if (this.btnPrevPage) {
                this.btnPrevPage.addEventListener('click', () => {
                    if (this.currentPage > 1) {
                        this.currentPage--;
                        this.renderPaginatedTable();
                    }
                });
            }

            if (this.btnNextPage) {
                this.btnNextPage.addEventListener('click', () => {
                    const maxPages = Math.ceil(this.currentDTOs.length / this.pageSize) || 1;
                    if (this.currentPage < maxPages) {
                        this.currentPage++;
                        this.renderPaginatedTable();
                    }
                });
            }

            if (this.navItemDashboard) {
                this.navItemDashboard.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.showDashboardSection();
                });
            }

            const btnToggleSidebar = document.getElementById('btnToggleSidebar');
            const sidebar = document.querySelector('.sidebar');
            const sidebarToggleIcon = document.getElementById('sidebarToggleIcon');

            if (localStorage.getItem('mpd_sidebar_collapsed') === 'true' && sidebar) {
                sidebar.classList.add('collapsed');
                if (sidebarToggleIcon) {
                    sidebarToggleIcon.className = 'ri-menu-unfold-line';
                }
            }

            if (btnToggleSidebar && sidebar) {
                btnToggleSidebar.addEventListener('click', (e) => {
                    e.preventDefault();
                    sidebar.classList.toggle('collapsed');
                    const isCollapsed = sidebar.classList.contains('collapsed');
                    localStorage.setItem('mpd_sidebar_collapsed', isCollapsed ? 'true' : 'false');
                    if (sidebarToggleIcon) {
                        sidebarToggleIcon.className = isCollapsed ? 'ri-menu-unfold-line' : 'ri-menu-fold-line';
                    }
                });
            }

            if (this.navItemConfig) {
                this.navItemConfig.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.showConfigSection();
                });
            }

            if (this.adminUserForm) {
                this.adminUserForm.addEventListener('submit', (e) => this.handleAdminUserSubmit(e));
            }

            const catalogCategoryTabs = document.getElementById('catalogCategoryTabs');
            if (catalogCategoryTabs) {
                catalogCategoryTabs.querySelectorAll('.catalog-tab-btn').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        catalogCategoryTabs.querySelectorAll('.catalog-tab-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        this.activeCatalogCategory = btn.getAttribute('data-cat');
                        await this.loadAdminCatalogView();
                    });
                });
            }

            const btnAddCatalogOptionBtn = document.getElementById('btnAddCatalogOptionBtn');
            if (btnAddCatalogOptionBtn) {
                btnAddCatalogOptionBtn.addEventListener('click', async () => {
                    const input = document.getElementById('newCatalogOptionInput');
                    if (input && input.value.trim()) {
                        await this.addCatalogOption(input.value.trim());
                    }
                });
            }

            const btnCancelEditUser = document.getElementById('btnCancelEditUser');
            if (btnCancelEditUser) {
                btnCancelEditUser.addEventListener('click', () => {
                    this.resetAdminUserForm();
                });
            }

            if (this.btnSearchDni) {
                this.btnSearchDni.addEventListener('click', () => {
                    this.performDniLookup();
                });
            }

            if (this.newDniInput) {
                this.newDniInput.addEventListener('input', () => {
                    const clean = this.newDniInput.value.replace(/[^0-9]/g, '');
                    if (clean.length >= 7 && clean.length <= 9) {
                        this.performDniLookup();
                    } else if (clean.length === 0) {
                        if (this.dniStatusBadge) this.dniStatusBadge.style.display = 'none';
                        if (this.dniQuickActionsBar) this.dniQuickActionsBar.style.display = 'none';
                    }
                });
            }

            if (this.btnQuickNuevaCausa) {
                this.btnQuickNuevaCausa.addEventListener('click', () => this.handleQuickNuevaCausa(true));
            }

            if (this.btnQuickContinuarCausa) {
                this.btnQuickContinuarCausa.addEventListener('click', () => this.handleQuickContinuarCausa());
            }

            if (this.btnQuickVerHistorial) {
                this.btnQuickVerHistorial.addEventListener('click', () => this.openCitizenHistoryDrawer());
            }

            if (this.btnCloseHistoryDrawer) {
                this.btnCloseHistoryDrawer.addEventListener('click', () => this.closeCitizenHistoryDrawer());
            }

            if (this.citizenHistoryDrawerOverlay) {
                this.citizenHistoryDrawerOverlay.addEventListener('click', (e) => {
                    if (e.target === this.citizenHistoryDrawerOverlay) {
                        this.closeCitizenHistoryDrawer();
                    }
                });
            }

            const btnUnlink = document.getElementById('btnUnlinkHistory');
            if (btnUnlink) {
                btnUnlink.addEventListener('click', () => this.unlinkHistoryRecord());
            }

            if (this.newDefensoriaSelect) {
                this.newDefensoriaSelect.addEventListener('change', () => {
                    if (this.newAtendidoPorInput && this.currentUser) {
                        this.newAtendidoPorInput.value = this.currentUser.nombreCompleto;
                    }
                    this.handleFueroChange();
                });
            }

            if (this.newTipoTramiteFamilia) {
                this.newTipoTramiteFamilia.addEventListener('change', () => {
                    this.handleTipoTramiteFamiliaChange();
                });
            }

            if (this.newMateriaFamilia) {
                this.newMateriaFamilia.addEventListener('change', () => {
                    this.updateFamiliaAssignmentLogic();
                });
            }

            const elResultadoSelect = document.getElementById('newResultado');
            if (elResultadoSelect) {
                elResultadoSelect.addEventListener('change', () => {
                    this.handleResultadoChange();
                });
            }

            if (this.newExpteInput) {
                this.newExpteInput.addEventListener('change', () => {
                    if (this.newDefensoriaSelect && this.newDefensoriaSelect.value === 'CO-DEF. FAMILIA') {
                        this.updateFamiliaAssignmentLogic();
                    }
                });
            }

            this.searchInput.addEventListener('input', () => {
                this.currentPage = 1;
                this.updateView();
            });

            this.filterDefensoria.addEventListener('change', () => {
                this.currentPage = 1;
                this.updateView();
            });

            this.filterResultado.addEventListener('change', () => {
                this.currentPage = 1;
                this.updateView();
            });

            if (this.cardTotalAtenciones && this.operatorTooltip) {
                this.cardTotalAtenciones.addEventListener('mouseenter', () => {
                    this.operatorTooltip.style.display = 'block';
                });
                this.cardTotalAtenciones.addEventListener('mouseleave', () => {
                    this.operatorTooltip.style.display = 'none';
                });

                this.operatorTooltip.addEventListener('click', (e) => {
                    e.stopPropagation();
                });

                const tabButtons = this.operatorTooltip.querySelectorAll('.btn-op-tab');
                tabButtons.forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const period = btn.getAttribute('data-period');
                        if (period) {
                            this.selectedOperatorPeriod = period;
                            tabButtons.forEach(b => {
                                const isActive = b === btn;
                                b.classList.toggle('active', isActive);
                                b.style.background = isActive ? 'var(--mpd-red)' : 'transparent';
                                b.style.color = isActive ? '#FFF' : '#94A3B8';
                            });
                            this.renderOperatorBreakdown();
                        }
                    });
                });
            }

            if (this.cardTareasPendientes) {
                if (this.pendingOperatorTooltip) {
                    this.cardTareasPendientes.addEventListener('mouseenter', () => {
                        this.pendingOperatorTooltip.style.display = 'block';
                    });
                    this.cardTareasPendientes.addEventListener('mouseleave', () => {
                        this.pendingOperatorTooltip.style.display = 'none';
                    });
                }
                this.cardTareasPendientes.addEventListener('click', (e) => {
                    // Evitar que el click dentro del tooltip cierre o distorsione la acción si fue en un elemento de texto
                    if (this.filterResultado) {
                        if (this.filterResultado.value === 'PENDIENTE') {
                            this.filterResultado.value = '';
                        } else {
                            this.filterResultado.value = 'PENDIENTE';
                        }
                        this.currentPage = 1;
                        this.updateView();
                    }
                });
            }

            if (this.btnCloseDetailModal) this.btnCloseDetailModal.addEventListener('click', () => this.detailModal.classList.remove('active'));
            if (this.btnNewRecord) this.btnNewRecord.addEventListener('click', () => this.openNewModal());
            if (this.btnNavNuevaAtencion) this.btnNavNuevaAtencion.addEventListener('click', (e) => { e.preventDefault(); this.openNewModal(); });
            if (this.btnCloseNewModal) this.btnCloseNewModal.addEventListener('click', () => this.newRecordModal.classList.remove('active'));
            if (this.newRecordForm) this.newRecordForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
            if (this.btnExportPDF) this.btnExportPDF.addEventListener('click', (e) => { e.preventDefault(); window.print(); });

            this.setupEscritoEvents();
            this.setupAdminPlantillaEvents();

            // Close modals when clicking outside (on the overlay), except newRecordModal to prevent data loss
            document.querySelectorAll('.modal-overlay').forEach(overlay => {
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay && overlay.id !== 'newRecordModal' && overlay.id !== 'loginModal') {
                        overlay.classList.remove('active');
                    }
                });
            });
        }

        startClock() {
            if (!this.currentDateText || !this.currentTimeText) return;
            
            const updateClock = () => {
                const now = new Date();
                const day = now.getDate();
                const month = now.toLocaleDateString('es-AR', { month: 'long' });
                const year = now.getFullYear();
                this.currentDateText.textContent = 'San Rafael, ' + day + ' de ' + month + ' de ' + year;
                this.currentTimeText.textContent = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            };
            
            updateClock();
            setInterval(updateClock, 1000);
        }

        async performDniLookup() {
            const dniVal = this.newDniInput ? this.newDniInput.value.trim() : '';
            const cleanDni = dniVal.replace(/[^0-9]/g, '');

            if (!cleanDni || cleanDni.length < 7 || cleanDni.length > 9) {
                if (this.dniStatusBadge) {
                    this.dniStatusBadge.style.display = 'inline-block';
                    this.dniStatusBadge.className = 'badge badge-otro';
                    this.dniStatusBadge.textContent = '⚠️ Ingrese un DNI válido (7 u 8 dígitos)';
                }
                if (this.dniQuickActionsBar) this.dniQuickActionsBar.style.display = 'none';
                return;
            }

            if (this.dniStatusBadge) {
                this.dniStatusBadge.style.display = 'inline-block';
                this.dniStatusBadge.className = 'badge badge-civil';
                this.dniStatusBadge.textContent = 'Buscando...';
            }

            let foundHistory = [];
            let personalData = null;

            try {
                const res = await fetch(getApiUrl('/api/ciudadanos/historial?dni=' + encodeURIComponent(cleanDni)));
                if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.found) {
                        foundHistory = data.history || [];
                        personalData = data.personalData || null;
                    }
                }
            } catch(e) {}

            if (foundHistory.length === 0) {
                const matchedEntities = this.rawEntities.filter(ent => ent.dni && ent.dni.clean === cleanDni);
                if (matchedEntities.length > 0) {
                    const latest = matchedEntities[0];
                    personalData = {
                        apellidos: latest.apellidos,
                        nombres: latest.nombres,
                        celular: latest.celular
                    };
                    foundHistory = matchedEntities.map(e => AttendanceDTO.fromEntity(e));
                }
            }

            if (foundHistory.length > 0) {
                this.currentCitizenHistory = foundHistory;

                if (this.dniStatusBadge) {
                    this.dniStatusBadge.style.display = 'inline-block';
                    this.dniStatusBadge.className = 'badge badge-familia';
                    this.dniStatusBadge.textContent = '¡Registrado! (' + foundHistory.length + ' atención' + (foundHistory.length > 1 ? 'es' : '') + ' previa' + (foundHistory.length > 1 ? 's' : '') + ')';
                }

                if (personalData) {
                    if (this.newApellidosInput) this.newApellidosInput.value = personalData.apellidos || '';
                    if (this.newNombresInput) this.newNombresInput.value = personalData.nombres || '';
                    if (this.newCelularInput && personalData.celular) this.newCelularInput.value = personalData.celular;
                }

                if (this.dniQuickActionsBar) {
                    this.dniQuickActionsBar.style.display = 'block';
                    if (this.quickHistoryCount) this.quickHistoryCount.textContent = foundHistory.length;
                    if (this.btnQuickNuevaCausa) this.btnQuickNuevaCausa.classList.add('active');
                    if (this.btnQuickContinuarCausa) this.btnQuickContinuarCausa.classList.remove('active');
                }

                this.renderCitizenHistoryDrawer(foundHistory, personalData);
            } else {
                this.currentCitizenHistory = [];
                if (this.dniStatusBadge) {
                    this.dniStatusBadge.style.display = 'inline-block';
                    this.dniStatusBadge.className = 'badge badge-civil';
                    this.dniStatusBadge.textContent = '✨ Ciudadano Nuevo (Primer Registro)';
                }
                if (this.dniQuickActionsBar) this.dniQuickActionsBar.style.display = 'none';
                if (this.linkedHistoryBanner) this.linkedHistoryBanner.style.display = 'none';
                this.linkedHistoryDto = null;
            }
        }

        handleQuickNuevaCausa(notify = true) {
            this.linkedHistoryDto = null;
            if (this.linkedHistoryBanner) this.linkedHistoryBanner.style.display = 'none';

            if (this.btnQuickNuevaCausa) this.btnQuickNuevaCausa.classList.add('active');
            if (this.btnQuickContinuarCausa) this.btnQuickContinuarCausa.classList.remove('active');

            if (this.newExpteInput) this.newExpteInput.value = '';

            if (this.newDefensoriaSelect && this.newDefensoriaSelect.value === 'CO-DEF. FAMILIA') {
                if (this.newTipoTramiteFamilia) this.newTipoTramiteFamilia.value = 'Causa Nueva';
                this.updateFamiliaAssignmentLogic();
            }

            if (notify) {
                showToast('Modo activo: Nueva Consulta / Asunto Nuevo para este ciudadano', 'info');
            }
        }

        handleQuickContinuarCausa() {
            if (!this.currentCitizenHistory || this.currentCitizenHistory.length === 0) {
                showToast('No se encontraron trámites previos para continuar.', 'warning');
                return;
            }
            const latest = this.currentCitizenHistory[0];
            this.selectHistoryRecordToContinue(latest);
        }

        openCitizenHistoryDrawer() {
            if (!this.citizenHistoryDrawerOverlay) return;
            this.citizenHistoryDrawerOverlay.classList.add('active');
        }

        closeCitizenHistoryDrawer() {
            if (!this.citizenHistoryDrawerOverlay) return;
            this.citizenHistoryDrawerOverlay.classList.remove('active');
        }

        renderCitizenHistoryDrawer(historyList, personalData) {
            if (this.drawerCitizenName) {
                const name = (personalData && personalData.apellidos) ? (personalData.apellidos + ' ' + (personalData.nombres || '')) : 'Ciudadano';
                this.drawerCitizenName.textContent = name;
            }
            if (this.drawerCitizenDni && this.newDniInput) {
                this.drawerCitizenDni.textContent = 'DNI: ' + this.newDniInput.value.trim();
            }

            if (!this.drawerHistoryList) return;

            let html = '';
            historyList.forEach(item => {
                const def = item.defensoria || item.defensoriaName || 'Defensoría';
                const fecha = item.fecha || 's/f';
                const expte = item.expte ? ('Expte: ' + item.expte) : (item.motivo || 'Atención en Mesa');
                const obs = item.observaciones ? ('<div class="history-card-obs">"' + item.observaciones + '"</div>') : '';
                const task = (item.tarea_pendiente || item.tareaPendiente) ? '<span style="color:#FBBF24; font-size:0.72rem; font-weight:700;">⚠️ Tarea Pendiente: ' + (item.detalle_pendiente || item.detallePendiente || '') + '</span>' : '';
                const codef = item.codefensora_asignada || item.codefensoraAsignada || '';

                let borderClass = 'is-civil';
                if (def.includes('FAMILIA')) borderClass = 'is-family';
                else if (def.includes('PENAL')) borderClass = 'is-penal';

                html += '<div class="history-item-card ' + borderClass + '">' +
                    '<div class="history-card-header">' +
                        '<span class="badge" style="font-size:0.7rem; background:rgba(0,180,216,0.15); color:#38BDF8;">' + def + '</span>' +
                        '<span class="history-card-date"><i class="ri-calendar-line"></i> ' + fecha + '</span>' +
                    '</div>' +
                    '<div class="history-card-meta">' + expte + '</div>' +
                    (codef ? '<div style="font-size:0.76rem; color:#EC4899;"><i class="ri-user-star-line"></i> Co-Defensora: Dra. ' + codef.replace(/^Dra\\.\\s*/i, '') + '</div>' : '') +
                    '<div style="font-size:0.75rem; color:#94A3B8;">Resultado: <strong style="color:#FFF;">' + (item.resultado || 'Resuelve') + '</strong></div>' +
                    task +
                    obs +
                    '<button type="button" class="btn-select-history-card" data-history-id="' + item.id + '">' +
                        '<i class="ri-link-m"></i> Continuar este Trámite' +
                    '</button>' +
                '</div>';
            });

            this.drawerHistoryList.innerHTML = html;

            this.drawerHistoryList.querySelectorAll('.btn-select-history-card').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = Number(btn.getAttribute('data-history-id'));
                    const item = historyList.find(h => h.id === id);
                    if (item) {
                        this.selectHistoryRecordToContinue(item);
                        this.closeCitizenHistoryDrawer();
                    }
                });
            });
        }

        async handleLoginSubmit(e) {
            e.preventDefault();
            this.loginErrorMessage.style.display = 'none';

            const username = this.loginUserSelect.value;
            const password = this.loginPassword.value;

            try {
                const res = await fetch(getApiUrl('/api/auth/login'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await res.json();
                if (res.ok && data.success && data.user) {
                    this.currentUser = new User(data.user);
                    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(this.currentUser.toJSON()));

                    this.loginModal.classList.remove('active');
                    await this.onLoginSuccess();
                    return;
                } else {
                    this.loginErrorMessage.textContent = data.error || 'Credenciales incorrectas';
                    this.loginErrorMessage.style.display = 'block';
                    return;
                }
            } catch(err) {}

            const isSp = username === 'spereyra';
            this.currentUser = new User({
                username: username,
                nombreCompleto: isSp ? 'Sergio M. Pereyra' : 'Operador de Turno',
                rol: isSp ? 'ADMINISTRADOR' : 'OPERADOR',
                avatarInitials: isSp ? 'SP' : 'OP',
                isAdmin: isSp
            });

            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(this.currentUser.toJSON()));

            this.loginModal.classList.remove('active');
            await this.onLoginSuccess();
        }

        async onLoginSuccess() {
            this.userAvatar.textContent = this.currentUser.avatarInitials;
            this.userName.textContent = this.currentUser.nombreCompleto;
            this.userRole.textContent = this.currentUser.rol;

            if (this.currentUser && typeof this.currentUser.canAccessConfig === 'function' && this.currentUser.canAccessConfig()) {
                this.navItemConfig.style.display = 'flex';
            } else if (this.currentUser && (this.currentUser.isAdmin() || this.currentUser.username === 'spereyra')) {
                this.navItemConfig.style.display = 'flex';
            } else {
                this.navItemConfig.style.display = 'none';
            }

            if (this.newAtendidoPorInput && this.currentUser) {
                this.newAtendidoPorInput.value = this.currentUser.nombreCompleto;
            }

            await this.loadCodefensorasRoster();
            await this.loadCatalogOptions();
            await this.loadPlantillasEscritos();
            if (this.currentUser && (this.currentUser.isAdmin() || this.currentUser.username === 'spereyra')) {
                await this.loadAdminPlantillas();
            }
            this.rawEntities = await this.repository.getAll();
            this.showDashboardSection();
            this.updateView();
            this.initChatModule();
            await this.updateChatGlobalUnreadBadge();
            this.initWebSocketConnection();
            this.startAutoSyncPolling();
        }

        initWebSocketConnection() {
            if (this.socket) {
                try { this.socket.close(); } catch(e) {}
            }

            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            let wsUrl = '';
            if (window.location.protocol === 'file:') {
                wsUrl = 'ws://localhost:3000';
            } else {
                wsUrl = \`\${protocol}//\${window.location.host}\`;
            }

            try {
                this.socket = new WebSocket(wsUrl);

                this.socket.onopen = () => {
                    if (this.currentUser) {
                        this.socket.send(JSON.stringify({
                            type: 'IDENTIFY',
                            user: {
                                username: this.currentUser.username,
                                nombreCompleto: this.currentUser.nombreCompleto,
                                rol: this.currentUser.rol,
                                avatarInitials: this.currentUser.avatarInitials
                            }
                        }));
                    }
                };

                this.socket.onmessage = async (event) => {
                    try {
                        const msg = JSON.parse(event.data);
                        await this.handleRealtimeEvent(msg);
                    } catch (e) {}
                };

                this.socket.onclose = () => {
                    setTimeout(() => {
                        if (this.currentUser) this.initWebSocketConnection();
                    }, 3000);
                };

                this.socket.onerror = (err) => {};
            } catch (e) {}
        }

        async handleRealtimeEvent(msg) {
            if (!msg || !msg.type) return;
            const { type, payload } = msg;

            if (type === 'RECORD_CREATED') {
                showToast(\`ℹ️ \${payload.operator || 'Un operador'} registró una nueva atención\`, 'info');
                this.rawEntities = await this.repository.getAll();
                this.updateView();
            } else if (type === 'RECORD_UPDATED') {
                this.rawEntities = await this.repository.getAll();
                this.updateView();
            } else if (type === 'RECORD_DELETED') {
                if (payload && payload.id) {
                    this.rawEntities = this.rawEntities.filter(e => e.id !== payload.id);
                    this.updateView();
                }
            } else if (type === 'PRESENCE_UPDATED') {
                await this.loadCodefensorasRoster();
                await this.calculateProximoTurno();
                if (payload && payload.nombre) {
                    showToast(\`👥 Cambio de presentismo: \${payload.nombre} marcado como \${payload.isPresente ? 'Presente' : 'Ausente'}\`, 'info');
                }
            } else if (type === 'ONLINE_USERS_UPDATED') {
                if (payload && Array.isArray(payload.data)) {
                    this.renderOnlineUsers(payload.data);
                }
            } else if (type === 'CHAT_RECEIVE_MESSAGE') {
                if (payload) {
                    const isForMe = this.currentUser && payload.receptor_username === this.currentUser.username;
                    if (isForMe && (!this.activeChatUsername || this.activeChatUsername !== payload.emisor_username)) {
                        showToast('💬 Nuevo mensaje de ' + payload.emisor_username, 'info');
                    }
                    if (this.activeChatUsername && (payload.emisor_username === this.activeChatUsername || payload.receptor_username === this.activeChatUsername)) {
                        await this.loadChatMessages();
                    }
                    await this.updateChatGlobalUnreadBadge();
                    if (this.chatContactsList && this.chatContactsList.style.display !== 'none') {
                        await this.loadChatContacts();
                    }
                }
            } else if (type === 'CHAT_FILE_PURGED') {
                if (this.activeChatUsername) {
                    await this.loadChatMessages();
                }
            }
        }

        startAutoSyncPolling() {
            if (this.autoSyncInterval) clearInterval(this.autoSyncInterval);
            this.sendHeartbeatAndFetchOnlineUsers();
            this.autoSyncInterval = setInterval(async () => {
                try {
                    await this.sendHeartbeatAndFetchOnlineUsers();
                    await this.loadCodefensorasRoster();
                    const latestData = await this.repository.getAll();
                    if (latestData && latestData.length !== this.rawEntities.length) {
                        this.rawEntities = latestData;
                        this.updateView();
                    }
                } catch(e) {}
            }, 8000);
        }

        async sendHeartbeatAndFetchOnlineUsers() {
            if (!this.currentUser) return;
            try {
                await fetch(getApiUrl('/api/usuarios/heartbeat'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: this.currentUser.username,
                        nombreCompleto: this.currentUser.nombreCompleto,
                        rol: this.currentUser.rol,
                        avatarInitials: this.currentUser.avatarInitials
                    })
                });

                const res = await fetch(getApiUrl('/api/usuarios/online'));
                if (res.ok) {
                    const data = await res.json();
                    if (data.success && Array.isArray(data.data)) {
                        this.renderOnlineUsers(data.data);
                    }
                }
            } catch(e) {}
        }

        renderOnlineUsers(users) {
            const count = users.length;
            if (this.onlineUsersCountText) {
                this.onlineUsersCountText.textContent = count + ' ' + (count === 1 ? 'Conectado' : 'Conectados');
            }
            if (this.onlineUsersBadgeCount) {
                this.onlineUsersBadgeCount.textContent = count + ' En línea';
            }
            if (!this.onlineUsersList) return;

            let html = '';
            users.forEach(u => {
                const isCurrent = this.currentUser && this.currentUser.username === u.username;
                const roleBadgeClass = u.rol === 'ADMINISTRADOR' ? 'badge-familia' : 'badge-otro';
                html += '<div class="online-user-item-row" data-username="' + u.username + '" data-name="' + u.nombreCompleto + '" title="' + (isCurrent ? 'Tu usuario' : 'Clic para chatear con ' + u.nombreCompleto) + '">' +
                    '<div style="display: flex; align-items: center; gap: 0.6rem;">' +
                        '<div style="position: relative;">' +
                            '<div class="avatar" style="width: 30px; height: 30px; font-size: 0.75rem; font-weight: 700;">' + (u.avatarInitials || 'OP') + '</div>' +
                            '<span style="position: absolute; bottom: -1px; right: -1px; width: 9px; height: 9px; border-radius: 50%; background: #4ADE80; border: 2px solid #0F172A;"></span>' +
                        '</div>' +
                        '<div>' +
                            '<span style="display: block; font-size: 0.82rem; font-weight: 600; color: #FFF;">' + u.nombreCompleto + (isCurrent ? ' <small style="color: #38BDF8;">(Tú)</small>' : '') + '</span>' +
                            '<span class="badge ' + roleBadgeClass + '" style="font-size: 0.65rem; padding: 0.1rem 0.35rem;">' + u.rol + '</span>' +
                        '</div>' +
                    '</div>' +
                    (!isCurrent ? '<i class="ri-chat-3-line" style="color: #38BDF8; font-size: 1rem;"></i>' : '') +
                '</div>';
            });
            this.onlineUsersList.innerHTML = html;

            this.onlineUsersList.querySelectorAll('.online-user-item-row').forEach(row => {
                row.addEventListener('click', async () => {
                    const uname = row.getAttribute('data-username');
                    const name = row.getAttribute('data-name');
                    if (this.currentUser && uname === this.currentUser.username) return;
                    if (this.onlineUsersPopover) this.onlineUsersPopover.style.display = 'none';
                    await this.openChatDrawer();
                    await this.openConversation(uname, name);
                });
            });
        }

        async loadPublicUsersForLogin() {
            if (!this.loginUserSelect) return;
            try {
                const res = await fetch(getApiUrl('/api/auth/users'));
                if (res.ok) {
                    const result = await res.json();
                    if (result.success && Array.isArray(result.data) && result.data.length > 0) {
                        const currentVal = this.loginUserSelect.value;
                        let html = '';
                        result.data.forEach(u => {
                            html += '<option value="' + u.username + '">' + u.nombre_completo + '</option>';
                        });
                        this.loginUserSelect.innerHTML = html;
                        if (currentVal && Array.from(this.loginUserSelect.options).some(o => o.value === currentVal)) {
                            this.loginUserSelect.value = currentVal;
                        }
                    }
                }
            } catch(e) {
                console.warn('Error al cargar usuarios para login:', e.message);
            }
        }

        logoutUser() {
            this.currentUser = null;
            localStorage.removeItem(SESSION_STORAGE_KEY);
            this.loginModal.classList.add('active');
            this.loadPublicUsersForLogin();
            if (this.navItemConfig) this.navItemConfig.style.display = 'none';
            this.showDashboardSection();
        }

        showDashboardSection() {
            this.viewDashboardSection.style.display = 'block';
            this.viewConfigSection.style.display = 'none';
            this.navItemDashboard.classList.add('active');
            if (this.navItemConfig) this.navItemConfig.classList.remove('active');
        }

        async showConfigSection() {
            if (!this.currentUser || (!this.currentUser.isAdmin() && this.currentUser.username !== 'spereyra')) {
                alert('Acceso Denegado: Reservado exclusivamente para el Administrador Sergio M. Pereyra.');
                return;
            }

            this.viewDashboardSection.style.display = 'none';
            this.viewConfigSection.style.display = 'flex';
            this.navItemDashboard.classList.remove('active');
            this.navItemConfig.classList.add('active');

            await this.loadAdminUsersTable();
            await this.loadAdminRotacionControl();
            await this.loadAdminCatalogView();
            await this.loadAdminAuditTable();
        }

        initChatModule() {
            this.btnOpenChatDrawer = document.getElementById('btnOpenChatDrawer');
            this.btnCloseChatDrawer = document.getElementById('btnCloseChatDrawer');
            this.chatDrawerOverlay = document.getElementById('chatDrawerOverlay');
            this.chatContactsList = document.getElementById('chatContactsList');
            this.chatConversationView = document.getElementById('chatConversationView');
            this.btnBackToContacts = document.getElementById('btnBackToContacts');
            this.chatMessagesArea = document.getElementById('chatMessagesArea');
            this.chatTextInput = document.getElementById('chatTextInput');
            this.btnSendChatMessage = document.getElementById('btnSendChatMessage');
            this.btnAttachFile = document.getElementById('btnAttachFile');
            this.chatFileInput = document.getElementById('chatFileInput');
            this.chatGlobalUnreadBadge = document.getElementById('chatGlobalUnreadBadge');
            this.activeChatUsername = null;

            if (this.btnOpenChatDrawer && !this.btnOpenChatDrawer.dataset.bound) {
                this.btnOpenChatDrawer.dataset.bound = "true";
                this.btnOpenChatDrawer.addEventListener('click', () => this.openChatDrawer());
            }
            if (this.btnCloseChatDrawer && !this.btnCloseChatDrawer.dataset.bound) {
                this.btnCloseChatDrawer.dataset.bound = "true";
                this.btnCloseChatDrawer.addEventListener('click', () => this.closeChatDrawer());
            }
            if (this.chatDrawerOverlay && !this.chatDrawerOverlay.dataset.bound) {
                this.chatDrawerOverlay.dataset.bound = "true";
                this.chatDrawerOverlay.addEventListener('click', (e) => {
                    if (e.target === this.chatDrawerOverlay) this.closeChatDrawer();
                });
            }
            if (this.btnBackToContacts && !this.btnBackToContacts.dataset.bound) {
                this.btnBackToContacts.dataset.bound = "true";
                this.btnBackToContacts.addEventListener('click', () => {
                    this.activeChatUsername = null;
                    this.chatConversationView.style.display = 'none';
                    this.chatContactsList.style.display = 'flex';
                    this.loadChatContacts();
                });
            }
            if (this.btnSendChatMessage && !this.btnSendChatMessage.dataset.bound) {
                this.btnSendChatMessage.dataset.bound = "true";
                this.btnSendChatMessage.addEventListener('click', () => this.sendChatMessage());
            }
            if (this.chatTextInput && !this.chatTextInput.dataset.bound) {
                this.chatTextInput.dataset.bound = "true";
                this.chatTextInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.sendChatMessage();
                });
            }
            if (this.btnAttachFile && this.chatFileInput && !this.btnAttachFile.dataset.bound) {
                this.btnAttachFile.dataset.bound = "true";
                this.btnAttachFile.addEventListener('click', () => this.chatFileInput.click());
                this.chatFileInput.addEventListener('change', () => this.handleFileSelected());
            }
        }

        async openChatDrawer() {
            if (this.chatDrawerOverlay) this.chatDrawerOverlay.classList.add('active');
            await this.loadChatContacts();
        }

        closeChatDrawer() {
            if (this.chatDrawerOverlay) this.chatDrawerOverlay.classList.remove('active');
        }

        async updateChatGlobalUnreadBadge() {
            if (!this.currentUser || !this.chatGlobalUnreadBadge) return;
            try {
                const res = await fetch(getApiUrl('/api/chat/unread-count?username=' + encodeURIComponent(this.currentUser.username)));
                if (res.ok) {
                    const json = await res.json();
                    if (json.success && Array.isArray(json.data)) {
                        const total = json.data.reduce((acc, curr) => acc + (curr.unread_count || 0), 0);
                        if (total > 0) {
                            this.chatGlobalUnreadBadge.textContent = total;
                            this.chatGlobalUnreadBadge.style.display = 'inline-block';
                            if (this.btnOnlineUsers) this.btnOnlineUsers.classList.add('has-unread');
                        } else {
                            this.chatGlobalUnreadBadge.style.display = 'none';
                            if (this.btnOnlineUsers) this.btnOnlineUsers.classList.remove('has-unread');
                        }
                    }
                }
            } catch(e) {}
        }

        async loadChatContacts() {
            if (!this.chatContactsList) return;
            try {
                const usersRes = await fetch(getApiUrl('/api/auth/users'));
                const unreadRes = await fetch(getApiUrl('/api/chat/unread-count?username=' + encodeURIComponent(this.currentUser ? this.currentUser.username : '')));
                const onlineRes = await fetch(getApiUrl('/api/usuarios/online'));

                const usersData = usersRes.ok ? (await usersRes.json()).data : [];
                const unreadData = unreadRes.ok ? (await unreadRes.json()).data : [];
                const onlineData = onlineRes.ok ? (await onlineRes.json()).data : [];

                const unreadMap = {};
                (unreadData || []).forEach(r => unreadMap[r.emisor_username] = r.unread_count);
                const onlineMap = {};
                (onlineData || []).forEach(o => onlineMap[o.username] = true);

                let html = '';
                (usersData || []).forEach(u => {
                    if (this.currentUser && u.username === this.currentUser.username) return;
                    const isOnline = Boolean(onlineMap[u.username]);
                    const unread = unreadMap[u.username] || 0;
                    const initials = (u.nombre_completo.split(' ').map(p => p[0]).join('')).substring(0, 2).toUpperCase();

                    const unreadBadgeHtml = unread > 0 ? '<span class="badge" style="background: #EF4444; color: #FFF; font-size: 0.7rem; padding: 0.15rem 0.4rem; border-radius: 10px;">' + unread + ' nuevo(s)</span>' : '';
                    const statusColor = isOnline ? '#4ADE80' : '#64748B';
                    const statusText = isOnline ? 'En línea' : 'Desconectado';

                    html += '<div class="chat-contact-item" data-username="' + u.username + '" data-name="' + u.nombre_completo + '">' +
                        '<div style="display: flex; align-items: center; gap: 0.75rem;">' +
                            '<div style="position: relative;">' +
                                '<div class="avatar" style="width: 34px; height: 34px; font-size: 0.8rem; font-weight: 700;">' + initials + '</div>' +
                                '<span style="position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; border-radius: 50%; background: ' + statusColor + '; border: 2px solid #0F172A;"></span>' +
                            '</div>' +
                            '<div>' +
                                '<span style="display: block; font-size: 0.88rem; font-weight: 600; color: #FFF;">' + u.nombre_completo + '</span>' +
                                '<span style="font-size: 0.72rem; color: ' + statusColor + ';">' + statusText + '</span>' +
                            '</div>' +
                        '</div>' +
                        unreadBadgeHtml +
                    '</div>';
                });

                this.chatContactsList.innerHTML = html || '<div style="color: #94A3B8; text-align: center; font-size: 0.85rem; padding: 1rem;">No hay otros usuarios registrados.</div>';

                const self = this;
                this.chatContactsList.querySelectorAll('.chat-contact-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const uname = item.getAttribute('data-username');
                        const name = item.getAttribute('data-name');
                        self.openConversation(uname, name);
                    });
                });
            } catch(e) {}
        }

        async openConversation(username, name) {
            this.activeChatUsername = username;
            document.getElementById('activeChatName').textContent = name;
            document.getElementById('activeChatAvatar').textContent = (name.split(' ').map(p => p[0]).join('')).substring(0, 2).toUpperCase();

            this.chatContactsList.style.display = 'none';
            this.chatConversationView.style.display = 'flex';

            await fetch(getApiUrl('/api/chat/marcar-leidos'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emisor: username, receptor: this.currentUser ? this.currentUser.username : '' })
            });

            await this.updateChatGlobalUnreadBadge();
            await this.loadChatMessages();
        }

        async loadChatMessages() {
            if (!this.activeChatUsername || !this.chatMessagesArea) return;
            try {
                const res = await fetch(getApiUrl('/api/chat/historial?user1=' + encodeURIComponent(this.currentUser ? this.currentUser.username : '') + '&user2=' + encodeURIComponent(this.activeChatUsername)));
                if (res.ok) {
                    const json = await res.json();
                    if (json.success && Array.isArray(json.data)) {
                        let html = '';
                        json.data.forEach(m => {
                            const isSent = this.currentUser && m.emisor_username === this.currentUser.username;
                            const bubbleClass = isSent ? 'sent' : 'received';

                            let contentHtml = '';
                            if (m.tipo === 'FILE') {
                                if (m.descargado) {
                                    contentHtml = '<div style="display: flex; align-items: center; gap: 0.4rem; color: #E2E8F0; font-size: 0.8rem;">' +
                                        '<i class="ri-checkbox-circle-fill" style="color: #4ADE80; font-size: 1.1rem;"></i>' +
                                        '<span>Archivo <strong>' + m.archivo_nombre + '</strong> descargado y purgado.</span>' +
                                    '</div>';
                                } else {
                                    contentHtml = '<div style="display: flex; flex-direction: column; gap: 0.35rem;">' +
                                        '<div style="font-weight: 600; font-size: 0.85rem;"><i class="ri-file-download-line"></i> ' + m.archivo_nombre + '</div>' +
                                        '<div style="font-size: 0.72rem; opacity: 0.85;">Tamaño: ' + (m.archivo_tamano / 1024).toFixed(1) + ' KB</div>' +
                                        '<a href="' + getApiUrl('/api/chat/descargar/' + m.id) + '" target="_blank" class="btn btn-secondary" style="font-size: 0.75rem; padding: 0.3rem 0.5rem; text-decoration: none; margin-top: 0.25rem; display: inline-flex; align-items: center; gap: 0.3rem; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.2); color: #FFF;">' +
                                            '<i class="ri-download-line"></i> Descargar (Borrado Automático)' +
                                        '</a>' +
                                    '</div>';
                                }
                            } else {
                                contentHtml = m.mensaje;
                            }

                            html += '<div class="chat-bubble ' + bubbleClass + '">' +
                                contentHtml +
                            '</div>';
                        });
                        this.chatMessagesArea.innerHTML = html || '<div style="color: #64748B; font-size: 0.8rem; text-align: center; padding: 1rem;">No hay mensajes en esta conversación.</div>';
                        this.chatMessagesArea.scrollTop = this.chatMessagesArea.scrollHeight;
                    }
                }
            } catch(e) {}
        }

        async sendChatMessage() {
            const text = this.chatTextInput ? this.chatTextInput.value.trim() : '';
            if (!text || !this.activeChatUsername || !this.socket) return;

            const payload = {
                emisor: this.currentUser.username,
                receptor: this.activeChatUsername,
                mensaje: text,
                tipo: 'TEXT'
            };

            this.socket.send(JSON.stringify({ type: 'CHAT_SEND_MESSAGE', payload }));
            this.chatTextInput.value = '';
        }

        async handleFileSelected() {
            const file = this.chatFileInput ? this.chatFileInput.files[0] : null;
            if (!file || !this.activeChatUsername) return;

            if (file.size > 15 * 1024 * 1024) {
                showToast('El archivo supera el límite de 15 MB', 'error');
                return;
            }

            try {
                showToast('Subiendo archivo adjunto...', 'info');
                const uploadRes = await fetch(getApiUrl('/api/chat/upload'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': file.type || 'application/octet-stream',
                        'X-File-Name': encodeURIComponent(file.name)
                    },
                    body: file
                });

                if (uploadRes.ok) {
                    const upData = await uploadRes.json();
                    if (upData.success) {
                        const payload = {
                            emisor: this.currentUser.username,
                            receptor: this.activeChatUsername,
                            mensaje: 'Envió un archivo adjunto: ' + upData.archivoNombre,
                            tipo: 'FILE',
                            archivoNombre: upData.archivoNombre,
                            archivoRuta: upData.archivoRuta,
                            archivoTamano: upData.archivoTamano,
                            archivoMime: upData.archivoMime
                        };
                        this.socket.send(JSON.stringify({ type: 'CHAT_SEND_MESSAGE', payload }));
                        showToast('Archivo adjuntado correctamente', 'success');
                    }
                }
            } catch(e) {
                showToast('Error al subir archivo adjunto', 'error');
            }
            this.chatFileInput.value = '';
        }

        async loadAdminRotacionControl() {
            const container = document.getElementById('rotacionCanalesContainer');
            const btnReset = document.getElementById('btnResetRotacion');

            if (btnReset && !btnReset.dataset.bound) {
                btnReset.dataset.bound = "true";
                btnReset.addEventListener('click', () => {
                    showConfirm('¿Reiniciar Rotación?', '¿Confirma reiniciar el puntero de rotación a cero para todos los canales?', async () => {
                        try {
                            const res = await fetch(getApiUrl('/api/admin/rotacion/reset'), {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ adminOperatorName: this.currentUser ? this.currentUser.nombreCompleto : 'ADMIN' })
                            });
                            if (res.ok) {
                                showToast('Rotación reiniciada a cero correctamente', 'success');
                                await this.loadAdminRotacionControl();
                                await this.calculateProximoTurno();
                            }
                        } catch(e) {
                            showToast('Error al reiniciar rotación', 'error');
                        }
                    });
                });
            }

            if (!container) return;

            const canales = [
                { key: 'ASESORAMIENTO_GENERAL', label: 'Asesoramiento General' },
                { key: 'CAUSA_NUEVA', label: 'Causa Nueva' },
                { key: 'CONTESTACION_DEMANDA', label: 'Contestación de Demanda' },
                { key: 'ADOPCION', label: 'Guarda / Tutela / Adopción' }
            ];

            let html = '';
            for (const c of canales) {
                const turnRes = await fetch(getApiUrl('/api/familia/proximo-turno?canal=' + encodeURIComponent(c.key)));
                let proxima = 'Sin asignar';
                if (turnRes.ok) {
                    const tData = await turnRes.json();
                    if (tData.proximaDefensora) proxima = tData.proximaDefensora;
                }

                let optionsHtml = '';
                this.codefensorasRoster.forEach((def, idx) => {
                    const selected = def.nombre.toLowerCase() === proxima.toLowerCase() ? 'selected' : '';
                    const ausenteTxt = def.isPresente ? '' : ' (Ausente)';
                    optionsHtml += '<option value="' + (idx - 1) + '" ' + selected + '>Inicia con: Dra. ' + def.nombre + ausenteTxt + '</option>';
                });

                html += '<div class="form-group" style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">' +
                    '<label style="font-weight: 600; color: #E2E8F0;">' + c.label + '</label>' +
                    '<div style="font-size: 0.82rem; color: #38BDF8; margin-bottom: 0.5rem;">Próximo Turno: Dra. ' + proxima + '</div>' +
                    '<select class="form-control channel-rotation-select" data-canal="' + c.key + '" style="font-size: 0.85rem;">' +
                        optionsHtml +
                    '</select>' +
                '</div>';
            }

            container.innerHTML = html;

            const self = this;
            container.querySelectorAll('.channel-rotation-select').forEach(function(sel) {
                sel.addEventListener('change', async function(e) {
                    const canal = sel.getAttribute('data-canal');
                    const lastIndex = parseInt(sel.value, 10);
                    try {
                        const res = await fetch(getApiUrl('/api/admin/rotacion/canal'), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                canal: canal,
                                lastIndex: lastIndex,
                                adminOperatorName: self.currentUser ? self.currentUser.nombreCompleto : 'ADMIN'
                            })
                        });
                        if (res.ok) {
                            showToast('Turno del canal actualizado', 'success');
                            await self.loadAdminRotacionControl();
                            await self.calculateProximoTurno();
                        }
                    } catch(err) {
                        showToast('Error al actualizar canal', 'error');
                    }
                });
            });
        }

        async loadCatalogOptions() {
            try {
                const res = await fetch(getApiUrl('/api/catalogos'));
                if (res.ok) {
                    const json = await res.json();
                    if (json.success && json.data) {
                        this.catalogData = json.data;
                        this.populateSelectsFromCatalog();
                    }
                }
            } catch (e) {
                console.warn('Error cargando catálogos:', e.message);
            }
        }

        populateSelectsFromCatalog() {
            if (!this.catalogData) return;

            const elActividad = document.getElementById('newActividad');
            if (elActividad && this.catalogData.actividad) {
                const curVal = elActividad.value;
                elActividad.innerHTML = '<option value="" disabled selected>-- Seleccionar Modalidad --</option>' +
                    this.catalogData.actividad.map(function(item) { 
                        const label = item.valor === 'Atención Personal' ? 'Mesa de Entradas (Atención Personal)' : item.valor;
                        return '<option value="' + item.valor + '">' + label + '</option>'; 
                    }).join('');
                if (curVal) elActividad.value = curVal;
            }

            const elDefensoria = document.getElementById('newDefensoria');
            if (elDefensoria && this.catalogData.defensoria) {
                const curVal = elDefensoria.value;
                elDefensoria.innerHTML = '<option value="" disabled selected>-- Seleccionar Defensoría / Fuero --</option>' +
                    this.catalogData.defensoria.map(function(item) { 
                        return '<option value="' + item.valor + '">' + item.valor + '</option>'; 
                    }).join('');
                if (curVal) elDefensoria.value = curVal;
            }

            const elMotivo = document.getElementById('newMotivo');
            if (elMotivo && this.catalogData.motivo) {
                const curVal = elMotivo.value;
                elMotivo.innerHTML = '<option value="" disabled selected>-- Seleccionar Motivo --</option>' +
                    this.catalogData.motivo.map(function(item) { return '<option value="' + item.valor + '">' + item.valor + '</option>'; }).join('');
                if (curVal) elMotivo.value = curVal;
            }

            if (this.updateResultadoOptions) {
                this.updateResultadoOptions(this.newDefensoriaSelect ? this.newDefensoriaSelect.value : '');
            }

            const elFamilySubmotivo = document.getElementById('newFamilySubmotivo');
            if (elFamilySubmotivo && this.catalogData.submotivo_familia) {
                const curVal = elFamilySubmotivo.value;
                elFamilySubmotivo.innerHTML = this.catalogData.submotivo_familia.map(function(item) { return '<option value="' + item.valor + '">' + item.valor + '</option>'; }).join('');
                if (curVal) elFamilySubmotivo.value = curVal;
            }

            const elModoFamilia = document.getElementById('newModoDerivacionFamilia');
            if (elModoFamilia && this.catalogData.modo_derivacion_familia) {
                const curVal = elModoFamilia.value;
                elModoFamilia.innerHTML = this.catalogData.modo_derivacion_familia.map(function(item) { return '<option value="' + item.valor + '">' + item.valor + '</option>'; }).join('');
                if (curVal) elModoFamilia.value = curVal;
            }
        }

        // ==========================================
        // MÓDULO DE CONFECCIÓN DE ESCRITOS JUDICIALES
        // ==========================================

        setupEscritoEvents() {
            if (this.toggleEscritoPanel) {
                this.toggleEscritoPanel.addEventListener('click', () => {
                    const isVisible = this.escritoPanelContent && this.escritoPanelContent.style.display === 'block';
                    if (this.escritoPanelContent) this.escritoPanelContent.style.display = isVisible ? 'none' : 'block';
                    if (this.escritoChevronIcon) {
                        this.escritoChevronIcon.className = isVisible ? 'ri-arrow-down-s-line' : 'ri-arrow-up-s-line';
                    }
                });
            }

            if (this.btnToggleEscrito) {
                this.btnToggleEscrito.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isVisible = this.escritoPanelContent && this.escritoPanelContent.style.display === 'block';
                    if (this.escritoPanelContent) this.escritoPanelContent.style.display = isVisible ? 'none' : 'block';
                    if (this.escritoChevronIcon) {
                        this.escritoChevronIcon.className = isVisible ? 'ri-arrow-down-s-line' : 'ri-arrow-up-s-line';
                    }
                });
            }

            if (this.selectPlantillaEscrito) {
                this.selectPlantillaEscrito.addEventListener('change', () => this.onPlantillaSelectChange());
            }

            const inputSync = [
                this.newDniInput, this.newApellidosInput, this.newNombresInput,
                this.newCelularInput, this.newExpteInput, this.newDefensoriaSelect,
                document.getElementById('newFecha'), this.newAtendidoPorInput
            ];
            inputSync.forEach(input => {
                if (input) {
                    input.addEventListener('input', () => { if (this.activePlantilla) this.updateEscritoPreview(); });
                    input.addEventListener('change', () => { if (this.activePlantilla) this.updateEscritoPreview(); });
                }
            });

            if (this.btnCopiarTextoEscrito) {
                this.btnCopiarTextoEscrito.addEventListener('click', () => this.copiarTextoEscrito());
            }
            if (this.btnImprimirEscrito) {
                this.btnImprimirEscrito.addEventListener('click', () => this.imprimirEscritoOficial());
            }
            if (this.btnDescargarPdfEscrito) {
                this.btnDescargarPdfEscrito.addEventListener('click', () => this.descargarPdfEscrito());
            }
            if (this.btnMarcarPendienteEscrito) {
                this.btnMarcarPendienteEscrito.addEventListener('click', () => this.guardarComoTareaPendienteEscrito());
            }
        }

        async loadPlantillasEscritos() {
            try {
                const res = await fetch(getApiUrl('/api/plantillas-escritos'));
                if (res.ok) {
                    const json = await res.json();
                    if (json.success && Array.isArray(json.data)) {
                        this.plantillasEscritos = json.data.map(d => new PlantillaEscrito(d));
                        this.populatePlantillasSelect();
                    }
                }
            } catch (e) {
                console.warn('Error cargando plantillas de escritos:', e.message);
            }
        }

        populatePlantillasSelect() {
            if (!this.selectPlantillaEscrito) return;
            const currentVal = this.selectPlantillaEscrito.value;
            let html = '<option value="">-- No confeccionar escrito en este momento --</option>';

            const categories = {};
            this.plantillasEscritos.forEach(p => {
                const cat = p.categoria || 'GENERAL';
                if (!categories[cat]) categories[cat] = [];
                categories[cat].push(p);
            });

            Object.keys(categories).forEach(cat => {
                html += '<optgroup label="Área: ' + cat + '">';
                categories[cat].forEach(p => {
                    html += '<option value="' + p.codigo + '">' + p.titulo + '</option>';
                });
                html += '</optgroup>';
            });

            this.selectPlantillaEscrito.innerHTML = html;
            if (currentVal) this.selectPlantillaEscrito.value = currentVal;
        }

        onPlantillaSelectChange() {
            const codigo = this.selectPlantillaEscrito.value;
            if (!codigo) {
                this.activePlantilla = null;
                this.escritoDynamicValues = {};
                if (this.escritoCamposDinamicosWrapper) this.escritoCamposDinamicosWrapper.style.display = 'none';
                if (this.escritoPreviewSection) this.escritoPreviewSection.style.display = 'none';
                if (this.escritoStatusBadge) {
                    this.escritoStatusBadge.className = 'badge';
                    this.escritoStatusBadge.style.background = 'rgba(148, 163, 184, 0.15)';
                    this.escritoStatusBadge.style.color = '#94A3B8';
                    this.escritoStatusBadge.textContent = 'Sin plantilla';
                }
                return;
            }

            const plantilla = this.plantillasEscritos.find(p => p.codigo === codigo);
            if (!plantilla) return;

            this.activePlantilla = plantilla;
            if (this.escritoStatusBadge) {
                this.escritoStatusBadge.className = 'badge badge-familia';
                this.escritoStatusBadge.textContent = 'Plantilla: ' + plantilla.categoria;
            }

            this.buildDynamicFields(plantilla.camposDinamicos);
            if (this.escritoPreviewSection) this.escritoPreviewSection.style.display = 'block';
            this.updateEscritoPreview();
        }

        buildDynamicFields(campos) {
            if (!this.escritoCamposDinamicosContainer || !this.escritoCamposDinamicosWrapper) return;
            if (!Array.isArray(campos) || campos.length === 0) {
                this.escritoCamposDinamicosWrapper.style.display = 'none';
                this.escritoCamposDinamicosContainer.innerHTML = '';
                return;
            }

            this.escritoCamposDinamicosWrapper.style.display = 'block';
            let html = '';
            campos.forEach(c => {
                const isFullWidth = c.type === 'textarea' || c.fullWidth;
                const defaultVal = this.escritoDynamicValues[c.key] !== undefined ? this.escritoDynamicValues[c.key] : (c.default || '');
                this.escritoDynamicValues[c.key] = defaultVal;

                html += '<div class="form-group ' + (isFullWidth ? 'full-width' : '') + '">' +
                    '<label style="color: #38BDF8; font-size: 0.82rem;">' + c.label + (c.required ? ' <span style="color: #F87171;">*</span>' : '') + '</label>';

                if (c.type === 'textarea') {
                    html += '<textarea class="form-control dynamic-escrito-field" data-key="' + c.key + '" rows="2" placeholder="' + (c.placeholder || '') + '" style="font-size: 0.88rem;">' + defaultVal + '</textarea>';
                } else if (c.type === 'select' && Array.isArray(c.options)) {
                    html += '<select class="form-control dynamic-escrito-field" data-key="' + c.key + '" style="font-size: 0.88rem;">';
                    c.options.forEach(opt => {
                        const isSel = (opt === defaultVal || (!defaultVal && opt === c.default)) ? ' selected' : '';
                        html += '<option value="' + opt + '"' + isSel + '>' + opt + '</option>';
                    });
                    html += '</select>';
                } else {
                    html += '<input type="text" class="form-control dynamic-escrito-field" data-key="' + c.key + '" value="' + defaultVal + '" placeholder="' + (c.placeholder || '') + '" style="font-size: 0.88rem;">';
                }

                html += '</div>';
            });

            this.escritoCamposDinamicosContainer.innerHTML = html;

            this.escritoCamposDinamicosContainer.querySelectorAll('.dynamic-escrito-field').forEach(input => {
                const handler = (e) => {
                    const key = e.target.getAttribute('data-key');
                    this.escritoDynamicValues[key] = e.target.value;
                    this.updateEscritoPreview();
                };
                input.addEventListener('input', handler);
                input.addEventListener('change', handler);
            });
        }

        updateEscritoPreview() {
            if (!this.activePlantilla) return;

            const dniVal = this.newDniInput ? this.newDniInput.value : '';
            const apellidosVal = this.newApellidosInput ? this.newApellidosInput.value : '';
            const nombresVal = this.newNombresInput ? this.newNombresInput.value : '';
            const celularVal = this.newCelularInput ? this.newCelularInput.value : '';
            const expteVal = this.newExpteInput ? this.newExpteInput.value : '';
            const defensoriaVal = this.newDefensoriaSelect ? this.newDefensoriaSelect.value : '';
            const atendidoPorVal = this.newAtendidoPorInput ? this.newAtendidoPorInput.value : '';
            const elFecha = document.getElementById('newFecha');
            const fechaVal = elFecha ? elFecha.value : '';

            const renderData = Object.assign({
                dni: dniVal,
                apellidos: apellidosVal,
                nombres: nombresVal,
                celular: celularVal,
                expte: expteVal,
                defensoria: defensoriaVal,
                atendidoPor: atendidoPorVal,
                fecha: fechaVal
            }, this.escritoDynamicValues);

            const renderedText = DocumentRenderService.renderTemplate(this.activePlantilla.cuerpoTemplate, renderData);

            if (this.escritoTextoEditor) {
                this.escritoTextoEditor.value = renderedText;
            }

            if (this.previewHeaderExpte) {
                this.previewHeaderExpte.innerHTML = '<strong>Expte:</strong> ' + (expteVal || 'S/N°');
            }
            if (this.previewHeaderDefensoria) {
                this.previewHeaderDefensoria.innerHTML = '<strong>Defensoría:</strong> ' + (defensoriaVal || 'Oficial');
            }
            if (this.previewSumarioBadge) {
                const customSumario = this.escritoDynamicValues.SUMARIO_PERSONALIZADO || this.activePlantilla.sumario || 'PRESENTA ESCRITO JUDICIAL';
                this.previewSumarioBadge.textContent = 'SUMARIO: ' + customSumario;
            }
        }

        copiarTextoEscrito() {
            if (!this.escritoTextoEditor || !this.escritoTextoEditor.value.trim()) {
                showToast('No hay texto para copiar.', 'error');
                return;
            }
            const textToCopy = this.escritoTextoEditor.value;
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(textToCopy).then(() => {
                    showToast('¡Texto del escrito copiado al portapapeles!', 'success');
                }).catch(() => {
                    this._fallbackCopyText(textToCopy);
                });
            } else {
                this._fallbackCopyText(textToCopy);
            }
        }

        _fallbackCopyText(text) {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                showToast('¡Texto del escrito copiado al portapapeles!', 'success');
            } catch (err) {
                showToast('No se pudo copiar el texto automáticamente.', 'error');
            }
            textArea.remove();
        }

        _printHtmlViaIframe(html) {
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            iframe.style.zIndex = '-9999';
            document.body.appendChild(iframe);

            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write('<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Imprimir Escrito - MPD Mendoza</title>' +
                '<style>' +
                    '@page { size: A4 portrait; margin: 12mm 15mm; }' +
                    '* { box-sizing: border-box; }' +
                    'body { margin: 0; padding: 0; background: #FFF !important; color: #000 !important; font-family: Times, "Times New Roman", serif; }' +
                    '.escrito-print-document { width: 100% !important; max-width: 100% !important; margin: 0 auto !important; padding: 0 !important; }' +
                '</style></head><body>' +
                html +
                '</body></html>');
            doc.close();

            iframe.contentWindow.focus();
            setTimeout(() => {
                try {
                    iframe.contentWindow.print();
                } catch(err) {
                    console.error('Error al imprimir iframe:', err);
                }
                setTimeout(() => {
                    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
                }, 3000);
            }, 350);
        }

        imprimirEscritoOficial() {
            if (!this.escritoTextoEditor || !this.escritoTextoEditor.value.trim()) {
                showToast('No hay texto para imprimir.', 'error');
                return;
            }

            const html = DocumentRenderService.generatePrintableHtml({
                titulo: this.activePlantilla ? this.activePlantilla.titulo : 'ESCRITO JUDICIAL',
                sumario: (this.escritoDynamicValues && this.escritoDynamicValues.SUMARIO_PERSONALIZADO) || (this.activePlantilla ? this.activePlantilla.sumario : 'PRESENTA ESCRITO JUDICIAL'),
                cuerpoTexto: this.escritoTextoEditor.value,
                ciudadanoNombre: ((this.newApellidosInput ? this.newApellidosInput.value : '') + ' ' + (this.newNombresInput ? this.newNombresInput.value : '')).trim() || 'COMPARECIENTE',
                dni: this.newDniInput ? this.newDniInput.value : '',
                expte: this.newExpteInput ? this.newExpteInput.value : '',
                defensoria: this.newDefensoriaSelect ? this.newDefensoriaSelect.value : '',
                operador: this.newAtendidoPorInput ? this.newAtendidoPorInput.value : '',
                fecha: (document.getElementById('newFecha') ? document.getElementById('newFecha').value : ''),
                firmanteTipo: (this.escritoDynamicValues && this.escritoDynamicValues.FIRMANTE_DEFENSA) || 'titular'
            });

            this._printHtmlViaIframe(html);
        }

        descargarPdfEscrito() {
            if (!this.escritoTextoEditor || !this.escritoTextoEditor.value.trim()) {
                showToast('No hay texto para descargar.', 'error');
                return;
            }

            showToast('Generando archivo PDF...', 'info');

            const ape = ((this.newApellidosInput ? this.newApellidosInput.value : '') || 'Ciudadano').trim().replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]/g, '_');
            const cod = (this.activePlantilla ? this.activePlantilla.codigo : 'escrito').replace(/[^a-zA-Z0-9_-]/g, '');
            const filename = 'Escrito_' + cod + '_' + ape + '.pdf';

            const html = DocumentRenderService.generatePrintableHtml({
                titulo: this.activePlantilla ? this.activePlantilla.titulo : 'ESCRITO JUDICIAL',
                sumario: (this.escritoDynamicValues && this.escritoDynamicValues.SUMARIO_PERSONALIZADO) || (this.activePlantilla ? this.activePlantilla.sumario : 'PRESENTA ESCRITO JUDICIAL'),
                cuerpoTexto: this.escritoTextoEditor.value,
                ciudadanoNombre: ((this.newApellidosInput ? this.newApellidosInput.value : '') + ' ' + (this.newNombresInput ? this.newNombresInput.value : '')).trim() || 'COMPARECIENTE',
                dni: this.newDniInput ? this.newDniInput.value : '',
                expte: this.newExpteInput ? this.newExpteInput.value : '',
                defensoria: this.newDefensoriaSelect ? this.newDefensoriaSelect.value : '',
                operador: this.newAtendidoPorInput ? this.newAtendidoPorInput.value : '',
                fecha: (document.getElementById('newFecha') ? document.getElementById('newFecha').value : ''),
                firmanteTipo: (this.escritoDynamicValues && this.escritoDynamicValues.FIRMANTE_DEFENSA) || 'titular'
            });

            const container = document.createElement('div');
            container.innerHTML = html;
            container.style.position = 'absolute';
            container.style.left = '-9999px';
            container.style.top = '0';
            container.style.width = '210mm';
            container.style.background = '#ffffff';
            container.style.color = '#000000';
            document.body.appendChild(container);

            if (typeof window.html2pdf === 'function') {
                const opt = {
                    margin: [10, 12, 12, 12],
                    filename: filename,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, logging: false },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                };

                window.html2pdf().set(opt).from(container).save().then(() => {
                    if (container.parentNode) container.parentNode.removeChild(container);
                    showToast('¡Archivo PDF descargado exitosamente!', 'success');
                }).catch(err => {
                    console.error('Error al generar PDF:', err);
                    if (container.parentNode) container.parentNode.removeChild(container);
                    this._printHtmlViaIframe(html);
                });
            } else {
                if (container.parentNode) container.parentNode.removeChild(container);
                this._printHtmlViaIframe(html);
            }
        }

        guardarComoTareaPendienteEscrito() {
            if (!this.newTareaPendiente) return;
            this.newTareaPendiente.checked = true;
            const plantillaTitulo = this.activePlantilla ? this.activePlantilla.titulo : 'Confección de Escrito';
            if (this.newDetallePendiente && !this.newDetallePendiente.value.trim()) {
                this.newDetallePendiente.value = 'Confección de Escrito: ' + plantillaTitulo;
            }
            showToast('Tarea pendiente marcada. El borrador del escrito se guardará con la atención.', 'info');
        }

        async loadAdminPlantillas() {
            if (!this.adminPlantillasTableBody) return;
            try {
                const res = await fetch(getApiUrl('/api/admin/plantillas-escritos'));
                if (res.ok) {
                    const json = await res.json();
                    if (json.success && Array.isArray(json.data)) {
                        this.renderAdminPlantillasTable(json.data);
                    }
                }
            } catch (e) {
                console.warn('Error cargando plantillas admin:', e.message);
            }
        }

        renderAdminPlantillasTable(items) {
            if (!this.adminPlantillasTableBody) return;
            if (!items || items.length === 0) {
                this.adminPlantillasTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #94A3B8;">No hay plantillas registradas.</td></tr>';
                return;
            }

            let html = '';
            items.forEach(p => {
                const isActivo = Boolean(Number(p.activo));
                const badgeStatus = isActivo ? '<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34D399; border: 1px solid #10B981;">Activa</span>' : '<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #F87171; border: 1px solid #EF4444;">Inactiva</span>';
                const toggleBtnText = isActivo ? '<i class="ri-eye-off-line"></i> Desactivar' : '<i class="ri-eye-line"></i> Activar';
                const toggleBtnColor = isActivo ? 'background: rgba(239, 68, 68, 0.15); color: #F87171; border-color: #EF4444;' : 'background: rgba(16, 185, 129, 0.15); color: #34D399; border-color: #10B981;';

                html += '<tr>' +
                    '<td><code style="color: var(--mpd-cyan); font-weight: 700;">' + p.codigo + '</code></td>' +
                    '<td style="font-weight: 600;">' + p.titulo + '</td>' +
                    '<td><span class="badge badge-otro">' + (p.categoria || 'PENAL') + '</span></td>' +
                    '<td style="font-size: 0.8rem; color: #CBD5E1;">' + (p.sumario || '-') + '</td>' +
                    '<td>' + badgeStatus + '</td>' +
                    '<td>' +
                        '<div style="display: flex; gap: 0.4rem;">' +
                            '<button class="btn btn-sm btn-admin-edit-plantilla" data-id="' + p.id + '" style="background: rgba(56, 189, 248, 0.15); color: #38BDF8; border-color: #38BDF8; font-size: 0.78rem; padding: 0.25rem 0.6rem;">' +
                                '<i class="ri-edit-line"></i> Editar' +
                            '</button>' +
                            '<button class="btn btn-sm btn-admin-toggle-plantilla" data-id="' + p.id + '" style="' + toggleBtnColor + ' font-size: 0.78rem; padding: 0.25rem 0.6rem;">' +
                                toggleBtnText +
                            '</button>' +
                        '</div>' +
                    '</td>' +
                '</tr>';
            });

            this.adminPlantillasTableBody.innerHTML = html;

            this.adminPlantillasTableBody.querySelectorAll('.btn-admin-edit-plantilla').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = Number(e.currentTarget.getAttribute('data-id'));
                    const item = items.find(p => p.id === id);
                    if (item) this.openAdminEditPlantilla(item);
                });
            });

            this.adminPlantillasTableBody.querySelectorAll('.btn-admin-toggle-plantilla').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = Number(e.currentTarget.getAttribute('data-id'));
                    await this.toggleAdminPlantillaStatus(id);
                });
            });
        }

        openAdminEditPlantilla(p) {
            if (!this.adminPlantillaForm) return;
            document.getElementById('adminPlantillaId').value = p.id;
            document.getElementById('adminPlantillaCodigo').value = p.codigo;
            document.getElementById('adminPlantillaCodigo').readOnly = true;
            document.getElementById('adminPlantillaTitulo').value = p.titulo;
            document.getElementById('adminPlantillaCategoria').value = p.categoria || 'PENAL';
            document.getElementById('adminPlantillaSumario').value = p.sumario || '';
            document.getElementById('adminPlantillaDestinatario').value = p.destinatario_default || 'SEÑOR/A DEFENSOR/A OFICIAL';
            document.getElementById('adminPlantillaCuerpo').value = p.cuerpo_template || '';
            document.getElementById('adminPlantillaCampos').value = typeof p.campos_dinamicos === 'string' ? p.campos_dinamicos : JSON.stringify(p.campos_dinamicos || []);

            this.adminPlantillaForm.style.display = 'grid';
            this.adminPlantillaForm.scrollIntoView({ behavior: 'smooth' });
        }

        async toggleAdminPlantillaStatus(id) {
            try {
                const res = await fetch(getApiUrl('/api/admin/plantillas-escritos/' + id), { method: 'DELETE' });
                if (res.ok) {
                    showToast('Estado de plantilla actualizado.', 'success');
                    await this.loadAdminPlantillas();
                    await this.loadPlantillasEscritos();
                }
            } catch (e) {
                showToast('Error al actualizar estado de plantilla.', 'error');
            }
        }

        setupAdminPlantillaEvents() {
            if (this.btnAdminNuevaPlantilla) {
                this.btnAdminNuevaPlantilla.addEventListener('click', () => {
                    if (!this.adminPlantillaForm) return;
                    this.adminPlantillaForm.reset();
                    document.getElementById('adminPlantillaId').value = '';
                    document.getElementById('adminPlantillaCodigo').readOnly = false;
                    document.getElementById('adminPlantillaCampos').value = '[]';
                    this.adminPlantillaForm.style.display = 'grid';
                });
            }

            if (this.btnCancelEditPlantilla) {
                this.btnCancelEditPlantilla.addEventListener('click', () => {
                    if (this.adminPlantillaForm) {
                        this.adminPlantillaForm.reset();
                        this.adminPlantillaForm.style.display = 'none';
                    }
                });
            }

            if (this.adminPlantillaForm) {
                this.adminPlantillaForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const id = document.getElementById('adminPlantillaId').value;
                    const codigo = document.getElementById('adminPlantillaCodigo').value.trim();
                    const titulo = document.getElementById('adminPlantillaTitulo').value.trim();
                    const categoria = document.getElementById('adminPlantillaCategoria').value;
                    const sumario = document.getElementById('adminPlantillaSumario').value.trim();
                    const destinatarioDefault = document.getElementById('adminPlantillaDestinatario').value.trim();
                    const cuerpoTemplate = document.getElementById('adminPlantillaCuerpo').value;
                    const camposRaw = document.getElementById('adminPlantillaCampos').value.trim();

                    let camposDinamicos = [];
                    if (camposRaw) {
                        try {
                            camposDinamicos = JSON.parse(camposRaw);
                        } catch (err) {
                            showToast('El formato de Campos Dinámicos debe ser un JSON válido.', 'error');
                            return;
                        }
                    }

                    const payload = {
                        codigo,
                        titulo,
                        categoria,
                        sumario,
                        destinatarioDefault,
                        cuerpoTemplate,
                        camposDinamicos,
                        adminOperatorName: this.currentUser ? this.currentUser.nombreCompleto : 'ADMIN'
                    };

                    try {
                        const url = id ? getApiUrl('/api/admin/plantillas-escritos/' + id) : getApiUrl('/api/admin/plantillas-escritos');
                        const method = id ? 'PUT' : 'POST';

                        const res = await fetch(url, {
                            method: method,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });

                        if (res.ok) {
                            showToast(id ? '¡Plantilla actualizada correctamente!' : '¡Nueva plantilla creada con éxito!', 'success');
                            this.adminPlantillaForm.reset();
                            this.adminPlantillaForm.style.display = 'none';
                            await this.loadAdminPlantillas();
                            await this.loadPlantillasEscritos();
                        } else {
                            const err = await res.json();
                            showToast('Error: ' + (err.error || 'No se pudo guardar la plantilla'), 'error');
                        }
                    } catch (err) {
                        showToast('Error de conexión al guardar plantilla.', 'error');
                    }
                });
            }
        }

        async loadAdminUsersTable() {
            try {
                const res = await fetch(getApiUrl('/api/admin/usuarios'));
                if (res.ok) {
                    const data = await res.json();
                    if (data.success && Array.isArray(data.data)) {
                        let html = '';
                        data.data.forEach(u => {
                            const isSelf = u.username === 'spereyra';
                            const statusBadge = u.activo ? '<span class="badge badge-civil">Activo</span>' : '<span class="badge badge-penal">Inactivo</span>';
                            const actionBtns = isSelf ? '<span style="font-size:0.75rem; color:#C9B07A;">Admin Principal</span>' : 
                                '<div style="display:flex; gap:0.35rem;">' +
                                    '<button class="btn btn-secondary btn-edit-user" data-id="' + u.id + '" data-username="' + u.username + '" data-nombre="' + u.nombre_completo + '" data-rol="' + u.rol + '" style="padding: 0.2rem 0.5rem; font-size:0.75rem; color:#38BDF8;">' +
                                        '<i class="ri-edit-line"></i> Editar' +
                                    '</button>' +
                                    '<button class="btn btn-secondary btn-toggle-user" data-id="' + u.id + '" data-username="' + u.username + '" style="padding: 0.2rem 0.5rem; font-size:0.75rem; color:' + (u.activo ? '#F87171' : '#4ADE80') + ';">' +
                                        (u.activo ? 'Desactivar' : 'Reactivar') +
                                    '</button>' +
                                '</div>';

                            html += '<tr>' +
                                '<td><strong>' + u.username + '</strong></td>' +
                                '<td>' + u.nombre_completo + '</td>' +
                                '<td><span class="badge ' + (u.rol === 'ADMINISTRADOR' ? 'badge-familia' : 'badge-otro') + '">' + u.rol + '</span></td>' +
                                '<td>' + statusBadge + '</td>' +
                                '<td>' + actionBtns + '</td>' +
                            '</tr>';
                        });
                        this.adminUsersTableBody.innerHTML = html;

                        this.adminUsersTableBody.querySelectorAll('.btn-edit-user').forEach(btn => {
                            btn.addEventListener('click', () => {
                                const id = btn.getAttribute('data-id');
                                const username = btn.getAttribute('data-username');
                                const nombre = btn.getAttribute('data-nombre');
                                const rol = btn.getAttribute('data-rol');
                                
                                document.getElementById('adminUserId').value = id;
                                document.getElementById('adminUsername').value = username;
                                document.getElementById('adminUsername').readOnly = true;
                                document.getElementById('adminNombreCompleto').value = nombre;
                                document.getElementById('adminRol').value = rol;
                                document.getElementById('adminPassword').value = '';
                                
                                const modeBadge = document.getElementById('adminUserFormMode');
                                if (modeBadge) {
                                    modeBadge.textContent = 'Edición de Usuario: ' + username;
                                    modeBadge.className = 'badge badge-gold';
                                }
                                const btnCancel = document.getElementById('btnCancelEditUser');
                                if (btnCancel) btnCancel.style.display = 'inline-flex';
                            });
                        });

                        this.adminUsersTableBody.querySelectorAll('.btn-toggle-user').forEach(btn => {
                            btn.addEventListener('click', async () => {
                                const username = btn.getAttribute('data-username');
                                const id = btn.getAttribute('data-id');
                                await this.toggleUserActive(id, username);
                                await this.loadAdminUsersTable();
                            });
                        });
                    }
                }
            } catch(e) {}
        }

        async toggleUserActive(id, username) {
            try {
                const res = await fetch(getApiUrl('/api/admin/usuarios/baja'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, username, toggleStatus: true, adminOperatorName: this.currentUser ? this.currentUser.nombreCompleto : 'ADMIN' })
                });
                const data = await res.json();
                if (data.success) {
                    showToast(data.message, 'success');
                    await this.loadPublicUsersForLogin();
                } else {
                    showToast(data.error || 'Error al cambiar estado', 'error');
                }
            } catch(e) {
                showToast('Error de red al cambiar estado de usuario', 'error');
            }
        }

        resetAdminUserForm() {
            if (this.adminUserForm) this.adminUserForm.reset();
            const idInput = document.getElementById('adminUserId');
            if (idInput) idInput.value = '';
            const userInput = document.getElementById('adminUsername');
            if (userInput) userInput.readOnly = false;
            const modeBadge = document.getElementById('adminUserFormMode');
            if (modeBadge) {
                modeBadge.textContent = 'Alta de Usuario';
                modeBadge.className = 'badge badge-familia';
            }
            const btnCancel = document.getElementById('btnCancelEditUser');
            if (btnCancel) btnCancel.style.display = 'none';
        }

        async loadAdminCatalogView() {
            try {
                const res = await fetch(getApiUrl('/api/admin/catalogos'));
                if (!res.ok) return;
                const json = await res.json();
                if (!json.success || !Array.isArray(json.data)) return;

                const optionsListContainer = document.getElementById('catalogOptionsListContainer');
                if (!optionsListContainer) return;

                const catOptions = json.data.filter(item => item.categoria === this.activeCatalogCategory);

                if (catOptions.length === 0) {
                    optionsListContainer.innerHTML = '<div style="color:#94A3B8; font-size:0.85rem;">No hay opciones registradas en esta categoría.</div>';
                    return;
                }

                let html = '';
                catOptions.forEach(opt => {
                    const statusBadge = opt.activo ? '<span class="badge badge-civil" style="font-size:0.7rem;">Activo</span>' : '<span class="badge badge-penal" style="font-size:0.7rem;">Inactivo</span>';
                    html += '<div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.08); padding: 0.75rem; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">' +
                        '<div>' +
                            '<strong style="color: #FFF; font-size: 0.9rem; display: block;">' + opt.valor + '</strong>' +
                            '<span style="font-size: 0.75rem; color: #94A3B8;">ID: ' + opt.id + ' • ' + statusBadge + '</span>' +
                        '</div>' +
                        '<button class="btn btn-secondary btn-delete-catalog-opt" data-id="' + opt.id + '" data-val="' + opt.valor + '" style="padding: 0.3rem 0.5rem; color: #F87171;" title="Desactivar / Eliminar esta opción">' +
                            '<i class="ri-delete-bin-line"></i>' +
                        '</button>' +
                    '</div>';
                });
                optionsListContainer.innerHTML = html;

                optionsListContainer.querySelectorAll('.btn-delete-catalog-opt').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const id = btn.getAttribute('data-id');
                        const val = btn.getAttribute('data-val');
                        showConfirm('Desactivar Opción', '¿Seguro que deseas desactivar la opción "' + val + '" del formulario?', async () => {
                            await this.deleteCatalogOption(id);
                            await this.loadAdminCatalogView();
                            await this.loadCatalogOptions();
                        });
                    });
                });
            } catch(e) {
                console.warn('Error cargando catálogo admin:', e);
            }
        }

        async addCatalogOption(val) {
            if (!val || !val.trim()) return;
            try {
                const res = await fetch(getApiUrl('/api/admin/catalogos'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        categoria: this.activeCatalogCategory,
                        valor: val.trim(),
                        adminOperatorName: this.currentUser ? this.currentUser.nombreCompleto : 'ADMIN'
                    })
                });
                const data = await res.json();
                if (data.success) {
                    showToast('Opción "' + val + '" agregada correctamente', 'success');
                    const input = document.getElementById('newCatalogOptionInput');
                    if (input) input.value = '';
                    await this.loadAdminCatalogView();
                    await this.loadCatalogOptions();
                } else {
                    showToast(data.error || 'Error al agregar opción', 'error');
                }
            } catch(e) {
                showToast('Error de red al agregar opción al catálogo', 'error');
            }
        }

        async deleteCatalogOption(id) {
            try {
                const operatorName = this.currentUser ? this.currentUser.nombreCompleto : 'ADMIN';
                const res = await fetch(getApiUrl('/api/admin/catalogos?id=' + id + '&operatorName=' + encodeURIComponent(operatorName)), {
                    method: 'DELETE'
                });
                const data = await res.json();
                if (data.success) {
                    showToast('Opción desactivada correctamente.', 'info');
                } else {
                    showToast(data.error || 'Error al desactivar opción', 'error');
                }
            } catch(e) {
                showToast('Error de red al eliminar opción', 'error');
            }
        }

        async loadAdminAuditTable() {
            try {
                const res = await fetch(getApiUrl('/api/admin/auditoria'));
                if (res.ok) {
                    const data = await res.json();
                    if (data.success && Array.isArray(data.data)) {
                        let html = '';
                        data.data.forEach(a => {
                            html += '<tr>' +
                                '<td><span style="font-family: var(--font-mono); font-size: 0.78rem;">' + a.timestamp + '</span></td>' +
                                '<td><strong>' + a.usuario_nombre + '</strong></td>' +
                                '<td><span class="badge badge-familia">' + a.accion + '</span></td>' +
                                '<td>' + a.detalle + '</td>' +
                            '</tr>';
                        });
                        this.adminAuditTableBody.innerHTML = html;
                    }
                }
            } catch(e) {}
        }

        async handleAdminUserSubmit(e) {
            e.preventDefault();
            const userId = document.getElementById('adminUserId').value;
            const username = document.getElementById('adminUsername').value;
            const nombreCompleto = document.getElementById('adminNombreCompleto').value;
            const rol = document.getElementById('adminRol').value;
            const password = document.getElementById('adminPassword').value;

            try {
                const res = await fetch(getApiUrl('/api/admin/usuarios'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: userId,
                        username,
                        nombreCompleto,
                        rol,
                        password,
                        adminOperatorName: this.currentUser ? this.currentUser.nombreCompleto : 'ADMIN'
                    })
                });

                if (res.ok) {
                    showToast('Usuario ' + username + ' guardado correctamente.', 'success');
                    this.resetAdminUserForm();
                    await this.loadAdminUsersTable();
                    await this.loadPublicUsersForLogin();
                } else {
                    const errJson = await res.json();
                    showToast(errJson.error || 'Error al guardar usuario', 'error');
                }
            } catch(err) {
                showToast('Error de red al guardar usuario', 'error');
            }
        }

        async loadCodefensorasRoster() {
            try {
                const res = await fetch(getApiUrl('/api/familia/codefensoras'));
                if (res.ok) {
                    const data = await res.json();
                    if (data.success && Array.isArray(data.data)) {
                        this.codefensorasRoster = data.data.map(item => ({
                            id: item.id,
                            nombre: item.nombre,
                            isPresente: Boolean(item.is_presente),
                            motivoAusencia: item.motivo_ausencia || ''
                        }));
                    }
                }
            } catch(e) {}
            this.renderPresenceRoster();
            await this.calculateProximoTurno();
        }

        renderPresenceRoster() {
            const track = this.presenceMarqueeTrack || document.getElementById('presenceMarqueeTrack');
            const gridContainer = this.presenceGridContainer || document.getElementById('presenceGridContainer');
            if (!track && !gridContainer && !this.presenceRosterContainer) return;

            const turnos = this.currentTurnos || {};

            const generatePillHtml = (c) => {
                const isPresent = !!c.isPresente;
                let dutyClass = '';
                const roles = [];

                if (turnos['Ases. General'] === c.nombre || turnos['Asesoramiento General'] === c.nombre) {
                    roles.push({ cls: 'duty-asesoria', label: 'Ases. Gen.' });
                }
                if (turnos['Causa Nueva'] === c.nombre) {
                    roles.push({ cls: 'duty-causa', label: 'Causa Nva.' });
                }
                if (turnos['Contestación'] === c.nombre) {
                    roles.push({ cls: 'duty-contestacion', label: 'Contestación' });
                }
                if (turnos['Adopción / Guarda'] === c.nombre || turnos['Adopción'] === c.nombre) {
                    roles.push({ cls: 'duty-adopcion', label: 'Adopción' });
                }

                if (roles.length > 0) {
                    dutyClass = roles[0].cls;
                }
                const dutyLabel = roles.map(r => r.label).join(' | ');

                const statusStr = isPresent ? 'Presente' : 'Ausente';
                const titleText = 'Dra. ' + c.nombre + ' (' + statusStr + ') - Clic para cambiar presencia';

                let chipHtml = '';
                if (dutyLabel) {
                    chipHtml = '<span class="duty-chip">' + dutyLabel + '</span>';
                }

                const dotClass = isPresent ? 'is-present' : '';

                return '<div class="presence-pill-unified ' + dutyClass + '" data-name="' + c.nombre + '" title="' + titleText + '">' +
                    '<span class="presence-dot ' + dotClass + '"></span>' +
                    '<span class="presence-name">Dra. ' + c.nombre + '</span>' +
                    chipHtml +
                '</div>';
            };

            const singleRosterHtml = this.codefensorasRoster.map(c => generatePillHtml(c)).join('');

            const attachClickHandlers = (container) => {
                if (!container) return;
                container.querySelectorAll('.presence-pill-unified').forEach(pill => {
                    pill.addEventListener('click', async () => {
                        const nombre = pill.getAttribute('data-name');
                        const c = this.codefensorasRoster.find(item => item.nombre === nombre);
                        if (c) {
                            c.isPresente = !c.isPresente;
                            await this.updateCodefensoraPresenceServer(c);
                            this.renderPresenceRoster();
                            await this.calculateProximoTurno();
                        }
                    });
                });
            };

            const generateMasonryCardHtml = (c) => {
                const isPresent = !!c.isPresente;
                const turnos = this.currentTurnos || {};
                const roles = [];

                if (turnos['Ases. General'] === c.nombre || turnos['Asesoramiento General'] === c.nombre) {
                    roles.push({ cls: 'duty-asesoria', label: 'Asesoría General', icon: 'ri-file-user-line' });
                }
                if (turnos['Causa Nueva'] === c.nombre) {
                    roles.push({ cls: 'duty-causa', label: 'Causa Nueva', icon: 'ri-folder-add-line' });
                }
                if (turnos['Contestación'] === c.nombre) {
                    roles.push({ cls: 'duty-contestacion', label: 'Contestación de Demanda', icon: 'ri-edit-2-line' });
                }
                if (turnos['Adopción / Guarda'] === c.nombre || turnos['Adopción'] === c.nombre) {
                    roles.push({ cls: 'duty-adopcion', label: 'Adopción / Guarda', icon: 'ri-heart-add-line' });
                }

                let dutyBlocksHtml = '';
                if (roles.length > 0) {
                    dutyBlocksHtml = '<div class="card-duty-list">' +
                        roles.map(r => '<div class="duty-chip-block ' + r.cls + '"><i class="' + r.icon + '"></i><span>' + r.label + '</span></div>').join('') +
                    '</div>';
                } else {
                    dutyBlocksHtml = '<div style="font-size: 0.72rem; color: #64748B; padding-top: 0.4rem; font-style: italic;">Sin turno asignado hoy</div>';
                }

                const cardStateClass = isPresent ? 'is-present' : 'is-absent';
                const statusBadgeClass = isPresent ? 'present' : 'absent';
                const statusText = isPresent ? '<i class="ri-checkbox-circle-fill"></i> Presente' : '<i class="ri-close-circle-line"></i> Ausente';

                return '<div class="presence-card-masonry ' + cardStateClass + '" data-name="' + c.nombre + '">' +
                    '<div class="card-header-main">' +
                        '<div class="card-user-info">' +
                            '<div class="card-avatar"><i class="ri-user-star-line"></i></div>' +
                            '<span class="card-name">Dra. ' + c.nombre + '</span>' +
                        '</div>' +
                        '<span class="card-status-badge ' + statusBadgeClass + '">' + statusText + '</span>' +
                    '</div>' +
                    dutyBlocksHtml +
                '</div>';
            };

            if (track) {
                track.innerHTML = singleRosterHtml + singleRosterHtml;
                attachClickHandlers(track);
            }

            if (gridContainer) {
                gridContainer.innerHTML = this.codefensorasRoster.map(c => generateMasonryCardHtml(c)).join('');
                gridContainer.querySelectorAll('.presence-card-masonry').forEach(card => {
                    card.addEventListener('click', async () => {
                        const nombre = card.getAttribute('data-name');
                        const c = this.codefensorasRoster.find(item => item.nombre === nombre);
                        if (c) {
                            c.isPresente = !c.isPresente;
                            await this.updateCodefensoraPresenceServer(c);
                            this.renderPresenceRoster();
                            await this.calculateProximoTurno();
                        }
                    });
                });
            }

            if (this.presenceRosterContainer) {
                this.presenceRosterContainer.innerHTML = singleRosterHtml;
                attachClickHandlers(this.presenceRosterContainer);
            }

            this.renderDndList();
            this.renderKanbanCategoryAssignment();
        }

        async reorderDefensoras(fromIdx, toIdx) {
            if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= this.codefensorasRoster.length || toIdx >= this.codefensorasRoster.length) return;

            const rosterCopy = [...this.codefensorasRoster];
            const [moved] = rosterCopy.splice(fromIdx, 1);
            rosterCopy.splice(toIdx, 0, moved);

            this.codefensorasRoster = rosterCopy;

            const liveRegion = this.dndLiveRegion || document.getElementById('dndLiveRegion');
            if (liveRegion) {
                liveRegion.textContent = 'Dra. ' + moved.nombre + ' reordenada a la posición ' + (toIdx + 1) + ' de ' + rosterCopy.length + '.';
            }

            const nombresOrdenados = rosterCopy.map(r => r.nombre);
            try {
                await fetch(getApiUrl('/api/familia/codefensoras/reordenar'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ordenNombres: nombresOrdenados, operatorName: this.currentUser ? this.currentUser.nombreCompleto : 'OPERADOR' })
                });
            } catch(err) {}

            this.renderPresenceRoster();
            await this.calculateProximoTurno();
        }

        renderKanbanCategoryAssignment() {
            const container = document.getElementById('kanbanCategoryContainer');
            if (!container) return;

            const turnos = this.currentTurnos || {};

            const CANALES_ROLES = [
                { key: 'ASESORAMIENTO_GENERAL', label: 'Asesoramiento General', cls: 'duty-asesoria', icon: 'ri-file-user-line' },
                { key: 'CAUSA_NUEVA', label: 'Causa Nueva', cls: 'duty-causa', icon: 'ri-folder-add-line' },
                { key: 'CONTESTACION_DEMANDA', label: 'Contestación de Demanda', cls: 'duty-contestacion', icon: 'ri-edit-2-line' },
                { key: 'ADOPCION', label: 'Guarda / Adopción', cls: 'duty-adopcion', icon: 'ri-heart-add-line' }
            ];

            let html = '';
            this.codefensorasRoster.forEach(c => {
                const isAbsent = !c.isPresente;
                const cardCls = isAbsent ? 'kanban-defensora-card is-absent' : 'kanban-defensora-card';
                const dotCls = isAbsent ? 'presence-dot is-absent' : 'presence-dot is-present';
                const absentTag = isAbsent ? ' <span style="font-size: 0.72rem; color: #EF4444; font-weight: 700;">(Ausente)</span>' : '';

                const assignedRoles = [];
                if (!isAbsent) {
                    CANALES_ROLES.forEach(r => {
                        const asignado = turnos[r.key] || turnos[r.label] || (r.key === 'ADOPCION' ? (turnos['Adopción / Guarda'] || turnos['Adopción'] || turnos['Guarda Judicial / Tutela / Adopción']) : null) || (r.key === 'CONTESTACION_DEMANDA' ? turnos['Contestación'] : null) || (r.key === 'ASESORAMIENTO_GENERAL' ? turnos['Ases. General'] : null);
                        if (asignado === c.nombre) {
                            assignedRoles.push(r);
                        }
                    });
                }

                let chipsHtml = '';
                if (isAbsent) {
                    chipsHtml = '<div style="font-size: 0.74rem; color: #EF4444; font-style: italic; display: flex; align-items: center; gap: 0.3rem;"><i class="ri-user-unfollow-line"></i> No disponible (Ausente)</div>';
                } else if (assignedRoles.length > 0) {
                    chipsHtml = assignedRoles.map(r => 
                        '<div class="draggable-category-chip ' + r.cls + '" draggable="true" data-canal="' + r.key + '" data-label="' + r.label + '">' +
                            '<i class="' + r.icon + '"></i><span>' + r.label + '</span>' +
                        '</div>'
                    ).join('');
                } else {
                    chipsHtml = '<div style="font-size: 0.74rem; color: #64748B; font-style: italic;">Sin turnos asignados como próximo</div>';
                }

                html += '<div class="' + cardCls + '" data-nombre="' + c.nombre + '" data-presente="' + (isAbsent ? '0' : '1') + '">' +
                    '<div class="kanban-card-header">' +
                        '<span>Dra. ' + c.nombre + absentTag + '</span>' +
                        '<span class="' + dotCls + '"></span>' +
                    '</div>' +
                    '<div class="kanban-card-body" style="min-height: 48px; display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center;">' +
                        chipsHtml +
                    '</div>' +
                '</div>';
            });

            container.innerHTML = html;

            let activeDraggedCanal = null;
            let activeDraggedLabel = null;
            const liveRegion = this.dndLiveRegion || document.getElementById('dndLiveRegion');

            container.querySelectorAll('.draggable-category-chip').forEach(chip => {
                chip.addEventListener('dragstart', (e) => {
                    activeDraggedCanal = chip.getAttribute('data-canal');
                    activeDraggedLabel = chip.getAttribute('data-label');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', activeDraggedCanal);

                    if (liveRegion) {
                        liveRegion.textContent = 'Seleccionada especialidad ' + activeDraggedLabel + ' para reasignar próximo turno.';
                    }
                });
            });

            container.querySelectorAll('.kanban-defensora-card').forEach(card => {
                card.addEventListener('dragover', (e) => {
                    if (card.getAttribute('data-presente') === '0') return;
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'move';
                    card.classList.add('drop-target-active');
                });

                card.addEventListener('dragleave', (e) => {
                    if (!card.contains(e.relatedTarget)) {
                        card.classList.remove('drop-target-active');
                    }
                });

                card.addEventListener('drop', async (e) => {
                    if (card.getAttribute('data-presente') === '0') return;
                    e.preventDefault();
                    e.stopPropagation();
                    card.classList.remove('drop-target-active');

                    const nombreDefensora = card.getAttribute('data-nombre');
                    const canalToAssign = activeDraggedCanal || e.dataTransfer.getData('text/plain');

                    if (!canalToAssign || !nombreDefensora) return;

                    if (liveRegion) {
                        liveRegion.textContent = 'Asignando próximo turno de ' + (activeDraggedLabel || canalToAssign) + ' a Dra. ' + nombreDefensora + '.';
                    }

                    try {
                        await fetch(getApiUrl('/api/familia/turnos/asignar-proximo'), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                canalKey: canalToAssign,
                                nombreDefensora: nombreDefensora,
                                operatorName: this.currentUser ? this.currentUser.nombreCompleto : 'OPERADOR'
                            })
                        });
                    } catch(err) {}

                    await this.calculateProximoTurno();
                    this.renderPresenceRoster();
                });
            });
        }

        bindSegmentedControlEvents() {
            const container = document.querySelector('.segmented-control-container');
            if (!container) return;

            container.querySelectorAll('.segmented-control-btn').forEach(btn => {
                btn.onclick = () => {
                    container.querySelectorAll('.segmented-control-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const selectedCanal = btn.getAttribute('data-canal');
                    this.currentSelectedCanal = selectedCanal;
                    this.renderDndList(selectedCanal);
                };
            });
        }

        renderDndList(canalKey) {
            const selectedCanal = canalKey || this.currentSelectedCanal || 'ASESORAMIENTO_GENERAL';
            this.currentSelectedCanal = selectedCanal;

            const container = this.presenceReorderContainer || document.getElementById('presenceReorderContainer');
            if (!container) return;

            this.bindSegmentedControlEvents();

            const segContainer = document.querySelector('.segmented-control-container');
            if (segContainer) {
                segContainer.querySelectorAll('.segmented-control-btn').forEach(btn => {
                    if (btn.getAttribute('data-canal') === selectedCanal) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
            }

            let allDefensores = [...this.codefensorasRoster];

            if (this.canalOrders && this.canalOrders[selectedCanal]) {
                const orderArr = this.canalOrders[selectedCanal];
                allDefensores.sort((a, b) => {
                    let idxA = orderArr.indexOf(a.nombre);
                    let idxB = orderArr.indexOf(b.nombre);
                    if (idxA === -1) idxA = 999;
                    if (idxB === -1) idxB = 999;
                    return idxA - idxB;
                });
            }

            const turnos = this.currentTurnos || {};

            const dutyClassMap = {
                'ASESORAMIENTO_GENERAL': 'asesoria',
                'CAUSA_NUEVA': 'causa',
                'CONTESTACION_DEMANDA': 'contestacion',
                'ADOPCION': 'adopcion'
            };
            const currentDutyCls = dutyClassMap[selectedCanal] || 'causa';

            const proximaDefensora = turnos[selectedCanal] || (selectedCanal === 'ASESORAMIENTO_GENERAL' ? turnos['Asesoramiento General'] : (selectedCanal === 'CAUSA_NUEVA' ? turnos['Causa Nueva'] : (selectedCanal === 'CONTESTACION_DEMANDA' ? (turnos['Contestación de Demanda'] || turnos['Contestación']) : (turnos['Guarda Judicial / Tutela / Adopción'] || turnos['Adopción / Guarda'] || turnos['Adopción']))));

            let html = '';
            allDefensores.forEach((c, index) => {
                const isPresent = !!c.isPresente;
                const dotClass = isPresent ? 'is-present' : 'is-absent';
                const isProxima = isPresent && (c.nombre === proximaDefensora);
                const proximaItemClass = isProxima ? (' is-proxima duty-' + currentDutyCls) : (isPresent ? '' : ' is-absent-row');
                const proximaBadgeHtml = isProxima ? ('<span class="proxima-badge duty-' + currentDutyCls + '"><i class="ri-checkbox-circle-fill"></i> PRÓXIMA</span>') : '';
                const absentBadgeHtml = !isPresent ? ('<span class="absent-badge-row"><i class="ri-user-unfollow-line"></i> Ausente</span>') : '';

                html += '<div class="dnd-item' + proximaItemClass + '" draggable="true" data-index="' + index + '" data-nombre="' + c.nombre + '">' +
                    '<div class="dnd-item-content">' +
                        '<span class="dnd-handle" title="Arrastrar para reordenar"><i class="ri-draggable"></i></span>' +
                        '<span class="priority-badge">' + (index + 1) + '°</span>' +
                        '<span class="presence-dot ' + dotClass + '"></span>' +
                        '<span style="font-weight: 600; font-size: 0.88rem; color: ' + (isPresent ? '#FFF' : '#94A3B8') + ';">Dra. ' + c.nombre + '</span>' +
                        absentBadgeHtml +
                        proximaBadgeHtml +
                    '</div>' +
                '</div>';
            });

            if (allDefensores.length === 0) {
                html = '<div style="font-size: 0.8rem; color: #64748B; padding: 0.75rem; text-align: center; font-style: italic;">No hay defensoras registradas</div>';
            }

            container.innerHTML = html;

            let draggedItem = null;
            let draggedNombre = null;
            const liveRegion = this.dndLiveRegion || document.getElementById('dndLiveRegion');

            const placeholder = document.createElement('div');
            placeholder.className = 'dnd-placeholder-slot';
            placeholder.innerHTML = '<i class="ri-drag-drop-line"></i><span>Soltar aquí para posicionar</span>';

            const getDragAfterElement = (containerEl, y) => {
                const draggableElements = [...containerEl.querySelectorAll('.dnd-item:not(.is-dragging)')];
                return draggableElements.reduce((closest, child) => {
                    const box = child.getBoundingClientRect();
                    const offset = y - box.top - box.height / 2;
                    if (offset < 0 && offset > closest.offset) {
                        return { offset: offset, element: child };
                    } else {
                        return closest;
                    }
                }, { offset: Number.NEGATIVE_INFINITY }).element;
            };

            container.querySelectorAll('.dnd-item').forEach(item => {
                item.addEventListener('dragstart', (e) => {
                    draggedItem = item;
                    draggedNombre = item.getAttribute('data-nombre');
                    const draggedIndex = parseInt(item.getAttribute('data-index'), 10);
                    item.classList.add('is-dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', draggedNombre);

                    if (liveRegion) {
                        liveRegion.textContent = 'Se ha seleccionado a Dra. ' + draggedNombre + '. Posición actual ' + (draggedIndex + 1) + ' de ' + allDefensores.length + '.';
                    }
                });

                item.addEventListener('dragend', () => {
                    if (draggedItem) draggedItem.classList.remove('is-dragging');
                    if (placeholder.parentNode) {
                        placeholder.parentNode.removeChild(placeholder);
                    }
                    draggedItem = null;
                    draggedNombre = null;
                });
            });

            container.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (!draggedItem) return;

                const afterElement = getDragAfterElement(container, e.clientY);
                if (afterElement == null) {
                    container.appendChild(placeholder);
                } else {
                    container.insertBefore(placeholder, afterElement);
                }
            });

            container.addEventListener('drop', async (e) => {
                e.preventDefault();
                if (!draggedItem || !placeholder.parentNode) return;

                const children = [...container.children];
                const placeholderIdx = children.indexOf(placeholder);

                const currentList = allDefensores.map(c => c.nombre).filter(n => n !== draggedNombre);
                const originalIdx = allDefensores.findIndex(c => c.nombre === draggedNombre);

                let targetIndex = placeholderIdx;
                if (originalIdx !== -1 && originalIdx < placeholderIdx) {
                    targetIndex = placeholderIdx - 1;
                }
                if (targetIndex < 0) targetIndex = 0;
                if (targetIndex > currentList.length) targetIndex = currentList.length;

                currentList.splice(targetIndex, 0, draggedNombre);

                if (placeholder.parentNode) {
                    placeholder.parentNode.removeChild(placeholder);
                }

                this.canalOrders = this.canalOrders || {};
                this.canalOrders[selectedCanal] = currentList;

                try {
                    await fetch(getApiUrl('/api/familia/codefensoras/reordenar-canal'), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            canalKey: selectedCanal,
                            ordenNombres: currentList,
                            operatorName: this.currentUser ? this.currentUser.nombreCompleto : 'OPERADOR'
                        })
                    });
                } catch(err) {}

                this.renderPresenceRoster();
                await this.calculateProximoTurno();
            });
        }

        async updateCodefensoraPresenceServer(c) {
            try {
                await fetch(getApiUrl('/api/familia/codefensoras/estado'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nombre: c.nombre, isPresente: c.isPresente, operatorName: this.currentUser ? this.currentUser.nombreCompleto : 'OPERADOR' })
                });
            } catch(e) {}
        }

        async calculateProximoTurno(canalKey = 'Asesoramiento General') {
            try {
                const res = await fetch(getApiUrl('/api/familia/proximo-turno?canal=' + encodeURIComponent(canalKey)));
                if (res.ok) {
                    const data = await res.json();
                    if (data.success) {
                        if (data.turnos) {
                            this.currentTurnos = data.turnos || {};
                            this.renderPresenceRoster();
                        }
                        if (data.proximaDefensora) {
                            this.proximaDefensoriaTurno = data.proximaDefensora;
                            return data.proximaDefensora;
                        }
                    }
                }
            } catch(e) {}

            const presentes = this.codefensorasRoster.filter(c => c.isPresente);
            if (presentes.length > 0) {
                this.proximaDefensoriaTurno = presentes[0].nombre;
                return presentes[0].nombre;
            }
            return '';
        }

        handleFueroChange() {
            const defVal = this.newDefensoriaSelect ? this.newDefensoriaSelect.value : '';
            
            const isFamilia = defVal === 'CO-DEF. FAMILIA';
            const isPenal = defVal === 'PENAL' || defVal.includes('DEFENSORIA PENAL') || defVal === 'EJECUCIÓN PENAL' || defVal.includes('PENAL JUVENIL');
            const isCivil = defVal === 'DEF. CIVIL';
            const isOtro = defVal === 'Otro';

            if (this.fueroFamiliaSection) this.fueroFamiliaSection.style.display = isFamilia ? 'block' : 'none';
            if (this.fueroPenalSection) this.fueroPenalSection.style.display = isPenal ? 'block' : 'none';
            if (this.fueroCivilSection) this.fueroCivilSection.style.display = isCivil ? 'block' : 'none';

            if (this.fueroActiveBadge) {
                if (isFamilia) {
                    this.fueroActiveBadge.className = 'badge badge-familia';
                    this.fueroActiveBadge.textContent = 'Familia';
                } else if (isPenal) {
                    this.fueroActiveBadge.className = 'badge badge-penal';
                    this.fueroActiveBadge.textContent = defVal.includes('JUVENIL') ? 'Penal Juvenil' : 'Penal';
                } else if (isCivil) {
                    this.fueroActiveBadge.className = 'badge badge-civil';
                    this.fueroActiveBadge.textContent = 'Civil';
                } else {
                    this.fueroActiveBadge.className = 'badge badge-otro';
                    this.fueroActiveBadge.textContent = isOtro ? 'Otro Fuero / Trámite' : 'Seleccione Fuero';
                }
            }

            this.updateResultadoOptions(defVal);

            if (isFamilia) {
                this.handleTipoTramiteFamiliaChange();
                this.updateFamiliaAssignmentLogic();
            }
        }

        updateResultadoOptions(fueroVal) {
            if (!this.newResultadoSelect) return;
            const currentVal = this.newResultadoSelect.value;
            
            let options = [];
            if (fueroVal === 'CO-DEF. FAMILIA') {
                options = [
                    { value: 'Resuelve en Mesa / Operador', label: 'Resuelve en Mesa / Operador' },
                    { value: 'Entrevista con Defensor/a', label: 'Entrevista con Co-Defensora de Familia' },
                    { value: 'Asesoramiento General', label: 'Asesoramiento General' },
                    { value: 'Derivado a otra repartición', label: 'Derivado a otra repartición' }
                ];
            } else if (fueroVal === 'DEF. CIVIL') {
                options = [
                    { value: 'Resuelve en Mesa / Operador', label: 'Resuelve en Mesa / Operador' },
                    { value: 'Entrevista con Defensor/a', label: 'Entrevista con Defensor/a Civil' },
                    { value: 'Asesoramiento General', label: 'Asesoramiento General' },
                    { value: 'Derivado a otra repartición', label: 'Derivado a otra repartición' }
                ];
            } else if (fueroVal && (fueroVal.includes('PENAL') || fueroVal === 'EJECUCIÓN PENAL')) {
                options = [
                    { value: 'Resuelve en Mesa / Operador', label: 'Resuelve en Mesa / Operador' },
                    { value: 'Entrevista con Defensor/a', label: fueroVal.includes('JUVENIL') ? 'Entrevista con Defensor Penal Juvenil' : 'Entrevista con Defensor/a Penal' },
                    { value: 'Asesoramiento General', label: 'Asesoramiento General' },
                    { value: 'Derivado a otra repartición', label: 'Derivado a otra repartición' }
                ];
            } else {
                options = [
                    { value: 'Resuelve en Mesa / Operador', label: 'Resuelve en Mesa / Operador' },
                    { value: 'Asesoramiento General', label: 'Asesoramiento General' },
                    { value: 'Derivado a otra repartición', label: 'Derivado a otra repartición' }
                ];
            }

            let html = '<option value="" disabled' + (!currentVal ? ' selected' : '') + '>-- Seleccionar Resultado --</option>';
            let hasCurrent = false;
            options.forEach(opt => {
                const isSelected = (opt.value === currentVal);
                if (isSelected) hasCurrent = true;
                html += '<option value="' + opt.value + '"' + (isSelected ? ' selected' : '') + '>' + opt.label + '</option>';
            });
            this.newResultadoSelect.innerHTML = html;
            if (!hasCurrent && currentVal) {
                this.newResultadoSelect.value = '';
            }
            this.handleResultadoChange();
        }

        handleTipoTramiteFamiliaChange() {
            const tipo = this.newTipoTramiteFamilia ? this.newTipoTramiteFamilia.value : 'Causa Nueva';
            if (this.fechaVencimientoGroup) {
                this.fechaVencimientoGroup.style.display = (tipo === 'Contestación de Demanda') ? 'block' : 'none';
            }
            this.updateFamiliaAssignmentLogic();
        }

        handleResultadoChange() {
            const resVal = this.newResultadoSelect ? this.newResultadoSelect.value : '';
            if (this.reparticionDetalleGroup) {
                this.reparticionDetalleGroup.style.display = (resVal === 'Derivado a otra repartición') ? 'block' : 'none';
            }
        }

        setSelectValueNormalized(selectElement, targetValue) {
            if (!selectElement || !targetValue) return '';
            const cleanTarget = targetValue.replace(/^Dra\\.\\s*/i, '').replace(/^Dr\\.\\s*/i, '').trim();
            if (!cleanTarget) return '';

            for (let i = 0; i < selectElement.options.length; i++) {
                const optVal = selectElement.options[i].value.replace(/^Dra\\.\\s*/i, '').trim();
                const optText = selectElement.options[i].text.replace(/^Dra\\.\\s*/i, '').trim();
                if (optVal.toLowerCase() === cleanTarget.toLowerCase() || optText.toLowerCase().includes(cleanTarget.toLowerCase()) || cleanTarget.toLowerCase().includes(optVal.toLowerCase())) {
                    selectElement.selectedIndex = i;
                    return selectElement.options[i].value;
                }
            }
            return cleanTarget;
        }

        async updateFamiliaAssignmentLogic() {
            if (!this.newDefensoriaSelect || this.newDefensoriaSelect.value !== 'CO-DEF. FAMILIA') return;

            const tipo = this.newTipoTramiteFamilia ? this.newTipoTramiteFamilia.value : 'Causa Nueva';

            if (tipo === 'Causa en Trámite' || this.linkedHistoryDto) {
                let targetCodefensora = '';
                let recordIdRef = '';

                if (this.linkedHistoryDto) {
                    targetCodefensora = this.linkedHistoryDto.codefensora_asignada || this.linkedHistoryDto.codefensoraAsignada || '';
                    recordIdRef = ' (Trámite N° ' + this.linkedHistoryDto.id + ')';
                }

                if (!targetCodefensora && Array.isArray(this.currentCitizenHistory)) {
                    const rec = this.currentCitizenHistory.find(r => r.codefensora_asignada || r.codefensoraAsignada);
                    if (rec) {
                        targetCodefensora = rec.codefensora_asignada || rec.codefensoraAsignada;
                        if (!recordIdRef) recordIdRef = ' (Trámite N° ' + rec.id + ')';
                    }
                }

                const dniClean = this.newDniInput ? this.newDniInput.value.replace(/[^0-9]/g, '') : '';
                const expteClean = this.newExpteInput ? this.newExpteInput.value.trim() : '';

                if (!targetCodefensora && (dniClean || expteClean)) {
                    try {
                        const res = await fetch(getApiUrl('/api/atenciones/historial-familia?dni=' + encodeURIComponent(dniClean) + '&expte=' + encodeURIComponent(expteClean)));
                        if (res.ok) {
                            const data = await res.json();
                            if (data.success && data.found && data.suggestedCodefensora) {
                                targetCodefensora = data.suggestedCodefensora;
                            }
                        }
                    } catch(e) {}
                }

                if (targetCodefensora) {
                    const selectedVal = this.setSelectValueNormalized(this.newCodefensoraAsignada, targetCodefensora);
                    const displayName = selectedVal || targetCodefensora.replace(/^Dra\\.\\s*/i, '');

                    const defObj = this.codefensorasRoster.find(item => item.nombre.toLowerCase() === displayName.toLowerCase());
                    const isPresente = defObj ? defObj.isPresente : true;
                    const motivo = (defObj && defObj.motivoAusencia) ? ' (' + defObj.motivoAusencia + ')' : '';

                    if (this.codefensoraBadgeStatus) {
                        this.codefensoraBadgeStatus.textContent = isPresente ? 'Causa en Trámite (Presente)' : 'Causa en Trámite (Ausente)';
                        this.codefensoraBadgeStatus.style.background = isPresente ? 'rgba(74, 222, 128, 0.2)' : 'rgba(245, 158, 11, 0.2)';
                        this.codefensoraBadgeStatus.style.color = isPresente ? '#4ADE80' : '#FBBF24';
                    }

                    if (this.codefensoraHint) {
                        if (isPresente) {
                            this.codefensoraHint.style.color = '#4ADE80';
                            this.codefensoraHint.textContent = '✓ Co-Defensora previa vinculada al expediente' + recordIdRef + ': Dra. ' + displayName;
                        } else {
                            this.codefensoraHint.style.color = '#FBBF24';
                            this.codefensoraHint.textContent = '⚠️ Dra. ' + displayName + recordIdRef + ' figura Ausente' + motivo + '. Puede mantenerla o re-asignar a otra Co-Defensora presente.';
                        }
                    }
                    return;
                }

                if (this.codefensoraBadgeStatus) {
                    this.codefensoraBadgeStatus.textContent = 'Causa en Trámite';
                    this.codefensoraBadgeStatus.style.background = 'rgba(245, 158, 11, 0.2)';
                    this.codefensoraBadgeStatus.style.color = '#FBBF24';
                }
                if (this.codefensoraHint) {
                    this.codefensoraHint.style.color = '#FBBF24';
                    this.codefensoraHint.textContent = '⚠️ Causa en Trámite: Sin antecedente previo. Seleccione la Co-Defensora asignada manualmente.';
                }
            } else {
                const proxima = await this.calculateProximoTurno(tipo);
                if (proxima && this.newCodefensoraAsignada) {
                    this.setSelectValueNormalized(this.newCodefensoraAsignada, proxima);
                }
                if (this.codefensoraBadgeStatus) {
                    this.codefensoraBadgeStatus.textContent = 'Turno Rotativo (' + tipo + ')';
                    this.codefensoraBadgeStatus.style.background = 'rgba(198, 63, 149, 0.2)';
                    this.codefensoraBadgeStatus.style.color = '#F472B6';
                }
                if (this.codefensoraHint) {
                    this.codefensoraHint.style.color = '#94A3B8';
                    this.codefensoraHint.textContent = 'Sugerida automáticamente por turno rotativo del canal "' + tipo + '". (Puede modificarla manualmente si es necesario).';
                }
            }
        }

        selectHistoryRecordToContinue(dto) {
            if (!dto) return;

            this.linkedHistoryDto = dto;

            if (this.btnQuickContinuarCausa) this.btnQuickContinuarCausa.classList.add('active');
            if (this.btnQuickNuevaCausa) this.btnQuickNuevaCausa.classList.remove('active');

            const banner = document.getElementById('linkedHistoryBanner');
            const bannerText = document.getElementById('linkedHistoryBannerText');

            const defensoria = dto.defensoria || dto.defensoriaName || 'CO-DEF. FAMILIA';
            let codefensora = dto.codefensora_asignada || dto.codefensoraAsignada || '';
            if (!codefensora && Array.isArray(this.currentCitizenHistory)) {
                const rec = this.currentCitizenHistory.find(r => r.codefensora_asignada || r.codefensoraAsignada);
                if (rec) codefensora = rec.codefensora_asignada || rec.codefensoraAsignada;
            }
            const expte = dto.expte || '';

            if (banner && bannerText) {
                const label = 'Continuando Trámite Previo (Atención N° ' + dto.id + ' | ' + defensoria + (codefensora ? ' | Dra. ' + codefensora.replace(/^Dra\\.\\s*/i, '') : '') + (expte ? ' | Expte: ' + expte : '') + ')';
                bannerText.textContent = label;
                banner.style.display = 'flex';
            }

            if (this.newDefensoriaSelect) {
                this.newDefensoriaSelect.value = defensoria;
            }

            this.handleFueroChange();

            if (defensoria === 'CO-DEF. FAMILIA') {
                if (this.newTipoTramiteFamilia) {
                    this.newTipoTramiteFamilia.value = 'Causa en Trámite';
                }
                if (dto.motivo) {
                    const matchMateria = dto.motivo.match(/\[(.*?)\]/);
                    if (matchMateria && matchMateria[1] && this.newMateriaFamilia) {
                        this.setSelectValueNormalized(this.newMateriaFamilia, matchMateria[1]);
                    }
                }
            }

            if (this.newExpteInput && expte) {
                this.newExpteInput.value = expte;
            }

            if (codefensora && this.newCodefensoraAsignada) {
                this.setSelectValueNormalized(this.newCodefensoraAsignada, codefensora);
            }

            this.updateFamiliaAssignmentLogic();

            const obsInput = document.getElementById('newObservaciones');
            if (obsInput) {
                obsInput.focus();
            }

            showToast('¡Trámite N° ' + dto.id + ' vinculado al formulario!', 'info');
        }

        unlinkHistoryRecord() {
            this.linkedHistoryDto = null;
            const banner = document.getElementById('linkedHistoryBanner');
            if (banner) banner.style.display = 'none';

            if (this.btnQuickNuevaCausa) this.btnQuickNuevaCausa.classList.add('active');
            if (this.btnQuickContinuarCausa) this.btnQuickContinuarCausa.classList.remove('active');

            if (this.newTipoTramiteFamilia) {
                this.newTipoTramiteFamilia.value = 'Causa Nueva';
            }
            this.updateFamiliaAssignmentLogic();

            showToast('Vinculación de trámite removida. Modo restablecido a Trámite Nuevo.', 'info');
        }

        async openNewModal() {
            this.editingRecordId = null;
            this.linkedHistoryDto = null;
            const modalTitle = document.getElementById('newRecordModalTitle');
            if (modalTitle) modalTitle.textContent = 'Registrar Nueva Atención Ciudadana';
            const submitBtn = document.getElementById('btnSubmitRecord');
            if (submitBtn) submitBtn.innerHTML = '<i class="ri-save-line"></i> Guardar e Incorporar Atención';

            if (this.newRecordForm) this.newRecordForm.reset();

            if (this.newDniInput) this.newDniInput.value = '';
            const elFecha = document.getElementById('newFecha');
            if (elFecha) elFecha.value = normalizeDateStr(new Date().toLocaleDateString('es-AR'));

            if (this.newActividadSelect) this.newActividadSelect.value = '';
            if (this.newDefensoriaSelect) this.newDefensoriaSelect.value = '';
            if (this.newExpteInput) this.newExpteInput.value = '';
            if (this.newResultadoSelect) this.newResultadoSelect.value = '';

            if (this.newTareaPendiente) this.newTareaPendiente.checked = false;
            if (this.newDetallePendiente) this.newDetallePendiente.value = '';
            if (this.dniStatusBadge) {
                this.dniStatusBadge.style.display = 'none';
                this.dniStatusBadge.className = 'badge badge-otro';
                this.dniStatusBadge.textContent = '';
            }
            if (this.dniQuickActionsBar) this.dniQuickActionsBar.style.display = 'none';

            const banner = document.getElementById('linkedHistoryBanner');
            if (banner) banner.style.display = 'none';

            if (this.newAtendidoPorInput) {
                if (this.currentUser) this.newAtendidoPorInput.value = this.currentUser.nombreCompleto;
                this.newAtendidoPorInput.readOnly = (!this.currentUser || !this.currentUser.isAdmin());
            }

            this.handleFueroChange();

            // Reset panel de confección de escritos
            if (this.selectPlantillaEscrito) this.selectPlantillaEscrito.value = '';
            this.activePlantilla = null;
            this.escritoDynamicValues = {};
            if (this.escritoCamposDinamicosWrapper) this.escritoCamposDinamicosWrapper.style.display = 'none';
            if (this.escritoCamposDinamicosContainer) this.escritoCamposDinamicosContainer.innerHTML = '';
            if (this.escritoPreviewSection) this.escritoPreviewSection.style.display = 'none';
            if (this.escritoTextoEditor) this.escritoTextoEditor.value = '';
            if (this.escritoPanelContent) this.escritoPanelContent.style.display = 'none';
            if (this.escritoChevronIcon) this.escritoChevronIcon.className = 'ri-arrow-down-s-line';
            if (this.escritoStatusBadge) {
                this.escritoStatusBadge.className = 'badge';
                this.escritoStatusBadge.style.background = 'rgba(148, 163, 184, 0.15)';
                this.escritoStatusBadge.style.color = '#94A3B8';
                this.escritoStatusBadge.textContent = 'Sin plantilla';
            }

            await this.loadCatalogOptions();
            await this.loadPlantillasEscritos();
            this.newRecordModal.classList.add('active');
        }

        async openEditModal(dto) {
            const entity = this.rawEntities.find(e => e.id === dto.id);
            if (!entity) return;

            await this.loadCatalogOptions();
            await this.loadPlantillasEscritos();

            this.editingRecordId = dto.id;
            const modalTitle = document.getElementById('newRecordModalTitle');
            if (modalTitle) modalTitle.textContent = '✏️ Editar Atención N° ' + dto.id;
            const submitBtn = document.getElementById('btnSubmitRecord');
            if (submitBtn) submitBtn.innerHTML = '<i class="ri-save-line"></i> Guardar Cambios';

            if (this.newDniInput) this.newDniInput.value = entity.dni.raw;
            if (this.newApellidosInput) this.newApellidosInput.value = entity.apellidos;
            if (this.newNombresInput) this.newNombresInput.value = entity.nombres;
            if (this.newCelularInput) this.newCelularInput.value = entity.celular;

            const elFecha = document.getElementById('newFecha');
            if (elFecha) elFecha.value = entity.fecha;

            const elActividad = document.getElementById('newActividad');
            if (elActividad) elActividad.value = entity.actividad;

            const elExpte = document.getElementById('newExpte');
            if (elExpte) elExpte.value = entity.expte;

            const defName = entity.defensoriaCategory ? entity.defensoriaCategory.name : (entity.defensoria || '');
            if (this.newDefensoriaSelect) this.newDefensoriaSelect.value = defName;

            this.handleFueroChange();

            const isFamilia = defName === 'CO-DEF. FAMILIA';
            const isPenal = defName === 'PENAL' || defName.includes('DEFENSORIA PENAL') || defName === 'EJECUCIÓN PENAL';

            if (isFamilia) {
                if (this.newTipoTramiteFamilia) {
                    this.newTipoTramiteFamilia.value = entity.modoDerivacionFamilia || 'Causa Nueva';
                }
                if (entity.motivo) {
                    const matchMateria = entity.motivo.match(/\[(.*?)\]/);
                    if (matchMateria && matchMateria[1] && this.newMateriaFamilia) {
                        this.setSelectValueNormalized(this.newMateriaFamilia, matchMateria[1]);
                    }
                }
                if (this.newCodefensoraAsignada) {
                    this.setSelectValueNormalized(this.newCodefensoraAsignada, entity.codefensoraAsignada || '');
                }
                if (this.newFechaVencimientoContestacion) {
                    this.newFechaVencimientoContestacion.value = entity.fechaVencimientoContestacion || '';
                }
                this.handleTipoTramiteFamiliaChange();
            } else if (isPenal) {
                if (this.newTramitePenal) this.setSelectValueNormalized(this.newTramitePenal, entity.motivo || '');
            } else {
                if (this.newTramiteCivil) this.setSelectValueNormalized(this.newTramiteCivil, entity.motivo || '');
            }

            const elResultado = document.getElementById('newResultado');
            if (elResultado) {
                elResultado.value = entity.resultado || 'Resuelve en Mesa / Operador';
            }
            if (entity.resultado === 'Derivado a otra repartición' && this.newReparticionDetalle) {
                this.newReparticionDetalle.value = entity.detalleReparticion || '';
            }
            this.handleResultadoChange();

            const elObs = document.getElementById('newObservaciones');
            if (elObs) elObs.value = entity.observaciones;

            if (this.newAtendidoPorInput) {
                this.newAtendidoPorInput.value = entity.atendidoPor;
                this.newAtendidoPorInput.readOnly = (!this.currentUser || !this.currentUser.isAdmin());
            }

            if (this.newTareaPendiente) this.newTareaPendiente.checked = entity.tareaPendiente;
            if (this.newDetallePendiente) this.newDetallePendiente.value = entity.detallePendiente || '';

            // Cargar estado de confección de escritos
            if (entity.plantillaCodigo || entity.escritos || entity.escritosData) {
                if (this.escritoPanelContent) this.escritoPanelContent.style.display = 'block';
                if (this.escritoChevronIcon) this.escritoChevronIcon.className = 'ri-arrow-up-s-line';
                
                if (entity.plantillaCodigo && this.selectPlantillaEscrito) {
                    this.selectPlantillaEscrito.value = entity.plantillaCodigo;
                    this.activePlantilla = this.plantillasEscritos.find(p => p.codigo === entity.plantillaCodigo) || null;
                }

                if (entity.escritosData) {
                    try {
                        this.escritoDynamicValues = typeof entity.escritosData === 'string' ? JSON.parse(entity.escritosData) : entity.escritosData;
                    } catch(e) {
                        this.escritoDynamicValues = {};
                    }
                } else {
                    this.escritoDynamicValues = {};
                }

                if (this.activePlantilla) {
                    this.buildDynamicFields(this.activePlantilla.camposDinamicos);
                }

                if (this.escritoPreviewSection) this.escritoPreviewSection.style.display = 'block';
                if (this.escritoTextoEditor) {
                    this.escritoTextoEditor.value = entity.escritos || '';
                }
                if (this.escritoStatusBadge) {
                    this.escritoStatusBadge.className = 'badge ' + (entity.tareaPendiente ? 'badge-escrito-borrador' : 'badge-escrito-completado');
                    this.escritoStatusBadge.textContent = entity.tareaPendiente ? 'Borrador Pendiente' : 'Escrito Confeccionado';
                }
            } else {
                if (this.selectPlantillaEscrito) this.selectPlantillaEscrito.value = '';
                this.activePlantilla = null;
                this.escritoDynamicValues = {};
                if (this.escritoCamposDinamicosWrapper) this.escritoCamposDinamicosWrapper.style.display = 'none';
                if (this.escritoPreviewSection) this.escritoPreviewSection.style.display = 'none';
                if (this.escritoTextoEditor) this.escritoTextoEditor.value = '';
                if (this.escritoPanelContent) this.escritoPanelContent.style.display = 'none';
                if (this.escritoChevronIcon) this.escritoChevronIcon.className = 'ri-arrow-down-s-line';
                if (this.escritoStatusBadge) {
                    this.escritoStatusBadge.className = 'badge';
                    this.escritoStatusBadge.style.background = 'rgba(148, 163, 184, 0.15)';
                    this.escritoStatusBadge.style.color = '#94A3B8';
                    this.escritoStatusBadge.textContent = 'Sin plantilla';
                }
            }

            this.newRecordModal.classList.add('active');
        }

        updateView() {
            const filters = {
                query: this.searchInput.value,
                defensoria: this.filterDefensoria.value,
                resultado: this.filterResultado.value,
                soloTecnica: this.activeTecnicaFilter,
                tecnicaCategory: this.activeTecnicaCategory
            };
            this.currentDTOs = this.searchAttendancesUseCase.execute(this.rawEntities, filters);
            const filteredEntities = this.rawEntities.filter(e => this.currentDTOs.some(d => d.id === e.id));
            const summary = this.getSummaryUseCase.execute(filteredEntities);

            this.kpiTotal.textContent = summary.totalYear.toLocaleString();
            if (this.kpiMes) this.kpiMes.textContent = summary.totalMonth.toLocaleString();
            if (this.kpiSemana) this.kpiSemana.textContent = summary.totalWeek.toLocaleString();
            if (this.kpiHoy) this.kpiHoy.textContent = summary.totalToday.toLocaleString();
            
            this.latestSummary = summary;
            this.renderOperatorBreakdown();

            if (this.kpiAsesoramiento) this.kpiAsesoramiento.textContent = (summary.totalAsesoramientos || 0).toLocaleString();
            if (this.kpiAsesFamilia) this.kpiAsesFamilia.textContent = (summary.asesFamilia || 0).toLocaleString();
            if (this.kpiAsesOtros) this.kpiAsesOtros.textContent = (summary.asesOtros || 0).toLocaleString();

            this.kpiEscritos.textContent = summary.escritosCount.toLocaleString();
            if (this.kpiPendientes) this.kpiPendientes.textContent = summary.pendientesCount.toLocaleString();
            if (this.kpiPendientesHoy) this.kpiPendientesHoy.textContent = summary.pendientesHoy.toLocaleString();
            if (this.kpiPendientesSemana) this.kpiPendientesSemana.textContent = summary.pendientesSemana.toLocaleString();
            if (this.kpiPendientesAntiguas) this.kpiPendientesAntiguas.textContent = summary.pendientesAntiguas.toLocaleString();

            if (this.tecnicaBreakdownList && summary.tecnicaBreakdown) {
                let html = '';
                const entries = Object.entries(summary.tecnicaBreakdown).sort((a, b) => b[1] - a[1]);
                if (entries.length === 0) {
                    html = '<span style="color: #94A3B8; font-size: 0.8rem;">Sin derivaciones técnicas</span>';
                } else {
                    for (const [profesional, count] of entries) {
                        const isSel = (this.activeTecnicaFilter && this.activeTecnicaCategory === profesional);
                        const bg = isSel ? 'background: rgba(236, 72, 153, 0.3); border: 1px solid #EC4899;' : 'background: rgba(255,255,255,0.05);';
                        html += '<div class="tecnica-breakdown-item" data-cat="' + profesional + '" style="display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; color: #E2E8F0; padding: 0.35rem 0.5rem; border-radius: 4px; cursor: pointer; ' + bg + '"><span style="font-weight: 600;">👤 ' + profesional + '</span> <span style="background: rgba(236, 72, 153, 0.2); color: #F472B6; font-weight: 700; padding: 0.1rem 0.4rem; border-radius: 4px;">' + count + '</span></div>';
                    }
                }
                this.tecnicaBreakdownList.innerHTML = html;

                this.tecnicaBreakdownList.querySelectorAll('.tecnica-breakdown-item').forEach(el => {
                    el.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const cat = el.getAttribute('data-cat');
                        this.setTecnicaCategoryFilter(cat);
                    });
                });
            }

            if (this.pendingOperatorBreakdownList) {
                let html = '';
                if (Object.keys(summary.pendingOperatorBreakdown).length === 0) {
                    html = '<span style="color: #94A3B8; font-size: 0.8rem;">Sin tareas pendientes</span>';
                } else {
                    for (const [operator, count] of Object.entries(summary.pendingOperatorBreakdown)) {
                        html += '<div style="display: flex; justify-content: space-between; font-size: 0.82rem; color: #E2E8F0;"><span style="font-weight: 600;">' + operator + '</span> <span style="background: rgba(245,158,11,0.2); padding: 0.1rem 0.4rem; border-radius: 4px; color: #FBBF24;">' + count + '</span></div>';
                    }
                }
                this.pendingOperatorBreakdownList.innerHTML = html;
            }

            this.renderPaginatedTable();
        }

        renderOperatorBreakdown() {
            if (!this.operatorBreakdownList || !this.latestSummary) return;
            const summary = this.latestSummary;
            const period = this.selectedOperatorPeriod || 'today';

            let breakdown = {};
            let totalPeriod = 0;
            let periodBadgeColor = '#4ADE80';

            if (period === 'week') {
                breakdown = summary.operatorBreakdownWeek || {};
                totalPeriod = summary.totalWeek || 0;
                periodBadgeColor = '#FBBF24';
            } else if (period === 'month') {
                breakdown = summary.operatorBreakdownMonth || {};
                totalPeriod = summary.totalMonth || 0;
                periodBadgeColor = '#38BDF8';
            } else {
                breakdown = summary.operatorBreakdownToday || summary.operatorBreakdown || {};
                totalPeriod = summary.totalToday || 0;
                periodBadgeColor = '#4ADE80';
            }

            if (this.operatorTooltipTotalBadge) {
                this.operatorTooltipTotalBadge.textContent = 'Total: ' + totalPeriod.toLocaleString();
                this.operatorTooltipTotalBadge.style.color = periodBadgeColor;
                this.operatorTooltipTotalBadge.style.borderColor = periodBadgeColor + '55';
                this.operatorTooltipTotalBadge.style.background = periodBadgeColor + '22';
            }

            const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);

            if (entries.length === 0) {
                this.operatorBreakdownList.innerHTML = '<span style="color: #94A3B8; font-size: 0.8rem; padding: 0.5rem 0; text-align: center;">Sin atenciones en este período</span>';
                return;
            }

            let html = '';
            for (const [operator, count] of entries) {
                const pct = totalPeriod > 0 ? ((count / totalPeriod) * 100).toFixed(1) : '0.0';
                html += '<div class="operator-breakdown-row" style="display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; color: #E2E8F0; padding: 0.25rem 0.4rem; border-radius: 4px; background: rgba(255,255,255,0.03);">' +
                            '<span style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;" title="' + operator + '">' + operator + '</span>' +
                            '<div style="display: flex; align-items: center; gap: 0.45rem;">' +
                                '<span style="font-size: 0.72rem; color: #94A3B8; font-weight: 500;">' + pct + '%</span>' +
                                '<span style="background: rgba(251, 191, 36, 0.15); color: var(--mpd-gold, #FBBF24); font-weight: 700; padding: 0.1rem 0.45rem; border-radius: 4px; font-size: 0.78rem; min-width: 24px; text-align: center; border: 1px solid rgba(251, 191, 36, 0.3);">' + count + '</span>' +
                            '</div>' +
                        '</div>';
            }
            this.operatorBreakdownList.innerHTML = html;
        }

        toggleTecnicaFilter() {
            this.activeTecnicaFilter = !this.activeTecnicaFilter;
            if (!this.activeTecnicaFilter) {
                this.activeTecnicaCategory = null;
            }
            this.updateTecnicaFilterUI();
            this.currentPage = 1;
            this.updateView();
        }

        setTecnicaCategoryFilter(categoryKey) {
            this.activeTecnicaFilter = true;
            this.activeTecnicaCategory = categoryKey;
            if (this.tecnicaBreakdownPopover) this.tecnicaBreakdownPopover.style.display = 'none';
            this.updateTecnicaFilterUI();
            this.currentPage = 1;
            this.updateView();
        }

        clearTecnicaFilter() {
            this.activeTecnicaFilter = false;
            this.activeTecnicaCategory = null;
            this.updateTecnicaFilterUI();
            this.currentPage = 1;
            this.updateView();
        }

        toggleTecnicaPopover() {
            if (!this.tecnicaBreakdownPopover) return;
            const isVisible = this.tecnicaBreakdownPopover.style.display === 'block';
            this.tecnicaBreakdownPopover.style.display = isVisible ? 'none' : 'block';
        }

        updateTecnicaFilterUI() {
            if (!this.tecnicaFilterBadge) return;
            if (this.activeTecnicaFilter) {
                this.tecnicaFilterBadge.style.display = 'inline-flex';
                if (this.tecnicaFilterBadgeText) {
                    this.tecnicaFilterBadgeText.textContent = this.activeTecnicaCategory 
                        ? ('Filtrado: ' + this.activeTecnicaCategory) 
                        : 'Filtrado: Derivadas a Asist. Técnica';
                }
                if (this.cardDerivadasTecnica) {
                    this.cardDerivadasTecnica.style.border = '1px solid #EC4899';
                    this.cardDerivadasTecnica.style.boxShadow = '0 0 15px rgba(236, 72, 153, 0.4)';
                }
            } else {
                this.tecnicaFilterBadge.style.display = 'none';
                if (this.cardDerivadasTecnica) {
                    this.cardDerivadasTecnica.style.border = '';
                    this.cardDerivadasTecnica.style.boxShadow = '';
                }
            }
        }

        formatDateTime(dateVal) {
            return DateTimeFormatter.format(dateVal);
        }

        getDefensoriaBadgeClass(name) {
            if (!name) return 'badge-otro';
            const norm = name.toUpperCase();
            if (norm.includes('FAMILIA')) return 'badge-familia';
            if (norm.includes('CIVIL')) return 'badge-civil';
            if (norm.includes('PENAL')) return 'badge-penal';
            return 'badge-otro';
        }

        getResultadoBadgeClass(res) {
            if (!res) return 'badge-otro';
            if (res.includes('Resuelve')) return 'badge-civil';
            if (res.includes('Entrevista') || res.includes('Defensor')) return 'badge-familia';
            if (res.includes('Asesoramiento')) return 'badge-familia';
            if (res.includes('Derivad')) return 'badge-penal';
            return 'badge-otro';
        }

        renderPaginatedTable() {
            const total = this.currentDTOs.length;
            const maxPages = Math.ceil(total / this.pageSize) || 1;
            if (this.currentPage > maxPages) this.currentPage = maxPages;
            if (this.currentPage < 1) this.currentPage = 1;

            const startIndex = (this.currentPage - 1) * this.pageSize;
            const endIndex = Math.min(startIndex + this.pageSize, total);
            const pageDTOs = this.currentDTOs.slice(startIndex, endIndex);

            if (this.totalRecordsCount) this.totalRecordsCount.textContent = total.toLocaleString();
            if (this.pageStart) this.pageStart.textContent = total > 0 ? (startIndex + 1).toLocaleString() : '0';
            if (this.pageEnd) this.pageEnd.textContent = endIndex.toLocaleString();
            if (this.pageIndicator) this.pageIndicator.textContent = 'Página ' + this.currentPage + ' de ' + maxPages;

            if (this.btnPrevPage) this.btnPrevPage.disabled = (this.currentPage <= 1);
            if (this.btnNextPage) this.btnNextPage.disabled = (this.currentPage >= maxPages);

            this.renderTable(pageDTOs);
        }

        renderTable(dtos) {
            if (dtos.length === 0) {
                this.tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #94A3B8;">No se encontraron registros.</td></tr>';
                return;
            }

            let html = '';
            dtos.forEach(dto => {
                const isPending = dto.tareaPendiente;
                const rowClass = isPending ? 'row-pending' : '';
                const rowStyle = isPending ? 'background: rgba(245, 158, 11, 0.08); border-left: 4px solid #F59E0B;' : '';

                const statusHtml = isPending ? 
                    '<span class="badge" style="background: rgba(245, 158, 11, 0.2); border: 1px solid #F59E0B; color: #FBBF24;"><i class="ri-time-line"></i> Pendiente</span>' +
                    (dto.detallePendiente ? '<span style="display:block; font-size:0.75rem; color:#FBBF24; margin-top:0.2rem;">' + dto.detallePendiente + '</span>' : '')
                    : '<span>' + dto.resultado + '</span>';

                const actionBtn = isPending ?
                    '<button class="btn btn-secondary btn-complete-task" data-id="' + dto.id + '" title="Marcar tarea como cumplida" style="padding: 0.25rem 0.6rem; font-size: 0.78rem; color: #4ADE80; border-color: rgba(74, 222, 128, 0.4);"><i class="ri-check-double-line"></i> Cumplir</button>'
                    : '<button class="btn btn-secondary btn-toggle-pending" data-id="' + dto.id + '" title="Marcar con tarea pendiente" style="padding: 0.25rem 0.5rem; font-size: 0.78rem; color: #FBBF24; opacity: 0.6;"><i class="ri-time-line"></i></button>';

                const editBtn = '<button class="btn btn-secondary btn-edit-record" data-id="' + dto.id + '" title="Editar registro" style="padding: 0.25rem 0.5rem; font-size: 0.78rem; color: #38BDF8; border-color: rgba(56, 189, 248, 0.4); margin-left: 0.25rem;"><i class="ri-edit-line"></i></button>';

                html += '<tr class="' + rowClass + '" data-id="' + dto.id + '" style="' + rowStyle + '">' +
                    '<td>' + (dto.fecha || 's/f') + '</td>' +
                    '<td>' +
                        '<span class="citizen-name">' + dto.fullName + '</span>' +
                        '<span class="citizen-dni">' + dto.dniFormatted + '</span>' +
                    '</td>' +
                    '<td><span class="expte-number">' + (dto.expte || dto.motivo || 'Atención General') + '</span></td>' +
                    '<td><span class="badge ' + dto.defensoriaBadgeClass + '">' + dto.defensoriaName + '</span></td>' +
                    '<td>' + statusHtml + '</td>' +
                    '<td>' +
                        (dto.defensoriaName === 'CO-DEF. FAMILIA' && dto.codefensoraAsignada 
                            ? '<span style="color:#F472B6; font-weight:600;">' + dto.codefensoraAsignada + '</span><br><span style="font-size:0.7rem; color:#94A3B8">Operador: ' + dto.atendidoPor + '</span>' 
                            : dto.atendidoPor) +
                    '</td>' +
                    '<td onclick="event.stopPropagation();">' + actionBtn + editBtn + '</td>' +
                '</tr>';
            });
            this.tableBody.innerHTML = html;

            this.tableBody.querySelectorAll('.btn-complete-task').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const id = Number(btn.getAttribute('data-id'));
                    await this.toggleTaskStatus(id, false);
                });
            });

            this.tableBody.querySelectorAll('.btn-toggle-pending').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const id = Number(btn.getAttribute('data-id'));
                    await this.toggleTaskStatus(id, true);
                });
            });

            this.tableBody.querySelectorAll('.btn-edit-record').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = Number(btn.getAttribute('data-id'));
                    const dto = this.currentDTOs.find(d => d.id === id);
                    if (dto) this.openEditModal(dto);
                });
            });

            this.tableBody.querySelectorAll('tr').forEach(row => {
                row.addEventListener('click', () => {
                    const id = row.getAttribute('data-id');
                    const dto = this.currentDTOs.find(d => d.id == id);
                    if (dto) this.openDetailModal(dto);
                });
            });
        }

        async toggleTaskStatus(id, newPendingStatus) {
            const ent = this.rawEntities.find(e => e.id === id);
            if (ent) {
                ent.tareaPendiente = newPendingStatus;
                if (!newPendingStatus) ent.tareaCumplidaAt = new Date().toISOString();
            }

            try {
                await fetch(getApiUrl('/api/atenciones/tarea-estado'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id,
                        tareaPendiente: newPendingStatus,
                        operatorName: this.currentUser ? this.currentUser.nombreCompleto : 'OPERADOR'
                    })
                });
            } catch(e) {}

            this.updateView();
        }

        openDetailModal(dto) {
            const isPending = dto.tareaPendiente;
            const toggleTaskBtnText = isPending ? '✅ Marcar Tarea como CUMPLIDA' : '⚠️ Marcar con Tarea Pendiente';
            const toggleTaskBtnColor = isPending ? 'background: rgba(74, 222, 128, 0.2); border: 1px solid #4ADE80; color: #4ADE80;' : 'background: rgba(245, 158, 11, 0.2); border: 1px solid #F59E0B; color: #FBBF24;';

            this.detailModalBody.innerHTML = '<div style="display: flex; flex-direction: column; gap: 1rem;">' +
                '<div style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.75rem; display:flex; justify-content:space-between; align-items:flex-start;">' +
                    '<div>' +
                        '<h3 style="font-size: 1.3rem; color: #FFF;">' + dto.fullName + '</h3>' +
                        '<p style="font-size: 0.85rem; color: #00B4D8; margin-top: 0.2rem;">DNI: ' + dto.dniFormatted + ' | Celular: ' + (dto.celular || 'No posee') + '</p>' +
                    '</div>' +
                    '<div style="display:flex; gap:0.5rem; align-items:center;">' +
                        '<button id="btnModalEditRecord" class="btn" style="background: rgba(56, 189, 248, 0.2); border: 1px solid #38BDF8; color: #38BDF8; font-size:0.85rem; padding:0.4rem 0.8rem;" title="Editar este registro">' +
                            '<i class="ri-edit-line"></i> Editar' +
                        '</button>' +
                        '<button id="btnModalToggleTask" class="btn" style="' + toggleTaskBtnColor + ' font-size:0.85rem; padding:0.4rem 0.8rem;">' +
                            toggleTaskBtnText +
                        '</button>' +
                        '<button id="btnModalDeleteRecord" class="btn" style="background: rgba(239, 68, 68, 0.2); border: 1px solid #EF4444; color: #F87171; font-size:0.85rem; padding:0.4rem 0.8rem;" title="Eliminar este registro">' +
                            '<i class="ri-delete-bin-line"></i> Eliminar' +
                        '</button>' +
                    '</div>' +
                '</div>' +

                (isPending ? '<div style="background: rgba(245, 158, 11, 0.15); border: 1px solid #F59E0B; padding: 0.75rem 1rem; border-radius: 6px;"><strong style="color: #FBBF24; display:block; margin-bottom: 0.2rem;"><i class="ri-time-line"></i> Tarea Pendiente de Resolución:</strong><p style="color: #FFF; font-size: 0.9rem;">' + (dto.detallePendiente || 'Trámite pendiente de seguimiento') + '</p></div>' : '') +

                '<div class="form-grid">' +
                    '<div><span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase;">Fecha</span><p style="font-weight: 600;">' + dto.fecha + '</p></div>' +
                    '<div><span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase;">Actividad</span><p style="font-weight: 600;">' + dto.actividad + '</p></div>' +
                    '<div><span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase;">N° Expte</span><p style="font-weight: 600; color: #00B4D8;">' + (dto.expte || 'Sin Expte.') + '</p></div>' +
                    '<div><span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase;">Defensoría</span><p><span class="badge ' + (dto.defensoriaBadgeClass || 'badge-otro') + '">' + (dto.defensoriaName || 'General') + '</span></p></div>' +
                    '<div><span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase;">Resultado</span><p style="font-weight: 600;">' + dto.resultado + '</p></div>' +
                    '<div><span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase;">Operador de Mesa (Atendió)</span><p style="font-weight: 600;">' + (dto.atendidoPor || 'Secretaría') + '</p></div>' +
                    (dto.defensoriaName === 'CO-DEF. FAMILIA' && dto.codefensoraAsignada ? '<div><span style="font-size: 0.75rem; color: #C63F95; text-transform: uppercase;">Co-Defensora Asignada</span><p style="font-weight: 700; color: #EC4899;">Dra. ' + dto.codefensoraAsignada.replace(/^Dra\\.\\s*/i, '') + '</p></div>' : '') +
                    (dto.defensoriaName === 'CO-DEF. FAMILIA' && dto.modoDerivacionFamilia ? '<div><span style="font-size: 0.75rem; color: #F472B6; text-transform: uppercase;">Modo Derivación Familia</span><p style="font-weight: 600;">' + dto.modoDerivacionFamilia + '</p></div>' : '') +
                    (dto.defensoriaName === 'CO-DEF. FAMILIA' && dto.fechaVencimientoContestacion ? '<div><span style="font-size: 0.75rem; color: #F87171; text-transform: uppercase;">Plazo Contestación</span><p style="font-weight: 700; color: #EF4444;"><i class="ri-alarm-warning-line"></i> ' + dto.fechaVencimientoContestacion + '</p></div>' : '') +
                '</div>' +
                
                '<div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); margin-top: 0.5rem;">' +
                    '<div style="margin-bottom: 0.75rem;">' +
                        '<span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase; display: block; margin-bottom: 0.2rem;">Motivo / Trámite</span>' +
                        '<p style="font-size: 0.95rem; font-weight: 600; color: #E2E8F0;">' + (dto.motivo || 'Sin motivo registrado.') + '</p>' +
                    '</div>' +
                    '<div>' +
                        '<span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase; display: block; margin-bottom: 0.2rem;">Observaciones</span>' +
                        '<p style="font-size: 0.9rem; line-height: 1.5; color: ' + (dto.observaciones ? '#FFF' : '#64748B') + ';">' + (dto.observaciones || 'Sin observaciones registradas en este evento.') + '</p>' +
                    '</div>' +
                '</div>' +

                (dto.escritos ? '<div style="background: rgba(14, 165, 233, 0.08); padding: 1.25rem; border-radius: 8px; border: 1px solid rgba(14, 165, 233, 0.3); margin-top: 0.5rem;">' +
                    '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">' +
                        '<div>' +
                            '<span style="font-size: 0.75rem; color: #38BDF8; text-transform: uppercase; font-weight: 700; display: flex; align-items: center; gap: 0.35rem;"><i class="ri-file-text-line"></i> Escrito Judicial Confeccionado</span>' +
                            '<span style="font-size: 0.85rem; color: #CBD5E1; font-weight: 600;">' + (dto.plantillaCodigo ? 'Plantilla: ' + dto.plantillaCodigo : 'Documento redactado') + '</span>' +
                        '</div>' +
                        '<div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">' +
                            '<button id="btnDetailCopiarEscrito" class="btn btn-sm" style="background: rgba(255,255,255,0.08); color: #E2E8F0; font-size: 0.78rem; padding: 0.3rem 0.6rem;"><i class="ri-file-copy-line"></i> Copiar Texto</button>' +
                            '<button id="btnDetailImprimirEscrito" class="btn btn-sm" style="background: rgba(14, 165, 233, 0.2); color: #38BDF8; border: 1px solid #38BDF8; font-size: 0.78rem; padding: 0.3rem 0.6rem;"><i class="ri-printer-line"></i> Imprimir</button>' +
                            (isPending ? '<button id="btnDetailRetomarEscrito" class="btn btn-sm" style="background: rgba(245, 158, 11, 0.2); color: #FBBF24; border: 1px solid #F59E0B; font-size: 0.78rem; padding: 0.3rem 0.6rem;"><i class="ri-edit-2-line"></i> Retomar / Concluir Escrito</button>' : '') +
                        '</div>' +
                    '</div>' +
                    '<div id="detailEscritoTextoContainer" style="background: #FFF; color: #0F172A; font-family: Times, serif; font-size: 0.88rem; line-height: 1.5; padding: 1rem; border-radius: 4px; max-height: 220px; overflow-y: auto; white-space: pre-wrap; border: 1px solid #CBD5E1;">' + dto.escritos + '</div>' +
                '</div>' : '') +
            '</div>';

            const btnDetailCopiar = document.getElementById('btnDetailCopiarEscrito');
            if (btnDetailCopiar) {
                btnDetailCopiar.addEventListener('click', () => {
                    const txt = dto.escritos || '';
                    if (navigator.clipboard && window.isSecureContext) {
                        navigator.clipboard.writeText(txt).then(() => {
                            showToast('¡Texto del escrito copiado al portapapeles!', 'success');
                        }).catch(() => {
                            this._fallbackCopyText(txt);
                        });
                    } else {
                        this._fallbackCopyText(txt);
                    }
                });
            }

            const btnDetailImprimir = document.getElementById('btnDetailImprimirEscrito');
            if (btnDetailImprimir) {
                btnDetailImprimir.addEventListener('click', () => {
                    const html = DocumentRenderService.generatePrintableHtml({
                        titulo: 'ESCRITO JUDICIAL',
                        sumario: 'PRESENTA ESCRITO JUDICIAL',
                        cuerpoTexto: dto.escritos,
                        ciudadanoNombre: dto.fullName,
                        dni: dto.dniRaw,
                        expte: dto.expte,
                        defensoria: dto.defensoriaName,
                        operador: dto.atendidoPor,
                        fecha: dto.fecha
                    });
                    this._printHtmlViaIframe(html);
                });
            }

            const btnDetailRetomar = document.getElementById('btnDetailRetomarEscrito');
            if (btnDetailRetomar) {
                btnDetailRetomar.addEventListener('click', () => {
                    this.detailModal.classList.remove('active');
                    this.openEditModal(dto);
                });
            }

            const btnModalEditRecord = document.getElementById('btnModalEditRecord');
            if (btnModalEditRecord) {
                btnModalEditRecord.addEventListener('click', () => {
                    this.detailModal.classList.remove('active');
                    this.openEditModal(dto);
                });
            }

            const btnModalToggleTask = document.getElementById('btnModalToggleTask');
            if (btnModalToggleTask) {
                btnModalToggleTask.addEventListener('click', async () => {
                    await this.toggleTaskStatus(dto.id, !isPending);
                    this.detailModal.classList.remove('active');
                });
            }

            const btnModalDeleteRecord = document.getElementById('btnModalDeleteRecord');
            if (btnModalDeleteRecord) {
                btnModalDeleteRecord.addEventListener('click', () => {
                    showConfirm('Eliminar Atención', '¿Confirmas que deseas eliminar este registro? Esta acción no se puede deshacer.', async () => {
                        await this.deleteRecord(dto.id);
                        this.detailModal.classList.remove('active');
                    });
                });
            }

            this.detailModal.style.zIndex = '99999';
            this.detailModal.classList.add('active');
        }

        async deleteRecord(id) {
            try {
                const operatorName = this.currentUser ? this.currentUser.nombreCompleto : 'ADMIN';
                await fetch(getApiUrl('/api/atenciones?id=' + id + '&operatorName=' + encodeURIComponent(operatorName)), { method: 'DELETE' });
                showToast('Atención N° ' + id + ' eliminada correctamente.', 'info');
                this.rawEntities = await this.repository.getAll();
                this.updateView();
            } catch (e) {
                console.warn('Error al eliminar registro:', e.message);
                showToast('Error al eliminar registro.', 'error');
            }
        }

        async handleFormSubmit(e) {
            e.preventDefault();
            if (this.isSubmitting) return;
            this.isSubmitting = true;
            
            const submitBtn = this.newRecordForm ? this.newRecordForm.querySelector('button[type="submit"]') : null;
            if (submitBtn) submitBtn.disabled = true;

            try {
                let motivoFinal = document.getElementById('newMotivo') ? document.getElementById('newMotivo').value : '';
                if (this.newDefensoriaSelect && this.newDefensoriaSelect.value === 'CO-DEF. FAMILIA' && this.newFamilySubmotivoSelect) {
                    if (!motivoFinal.startsWith('[')) {
                        motivoFinal = ('[' + this.newFamilySubmotivoSelect.value + '] ' + motivoFinal).trim();
                    }
                }

                const isTaskPending = this.newTareaPendiente ? this.newTareaPendiente.checked : false;
                const taskDetail = this.newDetallePendiente ? this.newDetallePendiente.value : '';

                const isFamilia = this.newDefensoriaSelect && this.newDefensoriaSelect.value === 'CO-DEF. FAMILIA';
                const modoFamilia = (isFamilia && this.newModoDerivacionFamilia) ? this.newModoDerivacionFamilia.value : '';
                const codefensora = (isFamilia && this.newCodefensoraAsignada) ? this.newCodefensoraAsignada.value : '';
                const vencimientoContestacion = (isFamilia && this.newFechaVencimientoContestacion) ? this.newFechaVencimientoContestacion.value : '';

                if (isFamilia && modoFamilia === 'Contestación de Demanda' && !vencimientoContestacion) {
                    showToast('Por favor ingrese la Fecha de Vencimiento / Plazo para la Contestación de Demanda.', 'error');
                    return;
                }

                const elResultadoVal = document.getElementById('newResultado') ? document.getElementById('newResultado').value : '';
                const elReparticionInput = document.getElementById('newReparticionDetalle');
                const detalleReparticionVal = elResultadoVal === 'Derivado a otra repartición' && elReparticionInput ? elReparticionInput.value.trim() : '';

                const getFormVal = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };

                const formData = {
                    id: this.editingRecordId || undefined,
                    fecha: getFormVal('newFecha'),
                    actividad: getFormVal('newActividad'),
                    dni: getFormVal('newDni'),
                    apellidos: getFormVal('newApellidos'),
                    nombres: getFormVal('newNombres'),
                    celular: getFormVal('newCelular'),
                    expte: getFormVal('newExpte'),
                    motivo: motivoFinal,
                    defensoria: getFormVal('newDefensoria'),
                    resultado: elResultadoVal,
                    observaciones: getFormVal('newObservaciones'),
                    atendidoPor: getFormVal('newAtendidoPor'),
                    tareaPendiente: isTaskPending,
                    detallePendiente: taskDetail,
                    modoDerivacionFamilia: modoFamilia,
                    codefensoraAsignada: codefensora,
                    fechaVencimientoContestacion: vencimientoContestacion,
                    detalleReparticion: detalleReparticionVal,
                    plantillaCodigo: this.activePlantilla ? this.activePlantilla.codigo : (this.selectPlantillaEscrito ? this.selectPlantillaEscrito.value : ''),
                    escritos: this.escritoTextoEditor ? this.escritoTextoEditor.value.trim() : '',
                    escritosData: this.escritoDynamicValues ? JSON.stringify(this.escritoDynamicValues) : '',
                    operatorId: this.currentUser ? this.currentUser.id : 0
                };

                if (this.editingRecordId) {
                    const entityToUpdate = new Attendance(formData);
                    entityToUpdate.id = this.editingRecordId;
                    await this.repository.update(entityToUpdate);
                    showToast('¡Atención N° ' + this.editingRecordId + ' actualizada correctamente!', 'success');
                } else {
                    await this.createAttendanceUseCase.execute(formData);
                    showToast('¡Atención registrada correctamente!', 'success');
                }

                this.rawEntities = await this.repository.getAll();
                await this.calculateProximoTurno();
                this.currentPage = 1;
                
                if (!this.editingRecordId) {
                    if (this.searchInput) this.searchInput.value = '';
                    if (this.filterDefensoria) this.filterDefensoria.value = '';
                    if (this.filterResultado) this.filterResultado.value = '';
                    this.activeTecnicaFilter = false;
                    this.activeTecnicaCategory = null;
                }

                this.updateView();

                this.editingRecordId = null;
                this.newRecordModal.classList.remove('active');
                if (this.newRecordForm) this.newRecordForm.reset();
                if (this.selectPlantillaEscrito) this.selectPlantillaEscrito.value = '';
                this.activePlantilla = null;
                this.escritoDynamicValues = {};
                if (this.escritoCamposDinamicosWrapper) this.escritoCamposDinamicosWrapper.style.display = 'none';
                if (this.escritoCamposDinamicosContainer) this.escritoCamposDinamicosContainer.innerHTML = '';
                if (this.escritoPreviewSection) this.escritoPreviewSection.style.display = 'none';
                if (this.escritoTextoEditor) this.escritoTextoEditor.value = '';
                if (this.escritoPanelContent) this.escritoPanelContent.style.display = 'none';
                if (this.escritoChevronIcon) this.escritoChevronIcon.className = 'ri-arrow-down-s-line';
                if (this.escritoStatusBadge) {
                    this.escritoStatusBadge.className = 'badge';
                    this.escritoStatusBadge.style.background = 'rgba(148, 163, 184, 0.15)';
                    this.escritoStatusBadge.style.color = '#94A3B8';
                    this.escritoStatusBadge.textContent = 'Sin plantilla';
                }
            } catch (err) {
                console.error('Error al guardar atención:', err);
                showToast('Error al guardar atención: ' + (err.message || err), 'error');
            } finally {
                this.isSubmitting = false;
                const submitBtn = this.newRecordForm ? this.newRecordForm.querySelector('button[type="submit"]') : null;
                if (submitBtn) submitBtn.disabled = false;
            }
        }
    }

    // Bootstrap
    document.addEventListener('DOMContentLoaded', async () => {
        const repo = new SQLiteAttendanceRepositoryAdapter();
        const getSummary = new GetAttendanceSummaryUseCase();
        const search = new SearchAttendancesUseCase();
        const create = new CreateAttendanceUseCase(repo);

        const controller = new DashboardViewController({
            getSummaryUseCase: getSummary,
            searchAttendancesUseCase: search,
            createAttendanceUseCase: create,
            attendanceRepository: repo
        });

        await controller.init();
    });
})();
`;

fs.writeFileSync(path.join(__dirname, '../public/js', 'dashboard-bundle.js'), bundleContent, 'utf8');

const indexHtmlPath = path.join(__dirname, '../public', 'index.html');
const dashboardHtmlPath = path.join(__dirname, '../public', 'dashboard.html');
if (fs.existsSync(indexHtmlPath)) {
    fs.copyFileSync(indexHtmlPath, dashboardHtmlPath);
}

console.log('✅ Bundle actualizado con Módulo Completo de Tareas Pendientes y dashboard.html sincronizado.');
