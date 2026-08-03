/**
 * Controlador de la Vista (UI Adapter / Controller)
 * Responsabilidad: Manejar eventos DOM y conectar la UI con los Casos de Uso
 */
export class DashboardViewController {
    constructor({ getSummaryUseCase, searchAttendancesUseCase, createAttendanceUseCase, attendanceRepository }) {
        this.getSummaryUseCase = getSummaryUseCase;
        this.searchAttendancesUseCase = searchAttendancesUseCase;
        this.createAttendanceUseCase = createAttendanceUseCase;
        this.repository = attendanceRepository;

        this.rawEntities = [];
        this.currentDTOs = [];

        this.initDOMReferences();
    }

    initDOMReferences() {
        this.tableBody = document.getElementById('tableBody');
        this.searchInput = document.getElementById('searchInput');
        this.filterDefensoria = document.getElementById('filterDefensoria');
        this.filterResultado = document.getElementById('filterResultado');
        
        this.kpiTotal = document.getElementById('kpiTotal');
        this.kpiTecnica = document.getElementById('kpiTecnica');
        this.kpiEscritos = document.getElementById('kpiEscritos');

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
    }

    async init() {
        this.bindEvents();
        try {
            this.rawEntities = await this.repository.getAll();
            this.updateView();
        } catch (error) {
            console.error('Error al inicializar controlador:', error);
            this.tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #F87171;">Error al cargar datos: ${error.message}</td></tr>`;
        }
    }

    bindEvents() {
        this.searchInput.addEventListener('input', () => this.updateView());
        this.filterDefensoria.addEventListener('change', () => this.updateView());
        this.filterResultado.addEventListener('change', () => this.updateView());

        if (this.btnCloseDetailModal) {
            this.btnCloseDetailModal.addEventListener('click', () => this.closeDetailModal());
        }

        if (this.btnNewRecord) {
            this.btnNewRecord.addEventListener('click', () => this.openNewModal());
        }

        if (this.btnNavNuevaAtencion) {
            this.btnNavNuevaAtencion.addEventListener('click', (e) => {
                e.preventDefault();
                this.openNewModal();
            });
        }

        if (this.btnCloseNewModal) {
            this.btnCloseNewModal.addEventListener('click', () => this.closeNewModal());
        }

        if (this.newRecordForm) {
            this.newRecordForm.addEventListener('submit', (e) => this.handleNewRecordSubmit(e));
        }

        if (this.btnExportPDF) {
            this.btnExportPDF.addEventListener('click', (e) => {
                e.preventDefault();
                window.print();
            });
        }

        if (this.btnCloseApp) {
            this.btnCloseApp.addEventListener('click', () => {
                if (confirm('¿Desea cerrar la sesión de la Defensoría Pública?')) {
                    document.querySelector('.aero-window').style.opacity = '0';
                    setTimeout(() => {
                        alert('Sesión finalizada.');
                        document.querySelector('.aero-window').style.opacity = '1';
                    }, 400);
                }
            });
        }
    }

    updateView() {
        const filters = {
            query: this.searchInput.value,
            defensoria: this.filterDefensoria.value,
            resultado: this.filterResultado.value
        };

        // Ejecutar Casos de Uso
        this.currentDTOs = this.searchAttendancesUseCase.execute(this.rawEntities, filters);
        
        // Filtrar entidades correspondientes a los DTOs devueltos para el resumen KPI
        const filteredEntities = this.rawEntities.filter(e => 
            this.currentDTOs.some(dto => dto.id === e.id)
        );
        
        const summary = this.getSummaryUseCase.execute(filteredEntities);

        // Actualizar KPIs en UI
        this.kpiTotal.textContent = summary.total.toLocaleString();
        this.kpiTecnica.textContent = summary.derivacionesTecnica.toLocaleString();
        this.kpiEscritos.textContent = summary.escritosCount.toLocaleString();

        // Renderizar Tabla (primeras 100)
        this.renderTable(this.currentDTOs.slice(0, 100));
    }

