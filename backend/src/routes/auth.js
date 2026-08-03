import express from 'express';
import bcryptjs from 'bcryptjs';
import { generateToken } from '../config/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { getConnection } from '../config/database.js';
import { generateId } from '../utils/helpers.js';
import { authenticateExternalUser } from '../utils/soapAuth.js';

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

// Registrar
router.post('/register', async (req, res) => {
  try {
    const { username, password, full_name } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Usuário obrigatório' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres' });
    }

    const connection = await getConnection();

    // Verificar se usuário já existe
    const existing = await connection.execute(
      'SELECT id, password_hash, full_name FROM cnt_users WHERE email = :username',
      { username }
    );

    const hashedPassword = await bcryptjs.hash(password, 10);
    const fullName = full_name || username;
    const userId = existing.rows.length > 0 ? existing.rows[0][0] : generateId();

    if (existing.rows.length > 0) {
      await connection.execute(
        `UPDATE cnt_users
         SET password_hash = :passwordHash,
             full_name = :fullName,
             status = 'disponivel'
         WHERE id = :id`,
        {
          passwordHash: hashedPassword,
          fullName,
          id: userId
        },
        { autoCommit: true }
      );
    } else {
      await connection.execute(
        `INSERT INTO cnt_users (id, email, password_hash, full_name, role, status, created_date)
         VALUES (:id, :username, :password, :fullName, 'user', 'disponivel', SYSDATE)`,
        {
          id: userId,
          username,
          password: hashedPassword,
          fullName
        },
        { autoCommit: true }
      );
    }

    await connection.close();

    const token = generateToken(userId);

    res.status(existing.rows.length > 0 ? 200 : 201).json({
      user: {
        id: userId,
        email: username,
        full_name: fullName,
        role: 'user'
      },
      token
    });
  } catch (error) {
    console.error('Erro ao registrar:', error);
    res.status(500).json({ error: 'Erro ao registrar usuário' });
  }
});

// Login — autenticação obrigatória via webservice Senior (AuthenticateJAAS)
router.post('/login', async (req, res) => {
  let connection;
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }

    if (!process.env.EXTERNAL_AUTH_URL) {
      console.error('EXTERNAL_AUTH_URL não configurado');
      return res.status(500).json({ error: 'Autenticação externa não configurada' });
    }

    let authCode;
    try {
      authCode = await authenticateExternalUser(username, password);
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[auth] authenticateExternalUser returned', authCode);
      }
    } catch (error) {
      console.error('Erro ao fazer login via SOAP:', error);
      return res.status(502).json({ error: 'Não foi possível validar usuário e senha no webservice' });
    }

    // pmLogged === 0 → credenciais ok; qualquer outro valor → senha/usuário inválidos
    if (authCode !== 0) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }

    connection = await getConnection();

    const result = await connection.execute(
      'SELECT id, full_name, role, status, password_hash FROM cnt_users WHERE email = :username',
      { username }
    );

    let userRecord;
    let needsProfileCompletion = false;

    if (result.rows.length === 0) {
      const userId = generateId();
      const hashedPassword = await bcryptjs.hash(password, 10);
      await connection.execute(
        `INSERT INTO cnt_users (id, email, password_hash, full_name, role, status, created_date)
         VALUES (:id, :username, :passwordHash, :fullName, 'user', 'disponivel', SYSDATE)`,
        {
          id: userId,
          username,
          passwordHash: hashedPassword,
          fullName: username
        },
        { autoCommit: true }
      );
      userRecord = [userId, username, 'user', 'disponivel'];
      needsProfileCompletion = true;
    } else {
      const [id, fullName, role, status, passwordHash] = result.rows[0];
      userRecord = [id, fullName, role, status];

      if (status === 'desativado') {
        return res.status(403).json({
          error: 'Usuário desativado. Contate o administrador do sistema.',
        });
      }

      if (!passwordHash) {
        const hashedPassword = await bcryptjs.hash(password, 10);
        await connection.execute(
          `UPDATE cnt_users
           SET password_hash = :passwordHash,
               full_name = COALESCE(full_name, :fullName)
           WHERE id = :id`,
          {
            passwordHash: hashedPassword,
            fullName: username,
            id
          },
          { autoCommit: true }
        );
      }
    }

    const [id, fullName, role, status] = userRecord;
    const token = generateToken(id);

    res.json({
      user: {
        id,
        email: username,
        full_name: fullName,
        role,
        status
      },
      token,
      needs_profile_completion: needsProfileCompletion
    });
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    res.status(500).json({ error: 'Erro ao fazer login' });
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

// Obter usuário atual
router.get('/me', authMiddleware, async (req, res) => {
  let connection;
  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT id, email, full_name, role, status, position, phone, email_signature, unit, work_schedule
       FROM cnt_users WHERE id = :id`,
      { id: req.userId }
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const [id, email, fullName, role, status, position, phone, emailSignature, unit, workSchedule] = result.rows[0];

    if (status === 'desativado') {
      return res.status(403).json({
        error: 'Usuário desativado. Contate o administrador do sistema.',
        code: 'user_disabled',
      });
    }

    // LOB precisa ser lido com a conexão ainda aberta
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

// Logout (apenas remove token no frontend)
router.post('/logout', authMiddleware, (req, res) => {
  res.json({ message: 'Logout realizado com sucesso' });
});

export default router;
