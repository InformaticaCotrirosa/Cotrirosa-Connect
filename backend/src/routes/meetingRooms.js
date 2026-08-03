import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getConnection } from '../config/database.js';
import { generateId, paginationParams } from '../utils/helpers.js';

const router = express.Router();

const toOracleBool = (value) => (value === true || value === 1 || value === '1' ? 1 : 0);
const fromOracleBool = (value) => value === 1 || value === true || value === '1' || value == null;

const parseResources = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const mapRoomRow = (row) => ({
  id: row[0],
  name: row[1],
  description: row[2],
  capacity: row[3],
  location: row[4],
  resources: parseResources(row[5]),
  color: row[6] || '#22c55e',
  type: row[7] || 'sala_reuniao',
  unit: row[8] || null,
  sort_order: row[9] ?? 0,
  // null/undefined = ativa (compatibilidade com bancos ainda sem backfill)
  is_active: fromOracleBool(row[10]),
});

const ROOM_SELECT = `id, name, description, capacity, location, resources, color, type, unit, sort_order, is_active`;

// Listar salas de reunião
// ?active_only=true → apenas salas ativas (para agendamento)
router.get('/', authMiddleware, async (req, res) => {
  let connection;
  try {
    const { limit, offset } = paginationParams(req.query);
    const activeOnly = req.query.active_only === 'true' || req.query.active_only === '1';
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT ${ROOM_SELECT}
       FROM cnt_meeting_rooms
       ${activeOnly ? 'WHERE NVL(is_active, 1) = 1' : ''}
       ORDER BY sort_order NULLS LAST, name
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { offset, limit }
    );

    res.json(result.rows.map(mapRoomRow));
  } catch (error) {
    console.error('Erro ao listar salas:', error);
    res.status(500).json({ error: 'Erro ao listar salas' });
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

// Obter sala por ID
router.get('/:id', authMiddleware, async (req, res) => {
  let connection;
  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT ${ROOM_SELECT}
       FROM cnt_meeting_rooms WHERE id = :id`,
      { id: req.params.id }
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sala não encontrada' });
    }

    res.json(mapRoomRow(result.rows[0]));
  } catch (error) {
    console.error('Erro ao obter sala:', error);
    res.status(500).json({ error: 'Erro ao obter sala' });
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

// Criar sala
router.post('/', authMiddleware, async (req, res) => {
  let connection;
  try {
    const {
      name,
      description = null,
      capacity = null,
      location = null,
      resources = [],
      color = '#22c55e',
      type = 'sala_reuniao',
      unit = null,
      sort_order = 0,
      is_active = true,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    connection = await getConnection();
    const roomId = generateId();
    const active = toOracleBool(is_active);

    await connection.execute(
      `INSERT INTO cnt_meeting_rooms (
         id, name, description, capacity, location, resources,
         color, type, unit, sort_order, is_active, created_date
       ) VALUES (
         :id, :name, :description, :capacity, :location, :resources,
         :color, :type, :unit, :sortOrder, :isActive, SYSDATE
       )`,
      {
        id: roomId,
        name,
        description,
        capacity,
        location: location || unit,
        resources: JSON.stringify(resources || []),
        color: color || '#22c55e',
        type: type || 'sala_reuniao',
        unit,
        sortOrder: sort_order ?? 0,
        isActive: active,
      },
      { autoCommit: true }
    );

    res.status(201).json({
      id: roomId,
      message: 'Sala criada com sucesso',
      color: color || '#22c55e',
      type: type || 'sala_reuniao',
      unit,
      is_active: active === 1,
    });
  } catch (error) {
    console.error('Erro ao criar sala:', error);
    res.status(500).json({ error: 'Erro ao criar sala' });
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

// Atualizar sala
router.put('/:id', authMiddleware, async (req, res) => {
  let connection;
  try {
    const allowedFields = {
      name: 'name',
      description: 'description',
      capacity: 'capacity',
      location: 'location',
      color: 'color',
      type: 'type',
      unit: 'unit',
      sort_order: 'sort_order',
    };

    const updates = [];
    const params = { id: req.params.id };
    let paramCount = 1;

    Object.entries(req.body).forEach(([key, value]) => {
      if (value === undefined) return;

      if (key === 'resources') {
        updates.push(`resources = :param${paramCount}`);
        params[`param${paramCount}`] = JSON.stringify(value);
        paramCount++;
        return;
      }

      if (key === 'is_active') {
        updates.push(`is_active = :param${paramCount}`);
        params[`param${paramCount}`] = toOracleBool(value);
        paramCount++;
        return;
      }

      const column = allowedFields[key];
      if (!column) return;

      updates.push(`${column} = :param${paramCount}`);
      params[`param${paramCount}`] = value;
      paramCount++;
    });

    // Formulário envia unit; manter location alinhada quando location não veio no body
    if (req.body.unit !== undefined && req.body.location === undefined) {
      updates.push(`location = :param${paramCount}`);
      params[`param${paramCount}`] = req.body.unit;
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    updates.push('updated_date = SYSDATE');

    connection = await getConnection();
    await connection.execute(
      `UPDATE cnt_meeting_rooms SET ${updates.join(', ')} WHERE id = :id`,
      params,
      { autoCommit: true }
    );

    res.json({ message: 'Sala atualizada com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar sala:', error);
    res.status(500).json({ error: 'Erro ao atualizar sala' });
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

// Deletar sala
router.delete('/:id', authMiddleware, async (req, res) => {
  let connection;
  try {
    connection = await getConnection();

    await connection.execute(
      'DELETE FROM cnt_meeting_rooms WHERE id = :id',
      { id: req.params.id },
      { autoCommit: true }
    );

    res.json({ message: 'Sala deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar sala:', error);
    res.status(500).json({ error: 'Erro ao deletar sala' });
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