    renderTable(dtos) {
        if (dtos.length === 0) {
            this.tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #94A3B8;">No se encontraron atenciones coincidentes.</td></tr>`;
            return;
        }

        let html = '';
        dtos.forEach(dto => {
            html += `
                <tr data-id="${dto.id}">
                    <td>${dto.fecha || 's/f'}</td>
                    <td>
                        <span class="citizen-name">${dto.fullName}</span>
                        <span class="citizen-dni">${dto.dniFormatted}</span>
                    </td>
                    <td>
                        <span class="expte-number">${dto.expte || dto.motivo || 'Atención General'}</span>
                    </td>
                    <td><span class="badge ${dto.defensoriaBadgeClass}">${dto.defensoriaName}</span></td>
                    <td>${dto.resultado}</td>
                    <td>${dto.atendidoPor}</td>
                </tr>
            `;
        });

        this.tableBody.innerHTML = html;

        this.tableBody.querySelectorAll('tr').forEach(row => {
            row.addEventListener('click', () => {
                const id = row.getAttribute('data-id');
                const dto = this.currentDTOs.find(d => d.id == id);
                if (dto) this.openDetailModal(dto);
            });
        });
    }

    openDetailModal(dto) {
        this.detailModalBody.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <div style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.75rem;">
                    <h3 style="font-size: 1.3rem; color: #FFF;">${dto.fullName}</h3>
                    <p style="font-size: 0.85rem; color: #00B4D8; margin-top: 0.2rem;">DNI Formateado: ${dto.dniFormatted} | DNI Raw: ${dto.dniRaw || 'N/A'} | Celular: ${dto.celular || 'No posee'}</p>
                </div>

                <div class="form-grid">
                    <div>
                        <span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase;">Fecha de Atención</span>
                        <p style="font-weight: 600;">${dto.fecha}</p>
                    </div>
                    <div>
                        <span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase;">Tipo de Actividad</span>
                        <p style="font-weight: 600;">${dto.actividad}</p>
                    </div>
                    <div>
                        <span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase;">N° de Expediente</span>
                        <p style="font-weight: 600; color: #00B4D8;">${dto.expte || 'Sin Expte.'}</p>
                    </div>
                    <div>
                        <span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase;">Defensoría / Área</span>
                        <p><span class="badge ${dto.defensoriaBadgeClass}">${dto.defensoriaName}</span></p>
                    </div>
                    <div>
                        <span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase;">Resultado / Estado</span>
                        <p style="font-weight: 600;">${dto.resultado}</p>
                    </div>
                    <div>
                        <span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase;">Atendido Por</span>
                        <p style="font-weight: 600;">${dto.atendidoPor}</p>
                    </div>
                </div>

                ${dto.observaciones ? `
                    <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); margin-top: 0.5rem;">
                        <span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase; display: block; margin-bottom: 0.35rem;">Observaciones del Caso</span>
                        <p style="font-size: 0.9rem; line-height: 1.5;">${dto.observaciones}</p>
                    </div>
                ` : ''}

                ${dto.escritos ? `
                    <div style="background: rgba(168, 10, 10, 0.15); padding: 1rem; border-radius: 6px; border: 1px solid rgba(168, 10, 10, 0.3);">
                        <span style="font-size: 0.75rem; color: #F87171; text-transform: uppercase; display: block; margin-bottom: 0.35rem;"><i class="ri-draft-line"></i> Escritos Judiciales Registrados</span>
                        <p style="font-size: 0.9rem; font-weight: 500;">${dto.escritos}</p>
                    </div>
                ` : ''}
            </div>
        `;
        this.detailModal.classList.add('active');
    }

    closeDetailModal() {
        this.detailModal.classList.remove('active');
    }

    openNewModal() {
        this.newRecordModal.classList.add('active');
    }

    closeNewModal() {
        this.newRecordModal.classList.remove('active');
    }

    async handleNewRecordSubmit(e) {
        e.preventDefault();

        const formData = {
            fecha: document.getElementById('newFecha').value,
            actividad: document.getElementById('newActividad').value,
            dni: document.getElementById('newDni').value,
            apellidos: document.getElementById('newApellidos').value,
            nombres: document.getElementById('newNombres').value,
            celular: document.getElementById('newCelular').value,
            expte: document.getElementById('newExpte').value,
            motivo: document.getElementById('newMotivo').value,
            defensoria: document.getElementById('newDefensoria').value,
            resultado: document.getElementById('newResultado').value,
            observaciones: document.getElementById('newObservaciones').value,
            atendidoPor: document.getElementById('newAtendidoPor').value
        };

        const newDTO = await this.createAttendanceUseCase.execute(formData);
        
        // Refrescar entidad y lista
        this.rawEntities = await this.repository.getAll();
        this.updateView();

        this.closeNewModal();
        this.newRecordForm.reset();
        alert(`¡Atención creada correctamente para ${newDTO.fullName}!`);
    }
}
