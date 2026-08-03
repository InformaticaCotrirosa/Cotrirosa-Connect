/**
 * Posiciona eventos com horário sobrepostos lado a lado (estilo Outlook).
 * Retorna Map<eventId, { column, columnCount, leftPct, widthPct }>.
 */
export function layoutOverlappingEvents(events) {
  if (!events?.length) return new Map();

  const items = events
    .map((event) => ({
      event,
      start: new Date(event.start_date).getTime(),
      end: Math.max(new Date(event.end_date).getTime(), new Date(event.start_date).getTime() + 1),
    }))
    .sort((a, b) => a.start - b.start || b.end - a.end);

  // Agrupa em clusters conectados por sobreposição de tempo
  const clusters = [];
  let current = [];
  let clusterEnd = -Infinity;

  for (const item of items) {
    if (current.length && item.start >= clusterEnd) {
      clusters.push(current);
      current = [];
      clusterEnd = -Infinity;
    }
    current.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  if (current.length) clusters.push(current);

  const layout = new Map();

  for (const cluster of clusters) {
    /** @type {number[]} fim do último evento em cada coluna */
    const columnEnds = [];

    for (const item of cluster) {
      let col = 0;
      while (col < columnEnds.length && columnEnds[col] > item.start) {
        col += 1;
      }
      if (col === columnEnds.length) {
        columnEnds.push(item.end);
      } else {
        columnEnds[col] = item.end;
      }
      item.column = col;
    }

    const columnCount = columnEnds.length;
    const widthPct = 100 / columnCount;

    for (const item of cluster) {
      layout.set(item.event.id, {
        column: item.column,
        columnCount,
        leftPct: item.column * widthPct,
        widthPct,
      });
    }
  }

  return layout;
}
