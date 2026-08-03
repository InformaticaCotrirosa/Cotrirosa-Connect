/**
 * Helpers de envolvimento em eventos do calendário.
 * A API usa organizer_id (não created_by_id).
 */

export function getEventOrganizerId(event) {
  return event?.organizer_id ?? event?.created_by_id ?? null;
}

export function isUserOrganizer(event, userId) {
  if (!userId || !event) return false;
  return String(getEventOrganizerId(event)) === String(userId);
}

export function isUserParticipant(event, userId) {
  if (!userId || !event) return false;
  return Array.isArray(event.participants)
    && event.participants.some((p) => String(p) === String(userId));
}

/** Organizador ou listado em participants */
export function isUserInvolvedInEvent(event, userId) {
  return isUserOrganizer(event, userId) || isUserParticipant(event, userId);
}

/**
 * Envolvido via organizador, participantes ou convite (não recusado).
 * @param {object} event
 * @param {string} userId
 * @param {Iterable<string>|Set<string>} [invitedEventIds] — ids de eventos com convite do usuário
 */
export function isUserInvolvedInEventOrInvite(event, userId, invitedEventIds) {
  if (!event || event.status === 'cancelado') return false;
  if (isUserInvolvedInEvent(event, userId)) return true;
  if (!invitedEventIds) return false;
  const set = invitedEventIds instanceof Set ? invitedEventIds : new Set([...invitedEventIds].map(String));
  return set.has(String(event.id));
}
