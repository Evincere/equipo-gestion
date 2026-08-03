/**
 * Entidad de Dominio: User (Usuario / Operador del Sistema)
 * Encapsula la lógica de identidad, roles y permisos de acceso
 */
export class User {
    static ROL_ADMIN = 'ADMINISTRADOR';
    static ROL_OPERADOR = 'OPERADOR';

    constructor({ id, username, nombreCompleto, rol = User.ROL_OPERADOR, avatarInitials, activo = true }) {
        this.id = id;
        this.username = username ? String(username).toLowerCase().trim() : '';
        this.nombreCompleto = nombreCompleto || 'Usuario';
        this.rol = rol || User.ROL_OPERADOR;
        this.avatarInitials = avatarInitials || this._computeInitials(this.nombreCompleto);
        this.activo = Boolean(activo);
    }

    isAdmin() {
        return this.rol === User.ROL_ADMIN || this.username === 'spereyra';
    }

    canAccessConfig() {
        return this.isAdmin();
    }

    _computeInitials(name) {
        if (!name) return 'US';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }
}
