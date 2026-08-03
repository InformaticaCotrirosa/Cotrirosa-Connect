/**
 * Intervalo de datas para listagem de agendas (ano da data de referência ± 1 mês).
 */
export function getEventsFetchRange(referenceDate = new Date()) {
  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const year = ref.getFullYear();
  const from = new Date(year, 0, 1, 0, 0, 0, 0);
  from.setMonth(from.getMonth() - 1);
  const to = new Date(year, 11, 31, 23, 59, 59, 999);
  to.setMonth(to.getMonth() + 1);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    year,
  };
}

/** Intervalo amplo para conflitos / monitores (ano atual completo + próximo). */
export function getWideEventsFetchRange(referenceDate = new Date()) {
  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const year = ref.getFullYear();
  const from = new Date(year, 0, 1, 0, 0, 0, 0);
  const to = new Date(year + 1, 11, 31, 23, 59, 59, 999);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}
