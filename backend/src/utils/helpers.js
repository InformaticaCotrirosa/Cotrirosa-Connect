import { v4 as uuidv4 } from 'uuid';

export const generateId = () => uuidv4();

export const formatDate = (date) => {
  if (!date) return null;
  return new Date(date).toISOString();
};

export const parseOracleDate = (oracleDate) => {
  if (!oracleDate) return null;
  return new Date(oracleDate).toISOString();
};

export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const paginationParams = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  // Permite carregar agendas de longas séries recorrentes
  const limit = Math.min(5000, parseInt(query.limit) || 50);
  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

export const buildWhereClause = (filters) => {
  const conditions = [];
  const params = [];
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      conditions.push(`${key} = ?`);
      params.push(value);
    }
  });
  
  return {
    clause: conditions.length ? ' WHERE ' + conditions.join(' AND ') : '',
    params
  };
};
