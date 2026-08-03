import React from 'react';
import { motion } from 'framer-motion';
import { Clock, MapPin, Users, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { isUserOrganizer, isUserParticipant } from '@/lib/eventInvolvement';

export default function TodayEvents({ events = [], userId, dayKey, pendingEventIds, confirmedEventIds }) {
  const now = new Date();
  const activeDayKey = dayKey || now.toDateString();

  const todayEvents = events
    .filter(e => {
      const start = new Date(e.start_date);
      return start.toDateString() === activeDayKey;
    })
    .sort((a, b) => {
      const aStart = new Date(a.start_date);
      const aEnd = new Date(a.end_date);
      const bStart = new Date(b.start_date);
      const bEnd = new Date(b.end_date);
      const aCurrent = aStart <= now && aEnd >= now ? 0 : 1;
      const bCurrent = bStart <= now && bEnd >= now ? 0 : 1;
      if (aCurrent !== bCurrent) return aCurrent - bCurrent;
      return aStart - bStart;
    });

  // Todos os próximos compromissos (após hoje)
  const upcomingEvents = events
    .filter(e => {
      const start = new Date(e.start_date);
      return start.toDateString() !== activeDayKey && start > now;
    })
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

  const roleOf = (event) => {
    if (!userId) return null;
    if (isUserOrganizer(event, userId)) return 'organizador';
    if (isUserParticipant(event, userId)) return 'convidado';
    return null;
  };

  const renderEvent = (event, { showDate = false } = {}) => {
    const start = new Date(event.start_date);
    const end = new Date(event.end_date);
    const isPast = end < now;
    const isCurrent = start <= now && end >= now;
    const isPending = pendingEventIds?.has(event.id);
    const isConfirmed = confirmedEventIds?.has(event.id);
    const role = roleOf(event);
    const prefix = isPending ? '⚠️ ' : isConfirmed ? '✅ ' : '';

    return (
      <div
        key={event.id}
        className={`p-4 flex gap-3 hover:bg-muted/50 transition-colors ${isPast ? 'opacity-50' : ''} ${isPending ? 'event-pending' : ''} ${isCurrent ? 'bg-primary/5' : ''}`}
      >
        <div
          className="w-1 rounded-full shrink-0 mt-1"
          style={{ backgroundColor: event.color || '#22c55e', height: '40px' }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium truncate">{prefix}{event.title}</p>
            {isCurrent && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground font-medium shrink-0">
                AGORA
              </span>
            )}
            {role === 'organizador' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 font-medium shrink-0">
                Organizador
              </span>
            )}
            {role === 'convidado' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200 font-medium shrink-0">
                Convidado
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {showDate
                ? format(start, "dd/MM 'às' HH:mm", { locale: ptBR })
                : `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`}
            </span>
            {event.location && (
              <span className="flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3" />
                {event.location}
              </span>
            )}
            {event.participants?.length > 0 && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {event.participants.length}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="bg-card rounded-xl border border-border"
    >
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-heading font-semibold text-sm">Sua agenda de hoje</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(now, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        <Link to="/calendar" className="text-xs text-primary hover:underline flex items-center gap-1">
          Ver agenda <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="divide-y divide-border max-h-[360px] overflow-y-auto">
        {todayEvents.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhum compromisso seu para hoje</p>
            <Link to="/calendar" className="text-xs text-primary hover:underline mt-1 inline-block">
              Criar novo evento
            </Link>
          </div>
        ) : (
          todayEvents.map((event) => renderEvent(event))
        )}
      </div>

      {upcomingEvents.length > 0 && (
        <>
          <div className="px-5 py-3 border-t border-border bg-muted/30 flex items-center justify-between">
            <h4 className="font-heading font-semibold text-xs text-muted-foreground uppercase tracking-wide">
              Eventos futuros
            </h4>
            <span className="text-[10px] text-muted-foreground">{upcomingEvents.length}</span>
          </div>
          <div className="divide-y divide-border max-h-[320px] overflow-y-auto">
            {upcomingEvents.map((event) => renderEvent(event, { showDate: true }))}
          </div>
        </>
      )}
    </motion.div>
  );
}
