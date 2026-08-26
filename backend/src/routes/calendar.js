import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getConnection } from '../config/database.js';
import { generateId, paginationParams } from '../utils/helpers.js';
import { expandRecurrence } from '../utils/recurrence.js';
import { syncEventInvitations } from '../utils/eventInvites.js';
import { canRoleBookRoom } from '../utils/roomPermissions.js';

const router = express.Router();

const toOracleBool = (value) => (value === true || value === 1 || value === '1' ? 1 : 0);
const fromOracleBool = (value) => value === 1 || value === true || value === '1';

/** Notifica o criador e todos os clientes (monitores de sala / calendário). */
const emitCalendarChange = (io, userId, eventName, payload = {}) => {
  if (!io) return;
  if (userId) {
    io.to(`calendar:${userId}`).emit(eventName, payload);
  }
  io.emit('calendar:changed', { type: eventName, ...payload });
};

async function assertCanBookRoom(connection, userId, roomId) {
  if (!roomId) return;
  const userResult = await connection.execute(
    'SELECT role FROM cnt_users WHERE id = :id',
    { id: userId }
  );
  const role = userResult.rows[0]?.[0] || 'user';
  const roomResult = await connection.execute(
    'SELECT allowed_roles FROM cnt_meeting_rooms WHERE id = :id',
    { id: roomId }
  );
  if (roomResult.rows.length === 0) {
    const err = new Error('Sala ou recurso não encontrado');
    err.statusCode = 400;
    throw err;
  }
  if (!canRoleBookRoom(role, roomResult.rows[0][0])) {
    const err = new Error('Seu perfil não tem permissão para agendar este recurso');
    err.statusCode = 403;
    throw err;
  }
}

const parseParticipants = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const mapEventRow = (row) => ({
  id: row[0],
  title: row[1],
  description: row[2],
  location: row[3],
  event_type: row[4],
  start_date: row[5],
  end_date: row[6],
  all_day: fromOracleBool(row[7]),
  participants: parseParticipants(row[8]),
  organizer_id: row[9],
  organizer_name: row[10],
  department_id: row[11],
  unit: row[12],
  room_id: row[13],
  is_recurring: fromOracleBool(row[14]),
  recurrence_rule: row[15],
  color: row[16],
  priority: row[17],
  recurrence_group_id: row[18] || null,
  // Alias legado usado em partes antigas do frontend
  created_by_id: row[9],
});

const EVENT_SELECT = `id, title, description, location, event_type, start_date, end_date,
              all_day, participants, organizer_id, organizer_name, department_id, unit,
              room_id, is_recurring, recurrence_rule, color, priority, recurrence_group_id`;

const insertEvent = async (connection, {
  id,
  title,
  description,
  location,
  eventType,
  startDate,
  endDate,
  allDay,
  participants,
  organizerId,
  organizerName,
  departmentId,
  unit,
  roomId,
  isRecurring,
  recurrenceRule,
  color,
  priority,
  recurrenceGroupId,
}) => {
  await connection.execute(
    `INSERT INTO cnt_calendar_events (
      id, title, description, location, event_type, start_date, end_date,
      all_day, participants, organizer_id, organizer_name, department_id, unit,
      room_id, is_recurring, recurrence_rule, color, priority, recurrence_group_id, created_date
    ) VALUES (
      :id, :title, :description, :location, :eventType, :startDate, :endDate,
      :allDay, :participants, :organizerId, :organizerName, :departmentId, :unit,
      :roomId, :isRecurring, :recurrenceRule, :color, :priority, :recurrenceGroupId, SYSDATE
    )`,
    {
      id,
      title,
      description: description || null,
      location: location || null,
      eventType: eventType || null,
      startDate,
      endDate,
      allDay: toOracleBool(allDay),
      participants: JSON.stringify(participants || []),
      organizerId,
      organizerName: organizerName || null,
      departmentId: departmentId || null,
      unit: unit || null,
      roomId: roomId || null,
      isRecurring: toOracleBool(isRecurring),
      recurrenceRule: recurrenceRule || null,
      color: color || '#22c55e',
      priority: priority || 'media',
      recurrenceGroupId: recurrenceGroupId || null,
    },
    { autoCommit: false }
  );
};

