import React from 'react';
import { format, isToday, isTomorrow, isThisWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, MapPin, Users, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EVENT_TYPES } from '@/lib/constants';

export default function ListView({ events, pendingEventIds, confirmedEventIds, onEventClick }) {
  const sortedEvents = [...events]
    .filter(e => e.status !== 'cancelado' && new Date(e.start_date) >= new Date(new Date().setHours(0, 0, 0, 0)))
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
    .slice(0, 30);

  const groupByDate = (events) => {
    const groups = {};
    events.forEach(event => {
      const dateKey = format(new Date(event.start_date), 'yyyy-MM-dd');
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(event);
    });
    return groups;
  };

  const groups = groupByDate(sortedEvents);

  const getDateLabel = (dateStr) => {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Hoje';
    if (isTomorrow(date)) return 'Amanhã';
    return format(date, "EEEE, d 'de' MMMM", { locale: ptBR });
  };

  return (
    <div className="space-y-4">
      {Object.keys(groups).length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-muted-foreground">Nenhum evento futuro encontrado.</p>
        </div>
      ) : (
        Object.entries(groups).map(([dateKey, dayEvents]) => (
          <div key={dateKey}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 capitalize">
              {getDateLabel(dateKey)}
            </h3>
            <div className="space-y-2">
              {dayEvents.map(event => {
                const isPending = pendingEventIds?.has(event.id);
                const isConfirmed = confirmedEventIds?.has(event.id);
                const prefix = isPending ? '⚠️ ' : isConfirmed ? '✅ ' : '';
                return (
                <button
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  className={`w-full bg-card rounded-xl border p-4 flex gap-3 hover:shadow-md transition-all text-left ${isPending ? 'border-amber-400 event-pending' : 'border-border hover:border-primary/20'}`}
                >
                  <div
                    className="w-1 rounded-full shrink-0"
                    style={{ backgroundColor: event.color || '#22c55e' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{prefix}{event.title}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {event.all_day ? 'Dia inteiro' : `${format(new Date(event.start_date), 'HH:mm')} - ${format(new Date(event.end_date), 'HH:mm')}`}
                      </span>
                      {event.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {event.location}
                        </span>
                      )}
                      {event.participants?.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {event.participants.length} participante{event.participants.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {event.event_type && (
                        <Badge variant="secondary" className="text-[10px] h-5">
                          {EVENT_TYPES[event.event_type]?.label || event.event_type}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}