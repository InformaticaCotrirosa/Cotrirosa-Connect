import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getConnection } from '../config/database.js';
import { paginationParams } from '../utils/helpers.js';

const router = express.Router();

const normalizeOracleLob = async (value) => {
  if (!value) return null;

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value.getData === 'function') {
    return await value.getData();
  }

  if (typeof value.setEncoding === 'function' && typeof value.read === 'function' && typeof value.close === 'function') {
    await value.setEncoding('utf8');
    let text = '';
    while (true) {
      const chunk = await value.read(4000);
      if (chunk === null || chunk === undefined || chunk === '') {
        break;
      }
      text += chunk;
    }
    await value.close();
    return text;
  }

  return value ?? null;
};

// Listar usuários
router.get('/', authMiddleware, async (req, res) => {
  let connection;
  try {
    const { limit, offset } = paginationParams(req.query);
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT id, email, full_name, role, status, position, phone, unit, work_schedule
       FROM cnt_users
       ORDER BY full_name
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { offset, limit }
    );

    const users = [];
    for (const row of result.rows) {
      const [id, email, fullName, role, status, position, phone, unit, workSchedule] = row;
      let normalizedWorkSchedule = null;
      try {
        const rawSchedule = await normalizeOracleLob(workSchedule);
        normalizedWorkSchedule = rawSchedule ? JSON.parse(rawSchedule) : null;
      } catch (_) {
        // ignore parse errors
      }
      users.push({
        id,
        email,
        full_name: fullName,
        role,
        status,
        position,
        phone,
        unit,
        work_schedule: normalizedWorkSchedule
      });
    }

    res.json(users);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ error: 'Erro ao listar usuários' });
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

// Obter usuário por ID
router.get('/:id', authMiddleware, async (req, res) => {
  let connection;
  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT id, email, full_name, role, status, position, phone, email_signature, unit, work_schedule
       FROM cnt_users WHERE id = :id`,
      { id: req.params.id }
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const [id, email, fullName, role, status, position, phone, emailSignature, unit, workSchedule] = result.rows[0];
    let normalizedEmailSignature = null;
    let normalizedWorkSchedule = null;
    try {
      normalizedEmailSignature = await normalizeOracleLob(emailSignature);
    } catch (lobError) {
      console.warn('Não foi possível ler email_signature:', lobError.message);
    }
    try {
      const rawSchedule = await normalizeOracleLob(workSchedule);
      normalizedWorkSchedule = rawSchedule ? JSON.parse(rawSchedule) : null;
    } catch (lobError) {
      console.warn('Não foi possível ler work_schedule:', lobError.message);
    }

    res.json({
      id,
      email,
      full_name: fullName,
      role,
      status,
      position,
      phone,
      email_signature: normalizedEmailSignature,
      unit,
      work_schedule: normalizedWorkSchedule
    });
  } catch (error) {
    console.error('Erro ao obter usuário:', error);
    res.status(500).json({ error: 'Erro ao obter usuário' });
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

// Atualizar usuário
router.put('/:id', authMiddleware, async (req, res) => {
  let connection;
  try {
    const isSelfUpdate = req.params.id === req.userId;
    const { full_name, position, phone, email_signature, status, unit, work_schedule, role } = req.body;

    connection = await getConnection();

    const currentUserResult = await connection.execute(
      'SELECT role FROM cnt_users WHERE id = :id',
      { id: req.userId }
    );

    if (currentUserResult.rows.length === 0) {
      return res.status(401).json({ error: 'Usuário autenticado não encontrado' });
    }

    const currentRole = currentUserResult.rows[0][0];
    const isAdmin = currentRole === 'admin';

    // Só o próprio usuário ou um admin pode atualizar
    if (!isSelfUpdate && !isAdmin) {
      return res.status(403).json({ error: 'Permissão negada' });
    }

    // Apenas admin pode alterar role
    if (role !== undefined && !isAdmin) {
      return res.status(403).json({ error: 'Apenas administradores podem alterar o perfil de acesso' });
    }

    const ALLOWED_ROLES = ['admin', 'gerente', 'coordenador', 'user'];
    if (role !== undefined && !ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        error: 'Perfil inválido. Use admin, gerente, coordenador ou user',
      });
    }

    // Impede remover o último administrador do sistema
    if (role !== undefined && role !== 'admin') {
      const targetResult = await connection.execute(
        'SELECT role FROM cnt_users WHERE id = :id',
        { id: req.params.id }
      );
      if (targetResult.rows.length === 0) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      const targetRole = targetResult.rows[0][0];
      if (targetRole === 'admin') {
        const adminCountResult = await connection.execute(
          `SELECT COUNT(*) FROM cnt_users WHERE role = 'admin'`
        );
        const adminCount = Number(adminCountResult.rows[0][0] || 0);
        if (adminCount <= 1) {
          return res.status(400).json({ error: 'Não é possível remover o último administrador' });
        }
      }
    }

    const updates = [];
    const params = { id: req.params.id };

    if (full_name !== undefined) {
      const trimmedName = String(full_name).trim();
      if (!trimmedName) {
        return res.status(400).json({ error: 'Nome é obrigatório' });
      }
      updates.push('full_name = :fullName');
      params.fullName = trimmedName;
    }
    if (position !== undefined) {
      updates.push('position = :position');
      params.position = position;
    }
    if (phone !== undefined) {
      updates.push('phone = :phone');
      params.phone = phone;
    }
    if (email_signature !== undefined) {
      updates.push('email_signature = :emailSignature');
      params.emailSignature = email_signature;
    }
    // Status: próprio usuário ou admin
    if (status !== undefined) {
      if (!isSelfUpdate && !isAdmin) {
        return res.status(403).json({ error: 'Apenas administradores podem alterar o status de outros usuários' });
      }
      updates.push('status = :status');
      params.status = status;
    }
    if (unit !== undefined) {
      updates.push('unit = :unit');
      params.unit = unit;
    }
    if (work_schedule !== undefined) {
      updates.push('work_schedule = :workSchedule');
      params.workSchedule = JSON.stringify(work_schedule);
    }
    if (role !== undefined && isAdmin) {
      updates.push('role = :role');
      params.role = role;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    updates.push('updated_date = SYSDATE');

    await connection.execute(
      `UPDATE cnt_users SET ${updates.join(', ')} WHERE id = :id`,
      params,
      { autoCommit: true }
    );

    res.json({ message: 'Usuário atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
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

// Deletar usuário
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    // Apenas admin pode deletar
    // TODO: Verificar se é admin
    
    const connection = await getConnection();
    
    await connection.execute(
      'DELETE FROM cnt_users WHERE id = :id',
      { id: req.params.id },
      { autoCommit: true }
    );

    await connection.close();

    res.json({ message: 'Usuário deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    res.status(500).json({ error: 'Erro ao deletar usuário' });
  }
});

export default router;