// Preview de recorrência (quantas instâncias até o fim do ano)
router.post('/recurrence-preview', authMiddleware, async (req, res) => {
  try {
    const { start_date, end_date, recurrence_rule } = req.body;
    if (!start_date || !recurrence_rule) {
      return res.status(400).json({ error: 'start_date e recurrence_rule são obrigatórios' });
    }
    const instances = expandRecurrence(start_date, end_date || start_date, recurrence_rule);
    res.json({
      totalInstances: instances.length,
      yearEnd: instances.length
        ? new Date(new Date(start_date).getFullYear(), 11, 31).toISOString()
        : null,
      firstDate: instances[0]?.start_date,
      lastDate: instances[instances.length - 1]?.start_date,
    });
  } catch (error) {
    console.error('Erro no preview de recorrência:', error);
    res.status(400).json({ error: error.message || 'Erro ao calcular recorrência' });
  }
});

// Criar evento (ou série recorrente até o fim do ano)
router.post('/', authMiddleware, async (req, res) => {
  let connection;
  try {
    const {
      title, description, location, event_type, start_date, end_date,
      all_day, participants, organizer_name, department_id, unit, room_id,
      is_recurring, recurrence_rule, color, priority
    } = req.body;

    if (!title || !start_date) {
      return res.status(400).json({ error: 'Título e data de início são obrigatórios' });
    }

    const createSeries = Boolean(is_recurring && recurrence_rule);
    if (is_recurring && !recurrence_rule) {
      return res.status(400).json({ error: 'Selecione a frequência da recorrência' });
    }

    connection = await getConnection();
    await assertCanBookRoom(connection, req.userId, room_id);

    const base = {
      title,
      description,
      location,
      eventType: event_type,
      allDay: all_day,
      participants: participants || [],
      organizerId: req.userId,
      organizerName: organizer_name,
      departmentId: department_id,
      unit,
      roomId: room_id,
      isRecurring: createSeries,
      recurrenceRule: createSeries ? recurrence_rule : null,
      color,
      priority,
    };

    let createdIds = [];
    let recurrenceGroupId = null;

    if (createSeries) {
      const instances = expandRecurrence(start_date, end_date || start_date, recurrence_rule);
      if (instances.length === 0) {
        return res.status(400).json({ error: 'Nenhuma ocorrência gerada para a recorrência' });
      }
      recurrenceGroupId = generateId();

      for (const instance of instances) {
        const id = generateId();
        await insertEvent(connection, {
          ...base,
          id,
          startDate: instance.start_date,
          endDate: instance.end_date,
          recurrenceGroupId,
        });
        createdIds.push(id);
      }
    } else {
      const id = generateId();
      await insertEvent(connection, {
        ...base,
        id,
        startDate: new Date(start_date),
        endDate: end_date ? new Date(end_date) : null,
        recurrenceGroupId: null,
      });
      createdIds = [id];
    }

    // Convites + notificações (1x na série: primeiro evento)
    await syncEventInvitations(connection, {
      eventId: createdIds[0],
      eventTitle: title,
      eventStart: start_date,
      eventEnd: end_date || start_date,
      participants: participants || [],
      organizerId: req.userId,
      organizerName: organizer_name,
      inviterId: req.userId,
      io: req.app.get('io'),
    });

    await connection.commit();

    emitCalendarChange(req.app.get('io'), req.userId, 'event:created', {
      ids: createdIds,
      title,
      count: createdIds.length,
    });

    res.status(201).json({
      id: createdIds[0],
      ids: createdIds,
      count: createdIds.length,
      recurrence_group_id: recurrenceGroupId,
      message: createSeries
        ? `${createdIds.length} eventos criados até o fim do ano`
        : 'Evento criado com sucesso',
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {
        // ignore
      }
    }
    console.error('Erro ao criar evento:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: 'Erro ao criar evento' });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (_) {
        // ignore
      }
    }
  }
});

