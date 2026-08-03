/* ==========================================================================
   JUSTICIA & GESTIÓN - MINISTERIO PÚBLICO DE LA DEFENSA (PROVINCIA DE MENDOZA)
   Lógica JavaScript: Carga CSV, Búsqueda, Filtrado y Gestión de Atenciones
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    let allRecords = [];
    let filteredRecords = [];

    // Elementos DOM
    const tableBody = document.getElementById('tableBody');
    const searchInput = document.getElementById('searchInput');
    const filterDefensoria = document.getElementById('filterDefensoria');
    const filterResultado = document.getElementById('filterResultado');
    
    const kpiTotal = document.getElementById('kpiTotal');
    const kpiTecnica = document.getElementById('kpiTecnica');
    const kpiEscritos = document.getElementById('kpiEscritos');

    const detailModal = document.getElementById('detailModal');
    const detailModalBody = document.getElementById('detailModalBody');
    const btnCloseDetailModal = document.getElementById('btnCloseDetailModal');

    const newRecordModal = document.getElementById('newRecordModal');
    const btnNewRecord = document.getElementById('btnNewRecord');
    const btnNavNuevaAtencion = document.getElementById('btnNavNuevaAtencion');
    const btnCloseNewModal = document.getElementById('btnCloseNewModal');
    const newRecordForm = document.getElementById('newRecordForm');
    const btnExportPDF = document.getElementById('btnExportPDF');

    // 1. Cargar y parsear atenciones.csv
    fetch('atenciones.csv')
        .then(response => {
            if (!response.ok) throw new Error('No se pudo cargar el archivo CSV');
            return response.text();
        })
        .then(csvText => {
            allRecords = parseCSV(csvText);
            filteredRecords = [...allRecords];
            updateKPIs(filteredRecords);
            renderTable(filteredRecords.slice(0, 100)); // Mostrar primeras 100 para rendimiento fluido
        })
        .catch(err => {
            console.error('Error cargando CSV:', err);
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: #F87171;">Error al cargar atenciones.csv: ${err.message}</td></tr>`;
        });

    // Parseador CSV que contempla comillas y comas internas
    function parseCSV(text) {
        const lines = text.split(/\r\n|\n/);
        if (lines.length < 2) return [];

        const records = [];
        
        // Empezar desde la línea 1 (omitir encabezado)
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cols = parseCSVLine(line);
            if (cols.length < 4) continue;

            const fecha = cols[0] ? cols[0].trim() : '';
            const actividad = cols[1] ? cols[1].trim() : '';
            const dni = cols[2] ? cols[2].trim() : '';
            const apellidos = cols[3] ? cols[3].trim() : '';
            const nombres = cols[4] ? cols[4].trim() : '';
            const celular = cols[5] ? cols[5].trim() : '';
            const expte = cols[6] ? cols[6].trim() : '';
            const motivo = cols[7] ? cols[7].trim() : '';
            const defensoria = cols[8] ? cols[8].trim() : '';
            const resultado = cols[9] ? cols[9].trim() : '';
            const observaciones = cols[10] ? cols[10].trim() : '';
            const atendidoPor = cols[11] ? cols[11].trim() : '';
            const derivadoA = cols[12] ? cols[12].trim() : '';
            const escritos = cols[13] ? cols[13].trim() : '';

            // Solo agregar si tiene datos mínimos (Fecha o Apellidos o DNI)
            if (fecha || apellidos || dni) {
                records.push({
                    id: i,
                    fecha,
                    actividad,
                    dni,
                    apellidos,
                    nombres,
                    celular,
                    expte,
                    motivo,
                    defensoria,
                    resultado,
                    observaciones,
                    atendidoPor,
                    derivadoA,
                    escritos
                });
            }
        }
        return records;
    }

    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        return result;
    }

    // 2. Renderizar Tabla
    function renderTable(records) {
        if (records.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #94A3B8;">No se encontraron registros coincidentes.</td></tr>`;
            return;
        }

        let html = '';
        records.forEach(rec => {
            const badgeClass = getBadgeClass(rec.defensoria);
            const fullname = `${rec.apellidos} ${rec.nombres}`.trim() || 'CIUDADANO NO REGISTRADO';
            const dniText = rec.dni ? `DNI: ${rec.dni}` : 'SIN DNI';
            const expteText = rec.expte ? rec.expte : (rec.motivo || 'Atención General');

            html += `
                <tr data-id="${rec.id}">
                    <td>${rec.fecha || 's/f'}</td>
                    <td>
                        <span class="citizen-name">${fullname}</span>
                        <span class="citizen-dni">${dniText}</span>
                    </td>
                    <td>
                        <span class="expte-number">${expteText}</span>
                    </td>
                    <td><span class="badge ${badgeClass}">${rec.defensoria || 'Sin Asignar'}</span></td>
                    <td>${rec.resultado || 'En trámite'}</td>
                    <td>${rec.atendidoPor || 'Secretaría'}</td>
                </tr>
            `;
        });

        tableBody.innerHTML = html;

        // Event Listeners en cada fila para abrir modal de detalle
        tableBody.querySelectorAll('tr').forEach(row => {
            row.addEventListener('click', () => {
                const id = row.getAttribute('data-id');
                const rec = allRecords.find(r => r.id == id);
                if (rec) openDetailModal(rec);
            });
        });
    }

    function getBadgeClass(defensoria) {
        if (!defensoria) return 'badge-otro';
        const d = defensoria.toUpperCase();
        if (d.includes('FAMILIA')) return 'badge-familia';
        if (d.includes('CIVIL')) return 'badge-civil';
        if (d.includes('PENAL') && !d.includes('EJECUCIÓN')) return 'badge-penal';
        if (d.includes('EJECUCIÓN')) return 'badge-ejecucion';
        return 'badge-otro';
    }

    // 3. Actualizar KPIs
    function updateKPIs(records) {
        kpiTotal.textContent = records.length.toLocaleString();
        
        const derivadasTecnica = records.filter(r => (r.resultado && r.resultado.includes('Técnica')) || (r.derivadoA && r.derivadoA.includes('Técnica'))).length;
        kpiTecnica.textContent = derivadasTecnica.toLocaleString();

        const escritosCount = records.filter(r => r.escritos && r.escritos.trim().length > 0).length;
        kpiEscritos.textContent = escritosCount.toLocaleString();
    }

    // 4. Filtrado y Búsqueda en Tiempo Real
    function applyFilters() {
        const query = searchInput.value.toLowerCase().trim();
        const defFilter = filterDefensoria.value;
        const resFilter = filterResultado.value;

        filteredRecords = allRecords.filter(r => {
            const matchesQuery = !query || 
                (r.dni && r.dni.toLowerCase().includes(query)) ||
                (r.apellidos && r.apellidos.toLowerCase().includes(query)) ||
                (r.nombres && r.nombres.toLowerCase().includes(query)) ||
                (r.expte && r.expte.toLowerCase().includes(query)) ||
                (r.observaciones && r.observaciones.toLowerCase().includes(query));

            const matchesDef = !defFilter || r.defensoria === defFilter;
            const matchesRes = !resFilter || r.resultado === resFilter;

            return matchesQuery && matchesDef && matchesRes;
        });

        updateKPIs(filteredRecords);
        renderTable(filteredRecords.slice(0, 100));
    }

    searchInput.addEventListener('input', applyFilters);
    filterDefensoria.addEventListener('change', applyFilters);
    filterResultado.addEventListener('change', applyFilters);

    // 5. Modal de Detalle
    function openDetailModal(rec) {
        detailModalBody.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <div style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.75rem;">
                    <h3 style="font-size: 1.3rem; color: #FFF;">${rec.apellidos} ${rec.nombres}</h3>
                    <p style="font-size: 0.85rem; color: #00B4D8; margin-top: 0.2rem;">DNI: ${rec.dni || 'Sin registrar'} | Celular: ${rec.celular || 'No posee'}</p>
                </div>

                <div class="form-grid">
                    <div>
                        <span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase;">Fecha de Atención</span>
                        <p style="font-weight: 600;">${rec.fecha || 'N/A'}</p>
                    </div>
                    <div>
                        <span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase;">Tipo de Actividad</span>
                        <p style="font-weight: 600;">${rec.actividad || 'Atención Personal'}</p>
                    </div>
                    <div>
                        <span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase;">N° de Expediente</span>
                        <p style="font-weight: 600; color: #00B4D8;">${rec.expte || 'Sin Expte.'}</p>
                    </div>
                    <div>
                        <span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase;">Defensoría / Área</span>
                        <p><span class="badge ${getBadgeClass(rec.defensoria)}">${rec.defensoria || 'Sin asignar'}</span></p>
                    </div>
                    <div>
                        <span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase;">Resultado / Estado</span>
                        <p style="font-weight: 600;">${rec.resultado || 'En trámite'}</p>
                    </div>
                    <div>
                        <span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase;">Atendido Por</span>
                        <p style="font-weight: 600;">${rec.atendidoPor || 'Secretaría'}</p>
                    </div>
                </div>

                ${rec.observaciones ? `
                    <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); margin-top: 0.5rem;">
                        <span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase; display: block; margin-bottom: 0.35rem;">Observaciones del Caso</span>
                        <p style="font-size: 0.9rem; line-height: 1.5;">${rec.observaciones}</p>
                    </div>
                ` : ''}

                ${rec.escritos ? `
                    <div style="background: rgba(168, 10, 10, 0.15); padding: 1rem; border-radius: 6px; border: 1px solid rgba(168, 10, 10, 0.3);">
                        <span style="font-size: 0.75rem; color: #F87171; text-transform: uppercase; display: block; margin-bottom: 0.35rem;"><i class="ri-draft-line"></i> Escritos Judiciales Registrados</span>
                        <p style="font-size: 0.9rem; font-weight: 500;">${rec.escritos}</p>
                    </div>
                ` : ''}
            </div>
        `;
        detailModal.classList.add('active');
    }

    btnCloseDetailModal.addEventListener('click', () => {
        detailModal.classList.remove('active');
    });

    // 6. Modal Nueva Atención
    function openNewRecordModal() {
        newRecordModal.classList.add('active');
    }

    btnNewRecord.addEventListener('click', openNewRecordModal);
    if (btnNavNuevaAtencion) btnNavNuevaAtencion.addEventListener('click', (e) => {
        e.preventDefault();
        openNewRecordModal();
    });

    btnCloseNewModal.addEventListener('click', () => {
        newRecordModal.classList.remove('active');
    });

    newRecordForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const newRec = {
            id: Date.now(),
            fecha: document.getElementById('newFecha').value,
            actividad: document.getElementById('newActividad').value,
            dni: document.getElementById('newDni').value,
            apellidos: document.getElementById('newApellidos').value.toUpperCase(),
            nombres: document.getElementById('newNombres').value.toUpperCase(),
            celular: document.getElementById('newCelular').value,
            expte: document.getElementById('newExpte').value,
            motivo: document.getElementById('newMotivo').value,
            defensoria: document.getElementById('newDefensoria').value,
            resultado: document.getElementById('newResultado').value,
            observaciones: document.getElementById('newObservaciones').value,
            atendidoPor: document.getElementById('newAtendidoPor').value,
            derivadoA: '',
            escritos: ''
        };

        allRecords.unshift(newRec);
        filteredRecords.unshift(newRec);

        updateKPIs(filteredRecords);
        renderTable(filteredRecords.slice(0, 100));

        newRecordModal.classList.remove('active');
        newRecordForm.reset();
        alert('¡Atención registrada correctamente!');
    });

    // Exportar / Imprimir PDF
    if (btnExportPDF) {
        btnExportPDF.addEventListener('click', (e) => {
            e.preventDefault();
            window.print();
        });
    }

    // Botón de Cierre de App (simulación Aero)
    const btnCloseApp = document.getElementById('btnCloseApp');
    if (btnCloseApp) {
        btnCloseApp.addEventListener('click', () => {
            if (confirm('¿Desea cerrar la aplicación de Gestión de Atenciones?')) {
                document.querySelector('.aero-window').style.opacity = '0';
                setTimeout(() => {
                    alert('Sesión de administración finalizada.');
                    document.querySelector('.aero-window').style.opacity = '1';
                }, 400);
            }
        });
    }
});
