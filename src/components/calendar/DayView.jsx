import React, { useMemo, useState, useEffect } from 'react';
import { format, isSameDay, isToday, startOfDay, differenceInCalendarDays } from 'date-fns';
import { layoutOverlappingEvents } from '@/lib/eventLayout';

const GRID_START_HOUR = 6;
const HOURS = Array.from({ length: 16 }, (_, i) => i + GRID_START_HOUR); // 6am to 9pm
const HOUR_HEIGHT = 60;
const GAP_PX = 2;

export default function DayView({ currentDate, events, pendingEventIds, confirmedEventIds, onEventClick, onSlotClick }) {
  const day = startOfDay(currentDate);
  const dayKey = day.getTime();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let intervalId;
    const tick = () => setNow(new Date());
    const msToNextMinute = 60_000 - (Date.now() % 60_000) + 50;
    const timeoutId = setTimeout(() => {
      tick();
      intervalId = setInterval(tick, 60_000);
    }, msToNextMinute);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  // Multi-day events: span more than one calendar day and touch today
  const multiDayEvents = events.filter(e => {
    const start = startOfDay(new Date(e.start_date));
    const end = startOfDay(new Date(e.end_date));
    return differenceInCalendarDays(end, start) > 0 && start <= day && end >= day;
  });

  // Single-day events that start on this day
  const timedEvents = useMemo(() => {
    const dayStart = startOfDay(new Date(dayKey));
    return events.filter(e => {
      const start = startOfDay(new Date(e.start_date));
      const end = startOfDay(new Date(e.end_date));
      return isSameDay(start, dayStart) && differenceInCalendarDays(end, start) === 0;
    });
  }, [events, dayKey]);

  const overlapLayout = useMemo(
    () => layoutOverlappingEvents(timedEvents),
    [timedEvents]
  );

  const getEventPosition = (event) => {
    const start = new Date(event.start_date);
    const end = new Date(event.end_date);
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    const top = Math.max((startHour - GRID_START_HOUR) * HOUR_HEIGHT, 0);
    const height = Math.max((endHour - startHour) * HOUR_HEIGHT, 30);
    return { top, height };
  };

  const viewingToday = isToday(currentDate);
  const nowDecimal = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const gridEndHour = GRID_START_HOUR + HOURS.length;
  const showNowLine = viewingToday && nowDecimal >= GRID_START_HOUR && nowDecimal < gridEndHour;
  const nowTop = (nowDecimal - GRID_START_HOUR) * HOUR_HEIGHT;
  const currentHour = now.getHours();

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Multi-day events banner */}
      {multiDayEvents.length > 0 && (
        <div className="border-b border-border px-4 py-2 space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Eventos multi-dia</p>
          {multiDayEvents.map(event => {
            const color = event.color || '#22c55e';
            const isPending = pendingEventIds?.has(event.id);
            const isConfirmed = confirmedEventIds?.has(event.id);
            const prefix = isPending ? '⚠️ ' : isConfirmed ? '✅ ' : '';
            return (
              <button
                key={event.id}
                onClick={() => onEventClick(event)}
                className={`w-full text-left px-3 py-1.5 rounded-full text-xs font-semibold text-white truncate hover:opacity-85 transition-opacity ${isPending ? 'event-pending' : ''}`}
                style={{ backgroundColor: color }}
              >
                {prefix}{event.title}
                <span className="ml-2 opacity-75 font-normal">
                  {format(new Date(event.start_date), 'dd/MM')} – {format(new Date(event.end_date), 'dd/MM')}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Timed grid — estilo Outlook */}
      <div className="overflow-y-auto max-h-[620px]">
        <div className="grid grid-cols-[56px_1fr] relative">
          {/* Coluna de horários: rótulo abaixo da linha da hora */}
          <div className="relative" style={{ height: HOURS.length * HOUR_HEIGHT }}>
            {HOURS.map(hour => {
              const isCurrentHour = viewingToday && hour === currentHour;
              return (
                <div
                  key={hour}
                  className="absolute right-0 pr-2 pt-1 flex justify-end"
                  style={{ top: (hour - GRID_START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                >
                  <span
                    className={`text-xs leading-none ${
                      isCurrentHour
                        ? 'font-bold text-foreground'
                        : 'font-medium text-foreground/70'
                    }`}
                  >
                    {String(hour).padStart(2, '0')}:00
                  </span>
                </div>
              );
            })}
          </div>

          <div className="border-l border-border/80 relative" style={{ height: HOURS.length * HOUR_HEIGHT }}>
            {HOURS.map(hour => (
              <div
                key={hour}
                className="absolute left-0 right-0 hover:bg-muted/25 cursor-pointer transition-colors"
                style={{ top: (hour - GRID_START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                onClick={() => {
                  const slotDate = new Date(currentDate);
                  slotDate.setHours(hour, 0, 0, 0);
                  onSlotClick(slotDate);
                }}
              >
                {/* Linha da hora cheia */}
                <div className="absolute top-0 left-0 right-0 border-t border-border" />
                {/* Linha da meia-hora (mais suave) */}
                <div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-border/40" />
              </div>
            ))}

            {timedEvents.map((event) => {
              const { top, height } = getEventPosition(event);
              const layout = overlapLayout.get(event.id) || { leftPct: 0, widthPct: 100 };
              const isPending = pendingEventIds?.has(event.id);
              const isConfirmed = confirmedEventIds?.has(event.id);
              const prefix = isPending ? '⚠️ ' : isConfirmed ? '✅ ' : '';
              return (
                <button
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  title={[event.title, event.location].filter(Boolean).join(' — ')}
                  className={`absolute rounded-lg px-2 py-1.5 text-left overflow-hidden hover:opacity-90 transition-opacity z-10 ${isPending ? 'event-pending' : ''}`}
                  style={{
                    top: `${top}px`,
                    height: `${height}px`,
                    left: `calc(${layout.leftPct}% + ${GAP_PX}px)`,
                    width: `calc(${layout.widthPct}% - ${GAP_PX * 2}px)`,
                    backgroundColor: (event.color || '#22c55e') + '15',
                    borderLeft: `3px solid ${event.color || '#22c55e'}`,
                  }}
                >
                  <p className="text-sm font-semibold truncate" style={{ color: event.color || '#22c55e' }}>
                    {prefix}{event.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(event.start_date), 'HH:mm')} - {format(new Date(event.end_date), 'HH:mm')}
                  </p>
                  {event.location && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{event.location}</p>
                  )}
                </button>
              );
            })}

            {/* Indicador do horário atual */}
            {showNowLine && (
              <div
                className="absolute left-0 right-0 z-20 pointer-events-none"
                style={{ top: `${nowTop}px` }}
                aria-hidden
              >
                <div className="relative">
                  <div className="absolute -left-[5px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-foreground" />
                  <div className="h-[2px] w-full bg-foreground" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
