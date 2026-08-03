import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getConnection } from '../config/database.js';
import { generateId, paginationParams } from '../utils/helpers.js';

const router = express.Router();

// Criar convite
router.post('/', authMiddleware, async (req, res) => {
  let connection;
  try {
    const { event_id, event_title, event_start, event_end, invitee_id, invitee_name, response_note } = req.body;

    if (!event_id || !invitee_id) {
      return res.status(400).json({ error: 'event_id e invitee_id são obrigatórios' });
    }

    connection = await getConnection();
    const invitationId = generateId();

    await connection.execute(
      `INSERT INTO cnt_event_invitations (
        id, event_id, event_title, event_start, event_end, invitee_id, invitee_name,
        inviter_id, status, response_note, created_date
      ) VALUES (
        :id, :eventId, :eventTitle, :eventStart, :eventEnd, :inviteeId, :inviteeName,
        :inviterId, 'pendente', :responseNote, SYSDATE
      )`,
      {
        id: invitationId,
        eventId: event_id,
        eventTitle: event_title,
        eventStart: event_start ? new Date(event_start) : null,
        eventEnd: event_end ? new Date(event_end) : null,
        inviteeId: invitee_id,
        inviteeName: invitee_name,
        inviterId: req.userId,
        responseNote: response_note
      },
      { autoCommit: false }
    );

    const notificationId = generateId();
    await connection.execute(
      `INSERT INTO cnt_notifications (
        id, user_id, title, message, notification_type, related_id, is_read, created_date
      ) VALUES (
        :id, :userId, :title, :message, :notificationType, :relatedId, 0, SYSDATE
      )`,
      {
        id: notificationId,
        userId: invitee_id,
        title: 'Confirme sua presença',
        message: `Você foi convidado para a reunião "${event_title || 'Sem título'}". Aceite ou recuse no Dashboard.`,
        notificationType: 'convite',
        relatedId: invitationId,
      },
      { autoCommit: false }
    );

    await connection.commit();

    const io = req.app.get('io');
    if (io) {
      io.to(`invitations:${invitee_id}`).emit('invitation:received', {
        id: invitationId,
        event_id,
        event_title,
        inviter_id: req.userId,
      });
      io.to(`notifications:${invitee_id}`).emit('notification:new', {
        id: notificationId,
        title: 'Confirme sua presença',
        type: 'convite',
        related_id: invitationId,
      });
    }

    res.status(201).json({ id: invitationId, message: 'Convite criado com sucesso' });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {
        // ignore
      }
    }
    console.error('Erro ao criar convite:', error);
    res.status(500).json({ error: 'Erro ao criar convite' });
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

// Listar convites
router.get('/', authMiddleware, async (req, res) => {
  let connection;
  try {
    const { limit, offset } = paginationParams(req.query);
    const eventId = req.query.event_id;
    connection = await getConnection();

    let result;
    if (eventId) {
      result = await connection.execute(
        `SELECT id, event_id, event_title, event_start, event_end, invitee_id, invitee_name,
                inviter_id, status, response_note, created_date
         FROM cnt_event_invitations
         WHERE event_id = :eventId
         ORDER BY created_date DESC
         OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
        { eventId, offset, limit }
      );
    } else {
      result = await connection.execute(
        `SELECT id, event_id, event_title, event_start, event_end, invitee_id, invitee_name,
                inviter_id, status, response_note, created_date
         FROM cnt_event_invitations
         WHERE invitee_id = :userId
         ORDER BY created_date DESC
         OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
        { userId: req.userId, offset, limit }
      );
    }

    const invitations = result.rows.map((row) => ({
      id: row[0],
      event_id: row[1],
      event_title: row[2],
      event_start: row[3],
      event_end: row[4],
      invitee_id: row[5],
      invitee_name: row[6],
      inviter_id: row[7],
      status: row[8],
      response_note: row[9],
      created_date: row[10],
    }));

    res.json(invitations);
  } catch (error) {
    console.error('Erro ao listar convites:', error);
    res.status(500).json({ error: 'Erro ao listar convites' });
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

// Obter convite por ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const connection = await getConnection();
    
    const result = await connection.execute(
      `SELECT id, event_id, event_title, event_start, event_end, invitee_id, invitee_name,
              inviter_id, status, response_note, created_date
       FROM cnt_event_invitations WHERE id = :id`,
      { id: req.params.id }
    );

    await connection.close();

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Convite não encontrado' });
    }

    const row = result.rows[0];
    res.json({
      id: row[0],
      event_id: row[1],
      event_title: row[2],
      event_start: row[3],
      event_end: row[4],
      invitee_id: row[5],
      invitee_name: row[6],
      inviter_id: row[7],
      status: row[8],
      response_note: row[9],
      created_date: row[10]
    });
  } catch (error) {
    console.error('Erro ao obter convite:', error);
    res.status(500).json({ error: 'Erro ao obter convite' });
  }
});

// Atualizar convite (aceitar/recusar)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { status, response_note } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status é obrigatório' });
    }

    const connection = await getConnection();
    
    await connection.execute(
      `UPDATE cnt_event_invitations SET status = :status, response_note = :responseNote WHERE id = :id`,
      {
        status,
        responseNote: response_note,
        id: req.params.id
      },
      { autoCommit: true }
    );

    await connection.close();

    // Notificar via WebSocket
    const io = req.app.get('io');
    io.to(`invitations:${req.userId}`).emit('invitation:updated', { id: req.params.id, status });

    res.json({ message: 'Convite atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar convite:', error);
    res.status(500).json({ error: 'Erro ao atualizar convite' });
  }
});

// Deletar convite
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const connection = await getConnection();
    
    await connection.execute(
      'DELETE FROM cnt_event_invitations WHERE id = :id',
      { id: req.params.id },
      { autoCommit: true }
    );

    await connection.close();

    res.json({ message: 'Convite deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar convite:', error);
    res.status(500).json({ error: 'Erro ao deletar convite' });
  }
});

export default router;
