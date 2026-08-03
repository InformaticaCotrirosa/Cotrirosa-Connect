/**
 * Expande datas de recorrência até 31/12 do ano da data inicial.
 */
export function getYearEnd(fromDate) {
  const d = new Date(fromDate);
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
}

export function advanceDate(date, rule) {
  const next = new Date(date);
  switch (rule) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly': {
      const day = next.getDate();
      next.setMonth(next.getMonth() + 1);
      // Evita overflow (ex.: 31 jan -> 2/3 mar)
      if (next.getDate() < day) {
        next.setDate(0);
      }
      break;
    }
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      throw new Error(`Regra de recorrência inválida: ${rule}`);
  }
  return next;
}

/**
 * Retorna lista de { start_date, end_date } incluindo a ocorrência inicial,
 * até o fim do ano (inclusive).
 */
export function expandRecurrence(startDate, endDate, rule) {
  const start = new Date(startDate);
  const end = new Date(endDate || startDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Datas inválidas para recorrência');
  }

  const durationMs = Math.max(0, end.getTime() - start.getTime());
  const yearEnd = getYearEnd(start);
  const instances = [];

  let cursor = new Date(start);
  // Limite de segurança (ex.: diário ~366)
  const maxInstances = 400;

  while (cursor.getTime() <= yearEnd.getTime() && instances.length < maxInstances) {
    instances.push({
      start_date: new Date(cursor),
      end_date: new Date(cursor.getTime() + durationMs),
    });
    cursor = advanceDate(cursor, rule);
  }

  return instances;
}

export function countRecurrenceInstances(startDate, endDate, rule) {
  return expandRecurrence(startDate, endDate, rule).length;
}
