export const BOOKING_ROLES = ['admin', 'gerente', 'coordenador', 'user'];

export function parseAllowedRoles(value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) {
    return value.map(String).map((r) => r.trim()).filter((r) => BOOKING_ROLES.includes(r));
  }
  return String(value)
    .split(',')
    .map((r) => r.trim())
    .filter((r) => BOOKING_ROLES.includes(r));
}

/** Lista vazia = todos os perfis podem agendar. */
export function canRoleBookRoom(role, allowedRoles) {
  const allowed = parseAllowedRoles(allowedRoles);
  if (allowed.length === 0) return true;
  return allowed.includes(role || 'user');
}

export function rolesForRoomForm(allowedRoles) {
  const parsed = parseAllowedRoles(allowedRoles);
  return parsed.length ? parsed : [...BOOKING_ROLES];
}
