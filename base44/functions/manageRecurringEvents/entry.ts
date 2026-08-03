import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function getTimeStr(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function generateDates(startDateStr, endDateStr, rule, includePast = false) {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const startTime = getTimeStr(start);
  const endTime = getTimeStr(end);
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function makeDate(year, month, day) {
    const s = new Date(year, month, day, sh, sm, 0, 0);
    const e = new Date(year, month, day, eh, em, 0, 0);
    return { start: s, end: e };
  }

  switch (rule) {
    case 'daily': {
      const limit = new Date(start);
      limit.setDate(limit.getDate() + 90);
      const d = new Date(start);
      d.setDate(d.getDate() + 1);
      while (d <= limit) {
        if (includePast || d > today) {
          const s = new Date(d);
          s.setHours(sh, sm, 0, 0);
          const e = new Date(d);
          e.setHours(eh, em, 0, 0);
          dates.push({ start: s, end: e });
        }
        d.setDate(d.getDate() + 1);
      }
      break;
    }
    case 'weekly': {
      for (let w = 1; w <= 52; w++) {
        const d = new Date(start);
        d.setDate(d.getDate() + w * 7);
        if (includePast || d > today) dates.push(makeDate(d.getFullYear(), d.getMonth(), d.getDate()));
      }
      break;
    }
    case 'biweekly': {
      for (let i = 1; i <= 26; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i * 15);
        if (includePast || d > today) dates.push(makeDate(d.getFullYear(), d.getMonth(), d.getDate()));
      }
      break;
    }
    case 'monthly': {
      const targetDay = start.getDate();
      for (let m = 1; m <= 12; m++) {
        const y = start.getFullYear();
        const month = start.getMonth() + m;
        const d = new Date(y, month, 1);
        const lastDay = new Date(y, month + 1, 0).getDate();
        const day = Math.min(targetDay, lastDay);
        const instance = new Date(y, month, day, sh, sm, 0, 0);
        if (includePast || instance > today) dates.push(makeDate(y, month, day));
      }
      break;
    }
    case 'yearly': {
      const targetDay = start.getDate();
      const targetMonth = start.getMonth();
      for (let y = 1; y <= 5; y++) {
        const year = start.getFullYear() + y;
        const lastDay = new Date(year, targetMonth + 1, 0).getDate();
        const day = Math.min(targetDay, lastDay);
        const instance = new Date(year, targetMonth, day, sh, sm, 0, 0);
        if (includePast || instance > today) dates.push(makeDate(year, targetMonth, day));
      }
      break;
    }
  }
  return dates;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, eventData, recurrence_rule, excludeEventId } = body;

    if (!action || !eventData) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // delete_instances doesn't need recurrence_rule or future dates
    if (action === 'delete_instances') {
      const masterEventId = body.masterEventId;
      const allEventsForDelete = await base44.asServiceRole.entities.CalendarEvent.list('-start_date', 5000);
      const instancesToDelete = allEventsForDelete.filter(ev =>
        ev.id !== masterEventId &&
        !ev.is_recurring &&
        !ev.recurrence_rule &&
        ev.title === eventData.title &&
        ev.organizer_name === eventData.organizer_name
      );
      for (const ev of instancesToDelete) {
        await base44.asServiceRole.entities.CalendarEvent.delete(ev.id);
      }
      return Response.json({ deleted: instancesToDelete.length });
    }

    if (!recurrence_rule) {
      return Response.json({ error: 'Missing recurrence_rule' }, { status: 400 });
    }

    const futureDates = generateDates(eventData.start_date, eventData.end_date, recurrence_rule);

    if (futureDates.length === 0) {
      return Response.json({ totalInstances: 0, conflicts: [], hasConflicts: false, created: 0 });
    }

    const allEvents = await base44.asServiceRole.entities.CalendarEvent.list('-start_date', 5000);
    const allUsers = await base44.asServiceRole.entities.User.list();

    const participants = eventData.participants || [];
    const roomId = eventData.room_id || '';

    // Check conflicts
    const conflicts = [];

    for (const { start, end } of futureDates) {
      const dateLabel = start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

      // Room conflicts
      if (roomId) {
        const roomBooked = allEvents.some(ev => {
          if (excludeEventId && ev.id === excludeEventId) return false;
          if (ev.room_id !== roomId) return false;
          const evStart = new Date(ev.start_date);
          const evEnd = new Date(ev.end_date);
          return evStart < end && evEnd > start;
        });
        if (roomBooked) {
          const room = allEvents.find(ev => ev.room_id === roomId);
          conflicts.push({
            date: dateLabel,
            type: 'room',
            message: `Sala ocupada em ${dateLabel}`
          });
        }
      }

      // User conflicts
      for (const uid of participants) {
        const hasConflict = allEvents.some(ev => {
          if (excludeEventId && ev.id === excludeEventId) return false;
          const isInvolved = (Array.isArray(ev.participants) && ev.participants.includes(uid)) || ev.created_by_id === uid;
          if (!isInvolved) return false;
          const evStart = new Date(ev.start_date);
          const evEnd = new Date(ev.end_date);
          return evStart < end && evEnd > start;
        });
        if (hasConflict) {
          const u = allUsers.find(u => u.id === uid);
          conflicts.push({
            date: dateLabel,
            type: 'user',
            userId: uid,
            userName: u?.full_name || u?.email || 'Usuário',
            message: `${u?.full_name || u?.email || 'Usuário'} já tem evento em ${dateLabel}`
          });
        }
      }
    }

    if (action === 'check') {
      return Response.json({
        totalInstances: futureDates.length,
        conflicts,
        hasConflicts: conflicts.length > 0
      });
    }

    if (action === 'create') {
      let created = 0;
      for (const { start, end } of futureDates) {
        await base44.asServiceRole.entities.CalendarEvent.create({
          ...eventData,
          start_date: start.toISOString(),
          end_date: end.toISOString(),
          is_recurring: false,
          recurrence_rule: '',
        });
        created++;
      }
      return Response.json({ created, totalInstances: futureDates.length, conflicts });
    }

    if (action === 'replace') {
      const masterEventId = body.masterEventId;
      const originalTitle = body.originalTitle || eventData.title;
      // Delete existing instances — match by ORIGINAL title + organizer + is_recurring=false
      const instancesToDelete = allEvents.filter(ev =>
        ev.id !== masterEventId &&
        !ev.is_recurring &&
        !ev.recurrence_rule &&
        ev.title === originalTitle &&
        ev.organizer_name === eventData.organizer_name
      );
      for (const ev of instancesToDelete) {
        await base44.asServiceRole.entities.CalendarEvent.delete(ev.id);
      }
      const deletedCount = instancesToDelete.length;

      // Create new instances — regenerate ALL dates (past + future) to keep history intact
      const allDates = generateDates(eventData.start_date, eventData.end_date, recurrence_rule, true);
      let created = 0;
      for (const { start, end } of allDates) {
        await base44.asServiceRole.entities.CalendarEvent.create({
          ...eventData,
          start_date: start.toISOString(),
          end_date: end.toISOString(),
          is_recurring: false,
          recurrence_rule: '',
        });
        created++;
      }
      return Response.json({ created, deleted: deletedCount, totalInstances: allDates.length });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});