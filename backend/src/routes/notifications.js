import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getConnection } from '../config/database.js';
import { paginationParams } from '../utils/helpers.js';

const router = express.Router();

const fromOracleBool = (value) => value === 1 || value === true || value === '1';

// List notifications for the current user
router.get('/', authMiddleware, async (req, res) => {
  let connection;
  try {
    const { limit, offset } = paginationParams(req.query);
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT id, user_id, title, message, notification_type, related_id, is_read, created_date
       FROM cnt_notifications
       WHERE user_id = :userId
       ORDER BY created_date DESC
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { userId: req.userId, offset, limit }
    );

    const notifications = result.rows.map((row) => ({
      id: row[0],
      user_id: row[1],
      title: row[2],
      message: row[3],
      type: row[4],
      notification_type: row[4],
      related_id: row[5],
      is_read: fromOracleBool(row[6]),
      created_date: row[7],
    }));

    res.json(notifications);
  } catch (error) {
    console.error('Erro ao listar notificações:', error);
    res.status(500).json({ error: 'Erro ao listar notificações' });
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

// Update notification
router.put('/:id', authMiddleware, async (req, res) => {
  let connection;
  try {
    const { is_read } = req.body;
    connection = await getConnection();

    await connection.execute(
      `UPDATE cnt_notifications SET is_read = :isRead WHERE id = :id AND user_id = :userId`,
      {
        id: req.params.id,
        isRead: is_read === true || is_read === 1 || is_read === '1' ? 1 : 0,
        userId: req.userId,
      },
      { autoCommit: true }
    );

    res.json({ message: 'Notificação atualizada com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar notificação:', error);
    res.status(500).json({ error: 'Erro ao atualizar notificação' });
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
