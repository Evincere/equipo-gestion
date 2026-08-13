const fs = require('fs');
const path = require('path');

const csvContent = fs.readFileSync(path.join(__dirname, 'data', 'atenciones.csv'), 'utf8');

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

    // 4. Entidad Attendance
    class Attendance {
        constructor({ id, fecha, actividad, dni, apellidos, nombres, celular, expte, motivo, defensoria, resultado, observaciones, atendidoPor, atendido_por, derivadoA, escritos, tarea_pendiente, tareaPendiente, detalle_pendiente, detallePendiente, tarea_cumplida_at, tareaCumplidaAt, modo_derivacion_familia, modoDerivacionFamilia, codefensora_asignada, codefensoraAsignada, fecha_vencimiento_contestacion, fechaVencimientoContestacion }) {
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
                fechaVencimientoContestacion: entity.fechaVencimientoContestacion
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
            const operatorBreakdown = {};

            let pendientesHoy = 0;
            let pendientesSemana = 0;
            let pendientesAntiguas = 0;
            const pendingOperatorBreakdown = {};

            attendances.forEach(a => {
                const isToday = normalizeDateStr(a.fecha) === todayStr;
                if (isToday) {
                    totalToday++;
                    const operator = a.atendidoPor || 'Secretaría';
                    operatorBreakdown[operator] = (operatorBreakdown[operator] || 0) + 1;
                }

                const ts = parseDate(a.fecha);
                if (ts > 0) {
                    const dateObj = new Date(ts);
                    if (dateObj >= startOfWeek) {
                        totalWeek++;
                    }
                    if (dateObj >= startOfMonth && dateObj.getFullYear() === now.getFullYear() && dateObj.getMonth() === now.getMonth()) {
                        totalMonth++;
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

            attendances.forEach(a => {
                if (a.isDerivacionTecnica()) {
                    const dest = (a.derivadoA && a.derivadoA.trim()) ? a.derivadoA.trim() : 'Sin Especificar';
                    tecnicaBreakdown[dest] = (tecnicaBreakdown[dest] || 0) + 1;
                }
            });

            return {
                total: attendances.length,
                totalYear,
                totalMonth,
                totalWeek,
                totalToday,
                derivacionesTecnica: attendances.filter(a => a.isDerivacionTecnica()).length,
                escritosCount: attendances.filter(a => a.hasEscritos()).length,
                pendientesCount: attendances.filter(a => a.tareaPendiente).length,
                pendientesHoy,
                pendientesSemana,
                pendientesAntiguas,
                operatorBreakdown,
                pendingOperatorBreakdown,
                tecnicaBreakdown
            };
        }
    }

    class SearchAttendancesUseCase {
        execute(attendances, { query = '', defensoria = '', resultado = '', soloTecnica = false, tecnicaCategory = null }) {
            const q = query.toLowerCase().trim();
            const qCleanDni = q.split('.').join('');
            const filtered = attendances.filter(item => {
                const matchesQuery = !q ||
                    item.dni.clean.includes(qCleanDni) ||
                    item.apellidos.toLowerCase().includes(q) ||
                    item.nombres.toLowerCase().includes(q) ||
                    item.expte.toLowerCase().includes(q) ||
                    item.observaciones.toLowerCase().includes(q) ||
                    (item.detallePendiente && item.detallePendiente.toLowerCase().includes(q));

                const matchesDefensoria = !defensoria || item.defensoriaCategory.name === defensoria;
                
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

            // Ordenar por fecha (descendente) y luego por ID
            filtered.sort((a, b) => {
                const dateB = parseDate(b.fecha);
                const dateA = parseDate(a.fecha);
                if (dateB !== dateA) return dateB - dateA;
                return b.id - a.id;
            });
            
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
                            fecha_vencimiento_contestacion: row.fecha_vencimiento_contestacion
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
                        fechaVencimientoContestacion: entity.fechaVencimientoContestacion
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
            this.citizenHistoryContainer = document.getElementById('citizenHistoryContainer');
            this.newApellidosInput = document.getElementById('newApellidos');
            this.newNombresInput = document.getElementById('newNombres');
            this.newCelularInput = document.getElementById('newCelular');
            this.newTareaPendiente = document.getElementById('newTareaPendiente');
            this.newDetallePendiente = document.getElementById('newDetallePendiente');

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
            this.operatorBreakdownList = document.getElementById('operatorBreakdownList');
            this.kpiTecnica = document.getElementById('kpiTecnica');
            this.cardDerivadasTecnica = document.getElementById('cardDerivadasTecnica');
            this.btnToggleTecnicaBreakdown = document.getElementById('btnToggleTecnicaBreakdown');
            this.tecnicaBreakdownPopover = document.getElementById('tecnicaBreakdownPopover');
            this.tecnicaBreakdownList = document.getElementById('tecnicaBreakdownList');
            this.tecnicaFilterBadge = document.getElementById('tecnicaFilterBadge');
            this.tecnicaFilterBadgeText = document.getElementById('tecnicaFilterBadgeText');
            this.btnClearTecnicaFilter = document.getElementById('btnClearTecnicaFilter');
            this.btnCloseTecnicaPopover = document.getElementById('btnCloseTecnicaPopover');

            this.activeTecnicaFilter = false;
            this.activeTecnicaCategory = null;
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
            this.btnNewRecord = document.getElementById('btnNewRecord');
            this.btnNavNuevaAtencion = document.getElementById('btnNavNuevaAtencion');
            this.btnCloseNewModal = document.getElementById('btnCloseNewModal');
            this.newRecordForm = document.getElementById('newRecordForm');
            this.btnExportPDF = document.getElementById('btnExportPDF');
                  this.presenceRosterContainer = document.getElementById('presenceRosterContainer');
            this.turnIndicatorBadge = document.getElementById('turnIndicatorBadge');
            this.turnIndicatorContainer = document.getElementById('turnIndicatorContainer');
            this.newDefensoriaSelect = document.getElementById('newDefensoria');
            this.familySubmotivoGroup = document.getElementById('familySubmotivoGroup');
            this.newFamilySubmotivoSelect = document.getElementById('newFamilySubmotivo');
            this.newAtendidoPorInput = document.getElementById('newAtendidoPor');

            this.familyDerivacionGroup = document.getElementById('familyDerivacionGroup');
            this.newModoDerivacionFamilia = document.getElementById('newModoDerivacionFamilia');
            this.fechaVencimientoGroup = document.getElementById('fechaVencimientoGroup');
            this.newFechaVencimientoContestacion = document.getElementById('newFechaVencimientoContestacion');
            this.codefensoraAsignadaGroup = document.getElementById('codefensoraAsignadaGroup');
            this.newCodefensoraAsignada = document.getElementById('newCodefensoraAsignada');
            this.codefensoraHint = document.getElementById('codefensoraHint');
            this.newExpteInput = document.getElementById('newExpte');

            this.btnOnlineUsers = document.getElementById('btnOnlineUsers');
            this.onlineUsersPopover = document.getElementById('onlineUsersPopover');
            this.onlineUsersCountText = document.getElementById('onlineUsersCountText');
            this.onlineUsersBadgeCount = document.getElementById('onlineUsersBadgeCount');
            this.onlineUsersList = document.getElementById('onlineUsersList');
            
            this.currentDateText = document.getElementById('currentDateText');
            this.currentTimeText = document.getElementById('currentTimeText');
            this.activeCatalogCategory = 'actividad';
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
            if (this.btnOnlineUsers && this.onlineUsersPopover) {
                this.btnOnlineUsers.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isVisible = this.onlineUsersPopover.style.display === 'block';
                    this.onlineUsersPopover.style.display = isVisible ? 'none' : 'block';
                });

                document.addEventListener('click', (e) => {
                    if (this.onlineUsersPopover && !this.onlineUsersPopover.contains(e.target) && e.target !== this.btnOnlineUsers) {
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
                    this.updateFamiliaAssignmentLogic();
                });
            }

            if (this.newDniInput) {
                this.newDniInput.addEventListener('input', () => {
                    const clean = this.newDniInput.value.replace(/[^\d]/g, '');
                    if (clean.length >= 7 && clean.length <= 9) {
                        this.performDniLookup();
                        this.updateFamiliaAssignmentLogic();
                    }
                });
            }

            if (this.newExpteInput) {
                this.newExpteInput.addEventListener('change', () => this.updateFamiliaAssignmentLogic());
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

            if (this.newDefensoriaSelect) {
                this.newDefensoriaSelect.addEventListener('change', () => {
                    const isFamilia = this.newDefensoriaSelect.value === 'CO-DEF. FAMILIA';
                    if (this.familyDerivacionGroup) this.familyDerivacionGroup.style.display = isFamilia ? 'flex' : 'none';
                    if (this.newAtendidoPorInput && this.currentUser) {
                        this.newAtendidoPorInput.value = this.currentUser.nombreCompleto;
                    }
                    this.updateFamiliaFormDynamism();
                    if (isFamilia) {
                        this.updateFamiliaAssignmentLogic();
                    }
                });
            }

            if (this.newModoDerivacionFamilia) {
                this.newModoDerivacionFamilia.addEventListener('change', () => {
                    const modo = this.newModoDerivacionFamilia.value;
                    if (this.fechaVencimientoGroup) {
                        this.fechaVencimientoGroup.style.display = (modo === 'Contestación de Demanda') ? 'flex' : 'none';
                    }
                    this.updateFamiliaFormDynamism();
                    this.updateFamiliaAssignmentLogic();
                });
            }

            const elResultadoSelect = document.getElementById('newResultado');
            if (elResultadoSelect) {
                elResultadoSelect.addEventListener('change', () => {
                    this.updateFamiliaFormDynamism();
                });
            }

            if (this.newFamilySubmotivoSelect) {
                this.newFamilySubmotivoSelect.addEventListener('change', () => {
                    if (this.newFamilySubmotivoSelect.value === 'Guarda Judicial / Tutela / Adopción') {
                        if (this.newModoDerivacionFamilia) {
                            this.newModoDerivacionFamilia.value = 'Guarda Judicial / Tutela / Adopción';
                        }
                        this.updateFamiliaFormDynamism();
                        this.updateFamiliaAssignmentLogic();
                    }
                });
            }

            if (this.cardTotalAtenciones && this.operatorTooltip) {
                this.cardTotalAtenciones.addEventListener('mouseenter', () => {
                    this.operatorTooltip.style.display = 'block';
                });
                this.cardTotalAtenciones.addEventListener('mouseleave', () => {
                    this.operatorTooltip.style.display = 'none';
                });
            }

            if (this.cardDerivadasTecnica) {
                this.cardDerivadasTecnica.addEventListener('click', (e) => {
                    if (e.target.closest('#btnToggleTecnicaBreakdown') || e.target.closest('#tecnicaBreakdownPopover')) return;
                    this.toggleTecnicaFilter();
                });
            }

            if (this.btnToggleTecnicaBreakdown) {
                this.btnToggleTecnicaBreakdown.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleTecnicaPopover();
                });
            }

            if (this.btnClearTecnicaFilter) {
                this.btnClearTecnicaFilter.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.clearTecnicaFilter();
                });
            }

            if (this.btnCloseTecnicaPopover) {
                this.btnCloseTecnicaPopover.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (this.tecnicaBreakdownPopover) this.tecnicaBreakdownPopover.style.display = 'none';
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
                this.currentDateText.textContent = \`San Rafael, \${day} de \${month} de \${year}\`;
                this.currentTimeText.textContent = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            };
            
            updateClock();
            setInterval(updateClock, 1000);
        }

        async performDniLookup() {
            const dniVal = this.newDniInput.value.trim();
            const cleanDni = dniVal.replace(/[^\\d]/g, '');

            if (!cleanDni || cleanDni.length < 5) {
                this.dniStatusBadge.className = 'badge badge-otro';
                this.dniStatusBadge.textContent = 'Ingrese DNI Válido';
                this.citizenHistoryContainer.style.display = 'none';
                return;
            }

            this.dniStatusBadge.className = 'badge badge-civil';
            this.dniStatusBadge.textContent = 'Buscando...';

            try {
                const res = await fetch(getApiUrl(\`/api/ciudadanos/historial?dni=\${encodeURIComponent(cleanDni)}\`));
                if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.found) {
                        this.dniStatusBadge.className = 'badge badge-familia';
                        this.dniStatusBadge.textContent = \`¡Registrado! (\${data.historyCount} atenciones previas)\`;

                        if (data.personalData) {
                            if (this.newApellidosInput) this.newApellidosInput.value = data.personalData.apellidos || '';
                            if (this.newNombresInput) this.newNombresInput.value = data.personalData.nombres || '';
                            if (this.newCelularInput && data.personalData.celular) this.newCelularInput.value = data.personalData.celular;
                        }

                        this.renderCitizenHistoryPanel(data.history);
                        return;
                    }
                }
            } catch(e) {}

            const matchedEntities = this.rawEntities.filter(ent => ent.dni && ent.dni.clean === cleanDni);

            if (matchedEntities.length > 0) {
                const latest = matchedEntities[0];
                this.dniStatusBadge.className = 'badge badge-familia';
                this.dniStatusBadge.textContent = \`¡Registrado! (\${matchedEntities.length} atenciones previas)\`;

                if (this.newApellidosInput) this.newApellidosInput.value = latest.apellidos || '';
                if (this.newNombresInput) this.newNombresInput.value = latest.nombres || '';
                if (this.newCelularInput && latest.celular) this.newCelularInput.value = latest.celular;

                const dtos = matchedEntities.map(e => AttendanceDTO.fromEntity(e));
                this.renderCitizenHistoryPanel(dtos);
            } else {
                this.dniStatusBadge.className = 'badge badge-civil';
                this.dniStatusBadge.textContent = '✨ Ciudadano Nuevo (Primer Registro)';
                this.citizenHistoryContainer.style.display = 'none';
            }
        }

        renderCitizenHistoryPanel(historyList) {
            if (!historyList || historyList.length === 0) {
                this.citizenHistoryContainer.style.display = 'none';
                return;
            }

            let cardsHtml = '';
            historyList.slice(0, 5).forEach((item) => {
                const fecha = item.fecha || 's/f';
                const defensoria = item.defensoria || item.defensoriaName || 'General';
                const expte = item.expte ? \`Expte: \${item.expte}\` : (item.motivo || 'Atención Spontánea');
                const obs = item.observaciones ? \`<p style="font-size:0.8rem; color:#CBD5E1; margin-top:0.25rem;">"...\${item.observaciones.substring(0, 120)}..."</p>\` : '';
                const taskBadge = item.tarea_pendiente || item.tareaPendiente ? '<span style="color:#FBBF24; font-size:0.75rem; font-weight:700;"> ⚠️ Tarea Pendiente</span>' : '';

                cardsHtml += \`
                    <div class="history-card" data-history-id="\${item.id}" style="cursor: pointer; background: rgba(30, 41, 59, 0.9); border: 1px solid rgba(0, 180, 216, 0.3); border-radius: 6px; padding: 0.75rem 1rem; margin-bottom: 0.5rem; transition: background 0.2s ease;">
                        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.2rem;">
                            <span style="color: #00B4D8;"><i class="ri-calendar-line"></i> \${fecha} | \${defensoria}</span>
                            <span style="color: #F472B6;">\${item.resultado || 'Resuelve'} \${taskBadge}</span>
                        </div>
                        <div style="font-size: 0.85rem; font-weight: 600; color: #FFF;">\${expte}</div>
                        \${obs}
                        <div style="font-size: 0.72rem; color: #94A3B8; margin-top: 0.3rem;">Atendido por: \${item.atendidoPor || item.atendido_por || 'Secretaría'}</div>
                    </div>
                \`;
            });

            this.citizenHistoryContainer.innerHTML = \`
                <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid var(--mpd-gold); border-radius: 8px; padding: 1rem;">
                    <h5 style="color: var(--mpd-gold); font-size: 0.88rem; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;">
                        <i class="ri-history-line"></i> Historial de Atenciones Anteriores del Ciudadano (\${historyList.length} Registros)
                    </h5>
                    <div style="max-height: 220px; overflow-y: auto;">
                        \${cardsHtml}
                    </div>
                </div>
            \`;
            
            const cards = this.citizenHistoryContainer.querySelectorAll('.history-card');
            cards.forEach(card => {
                card.addEventListener('mouseenter', () => card.style.background = 'rgba(51, 65, 85, 0.9)');
                card.addEventListener('mouseleave', () => card.style.background = 'rgba(30, 41, 59, 0.9)');
                card.addEventListener('click', () => {
                    const id = Number(card.getAttribute('data-history-id'));
                    const dto = historyList.find(i => i.id === id);
                    if (dto) {
                        this.openDetailModal(dto);
                    }
                });
            });

            this.citizenHistoryContainer.style.display = 'block';
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
                html += '<div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.04); padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.06);">' +
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
                '</div>';
            });
            this.onlineUsersList.innerHTML = html;
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
                        } else {
                            this.chatGlobalUnreadBadge.style.display = 'none';
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
                elActividad.innerHTML = '<option value="" disabled selected>-- Seleccionar Actividad --</option>' +
                    this.catalogData.actividad.map(function(item) { return '<option value="' + item.valor + '">' + item.valor + '</option>'; }).join('');
                if (curVal) elActividad.value = curVal;
            }

            const elDefensoria = document.getElementById('newDefensoria');
            if (elDefensoria && this.catalogData.defensoria) {
                const curVal = elDefensoria.value;
                elDefensoria.innerHTML = '<option value="" disabled selected>-- Seleccionar Defensoría / Área --</option>' +
                    this.catalogData.defensoria.map(function(item) { return '<option value="' + item.valor + '">' + item.valor + '</option>'; }).join('');
                if (curVal) elDefensoria.value = curVal;
            }

            const elMotivo = document.getElementById('newMotivo');
            if (elMotivo && this.catalogData.motivo) {
                const curVal = elMotivo.value;
                elMotivo.innerHTML = '<option value="" disabled selected>-- Seleccionar Motivo --</option>' +
                    this.catalogData.motivo.map(function(item) { return '<option value="' + item.valor + '">' + item.valor + '</option>'; }).join('');
                if (curVal) elMotivo.value = curVal;
            }

            const elResultado = document.getElementById('newResultado');
            if (elResultado && this.catalogData.resultado) {
                const curVal = elResultado.value;
                elResultado.innerHTML = '<option value="" disabled selected>-- Seleccionar Resultado --</option>' +
                    this.catalogData.resultado.map(function(item) { return '<option value="' + item.valor + '">' + item.valor + '</option>'; }).join('');
                if (curVal) elResultado.value = curVal;
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
            if (!this.presenceRosterContainer) return;
            let html = '';
            this.codefensorasRoster.forEach(c => {
                const statusClass = c.isPresente ? 'presente' : 'ausente';
                const statusText = c.isPresente ? 'Presente' : 'Ausente';
                html += '<div class="presence-pill ' + statusClass + '" data-name="' + c.nombre + '" title="Clic para cambiar presencia/ausencia">' +
                    '<span class="dot"></span>' +
                    '<span>Dra. ' + c.nombre + ' (' + statusText + ')</span>' +
                '</div>';
            });
            this.presenceRosterContainer.innerHTML = html;

            this.presenceRosterContainer.querySelectorAll('.presence-pill').forEach(pill => {
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
                            let badgesHtml = '';
                            const styles = {
                                'Ases. General': 'background: rgba(236, 72, 153, 0.2); border: 1px solid #EC4899; color: #F472B6;',
                                'Causa Nueva': 'background: rgba(56, 189, 248, 0.2); border: 1px solid #38BDF8; color: #38BDF8;',
                                'Contestación': 'background: rgba(245, 158, 11, 0.2); border: 1px solid #F59E0B; color: #FBBF24;',
                                'Adopción / Guarda': 'background: rgba(168, 85, 247, 0.2); border: 1px solid #A855F7; color: #C084FC;'
                            };
                            for (const [chanLabel, defName] of Object.entries(data.turnos)) {
                                const st = styles[chanLabel] || 'background: rgba(255,255,255,0.1); color: #FFF;';
                                badgesHtml += '<span class="turn-indicator" style="' + st + ' font-size: 0.74rem; padding: 0.2rem 0.6rem; border-radius: 14px; font-weight: 600;">' + chanLabel + ': Dra. ' + defName + '</span>';
                            }
                            if (this.turnIndicatorContainer) {
                                this.turnIndicatorContainer.innerHTML = badgesHtml;
                            } else if (this.turnIndicatorBadge) {
                                this.turnIndicatorBadge.innerHTML = badgesHtml;
                            }
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

        updateFamiliaFormDynamism() {
            const isFamilia = this.newDefensoriaSelect && this.newDefensoriaSelect.value === 'CO-DEF. FAMILIA';
            const elMotivo = document.getElementById('newMotivo');
            const elResultado = document.getElementById('newResultado');
            const elReparticionGroup = document.getElementById('reparticionDetalleGroup');

            if (isFamilia) {
                if (elMotivo) {
                    const curMotivo = elMotivo.value;
                    const familiaMotivos = ['Espontánea', 'Causa en Trámite', 'Turno', 'Otro'];
                    let optionsHtml = '<option value="" disabled selected>-- Seleccionar Motivo --</option>';
                    familiaMotivos.forEach(m => {
                        optionsHtml += '<option value="' + m + '">' + m + '</option>';
                    });
                    elMotivo.innerHTML = optionsHtml;
                    if (curMotivo && familiaMotivos.includes(curMotivo)) {
                        elMotivo.value = curMotivo;
                    }
                }

                if (elResultado) {
                    const curResultado = elResultado.value;
                    const familiaResultados = ['Resuelve operador', 'Entrevista con Codefensor', 'Derivado a otra repartición', 'Otro'];
                    let optionsHtml = '<option value="" disabled selected>-- Seleccionar Resultado --</option>';
                    familiaResultados.forEach(r => {
                        optionsHtml += '<option value="' + r + '">' + r + '</option>';
                    });
                    elResultado.innerHTML = optionsHtml;
                    if (curResultado && familiaResultados.includes(curResultado)) {
                        elResultado.value = curResultado;
                    }
                }

                const modo = this.newModoDerivacionFamilia ? this.newModoDerivacionFamilia.value : '';
                if (modo === 'Guarda Judicial / Tutela / Adopción') {
                    if (this.familySubmotivoGroup) this.familySubmotivoGroup.style.display = 'none';
                    if (this.newFamilySubmotivoSelect) this.newFamilySubmotivoSelect.value = 'Guarda Judicial / Tutela / Adopción';
                } else {
                    if (this.familySubmotivoGroup) this.familySubmotivoGroup.style.display = 'flex';
                }
            } else {
                if (elMotivo) {
                    const curMotivo = elMotivo.value;
                    const genericMotivos = ['Espontánea', 'Causa Trámite', 'Aud. Fijada', 'Divorcio', 'Ejecución', 'Turno', 'Aud. Imputación', 'Otro'];
                    let optionsHtml = '<option value="" disabled selected>-- Seleccionar Motivo --</option>';
                    genericMotivos.forEach(m => {
                        optionsHtml += '<option value="' + m + '">' + m + '</option>';
                    });
                    elMotivo.innerHTML = optionsHtml;
                    if (curMotivo && genericMotivos.includes(curMotivo)) elMotivo.value = curMotivo;
                }

                if (elResultado) {
                    const curResultado = elResultado.value;
                    const genericResultados = ['Resuelve', 'Deriva a A. Técnica', 'Deriva a CO-DEF- FAMILIA', 'Derivado a otra repartición', 'Otro'];
                    let optionsHtml = '<option value="" disabled selected>-- Seleccionar Resultado --</option>';
                    genericResultados.forEach(r => {
                        optionsHtml += '<option value="' + r + '">' + r + '</option>';
                    });
                    elResultado.innerHTML = optionsHtml;
                    if (curResultado && genericResultados.includes(curResultado)) elResultado.value = curResultado;
                }

                if (this.familySubmotivoGroup) this.familySubmotivoGroup.style.display = 'none';
            }

            if (elResultado && elResultado.value === 'Derivado a otra repartición') {
                if (elReparticionGroup) elReparticionGroup.style.display = 'flex';
            } else {
                if (elReparticionGroup) elReparticionGroup.style.display = 'none';
            }
        }

        async updateFamiliaAssignmentLogic() {
            if (!this.newDefensoriaSelect || this.newDefensoriaSelect.value !== 'CO-DEF. FAMILIA') return;

            const modo = this.newModoDerivacionFamilia ? this.newModoDerivacionFamilia.value : 'Asesoramiento General';

            if (modo === 'Causa en Trámite') {
                const dniClean = this.newDniInput ? this.newDniInput.value.replace(/[^\d]/g, '') : '';
                const expteClean = this.newExpteInput ? this.newExpteInput.value.trim() : '';

                if (dniClean || expteClean) {
                    try {
                        const res = await fetch(getApiUrl('/api/atenciones/historial-familia?dni=' + encodeURIComponent(dniClean) + '&expte=' + encodeURIComponent(expteClean)));
                        if (res.ok) {
                            const data = await res.json();
                            if (data.success && data.found && data.suggestedCodefensora) {
                                const suggestedName = data.suggestedCodefensora;
                                if (this.newCodefensoraAsignada) {
                                    this.newCodefensoraAsignada.value = suggestedName;
                                }

                                const defObj = this.codefensorasRoster.find(item => item.nombre.toLowerCase() === suggestedName.toLowerCase());
                                const isPresente = defObj ? defObj.isPresente : true;
                                const motivo = (defObj && defObj.motivoAusencia) ? ' (' + defObj.motivoAusencia + ')' : '';

                                if (this.codefensoraHint) {
                                    if (isPresente) {
                                        this.codefensoraHint.style.color = '#4ADE80';
                                        this.codefensoraHint.textContent = '✓ Co-Defensora previa vinculada al historial: Dra. ' + suggestedName;
                                    } else {
                                        this.codefensoraHint.style.color = '#FBBF24';
                                        this.codefensoraHint.textContent = '⚠️ Dra. ' + suggestedName + ' (asignada previamente a este expediente) figura Ausente' + motivo + '. Puede mantenerla o re-asignar a otra Co-Defensora presente.';
                                    }
                                }
                                return;
                            }
                        }
                    } catch(e) {}
                }

                if (this.codefensoraHint) {
                    this.codefensoraHint.style.color = '#FBBF24';
                    this.codefensoraHint.textContent = '⚠️ Causa en Trámite: Sin antecedente previo. Seleccione la Co-Defensora asignada manualmente.';
                }
            } else {
                const proxima = await this.calculateProximoTurno(modo);
                if (proxima && this.newCodefensoraAsignada) {
                    this.newCodefensoraAsignada.value = proxima;
                }
                if (this.codefensoraHint) {
                    this.codefensoraHint.style.color = '#94A3B8';
                    this.codefensoraHint.textContent = 'Sugerida automáticamente por turno del canal "' + modo + '". (Puede modificarla manualmente si es necesario).';
                }
            }
        }

        async openNewModal() {
            this.editingRecordId = null;
            const modalTitle = this.newRecordModal ? this.newRecordModal.querySelector('h4') : null;
            if (modalTitle) modalTitle.textContent = 'Registrar Nueva Atención';
            const submitBtn = this.newRecordForm ? this.newRecordForm.querySelector('button[type="submit"]') : null;
            if (submitBtn) submitBtn.innerHTML = '<i class="ri-save-line"></i> Guardar Registro';

            if (this.newRecordForm) this.newRecordForm.reset();

            if (this.newDniInput) this.newDniInput.value = '';
            const elFecha = document.getElementById('newFecha');
            if (elFecha) elFecha.value = normalizeDateStr(new Date().toLocaleDateString('es-AR'));

            const elActividad = document.getElementById('newActividad');
            if (elActividad) elActividad.value = '';

            if (this.newDefensoriaSelect) this.newDefensoriaSelect.value = '';

            const elMotivo = document.getElementById('newMotivo');
            if (elMotivo) elMotivo.value = '';

            const elResultado = document.getElementById('newResultado');
            if (elResultado) elResultado.value = '';

            if (this.newTareaPendiente) this.newTareaPendiente.checked = false;
            if (this.newDetallePendiente) this.newDetallePendiente.value = '';
            if (this.dniStatusBadge) {
                this.dniStatusBadge.className = 'badge badge-otro';
                this.dniStatusBadge.textContent = 'Ingrese DNI';
            }
            if (this.citizenHistoryContainer) this.citizenHistoryContainer.style.display = 'none';

            if (this.newAtendidoPorInput) {
                if (this.currentUser) this.newAtendidoPorInput.value = this.currentUser.nombreCompleto;
                this.newAtendidoPorInput.readOnly = (!this.currentUser || !this.currentUser.isAdmin());
            }

            if (this.familyDerivacionGroup) this.familyDerivacionGroup.style.display = 'none';
            if (this.familySubmotivoGroup) this.familySubmotivoGroup.style.display = 'none';
            if (this.fechaVencimientoGroup) this.fechaVencimientoGroup.style.display = 'none';

            await this.loadCatalogOptions();
            this.newRecordModal.classList.add('active');
        }

        async openEditModal(dto) {
            const entity = this.rawEntities.find(e => e.id === dto.id);
            if (!entity) return;

            await this.loadCatalogOptions();

            this.editingRecordId = dto.id;
            const modalTitle = this.newRecordModal ? this.newRecordModal.querySelector('h4') : null;
            if (modalTitle) modalTitle.textContent = '✏️ Editar Atención N° ' + dto.id;
            const submitBtn = this.newRecordForm ? this.newRecordForm.querySelector('button[type="submit"]') : null;
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

            const elDefensoria = document.getElementById('newDefensoria');
            if (elDefensoria) elDefensoria.value = entity.defensoriaCategory.name;

            const isFamilia = entity.defensoriaCategory.name === 'CO-DEF. FAMILIA';
            if (this.familySubmotivoGroup) this.familySubmotivoGroup.style.display = isFamilia ? 'flex' : 'none';
            if (this.familyDerivacionGroup) this.familyDerivacionGroup.style.display = isFamilia ? 'flex' : 'none';

            if (isFamilia) {
                if (this.newModoDerivacionFamilia) this.newModoDerivacionFamilia.value = entity.modoDerivacionFamilia || 'Asesoramiento General';
                if (this.newCodefensoraAsignada) this.newCodefensoraAsignada.value = entity.codefensoraAsignada || '';
                if (this.newFechaVencimientoContestacion) this.newFechaVencimientoContestacion.value = entity.fechaVencimientoContestacion || '';
                if (this.fechaVencimientoGroup) {
                    this.fechaVencimientoGroup.style.display = (entity.modoDerivacionFamilia === 'Contestación de Demanda') ? 'flex' : 'none';
                }
            }

            let rawMotivo = entity.motivo || '';
            if (rawMotivo.startsWith('[')) {
                const idx = rawMotivo.indexOf(']');
                if (idx !== -1) {
                    const sub = rawMotivo.substring(1, idx).trim();
                    if (this.newFamilySubmotivoSelect) this.newFamilySubmotivoSelect.value = sub;
                    rawMotivo = rawMotivo.substring(idx + 1).trim();
                }
            }
            const elMotivo = document.getElementById('newMotivo');
            if (elMotivo) elMotivo.value = rawMotivo;

            const elResultado = document.getElementById('newResultado');
            if (elResultado) elResultado.value = entity.resultado;

            const elObs = document.getElementById('newObservaciones');
            if (elObs) elObs.value = entity.observaciones;

            if (this.newAtendidoPorInput) {
                this.newAtendidoPorInput.value = entity.atendidoPor;
                this.newAtendidoPorInput.readOnly = (!this.currentUser || !this.currentUser.isAdmin());
            }

            if (this.newTareaPendiente) this.newTareaPendiente.checked = entity.tareaPendiente;
            if (this.newDetallePendiente) this.newDetallePendiente.value = entity.detallePendiente || '';

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
            
            if (this.operatorBreakdownList) {
                let html = '';
                if (Object.keys(summary.operatorBreakdown).length === 0) {
                    html = '<span style="color: #94A3B8; font-size: 0.8rem;">Sin atenciones hoy</span>';
                } else {
                    for (const [operator, count] of Object.entries(summary.operatorBreakdown)) {
                        html += '<div style="display: flex; justify-content: space-between; font-size: 0.82rem; color: #E2E8F0;"><span style="font-weight: 600;">' + operator + '</span> <span style="background: rgba(255,255,255,0.1); padding: 0.1rem 0.4rem; border-radius: 4px; color: var(--mpd-gold);">' + count + '</span></div>';
                    }
                }
                this.operatorBreakdownList.innerHTML = html;
            }

            this.kpiTecnica.textContent = summary.derivacionesTecnica.toLocaleString();
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
            const current = this.tecnicaBreakdownPopover.style.display;
            this.tecnicaBreakdownPopover.style.display = (current === 'none' || !current) ? 'block' : 'none';
        }

        updateTecnicaFilterUI() {
            if (this.cardDerivadasTecnica) {
                if (this.activeTecnicaFilter) {
                    this.cardDerivadasTecnica.classList.add('active-filter-card');
                } else {
                    this.cardDerivadasTecnica.classList.remove('active-filter-card');
                }
            }
            if (this.tecnicaFilterBadge) {
                if (this.activeTecnicaFilter) {
                    this.tecnicaFilterBadge.style.display = 'flex';
                    let label = 'Filtro: Asistencia Técnica';
                    if (this.activeTecnicaCategory) {
                        label = 'Filtro: A. Técnica (' + this.activeTecnicaCategory + ')';
                    }
                    if (this.tecnicaFilterBadgeText) this.tecnicaFilterBadgeText.textContent = label;
                } else {
                    this.tecnicaFilterBadge.style.display = 'none';
                }
            }
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
                    (dto.defensoriaName === 'CO-DEF. FAMILIA' && dto.codefensoraAsignada ? '<div><span style="font-size: 0.75rem; color: #C63F95; text-transform: uppercase;">Co-Defensora Asignada</span><p style="font-weight: 700; color: #EC4899;">Dra. ' + dto.codefensoraAsignada.replace(/^Dra\.\s*/i, '') + '</p></div>' : '') +
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

                (dto.escritos ? '<div style="background: rgba(168, 10, 10, 0.15); padding: 1rem; border-radius: 6px; border: 1px solid rgba(168, 10, 10, 0.3);"><span style="font-size: 0.75rem; color: #F87171; text-transform: uppercase; display: block; margin-bottom: 0.35rem;">Escritos Judiciales</span><p style="font-size: 0.9rem; font-weight: 500;">' + dto.escritos + '</p></div>' : '') +
            '</div>';

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

                const formData = {
                    id: this.editingRecordId || undefined,
                    fecha: document.getElementById('newFecha').value,
                    actividad: document.getElementById('newActividad').value,
                    dni: document.getElementById('newDni').value,
                    apellidos: document.getElementById('newApellidos').value,
                    nombres: document.getElementById('newNombres').value,
                    celular: document.getElementById('newCelular').value,
                    expte: document.getElementById('newExpte').value,
                    motivo: motivoFinal,
                    defensoria: document.getElementById('newDefensoria').value,
                    resultado: elResultadoVal,
                    observaciones: document.getElementById('newObservaciones').value,
                    atendidoPor: document.getElementById('newAtendidoPor').value,
                    tareaPendiente: isTaskPending,
                    detallePendiente: taskDetail,
                    modoDerivacionFamilia: modoFamilia,
                    codefensoraAsignada: codefensora,
                    fechaVencimientoContestacion: vencimientoContestacion,
                    detalleReparticion: detalleReparticionVal,
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
                this.updateView();

                this.editingRecordId = null;
                this.newRecordModal.classList.remove('active');
                if (this.newRecordForm) this.newRecordForm.reset();
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

fs.writeFileSync(path.join(__dirname, 'dashboard-bundle.js'), bundleContent, 'utf8');
console.log('✅ Bundle actualizado con Módulo Completo de Tareas Pendientes.');
