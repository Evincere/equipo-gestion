import { ServiceContainer } from './infrastructure/config/ServiceContainer.js';

/**
 * Punto de Entrada de la Aplicación
 * Arranca la inyección de dependencias e inicializa el controlador UI
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando Sistema de Gestión de Atenciones - Ministerio Público de la Defensa (Mendoza)');
    console.log('🏛️ Arquitectura Hexagonal (Puertos y Adaptadores) cargada correctamente.');

    const services = ServiceContainer.create();
    await services.viewController.init();
});