// Listar eventos
// Query opcional: from, to (ISO) — filtra por start_date
router.get('/', authMiddleware, async (req, res) => {
  let connection;
  try {
    const { limit, offset } = paginationParams(req.query);
    connection = await getConnection();

    const conditions = [];
    const binds = { offset, limit };

    if (req.query.from) {
      const fromDate = new Date(req.query.from);
      if (!Number.isNaN(fromDate.getTime())) {
        conditions.push('start_date >= :fromDate');
        binds.fromDate = fromDate;
      }
    }
    if (req.query.to) {
      const toDate = new Date(req.query.to);
      if (!Number.isNaN(toDate.getTime())) {
        conditions.push('start_date <= :toDate');
        binds.toDate = toDate;
      }
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    // Com intervalo: ordem cronológica (melhor para calendário)
    const orderBy = conditions.length
      ? 'ORDER BY start_date ASC'
      : 'ORDER BY start_date DESC';

    const result = await connection.execute(
      `SELECT ${EVENT_SELECT}
       FROM cnt_calendar_events
       ${where}
       ${orderBy}
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      binds
    );

    res.json(result.rows.map(mapEventRow));
  } catch (error) {
    console.error('Erro ao listar eventos:', error);
    res.status(500).json({ error: 'Erro ao listar eventos' });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (_) {
        // ignore
      }
    }
  }
});

// Obter evento por ID
router.get('/:id', authMiddleware, async (req, res) => {
  let connection;
  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT ${EVENT_SELECT}
       FROM cnt_calendar_events WHERE id = :id`,
      { id: req.params.id }
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Evento não encontrado' });
    }

    res.json(mapEventRow(result.rows[0]));
  } catch (error) {
    console.error('Erro ao obter evento:', error);
    res.status(500).json({ error: 'Erro ao obter evento' });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (_) {
        // ignore
      }
    }
  }
});

// Atualizar evento (scope=single|future)
router.put('/:id', authMiddleware, async (req, res) => {
  let connection;
  try {
    const scope = req.body.scope === 'future' ? 'future' : 'single';
    connection = await getConnection();

    const currentResult = await connection.execute(
      `SELECT ${EVENT_SELECT} FROM cnt_calendar_events WHERE id = :id`,
      { id: req.params.id }
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Evento não encontrado' });
    }

    const current = mapEventRow(currentResult.rows[0]);
    const {
      title = current.title,
      description = current.description,
      location = current.location,
      event_type = current.event_type,
      start_date,
      end_date,
      all_day = current.all_day,
      participants = current.participants,
      organizer_name = current.organizer_name,
      department_id = current.department_id,
      unit = current.unit,
      room_id = current.room_id,
      is_recurring = current.is_recurring,
      recurrence_rule = current.recurrence_rule,
      color = current.color,
      priority = current.priority,
    } = req.body;

    await assertCanBookRoom(connection, req.userId, room_id);

    const newStart = start_date ? new Date(start_date) : new Date(current.start_date);
    const newEnd = end_date ? new Date(end_date) : (current.end_date ? new Date(current.end_date) : null);

    if (scope === 'future' && current.recurrence_group_id) {
      // Remove esta e as próximas da série
      await connection.execute(
        `DELETE FROM cnt_calendar_events
         WHERE recurrence_group_id = :groupId
           AND start_date >= :fromDate`,
        {
          groupId: current.recurrence_group_id,
          fromDate: new Date(current.start_date),
        },
        { autoCommit: false }
      );

      const rule = recurrence_rule || current.recurrence_rule;
      const createSeries = Boolean(is_recurring && rule);
      const groupId = current.recurrence_group_id;
      const createdIds = [];

      if (createSeries) {
        const instances = expandRecurrence(newStart, newEnd || newStart, rule);
        for (const instance of instances) {
          const id = generateId();
          await insertEvent(connection, {
            id,
            title,
            description,
            location,
            eventType: event_type,
            startDate: instance.start_date,
            endDate: instance.end_date,
            allDay: all_day,
            participants,
            organizerId: current.organizer_id,
            organizerName: organizer_name,
            departmentId: department_id,
            unit,
            roomId: room_id,
            isRecurring: true,
            recurrenceRule: rule,
            color,
            priority,
            recurrenceGroupId: groupId,
          });
          createdIds.push(id);
        }
      } else {
        const id = generateId();
        await insertEvent(connection, {
          id,
          title,
          description,
          location,
          eventType: event_type,
          startDate: newStart,
          endDate: newEnd,
          allDay: all_day,
          participants,
          organizerId: current.organizer_id,
          organizerName: organizer_name,
          departmentId: department_id,
          unit,
          roomId: room_id,
          isRecurring: false,
          recurrenceRule: null,
          color,
          priority,
          recurrenceGroupId: null,
        });
        createdIds.push(id);
      }

      await connection.commit();

      await syncEventInvitations(connection, {
        eventId: createdIds[0],
        eventTitle: title,
        eventStart: newStart,
        eventEnd: newEnd || newStart,
        participants: participants || [],
        organizerId: current.organizer_id || req.userId,
        organizerName: organizer_name,
        inviterId: req.userId,
        io: req.app.get('io'),
      });
      await connection.commit();

      emitCalendarChange(req.app.get('io'), req.userId, 'event:updated', {
        id: req.params.id,
        ids: createdIds,
      });

      res.json({
        message: createSeries
          ? `${createdIds.length} ocorrências atualizadas (deste evento em diante)`
          : 'Evento atualizado',
        ids: createdIds,
        count: createdIds.length,
      });
      return;
    }

    // Atualização de um único evento
    await connection.execute(
      `UPDATE cnt_calendar_events SET
         title = :title,
         description = :description,
         location = :location,
         event_type = :eventType,
         start_date = :startDate,
         end_date = :endDate,
         all_day = :allDay,
         participants = :participants,
         organizer_name = :organizerName,
         department_id = :departmentId,
         unit = :unit,
         room_id = :roomId,
         is_recurring = :isRecurring,
         recurrence_rule = :recurrenceRule,
         color = :color,
         priority = :priority,
         updated_date = SYSDATE
       WHERE id = :id`,
      {
        id: req.params.id,
        title,
        description: description || null,
        location: location || null,
        eventType: event_type || null,
        startDate: newStart,
        endDate: newEnd,
        allDay: toOracleBool(all_day),
        participants: JSON.stringify(participants || []),
        organizerName: organizer_name || null,
        departmentId: department_id || null,
        unit: unit || null,
        roomId: room_id || null,
        isRecurring: toOracleBool(is_recurring),
        recurrenceRule: recurrence_rule || null,
        color: color || '#22c55e',
        priority: priority || 'media',
      },
      { autoCommit: false }
    );

    await syncEventInvitations(connection, {
      eventId: req.params.id,
      eventTitle: title,
      eventStart: newStart,
      eventEnd: newEnd || newStart,
      participants: participants || [],
      organizerId: current.organizer_id || req.userId,
      organizerName: organizer_name,
      inviterId: req.userId,
      io: req.app.get('io'),
    });

    await connection.commit();

    emitCalendarChange(req.app.get('io'), req.userId, 'event:updated', { id: req.params.id });

    res.json({ message: 'Evento atualizado com sucesso' });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {
        // ignore
      }
    }
    console.error('Erro ao atualizar evento:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: 'Erro ao atualizar evento' });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (_) {
        // ignore
      }
    }
  }
});

