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
        constructor({ id, fecha, actividad, dni, apellidos, nombres, celular, expte, motivo, defensoria, resultado, observaciones, atendidoPor, derivadoA, escritos, tarea_pendiente, tareaPendiente, detalle_pendiente, detallePendiente, tarea_cumplida_at, tareaCumplidaAt }) {
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
            this.atendidoPor = fixMojibake(atendidoPor) || 'Secretaría';
            this.derivadoA = fixMojibake(derivadoA);
            this.escritos = fixMojibake(escritos);

            this.tareaPendiente = Boolean(tarea_pendiente || tareaPendiente);
            this.detallePendiente = fixMojibake(detalle_pendiente || detallePendiente || '');
            this.tareaCumplidaAt = tarea_cumplida_at || tareaCumplidaAt || null;
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
                tareaCumplidaAt: entity.tareaCumplidaAt
            };
        }
    }

    // 6. Casos de Uso
    class GetAttendanceSummaryUseCase {
        execute(attendances) {
            const todayStr = normalizeDateStr(new Date().toLocaleDateString('es-AR'));
            const todayAttendances = attendances.filter(a => normalizeDateStr(a.fecha) === todayStr);
            
            const operatorBreakdown = {};
            todayAttendances.forEach(a => {
                const operator = a.atendidoPor || 'Secretaría';
                operatorBreakdown[operator] = (operatorBreakdown[operator] || 0) + 1;
            });

            return {
                total: attendances.length,
                derivacionesTecnica: attendances.filter(a => a.isDerivacionTecnica()).length,
                escritosCount: attendances.filter(a => a.hasEscritos()).length,
                pendientesCount: attendances.filter(a => a.tareaPendiente).length,
                totalToday: todayAttendances.length,
                operatorBreakdown
            };
        }
    }

    class SearchAttendancesUseCase {
        execute(attendances, { query = '', defensoria = '', resultado = '' }) {
            const q = query.toLowerCase().trim();
            const qCleanDni = q.replace(/\./g, '');
            const filtered = attendances.filter(item => {
                const matchesQuery = !q ||
                    item.dni.raw.toLowerCase().replace(/\./g, '').includes(qCleanDni) ||
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

                return matchesQuery && matchesDefensoria && matchesResultado;
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
                            tarea_cumplida_at: row.tarea_cumplida_at
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
                        detallePendiente: entity.detallePendiente
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.id) entity.id = Number(data.id);
                }
            } catch(e) {
                console.warn('Error enviando registro a API:', e.message);
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
                        detallePendiente: entity.detallePendiente
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
            this.kpiHoy = document.getElementById('kpiHoy');
            this.cardTotalAtenciones = document.getElementById('cardTotalAtenciones');
            this.operatorTooltip = document.getElementById('operatorTooltip');
            this.operatorBreakdownList = document.getElementById('operatorBreakdownList');
            this.kpiTecnica = document.getElementById('kpiTecnica');
            this.kpiEscritos = document.getElementById('kpiEscritos');
            this.kpiPendientes = document.getElementById('kpiPendientes');

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
            this.btnCloseApp = document.getElementById('btnCloseApp');

            this.presenceRosterContainer = document.getElementById('presenceRosterContainer');
            this.turnIndicatorBadge = document.getElementById('turnIndicatorBadge');
            this.newDefensoriaSelect = document.getElementById('newDefensoria');
            this.familySubmotivoGroup = document.getElementById('familySubmotivoGroup');
            this.newFamilySubmotivoSelect = document.getElementById('newFamilySubmotivo');
            this.newAtendidoPorInput = document.getElementById('newAtendidoPor');

            this.btnOnlineUsers = document.getElementById('btnOnlineUsers');
            this.onlineUsersPopover = document.getElementById('onlineUsersPopover');
            this.onlineUsersCountText = document.getElementById('onlineUsersCountText');
            this.onlineUsersBadgeCount = document.getElementById('onlineUsersBadgeCount');
            this.onlineUsersList = document.getElementById('onlineUsersList');
        }

        async init() {
            this.bindEvents();

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
                    if (this.loginUserSelect.value === 'spereyra') {
                        this.loginPassword.value = 'admin2026';
                    } else {
                        this.loginPassword.value = 'defensoria2026';
                    }
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

            if (this.navItemConfig) {
                this.navItemConfig.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.showConfigSection();
                });
            }

            if (this.adminUserForm) {
                this.adminUserForm.addEventListener('submit', (e) => this.handleAdminUserSubmit(e));
            }

            if (this.btnSearchDni) {
                this.btnSearchDni.addEventListener('click', () => this.performDniLookup());
            }

            if (this.newDniInput) {
                this.newDniInput.addEventListener('input', () => {
                    const clean = this.newDniInput.value.replace(/[^\\d]/g, '');
                    if (clean.length >= 7 && clean.length <= 9) {
                        this.performDniLookup();
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

            if (this.newDefensoriaSelect) {
                this.newDefensoriaSelect.addEventListener('change', () => {
                    if (this.newDefensoriaSelect.value === 'CO-DEF. FAMILIA') {
                        if (this.familySubmotivoGroup) this.familySubmotivoGroup.style.display = 'flex';
                        if (this.newAtendidoPorInput && this.proximaDefensoriaTurno) {
                            this.newAtendidoPorInput.value = \`Dra. \${this.proximaDefensoriaTurno}\`;
                        }
                    } else {
                        if (this.familySubmotivoGroup) this.familySubmotivoGroup.style.display = 'none';
                        if (this.newAtendidoPorInput && this.currentUser) {
                            this.newAtendidoPorInput.value = this.currentUser.nombreCompleto;
                        }
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

            if (this.btnCloseDetailModal) this.btnCloseDetailModal.addEventListener('click', () => this.detailModal.classList.remove('active'));
            if (this.btnNewRecord) this.btnNewRecord.addEventListener('click', () => this.openNewModal());
            if (this.btnNavNuevaAtencion) this.btnNavNuevaAtencion.addEventListener('click', (e) => { e.preventDefault(); this.openNewModal(); });
            if (this.btnCloseNewModal) this.btnCloseNewModal.addEventListener('click', () => this.newRecordModal.classList.remove('active'));
            if (this.newRecordForm) this.newRecordForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
            if (this.btnExportPDF) this.btnExportPDF.addEventListener('click', (e) => { e.preventDefault(); window.print(); });
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
                    <div style="background: rgba(30, 41, 59, 0.9); border: 1px solid rgba(0, 180, 216, 0.3); border-radius: 6px; padding: 0.75rem 1rem; margin-bottom: 0.5rem;">
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
            this.rawEntities = await this.repository.getAll();
            this.showDashboardSection();
            this.updateView();
            this.startAutoSyncPolling();
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

        logoutUser() {
            this.currentUser = null;
            localStorage.removeItem(SESSION_STORAGE_KEY);
            this.loginModal.classList.add('active');
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
            await this.loadAdminAuditTable();
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
                            const statusBadge = u.activo ? '<span class="badge badge-civil">Activo</span>' : '<span class="badge badge-penal">Dado de Baja</span>';
                            const actionBtn = isSelf ? '<span style="font-size:0.75rem; color:#C9B07A;">Admin Principal</span>' : 
                                (u.activo ? \`<button class="btn btn-secondary btn-baja-user" data-id="\${u.id}" data-username="\${u.username}" style="padding: 0.2rem 0.5rem; font-size:0.75rem; color:#F87171;">Dar de Baja</button>\` : '<span style="font-size:0.75rem; color:#64748B;">Inactivo</span>');

                            html += \`
                                <tr>
                                    <td><strong>\${u.username}</strong></td>
                                    <td>\${u.nombre_completo}</td>
                                    <td><span class="badge \${u.rol === 'ADMINISTRADOR' ? 'badge-familia' : 'badge-otro'}">\${u.rol}</span></td>
                                    <td>\${statusBadge}</td>
                                    <td>\${actionBtn}</td>
                                </tr>
                            \`;
                        });
                        this.adminUsersTableBody.innerHTML = html;

                        this.adminUsersTableBody.querySelectorAll('.btn-baja-user').forEach(btn => {
                            btn.addEventListener('click', async () => {
                                const username = btn.getAttribute('data-username');
                                const id = btn.getAttribute('data-id');
                                if (confirm(\`¿Confirmar dar de baja al operario \${username}?\`)) {
                                    await this.deactivateUser(id, username);
                                    await this.loadAdminUsersTable();
                                }
                            });
                        });
                    }
                }
            } catch(e) {}
        }

        async deactivateUser(id, username) {
            try {
                await fetch(getApiUrl('/api/admin/usuarios/baja'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, username, adminOperatorName: this.currentUser.nombreCompleto })
                });
                alert(\`Operario \${username} dado de baja correctamente.\`);
            } catch(e) {
                alert('Error al dar de baja usuario');
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
                            html += \`
                                <tr>
                                    <td><span style="font-family: var(--font-mono); font-size: 0.78rem;">\${a.timestamp}</span></td>
                                    <td><strong>\${a.usuario_nombre}</strong></td>
                                    <td><span class="badge badge-familia">\${a.accion}</span></td>
                                    <td>\${a.detalle}</td>
                                </tr>
                            \`;
                        });
                        this.adminAuditTableBody.innerHTML = html;
                    }
                }
            } catch(e) {}
        }

        async handleAdminUserSubmit(e) {
            e.preventDefault();
            const username = document.getElementById('adminUsername').value;
            const nombreCompleto = document.getElementById('adminNombreCompleto').value;
            const rol = document.getElementById('adminRol').value;
            const password = document.getElementById('adminPassword').value;

            try {
                const res = await fetch(getApiUrl('/api/admin/usuarios'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username,
                        nombreCompleto,
                        rol,
                        password,
                        adminOperatorName: this.currentUser.nombreCompleto
                    })
                });

                if (res.ok) {
                    alert(\`Usuario \${username} guardado correctamente.\`);
                    this.adminUserForm.reset();
                    await this.loadAdminUsersTable();
                }
            } catch(err) {
                alert('Error al guardar usuario en SQLite');
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
                html += \`
                    <div class="presence-pill \${statusClass}" data-name="\${c.nombre}" title="Clic para cambiar presencia/ausencia">
                        <span class="dot"></span>
                        <span>Dra. \${c.nombre} (\${statusText})</span>
                    </div>
                \`;
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

        async calculateProximoTurno() {
            try {
                const res = await fetch(getApiUrl('/api/familia/proximo-turno'));
                if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.proximaDefensoria) {
                        this.proximaDefensoriaTurno = data.proximaDefensoria;
                        if (this.turnIndicatorBadge) {
                            this.turnIndicatorBadge.textContent = \`Próximo Turno: Dra. \${data.proximaDefensoria}\`;
                        }
                        return;
                    }
                }
            } catch(e) {}

            const presentes = this.codefensorasRoster.filter(c => c.isPresente);
            if (presentes.length > 0) {
                this.proximaDefensoriaTurno = presentes[0].nombre;
                if (this.turnIndicatorBadge) {
                    this.turnIndicatorBadge.textContent = 'Próximo Turno: Dra. ' + presentes[0].nombre;
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

            await this.calculateProximoTurno();
            if (this.newDniInput) this.newDniInput.value = '';
            const elFecha = document.getElementById('newFecha');
            if (elFecha) elFecha.value = normalizeDateStr(new Date().toLocaleDateString('es-AR'));
            const elMotivo = document.getElementById('newMotivo');
            if (elMotivo) elMotivo.value = 'Espontánea';

            if (this.newTareaPendiente) this.newTareaPendiente.checked = false;
            if (this.newDetallePendiente) this.newDetallePendiente.value = '';
            if (this.dniStatusBadge) {
                this.dniStatusBadge.className = 'badge badge-otro';
                this.dniStatusBadge.textContent = 'Ingrese DNI';
            }
            if (this.citizenHistoryContainer) this.citizenHistoryContainer.style.display = 'none';

            if (this.newDefensoriaSelect && this.newDefensoriaSelect.value === 'CO-DEF. FAMILIA') {
                if (this.newAtendidoPorInput && this.proximaDefensoriaTurno) {
                    this.newAtendidoPorInput.value = 'Dra. ' + this.proximaDefensoriaTurno;
                }
            } else {
                if (this.newAtendidoPorInput && this.currentUser) {
                    this.newAtendidoPorInput.value = this.currentUser.nombreCompleto;
                }
            }
            this.newRecordModal.classList.add('active');
        }

        openEditModal(dto) {
            const entity = this.rawEntities.find(e => e.id === dto.id);
            if (!entity) return;

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

            const elMotivo = document.getElementById('newMotivo');
            if (elMotivo) elMotivo.value = entity.motivo;

            const elResultado = document.getElementById('newResultado');
            if (elResultado) elResultado.value = entity.resultado;

            const elObs = document.getElementById('newObservaciones');
            if (elObs) elObs.value = entity.observaciones;

            if (this.newAtendidoPorInput) this.newAtendidoPorInput.value = entity.atendidoPor;

            if (this.newTareaPendiente) this.newTareaPendiente.checked = entity.tareaPendiente;
            if (this.newDetallePendiente) this.newDetallePendiente.value = entity.detallePendiente || '';

            this.newRecordModal.classList.add('active');
        }

        updateView() {
            const filters = {
                query: this.searchInput.value,
                defensoria: this.filterDefensoria.value,
                resultado: this.filterResultado.value
            };
            this.currentDTOs = this.searchAttendancesUseCase.execute(this.rawEntities, filters);
            const filteredEntities = this.rawEntities.filter(e => this.currentDTOs.some(d => d.id === e.id));
            const summary = this.getSummaryUseCase.execute(filteredEntities);

            this.kpiTotal.textContent = summary.total.toLocaleString();
            if (this.kpiHoy) this.kpiHoy.textContent = summary.totalToday.toLocaleString();
            
            if (this.operatorBreakdownList) {
                let html = '';
                if (Object.keys(summary.operatorBreakdown).length === 0) {
                    html = '<span style="color: #94A3B8; font-size: 0.8rem;">Sin atenciones hoy</span>';
                } else {
                    for (const [operator, count] of Object.entries(summary.operatorBreakdown)) {
                        html += \`<div style="display: flex; justify-content: space-between; font-size: 0.82rem; color: #E2E8F0;"><span style="font-weight: 600;">\${operator}</span> <span style="background: rgba(255,255,255,0.1); padding: 0.1rem 0.4rem; border-radius: 4px; color: var(--mpd-gold);">\${count}</span></div>\`;
                    }
                }
                this.operatorBreakdownList.innerHTML = html;
            }

            this.kpiTecnica.textContent = summary.derivacionesTecnica.toLocaleString();
            this.kpiEscritos.textContent = summary.escritosCount.toLocaleString();
            if (this.kpiPendientes) this.kpiPendientes.textContent = summary.pendientesCount.toLocaleString();

            this.renderPaginatedTable();
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
            if (this.pageIndicator) this.pageIndicator.textContent = \`Página \${this.currentPage} de \${maxPages}\`;

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
                    \`<span class="badge" style="background: rgba(245, 158, 11, 0.2); border: 1px solid #F59E0B; color: #FBBF24;"><i class="ri-time-line"></i> Pendiente</span>
                     \${dto.detallePendiente ? \`<span style="display:block; font-size:0.75rem; color:#FBBF24; margin-top:0.2rem;">\${dto.detallePendiente}</span>\` : ''}\`
                    : \`<span>\${dto.resultado}</span>\`;

                const actionBtn = isPending ?
                    \`<button class="btn btn-secondary btn-complete-task" data-id="\${dto.id}" title="Marcar tarea como cumplida" style="padding: 0.25rem 0.6rem; font-size: 0.78rem; color: #4ADE80; border-color: rgba(74, 222, 128, 0.4);"><i class="ri-check-double-line"></i> Cumplir</button>\`
                    : \`<button class="btn btn-secondary btn-toggle-pending" data-id="\${dto.id}" title="Marcar con tarea pendiente" style="padding: 0.25rem 0.5rem; font-size: 0.78rem; color: #FBBF24; opacity: 0.6;"><i class="ri-time-line"></i></button>\`;

                const editBtn = \`<button class="btn btn-secondary btn-edit-record" data-id="\${dto.id}" title="Editar registro" style="padding: 0.25rem 0.5rem; font-size: 0.78rem; color: #38BDF8; border-color: rgba(56, 189, 248, 0.4); margin-left: 0.25rem;"><i class="ri-edit-line"></i></button>\`;

                html += \`
                    <tr class="\${rowClass}" data-id="\${dto.id}" style="\${rowStyle}">
                        <td>\${dto.fecha || 's/f'}</td>
                        <td>
                            <span class="citizen-name">\${dto.fullName}</span>
                            <span class="citizen-dni">\${dto.dniFormatted}</span>
                        </td>
                        <td><span class="expte-number">\${dto.expte || dto.motivo || 'Atención General'}</span></td>
                        <td><span class="badge \${dto.defensoriaBadgeClass}">\${dto.defensoriaName}</span></td>
                        <td>\${statusHtml}</td>
                        <td>\${dto.atendidoPor}</td>
                        <td onclick="event.stopPropagation();">\${actionBtn}\${editBtn}</td>
                    </tr>
                \`;
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

            this.detailModalBody.innerHTML = \`
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    <div style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.75rem; display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <h3 style="font-size: 1.3rem; color: #FFF;">\${dto.fullName}</h3>
                            <p style="font-size: 0.85rem; color: #00B4D8; margin-top: 0.2rem;">DNI: \${dto.dniFormatted} | Celular: \${dto.celular || 'No posee'}</p>
                        </div>
                        <div style="display:flex; gap:0.5rem; align-items:center;">
                            <button id="btnModalEditRecord" class="btn" style="background: rgba(56, 189, 248, 0.2); border: 1px solid #38BDF8; color: #38BDF8; font-size:0.85rem; padding:0.4rem 0.8rem;" title="Editar este registro">
                                <i class="ri-edit-line"></i> Editar
                            </button>
                            <button id="btnModalToggleTask" class="btn" style="\${toggleTaskBtnColor} font-size:0.85rem; padding:0.4rem 0.8rem;">
                                \${toggleTaskBtnText}
                            </button>
                            <button id="btnModalDeleteRecord" class="btn" style="background: rgba(239, 68, 68, 0.2); border: 1px solid #EF4444; color: #F87171; font-size:0.85rem; padding:0.4rem 0.8rem;" title="Eliminar este registro">
                                <i class="ri-delete-bin-line"></i> Eliminar
                            </button>
                        </div>
                    </div>

                    \${isPending ? \`<div style="background: rgba(245, 158, 11, 0.15); border: 1px solid #F59E0B; padding: 0.75rem 1rem; border-radius: 6px;"><strong style="color: #FBBF24; display:block; margin-bottom: 0.2rem;"><i class="ri-time-line"></i> Tarea Pendiente de Resolución:</strong><p style="color: #FFF; font-size: 0.9rem;">\${dto.detallePendiente || 'Trámite pendiente de seguimiento'}</p></div>\` : ''}

                    <div class="form-grid">
                        <div><span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase;">Fecha</span><p style="font-weight: 600;">\${dto.fecha}</p></div>
                        <div><span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase;">Actividad</span><p style="font-weight: 600;">\${dto.actividad}</p></div>
                        <div><span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase;">N° Expte</span><p style="font-weight: 600; color: #00B4D8;">\${dto.expte || 'Sin Expte.'}</p></div>
                        <div><span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase;">Defensoría</span><p><span class="badge \${dto.defensoriaBadgeClass}">\${dto.defensoriaName}</span></p></div>
                        <div><span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase;">Resultado</span><p style="font-weight: 600;">\${dto.resultado}</p></div>
                        <div><span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase;">Atendido Por / Operador</span><p style="font-weight: 600;">\${dto.atendidoPor}</p></div>
                    </div>
                    \${dto.observaciones ? \`<div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); margin-top: 0.5rem;"><span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase; display: block; margin-bottom: 0.35rem;">Observaciones</span><p style="font-size: 0.9rem; line-height: 1.5;">\${dto.observaciones}</p></div>\` : ''}
                    \${dto.escritos ? \`<div style="background: rgba(168, 10, 10, 0.15); padding: 1rem; border-radius: 6px; border: 1px solid rgba(168, 10, 10, 0.3);"><span style="font-size: 0.75rem; color: #F87171; text-transform: uppercase; display: block; margin-bottom: 0.35rem;">Escritos Judiciales</span><p style="font-size: 0.9rem; font-weight: 500;">\${dto.escritos}</p></div>\` : ''}
                </div>
            \`;

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

            this.detailModal.classList.add('active');
        }

        async deleteRecord(id) {
            try {
                await fetch(getApiUrl('/api/atenciones?id=' + id), { method: 'DELETE' });
                showToast('Atención N° ' + id + ' eliminada correctamente.', 'info');
            } catch (e) {
                console.warn('Error al eliminar registro:', e.message);
                showToast('Error al eliminar registro.', 'error');
            }
            this.rawEntities = this.rawEntities.filter(e => e.id !== id);
            this.updateView();
        }

        async handleFormSubmit(e) {
            e.preventDefault();

            let motivoFinal = document.getElementById('newMotivo').value;
            if (this.newDefensoriaSelect.value === 'CO-DEF. FAMILIA' && this.newFamilySubmotivoSelect) {
                if (!motivoFinal.startsWith('[')) {
                    motivoFinal = ('[' + this.newFamilySubmotivoSelect.value + '] ' + motivoFinal).trim();
                }
            }

            const isTaskPending = this.newTareaPendiente ? this.newTareaPendiente.checked : false;
            const taskDetail = this.newDetallePendiente ? this.newDetallePendiente.value : '';

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
                resultado: document.getElementById('newResultado').value,
                observaciones: document.getElementById('newObservaciones').value,
                atendidoPor: document.getElementById('newAtendidoPor').value,
                tareaPendiente: isTaskPending,
                detallePendiente: taskDetail,
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
            this.newRecordForm.reset();
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
