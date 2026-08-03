import { generateId } from './helpers.js';

/**
 * Cria convites pendentes + notificações para participantes novos.
 * Não reenvia para quem já tem convite no evento.
 */
export async function syncEventInvitations(connection, {
  eventId,
  eventTitle,
  eventStart,
  eventEnd,
  participants = [],
  organizerId,
  organizerName = '',
  inviterId,
  io,
}) {
  if (!eventId) return { created: 0 };

  const organizer = String(organizerId || inviterId || '');
  const participantIds = [...new Set((participants || []).map((p) => String(p)))]
    .filter((id) => id && id !== organizer);

  const existingResult = await connection.execute(
    `SELECT invitee_id, id, status FROM cnt_event_invitations WHERE event_id = :eventId`,
    { eventId }
  );
  const existingByInvitee = new Map(
    (existingResult.rows || []).map((row) => [String(row[0]), { id: row[1], status: row[2] }])
  );

  // Remover convites pendentes de quem saiu da lista
  for (const [inviteeId, inv] of existingByInvitee) {
    if (!participantIds.includes(inviteeId) && inv.status === 'pendente') {
      await connection.execute(
        `DELETE FROM cnt_event_invitations WHERE id = :id`,
        { id: inv.id }
      );
      existingByInvitee.delete(inviteeId);
    }
  }

  if (participantIds.length === 0) {
    return { created: 0 };
  }

  const nameById = new Map();
  for (const inviteeId of participantIds) {
    const userResult = await connection.execute(
      `SELECT full_name FROM cnt_users WHERE id = :id`,
      { id: inviteeId }
    );
    if (userResult.rows?.length) {
      nameById.set(inviteeId, userResult.rows[0][0] || '');
    }
  }

  let created = 0;
  const startDate = eventStart ? new Date(eventStart) : null;
  const endDate = eventEnd ? new Date(eventEnd) : null;
  const inviter = inviterId || organizerId;
  const who = organizerName || 'Alguém';

  for (const inviteeId of participantIds) {
    if (existingByInvitee.has(inviteeId)) {
      // Atualiza metadados do convite existente (título/datas)
      await connection.execute(
        `UPDATE cnt_event_invitations
         SET event_title = :eventTitle,
             event_start = :eventStart,
             event_end = :eventEnd,
             updated_date = SYSDATE
         WHERE event_id = :eventId AND invitee_id = :inviteeId`,
        {
          eventTitle: eventTitle || null,
          eventStart: startDate,
          eventEnd: endDate,
          eventId,
          inviteeId,
        }
      );
      continue;
    }

    const invitationId = generateId();
    const inviteeName = nameById.get(inviteeId) || '';

    await connection.execute(
      `INSERT INTO cnt_event_invitations (
        id, event_id, event_title, event_start, event_end, invitee_id, invitee_name,
        inviter_id, status, created_date
      ) VALUES (
        :id, :eventId, :eventTitle, :eventStart, :eventEnd, :inviteeId, :inviteeName,
        :inviterId, 'pendente', SYSDATE
      )`,
      {
        id: invitationId,
        eventId,
        eventTitle: eventTitle || null,
        eventStart: startDate,
        eventEnd: endDate,
        inviteeId,
        inviteeName: inviteeName || null,
        inviterId: inviter,
      }
    );

    const notificationId = generateId();
    const notifTitle = 'Confirme sua presença';
    const notifMessage = `${who} convidou você para a reunião "${eventTitle || 'Sem título'}". Aceite ou recuse no Dashboard.`;

    await connection.execute(
      `INSERT INTO cnt_notifications (
        id, user_id, title, message, notification_type, related_id, is_read, created_date
      ) VALUES (
        :id, :userId, :title, :message, :notificationType, :relatedId, 0, SYSDATE
      )`,
      {
        id: notificationId,
        userId: inviteeId,
        title: notifTitle,
        message: notifMessage,
        notificationType: 'convite',
        relatedId: invitationId,
      }
    );

    created += 1;

    if (io) {
      io.to(`invitations:${inviteeId}`).emit('invitation:received', {
        id: invitationId,
        event_id: eventId,
        event_title: eventTitle,
        inviter_id: inviter,
        inviter_name: who,
      });
      io.to(`notifications:${inviteeId}`).emit('notification:new', {
        id: notificationId,
        title: notifTitle,
        message: notifMessage,
        type: 'convite',
        related_id: invitationId,
      });
    }
  }

  return { created };
}
