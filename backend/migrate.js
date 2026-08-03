import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';
import initializeDatabase, { getConnection } from './src/config/database.js';

const runMigration = async () => {
  try {
    const schemaPath = path.resolve('./database-schema.sql');
    const content = await fs.readFile(schemaPath, 'utf8');

    // Normalizar quebras de linha
    const normalized = content.replace(/\r\n/g, '\n');

    // Remover comentários de linha e instruções não SQL (PRINT)
    const withoutComments = normalized
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n');

    // Separar por ';' seguido de nova linha (bom para blocos simples)
    const rawStatements = withoutComments.split(/;\s*\n/);

    // Executar apenas CREATE TABLE, para não alterar índices ou outros objetos
    const tableStatements = rawStatements.filter((stmt) => {
      const trimmed = stmt.trim();
      return /^CREATE\s+TABLE\b/i.test(trimmed);
    });

    // Inicializar pool
    await initializeDatabase();

    const connection = await getConnection();

    try {
      for (let stmt of tableStatements) {
        const s = stmt.trim();
        if (!s) continue;
        // Ignorar instruções não suportadas no driver (ex: PRINT)
        if (/^PRINT\b/i.test(s)) continue;

        console.log('Executando:', s.slice(0, 120).replace(/\n/g, ' '));
        try {
          await connection.execute(s);
        } catch (err) {
          const code = err && err.errorNum ? err.errorNum : null;
          if (code === 955 || code === 1408) {
            console.warn('Ignorando objeto já existente:', err.message || err);
            continue;
          }
          console.error('Erro ao executar statement:', err.message || err);
          throw err;
        }
      }

      // Commit final
      await connection.commit();
      console.log('Migração concluída com sucesso.');
    } finally {
      try { await connection.close(); } catch (e) { /* ignore */ }
    }
  } catch (error) {
    console.error('Falha na migração:', error);
    process.exit(1);
  }
};

if (process.argv[2] === '--yes') {
  runMigration();
} else {
  console.log('Este script irá executar `backend/database-schema.sql` no Oracle configurado por variáveis de ambiente.');
  console.log('Para executar automaticamente, rode: `node backend/migrate.js --yes`');
}
