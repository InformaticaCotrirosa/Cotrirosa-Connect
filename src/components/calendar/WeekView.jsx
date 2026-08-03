import React, { useMemo } from 'react';
import { startOfWeek, addDays, format, isSameDay, isToday, startOfDay, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { layoutOverlappingEvents } from '@/lib/eventLayout';

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7am to 8pm
const GAP_PX = 1;

export default function WeekView({ currentDate, events, pendingEventIds, confirmedEventIds, onEventClick, onSlotClick }) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const weekEnd = days[6];

  // Multi-day events that span more than one day and intersect this week
  const multiDayEvents = events.filter(e => {
    const start = startOfDay(new Date(e.start_date));
    const end = startOfDay(new Date(e.end_date));
    return differenceInCalendarDays(end, start) > 0 && start <= weekEnd && end >= weekStart;
  });

  const eventsByDay = useMemo(() => {
    return days.map((day) => {
      const dayEvents = events.filter((e) => {
        const start = startOfDay(new Date(e.start_date));
        const end = startOfDay(new Date(e.end_date));
        return isSameDay(start, day) && differenceInCalendarDays(end, start) === 0;
      });
      return {
        day,
        dayEvents,
        layout: layoutOverlappingEvents(dayEvents),
      };
    });
  }, [days, events]);

  const getEventPosition = (event) => {
    const start = new Date(event.start_date);
    const end = new Date(event.end_date);
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    const top = Math.max((startHour - 7) * 60, 0);
    const height = Math.max((endHour - startHour) * 60, 20);
    return { top, height };
  };

  // For each multi-day event, compute which columns (days) it spans this week
  const getMultiDaySpan = (event) => {
    const start = startOfDay(new Date(event.start_date));
    const end = startOfDay(new Date(event.end_date));
    let startCol = days.findIndex(d => isSameDay(d, start));
    let endCol = days.findIndex(d => isSameDay(d, end));
    if (startCol === -1) startCol = 0;
    if (endCol === -1) endCol = 6;
    return { startCol, endCol };
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header with day names */}
      <div className="grid grid-cols-8 border-b border-border">
        <div className="w-16 shrink-0" />
        {days.map((day, i) => (
          <div
            key={i}
            className={`py-3 text-center border-l border-border ${isToday(day) ? 'bg-primary/5' : ''}`}
          >
            <p className="text-[10px] text-muted-foreground uppercase">
              {format(day, 'EEE', { locale: ptBR })}
            </p>
            <p className={`text-lg font-semibold mt-0.5 ${isToday(day) ? 'text-primary' : ''}`}>
              {format(day, 'd')}
            </p>
          </div>
        ))}
      </div>

      {/* Multi-day events row */}
      {multiDayEvents.length > 0 && (
        <div className="grid grid-cols-8 border-b border-border bg-muted/20 py-1.5">
          <div className="w-16 shrink-0 flex items-center justify-end pr-2">
            <span className="text-[10px] text-muted-foreground">multi-dia</span>
          </div>
          <div className="col-span-7 relative" style={{ minHeight: `${multiDayEvents.length * 24 + 4}px` }}>
            {multiDayEvents.map((event, idx) => {
              const { startCol, endCol } = getMultiDaySpan(event);
              const color = event.color || '#22c55e';
              const isStartInWeek = startOfDay(new Date(event.start_date)) >= weekStart;
              const isEndInWeek = startOfDay(new Date(event.end_date)) <= weekEnd;
              const totalCols = 7;
              const left = `${(startCol / totalCols) * 100}%`;
              const width = `${((endCol - startCol + 1) / totalCols) * 100}%`;
              const isPending = pendingEventIds?.has(event.id);
              const isConfirmed = confirmedEventIds?.has(event.id);
              const prefix = isPending ? '⚠️ ' : isConfirmed ? '✅ ' : '';

              return (
                <button
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  title={event.title}
                  className={`absolute text-[10px] font-semibold text-white flex items-center truncate hover:opacity-85 transition-opacity ${
                    isStartInWeek ? 'rounded-l-full pl-3' : 'pl-2'
                  } ${
                    isEndInWeek ? 'rounded-r-full pr-3' : 'pr-1'
                  } ${isPending ? 'event-pending' : ''}`}
                  style={{
                    left,
                    width,
                    top: `${idx * 24 + 2}px`,
                    height: '20px',
                    backgroundColor: color,
                  }}
                >
                  {isStartInWeek && <span className="truncate">{prefix}{event.title}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Time Grid */}
      <div className="overflow-y-auto max-h-[580px]">
        <div className="grid grid-cols-8 relative">
          <div className="w-16 shrink-0">
            {HOURS.map(hour => (
              <div key={hour} className="h-[60px] flex items-start justify-end pr-2 -mt-2">
                <span className="text-[10px] text-muted-foreground">
                  {String(hour).padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>
          {eventsByDay.map(({ day, dayEvents, layout: dayLayout }, dayIdx) => (
              <div key={dayIdx} className="border-l border-border relative">
                {HOURS.map(hour => (
                  <div
                    key={hour}
                    className="h-[60px] border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => {
                      const slotDate = new Date(day);
                      slotDate.setHours(hour, 0, 0, 0);
                      onSlotClick(slotDate);
                    }}
                  />
                ))}
                {dayEvents.map((event) => {
                  const { top, height } = getEventPosition(event);
                  const layout = dayLayout.get(event.id) || { leftPct: 0, widthPct: 100 };
                  const isPending = pendingEventIds?.has(event.id);
                  const isConfirmed = confirmedEventIds?.has(event.id);
                  const prefix = isPending ? '⚠️ ' : isConfirmed ? '✅ ' : '';
                  return (
                    <button
                      key={event.id}
                      onClick={() => onEventClick(event)}
                      title={[event.title, event.location].filter(Boolean).join(' — ')}
                      className={`absolute rounded px-1 py-0.5 text-[10px] font-medium overflow-hidden hover:opacity-90 transition-opacity z-10 ${isPending ? 'event-pending' : ''}`}
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        left: `calc(${layout.leftPct}% + ${GAP_PX}px)`,
                        width: `calc(${layout.widthPct}% - ${GAP_PX * 2}px)`,
                        backgroundColor: (event.color || '#22c55e') + '20',
                        color: event.color || '#22c55e',
                        borderLeft: `2px solid ${event.color || '#22c55e'}`,
                      }}
                    >
                      <p className="truncate font-semibold">{prefix}{event.title}</p>
                      <p className="truncate opacity-75">
                        {format(new Date(event.start_date), 'HH:mm')} - {format(new Date(event.end_date), 'HH:mm')}
                      </p>
                    </button>
                  );
                })}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
