import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    let eventId = url.searchParams.get('eventId');
    let userId = url.searchParams.get('userId');
    let response = url.searchParams.get('response');

    // Also support POST/JSON body (for testing)
    if (!eventId && req.method === 'POST') {
      try {
        const body = await req.json();
        eventId = body.eventId;
        userId = body.userId;
        response = body.response;
      } catch (_) { /* not JSON */ }
    }

    if (!eventId || !userId || !response) {
      return new Response('Parâmetros inválidos', { status: 400 });
    }

    // Fetch the event
    const event = await base44.asServiceRole.entities.CalendarEvent.get(eventId);
    if (!event) {
      return new Response('Evento não encontrado', { status: 404 });
    }

    // Find or create EventInvitation record
    const invitations = await base44.asServiceRole.entities.EventInvitation.filter({
      event_id: eventId,
      invitee_id: userId,
    });

    const newStatus = response === 'accepted' ? 'aceito' : 'recusado';

    if (invitations.length > 0) {
      const inv = invitations[0];
      await base44.asServiceRole.entities.EventInvitation.update(inv.id, {
        status: newStatus,
        response_note: response === 'declined' ? 'Recusado via e-mail' : 'Aceito via e-mail',
      });
    } else {
      await base44.asServiceRole.entities.EventInvitation.create({
        event_id: eventId,
        event_title: event.title,
        event_start: event.start_date,
        event_end: event.end_date,
        invitee_id: userId,
        invitee_name: '',
        inviter_id: event.created_by_id || '',
        inviter_name: event.organizer_name || '',
        status: newStatus,
        response_note: response === 'declined' ? 'Recusado via e-mail' : 'Aceito via e-mail',
      });
    }

    // If declined, delete the event and notify participants
    if (response === 'declined') {
      const eventTitle = event.title || 'Evento';
      const declinerName = invitations.length > 0 ? (invitations[0].invitee_name || 'Um participante') : 'Um participante';

      // Delete associated EventInvitation records first
      const allEventInvites = await base44.asServiceRole.entities.EventInvitation.filter({ event_id: eventId });
      for (const inv of allEventInvites) {
        try {
          await base44.asServiceRole.entities.EventInvitation.delete(inv.id);
        } catch (_) { /* ignore */ }
      }

      // Delete the event itself
      await base44.asServiceRole.entities.CalendarEvent.delete(eventId);

      // Notify organizer and participants about cancellation
      try {
        // Notify organizer
        if (event.created_by_id) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: event.created_by_id,
            title: 'Evento cancelado',
            message: `"${eventTitle}" foi cancelado porque ${declinerName} recusou o convite.`,
            type: 'alteracao',
            is_read: false,
            related_id: eventId,
            action_url: '/calendar',
          });

          // Send email to organizer
          try {
            await base44.integrations.Core.SendEmail({
              to: event.organizer_name ? `${event.organizer_name}@cotrirosa.com.br` : 'agenda@cotrirosa.com.br',
              subject: `Evento cancelado: ${eventTitle}`,
              body: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;color:#333;max-width:600px"><h2 style="color:#dc2626">Evento cancelado</h2><p>O evento <strong>"${eventTitle}"</strong> foi cancelado porque <strong>${declinerName}</strong> recusou o convite.</p><p style="color:#888;font-size:12px">Esta é uma mensagem automática do sistema Cotrirosa.</p></body></html>`,
              from_name: 'Cotrirosa',
            });
          } catch (_) { /* ignore */ }
        }

        // Notify other participants (excluding the decliner)
        const participants = Array.isArray(event.participants) ? event.participants : [];
        for (const uid of participants) {
          if (uid === userId) continue;
          await base44.asServiceRole.entities.Notification.create({
            user_id: uid,
            title: 'Evento cancelado',
            message: `"${eventTitle}" foi cancelado porque um participante recusou o convite.`,
            type: 'alteracao',
            is_read: false,
            related_id: eventId,
            action_url: '/calendar',
          });
        }
      } catch (notifErr) {
        console.error('Failed to send cancellation notifications:', notifErr.message);
      }
    }

    // Return HTML page
    const title = response === 'declined' ? 'Evento cancelado' : 'Convite aceito';
    const message = response === 'declined'
      ? 'Sua recusa foi registrada. O evento foi excluído da agenda.'
      : 'Sua presença foi confirmada. Obrigado!';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5}.card{background:#fff;border-radius:12px;padding:40px;max-width:480px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08)}h1{color:#1a7a4c;margin:0 0 8px}p{color:#555;line-height:1.6}.event{background:#f8f9fa;border-radius:8px;padding:16px;margin:20px 0;text-align:left}.event h3{margin:0 0 4px;color:#333}.event span{font-size:14px;color:#777}</style></head><body><div class="card"><h1>${response === 'declined' ? '❌' : '✅'} ${title}</h1><p>${message}</p><div class="event"><h3>${event.title || 'Evento'}</h3><span>${event.organizer_name || ''}</span></div></div></body></html>`;

    return new Response(html, { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
  } catch (error) {
    return new Response(`Erro: ${error.message}`, { status: 500 });
  }
});