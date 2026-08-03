import React, { useMemo } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay, isToday,
  parseISO, isWithinInterval, startOfDay, endOfDay,
  differenceInCalendarDays, addDays, min, max,
} from 'date-fns';

export default function MonthView({ currentDate, events, pendingEventIds, confirmedEventIds, onDayClick, onEventClick }) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // For each event, compute start/end as day-boundaries
  const processedEvents = useMemo(() => {
    return events.map(e => ({
      ...e,
      _start: startOfDay(new Date(e.start_date)),
      _end: startOfDay(new Date(e.end_date)),
    }));
  }, [events]);

  // Build layout rows per week to place multi-day events in consistent slots
  const weekLayouts = useMemo(() => {
    return weeks.map(week => {
      const weekStart = week[0];
      const weekEnd = week[6];

      // Get all events that intersect this week
      const weekEvents = processedEvents.filter(e =>
        e._start <= weekEnd && e._end >= weekStart
      );

      // Sort: multi-day first (longer first), then single-day by start
      weekEvents.sort((a, b) => {
        const durA = differenceInCalendarDays(a._end, a._start);
        const durB = differenceInCalendarDays(b._end, b._start);
        if (durA !== durB) return durB - durA;
        return a._start - b._start;
      });

      // Assign rows (slots) to events — greedy, no overlap
      const rows = []; // rows[rowIndex] = array of { event, startCol, span }
      const placed = [];

      weekEvents.forEach(event => {
        const clampedStart = max([event._start, weekStart]);
        const clampedEnd = min([event._end, weekEnd]);
        const startCol = differenceInCalendarDays(clampedStart, weekStart);
        const span = differenceInCalendarDays(clampedEnd, clampedStart) + 1;

        // Find first row where this event doesn't conflict
        let rowIndex = 0;
        while (true) {
          if (!rows[rowIndex]) { rows[rowIndex] = []; break; }
          const conflict = rows[rowIndex].some(p =>
            p.startCol < startCol + span && p.startCol + p.span > startCol
          );
          if (!conflict) break;
          rowIndex++;
        }
        if (!rows[rowIndex]) rows[rowIndex] = [];
        rows[rowIndex].push({ event, startCol, span, rowIndex });
        placed.push({ event, startCol, span, rowIndex });
      });

      // Build per-day: list of {event, startCol, span, rowIndex, isStart, isEnd}
      const daySlots = week.map((day, colIndex) => {
        return placed
          .filter(p => p.startCol <= colIndex && p.startCol + p.span > colIndex)
          .map(p => ({
            ...p,
            isStart: p.startCol === colIndex,
            isEnd: p.startCol + p.span - 1 === colIndex,
          }))
          .sort((a, b) => a.rowIndex - b.rowIndex);
      });

      return { placed, daySlots, rowCount: rows.length };
    });
  }, [weeks, processedEvents]);

  const MAX_ROWS = 3;

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-7">
        {weekDays.map(day => (
          <div key={day} className="py-2.5 text-center text-xs font-medium text-muted-foreground border-b border-border">
            {day}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, weekIdx) => {
        const layout = weekLayouts[weekIdx];
        const visibleRows = MAX_ROWS;

        return (
          <div key={weekIdx} className="grid grid-cols-7 border-b border-border last:border-b-0">
            {week.map((day, colIdx) => {
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isCurrentDay = isToday(day);
              const slots = layout.daySlots[colIdx];

              // Count how many events are hidden
              const hiddenCount = slots.filter(s => s.rowIndex >= visibleRows).length;

              // Build visible slots (up to MAX_ROWS), filling gaps with null
              const visibleSlots = [];
              for (let r = 0; r < visibleRows; r++) {
                const slot = slots.find(s => s.rowIndex === r);
                visibleSlots.push(slot || null);
              }

              return (
                <div
                  key={colIdx}
                  onClick={() => onDayClick(day)}
                  className={`min-h-[110px] md:min-h-[130px] p-1 border-r border-border last:border-r-0 cursor-pointer hover:bg-muted/40 transition-colors relative ${
                    !isCurrentMonth ? 'bg-muted/20' : ''
                  }`}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-start mb-1 pl-0.5">
                    <span
                      className={`w-6 h-6 flex items-center justify-center text-xs rounded-full ${
                        isCurrentDay
                          ? 'bg-primary text-primary-foreground font-bold'
                          : isCurrentMonth
                          ? 'text-foreground font-medium'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>

                  {/* Event slots */}
                  <div className="space-y-0.5 mt-0.5">
                    {visibleSlots.map((slot, rowIdx) => {
                      if (!slot) {
                        // Empty spacer to keep rows aligned
                        return <div key={rowIdx} className="h-[18px]" />;
                      }

                      const { event, isStart, isEnd, span } = slot;
                      const isMultiDay = differenceInCalendarDays(event._end, event._start) > 0;
                      const color = event.color || '#22c55e';

                      const isPending = pendingEventIds?.has(event.id);
                      const isConfirmed = confirmedEventIds?.has(event.id);
                      const prefix = isPending ? '⚠️ ' : isConfirmed ? '✅ ' : '';

                      if (isMultiDay) {
                        return (
                          <button
                            key={event.id + '-' + rowIdx}
                            onClick={e => { e.stopPropagation(); onEventClick(event); }}
                            title={event.title}
                            className={`h-[18px] w-full flex items-center text-[10px] font-semibold truncate transition-opacity hover:opacity-85 ${
                              isStart ? 'rounded-l-full pl-2' : 'pl-1'
                            } ${
                              isEnd ? 'rounded-r-full pr-2' : 'pr-1'
                            } ${
                              isPending ? 'event-pending' : ''
                            }`}
                            style={{
                              backgroundColor: color,
                              color: '#fff',
                              marginLeft: isStart ? 0 : '-1px',
                              marginRight: isEnd ? 0 : '-1px',
                            }}
                          >
                            {isStart && (
                              <span className="truncate">{prefix}{event.title}</span>
                            )}
                          </button>
                        );
                      } else {
                        return (
                          <button
                            key={event.id + '-' + rowIdx}
                            onClick={e => { e.stopPropagation(); onEventClick(event); }}
                            className={`w-full text-left px-1.5 h-[18px] flex items-center rounded text-[10px] font-medium truncate hover:opacity-80 transition-opacity ${isPending ? 'event-pending' : ''}`}
                            style={{ backgroundColor: color + '25', color: color }}
                          >
                            {!event.all_day && (
                              <span className="mr-1 shrink-0 font-bold">{format(new Date(event.start_date), 'HH:mm')}</span>
                            )}
                            <span className="truncate">{prefix}{event.title}</span>
                          </button>
                        );
                      }
                    })}

                    {hiddenCount > 0 && (
                      <p className="text-[10px] text-muted-foreground px-1.5 h-[18px] flex items-center">
                        +{hiddenCount} mais
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}