// Deletar evento (scope=single|future via query)
router.delete('/:id', authMiddleware, async (req, res) => {
  let connection;
  try {
    const scope = req.query.scope === 'future' ? 'future' : 'single';
    connection = await getConnection();

    const currentResult = await connection.execute(
      `SELECT id, start_date, recurrence_group_id FROM cnt_calendar_events WHERE id = :id`,
      { id: req.params.id }
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Evento não encontrado' });
    }

    const [, startDate, groupId] = currentResult.rows[0];
    let deleted = 0;

    if (scope === 'future' && groupId) {
      const result = await connection.execute(
        `DELETE FROM cnt_calendar_events
         WHERE recurrence_group_id = :groupId
           AND start_date >= :fromDate`,
        {
          groupId,
          fromDate: new Date(startDate),
        },
        { autoCommit: true }
      );
      deleted = result.rowsAffected || 0;
    } else {
      const result = await connection.execute(
        'DELETE FROM cnt_calendar_events WHERE id = :id',
        { id: req.params.id },
        { autoCommit: true }
      );
      deleted = result.rowsAffected || 0;
    }

    emitCalendarChange(req.app.get('io'), req.userId, 'event:deleted', {
      id: req.params.id,
      scope,
      deleted,
    });

    res.json({
      message: scope === 'future'
        ? `${deleted} ocorrência(s) excluída(s) (deste evento em diante)`
        : 'Evento excluído com sucesso',
      deleted,
    });
  } catch (error) {
    console.error('Erro ao deletar evento:', error);
    res.status(500).json({ error: 'Erro ao deletar evento' });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (_) {
        // ignore
      }
    }
  }
});

export default router;
