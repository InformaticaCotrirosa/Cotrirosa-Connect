import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getConnection } from '../config/database.js';
import { generateId, paginationParams } from '../utils/helpers.js';

const router = express.Router();

// Listar departamentos
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { limit, offset } = paginationParams(req.query);
    const connection = await getConnection();
    
    const result = await connection.execute(
      `SELECT id, name, description, unit, manager_id
       FROM cnt_departments
       ORDER BY name
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { offset, limit }
    );

    const departments = result.rows.map(row => ({
      id: row[0],
      name: row[1],
      description: row[2],
      unit: row[3],
      manager_id: row[4]
    }));

    await connection.close();

    res.json(departments);
  } catch (error) {
    console.error('Erro ao listar departamentos:', error);
    res.status(500).json({ error: 'Erro ao listar departamentos' });
  }
});

// Obter departamento por ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const connection = await getConnection();
    
    const result = await connection.execute(
      `SELECT id, name, description, unit, manager_id
       FROM cnt_departments WHERE id = :id`,
      { id: req.params.id }
    );

    await connection.close();

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Departamento não encontrado' });
    }

    const row = result.rows[0];
    res.json({
      id: row[0],
      name: row[1],
      description: row[2],
      unit: row[3],
      manager_id: row[4]
    });
  } catch (error) {
    console.error('Erro ao obter departamento:', error);
    res.status(500).json({ error: 'Erro ao obter departamento' });
  }
});

// Criar departamento (admin apenas)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, description, unit, manager_id } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    const connection = await getConnection();
    const deptId = generateId();

    await connection.execute(
      `INSERT INTO cnt_departments (id, name, description, unit, manager_id, created_date)
       VALUES (:id, :name, :description, :unit, :managerId, SYSDATE)`,
      {
        id: deptId,
        name,
        description,
        unit,
        managerId: manager_id
      },
      { autoCommit: true }
    );

    await connection.close();

    res.status(201).json({ id: deptId, message: 'Departamento criado com sucesso' });
  } catch (error) {
    console.error('Erro ao criar departamento:', error);
    res.status(500).json({ error: 'Erro ao criar departamento' });
  }
});

// Atualizar departamento
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const updates = [];
    const params = { id: req.params.id };
    let paramCount = 1;

    Object.entries(req.body).forEach(([key, value]) => {
      if (value !== undefined) {
        const colName = key.toUpperCase();
        updates.push(`${colName} = :param${paramCount}`);
        params[`param${paramCount}`] = value;
        paramCount++;
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    const connection = await getConnection();
    await connection.execute(
      `UPDATE cnt_departments SET ${updates.join(', ')} WHERE id = :id`,
      params,
      { autoCommit: true }
    );
    await connection.close();

    res.json({ message: 'Departamento atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar departamento:', error);
    res.status(500).json({ error: 'Erro ao atualizar departamento' });
  }
});

// Deletar departamento
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const connection = await getConnection();
    
    await connection.execute(
      'DELETE FROM cnt_departments WHERE id = :id',
      { id: req.params.id },
      { autoCommit: true }
    );

    await connection.close();

    res.json({ message: 'Departamento deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar departamento:', error);
    res.status(500).json({ error: 'Erro ao deletar departamento' });
  }
});

export default router;
