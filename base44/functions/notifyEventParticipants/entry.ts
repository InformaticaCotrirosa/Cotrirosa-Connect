import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function formatICSDate(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function generateICS(event, organizerEmail) {
  const startDate = event.start_date ? new Date(event.start_date) : new Date();
  const endDate = event.end_date ? new Date(event.end_date) : new Date(startDate.getTime() + 3600000);

  const now = formatICSDate(new Date());
  const dtStart = formatICSDate(startDate);
  const dtEnd = formatICSDate(endDate);
  const uid = `${event.id || Date.now()}@cotrirosa.app`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cotrirosa//Calendario//PT-BR',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${event.title || 'Evento'}`,
    event.description ? `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}` : '',
    event.location ? `LOCATION:${event.location}` : '',
    `ORGANIZER;CN=${event.organizer_name || 'Cotrirosa'}:mailto:${organizerEmail || 'agenda@cotrirosa.com.br'}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'TRANSP:OPAQUE',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:Lembrete: ${event.title || 'Evento'}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean).join('\r\n');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const eventData = payload.data || payload.event;
    const oldData = payload.old_data;

    if (!eventData || !eventData.id) {
      return Response.json({ ok: true, skipped: 'no event data' });
    }

    const isCreate = !oldData;
    const participants = Array.isArray(eventData.participants) ? eventData.participants : [];

    if (participants.length === 0) {
      return Response.json({ ok: true, skipped: 'no participants' });
    }

    // On update: notify newly added participants + existing ones about the change
    let participantsToNotify = participants;
    if (!isCreate && oldData) {
      const oldParticipants = Array.isArray(oldData.participants) ? oldData.participants : [];
      // Notify all current participants (including existing ones, since the event changed)
      // plus only new ones get the "added" message
      participantsToNotify = participants;
    }

    // Fetch users for emails
    const allUsers = await base44.asServiceRole.entities.User.list();

    const startDate = eventData.start_date ? new Date(eventData.start_date) : null;
    const endDate = eventData.end_date ? new Date(eventData.end_date) : null;
    const dateStrLong = startDate
      ? startDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';
    const dateStrShort = startDate
      ? startDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';

    // Find organizer email
    let organizerEmail = 'agenda@cotrirosa.com.br';
    if (eventData.created_by_id) {
      const org = allUsers.find(u => u.id === eventData.created_by_id);
      if (org?.email) organizerEmail = org.email;
    }

    const organizerName = eventData.organizer_name || 'Cotrirosa';

    // Generate .ics file
    const icsContent = generateICS(eventData, organizerEmail);

    // Upload .ics file to get a downloadable URL
    let icsFileUrl = null;
    try {
      const icsBytes = new TextEncoder().encode(icsContent);
      const icsFile = new File([icsBytes], 'convite.ics', { type: 'text/calendar;charset=utf-8' });
      const uploadRes = await base44.integrations.Core.UploadFile({ file: icsFile });
      icsFileUrl = uploadRes.file_url;
    } catch (e) {
      console.error('Failed to upload ICS:', e.message);
    }

    // Determine which participants are new (for different email wording)
    const oldParticipants = (isCreate || !oldData) ? [] : (Array.isArray(oldData.participants) ? oldData.participants : []);
    const newParticipants = participants.filter(uid => !oldParticipants.includes(uid));
    const existingParticipants = participants.filter(uid => oldParticipants.includes(uid));

    const notifications = [];
    let emailsSent = 0;

    // Create or update EventInvitation records for tracking RSVP status
    for (const uid of participants) {
      const isNewParticipant = newParticipants.includes(uid);
      const u = allUsers.find(u => u.id === uid);
      if (!u) continue;

      if (isNewParticipant) {
        // Create a new pending invitation
        try {
          await base44.asServiceRole.entities.EventInvitation.create({
            event_id: eventData.id,
            event_title: eventData.title || 'Evento',
            event_start: eventData.start_date,
            event_end: eventData.end_date,
            invitee_id: uid,
            invitee_name: u.full_name || u.email || '',
            inviter_id: eventData.created_by_id || '',
            inviter_name: organizerName,
            status: 'pendente',
          });
        } catch (e) {
          console.error('Failed to create EventInvitation:', e.message);
        }
      }
    }

    for (const uid of participants) {
      const u = allUsers.find(u => u.id === uid);
      if (!u) continue;

      const isNewParticipant = newParticipants.includes(uid);

      // Build HTML email
      const emailLines = [];
      emailLines.push('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;color:#333;max-width:600px">');

      if (isCreate) {
        emailLines.push(`<p>Olá ${u.full_name || ''},</p>`);
        emailLines.push(`<p><strong>${organizerName}</strong> criou um evento e convidou você.</p>`);
      } else if (isNewParticipant) {
        emailLines.push(`<p>Olá ${u.full_name || ''},</p>`);
        emailLines.push(`<p><strong>${organizerName}</strong> adicionou você ao evento abaixo.</p>`);
      } else {
        emailLines.push(`<p>Olá ${u.full_name || ''},</p>`);
        emailLines.push(`<p>O evento abaixo foi <strong>atualizado</strong> por ${organizerName}.</p>`);
      }

      emailLines.push('<div style="background:#f8f9fa;border-radius:8px;padding:20px;margin:16px 0">');
      emailLines.push(`<h2 style="margin:0 0 12px;color:#1a7a4c;font-size:18px">${eventData.title || 'Evento'}</h2>`);
      emailLines.push(`<p style="margin:4px 0"><strong>📅 Data:</strong> ${dateStrLong}</p>`);
      if (eventData.location) {
        emailLines.push(`<p style="margin:4px 0"><strong>📍 Local:</strong> ${eventData.location}</p>`);
      }
      emailLines.push(`<p style="margin:4px 0"><strong>👤 Organizador:</strong> ${organizerName}</p>`);
      if (eventData.event_type) {
        const typeLabels = { reuniao: 'Reunião', visita: 'Visita', interno: 'Interno', externo: 'Externo', treinamento: 'Treinamento', assembleia: 'Assembleia' };
        emailLines.push(`<p style="margin:4px 0"><strong>📋 Tipo:</strong> ${typeLabels[eventData.event_type] || eventData.event_type}</p>`);
      }
      emailLines.push('</div>');

      if (eventData.description) {
        emailLines.push(`<p style="white-space:pre-wrap">${eventData.description}</p>`);
      }

      if (icsFileUrl) {
        emailLines.push(`<a href="${icsFileUrl}" style="display:inline-block;background:#1a7a4c;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:12px">📥 Adicionar ao Calendário</a>`);
        emailLines.push('<p style="font-size:12px;color:#888;margin-top:8px">Clique no botão acima para adicionar este evento ao seu Outlook, Google Calendar ou outro calendário.</p>');
      }

      // Accept / Decline buttons
      const appId = Deno.env.get('BASE44_APP_ID') || '';
      const baseUrl = `https://base44.app/api/apps/${appId}/functions/handleEventRsvp`;
      const acceptUrl = `${baseUrl}?eventId=${encodeURIComponent(eventData.id)}&userId=${encodeURIComponent(uid)}&response=accepted`;
      const declineUrl = `${baseUrl}?eventId=${encodeURIComponent(eventData.id)}&userId=${encodeURIComponent(uid)}&response=declined`;

      emailLines.push('<div style="margin-top:16px;padding-top:16px;border-top:1px solid #e0e0e0">');
      emailLines.push('<p style="font-size:13px;color:#555;margin:0 0 12px"><strong>Confirme sua presença:</strong></p>');
      emailLines.push(`<a href="${acceptUrl}" style="display:inline-block;background:#1a7a4c;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;margin-right:8px">✅ Aceitar</a>`);
      emailLines.push(`<a href="${declineUrl}" style="display:inline-block;background:#dc2626;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">❌ Recusar</a>`);
      emailLines.push('<p style="font-size:11px;color:#999;margin-top:8px">Ao recusar, o evento será cancelado para todos os participantes.</p>');
      emailLines.push('</div>');

      emailLines.push('<hr style="border:none;border-top:1px solid #e0e0e0;margin:20px 0">');
      emailLines.push('<p style="font-size:11px;color:#999">Esta é uma mensagem automática do sistema Cotrirosa.</p>');
      emailLines.push('</body></html>');

      const emailBody = emailLines.join('\n');

      // Send email
      if (u.email) {
        try {
          await base44.integrations.Core.SendEmail({
            to: u.email,
            subject: eventData.title || 'Convite de evento',
            body: emailBody,
            from_name: organizerName,
          });
          emailsSent++;
        } catch (e) {
          console.error(`Failed to send email to ${u.email}:`, e.message);
        }
      }

      // Create in-app notification
      notifications.push({
        user_id: uid,
        title: isCreate ? 'Novo evento' : 'Evento atualizado',
        message: `${organizerName} ${isCreate ? 'criou o evento' : 'atualizou o evento'} "${eventData.title}"${dateStrShort ? ` em ${dateStrShort}` : ''}.`,
        type: eventData.event_type === 'reuniao' ? 'reuniao' : 'convite',
        is_read: false,
        related_id: eventData.id,
        action_url: `/calendar?event=${eventData.id}`,
      });
    }

    // Create notifications in bulk
    for (const notif of notifications) {
      await base44.asServiceRole.entities.Notification.create(notif);
    }

    return Response.json({ ok: true, notifications: notifications.length, emailsSent, icsUrl: icsFileUrl });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});