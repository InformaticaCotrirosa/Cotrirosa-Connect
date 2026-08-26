import oracledb from 'oracledb';
import 'dotenv/config';

// TNS alias (ex.: PROD) precisa de tnsnames.ora apontado por TNS_ADMIN
if (process.env.TNS_ADMIN?.trim()) {
  process.env.TNS_ADMIN = process.env.TNS_ADMIN.trim();
}

// Instant Client (thick). Sem isso, node-oracledb 6+ usa modo Thin (Easy Connect).
if (process.env.ORACLE_CLIENT_LIB?.trim()) {
  try {
    oracledb.initOracleClient({ libDir: process.env.ORACLE_CLIENT_LIB.trim() });
    console.log('✓ Oracle Instant Client inicializado a partir de', process.env.ORACLE_CLIENT_LIB);
  } catch (err) {
    console.warn('⚠️ Não foi possível inicializar Oracle Instant Client:', err.message || err);
  }
}

const initializeDatabase = async () => {
  try {
    // CLOBs como string evitam LOB streaming após fechar a conexão
    oracledb.fetchAsString = [oracledb.CLOB];

    // Configurar pool de conexões
    await oracledb.createPool({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectionString: process.env.ORACLE_CONNECTION_STRING,
      poolMin: 1,
      poolMax: 10,
      poolIncrement: 1,
    });

    const schema = process.env.ORACLE_SCHEMA?.trim();
    if (schema) {
      console.log(`✓ Pool de conexões Oracle criado (schema padrão: ${schema})`);
    } else {
      console.log('✓ Pool de conexões Oracle criado com sucesso');
    }
  } catch (error) {
    console.error('✗ Erro ao conectar ao Oracle:', error);
    throw error;
  }
};

export const getConnection = async () => {
  try {
    const pool = oracledb.getPool();
    const connection = await pool.getConnection();

    const schema = process.env.ORACLE_SCHEMA?.trim();
    if (schema) {
      // Identificador Oracle: só letras, números e underscore
      if (!/^[A-Za-z][A-Za-z0-9_$#]*$/.test(schema)) {
        await connection.close();
        throw new Error(`ORACLE_SCHEMA inválido: ${schema}`);
      }
      await connection.execute(`ALTER SESSION SET CURRENT_SCHEMA = ${schema}`);
    }

    return connection;
  } catch (error) {
    console.error('Erro ao obter conexão:', error);
    throw error;
  }
};

export default initializeDatabase;
