import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Hourglass, X } from 'lucide-react';
import { format, differenceInMinutes, differenceInSeconds } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getEventOrganizerId } from '@/lib/eventInvolvement';

/**
 * Conteúdo visual do monitor de sala (modal ou página fullscreen).
 */
export function RoomMonitorView({ room, allUsers, allEvents, onClose, active = true }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [active]);

  const currentEvent = useMemo(() => {
    if (!room || !allEvents?.length) return null;
    return allEvents.find(ev => {
      if (ev.room_id !== room.id) return false;
      if (ev.status === 'cancelado') return false;
      const start = new Date(ev.start_date);
      const end = new Date(ev.end_date);
      return now >= start && now <= end;
    }) || null;
  }, [room, allEvents, now]);

  const remainingMinutes = useMemo(() => {
    if (!currentEvent) return null;
    const end = new Date(currentEvent.end_date);
    return Math.max(0, differenceInMinutes(end, now));
  }, [currentEvent, now]);

  const remainingDisplay = useMemo(() => {
    if (!currentEvent) return '';
    const end = new Date(currentEvent.end_date);
    const totalSeconds = Math.max(0, differenceInSeconds(end, now));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, [currentEvent, now]);

  const bgState = useMemo(() => {
    if (!currentEvent) return 'free';
    if (remainingMinutes <= 5) return 'blink';
    if (remainingMinutes <= 10) return 'red';
    if (remainingMinutes <= 15) return 'yellow';
    return 'green';
  }, [currentEvent, remainingMinutes]);

  const bgClass = useMemo(() => {
    switch (bgState) {
      case 'free': return 'bg-[#98FB98]';
      case 'green': return 'bg-[#98FB98]';
      case 'yellow': return 'bg-[#FADF3A]';
      case 'red': return 'bg-[#b91c1c]';
      case 'blink': return 'bg-[#b91c1c] room-monitor-blink';
      default: return 'bg-[#98FB98]';
    }
  }, [bgState]);

  const organizer = useMemo(() => {
    if (!currentEvent) return null;
    const creator = allUsers?.find(u => u.id === getEventOrganizerId(currentEvent));
    return {
      name: creator?.full_name || currentEvent.organizer_name || 'Desconhecido',
      email: creator?.email || '',
    };
  }, [currentEvent, allUsers]);

  const isFree = !currentEvent;
  const isRedBg = bgState === 'red' || bgState === 'blink';
  const textColorClass = isRedBg ? 'text-white' : 'text-black';
  const hrClass = isRedBg ? 'border-white/40' : 'border-black/30';

  const nextEvent = useMemo(() => {
    if (!room || !allEvents?.length) return null;
    const next = allEvents
      .filter(ev => {
        if (ev.room_id !== room.id) return false;
        if (ev.status === 'cancelado') return false;
        if (currentEvent && ev.id === currentEvent.id) return false;
        const start = new Date(ev.start_date);
        return start > now;
      })
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))[0];
    return next || null;
  }, [room, allEvents, now, currentEvent]);

  const nextOrganizer = useMemo(() => {
    if (!nextEvent) return null;
    const creator = allUsers?.find(u => u.id === getEventOrganizerId(nextEvent));
    return {
      name: creator?.full_name || nextEvent.organizer_name || 'Desconhecido',
      email: creator?.email || '',
    };
  }, [nextEvent, allUsers]);

  return (
    <div className={`h-full w-full flex flex-col ${bgClass}`}>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className={`absolute top-4 right-4 z-10 p-2 rounded-full ${isRedBg ? 'text-white/70 hover:text-white hover:bg-white/20' : 'text-black/50 hover:text-black hover:bg-black/10'} transition-colors`}
        >
          <X className="w-8 h-8" />
        </button>
      )}

      <div className={`flex-1 flex flex-col items-center justify-center min-h-[300px] ${textColorClass}`}>
        {isFree ? (
          <div className="text-center space-y-4 px-4">
            {room?.name && (
              <p className="text-2xl font-medium opacity-80">
                {room.type === 'carro' ? '🚗 ' : '🏢 '}{room.name}
              </p>
            )}
            <span className="text-9xl font-display font-extrabold block" style={{ color: '#27a346' }}>
              LIVRE
            </span>
          </div>
        ) : (
          <div className="w-full space-y-4 px-4">
            <div>
              <p className="text-2xl font-medium text-left">
                {room.type === 'carro' ? '🚗 ' : '🏢 '}{room.name}
              </p>
              <hr className={`${hrClass} my-2`} />
            </div>

            <h2 className="text-4xl font-display font-bold text-center">
              {currentEvent.title}
            </h2>
            <hr className={hrClass} />

            <p className="text-lg text-left">
              Agendado por: <strong>{organizer?.name}</strong>
              {organizer?.email ? ` (${organizer.email})` : ''}
            </p>

            <div className="space-y-2 text-lg">
              <p className="flex items-center gap-3">
                <Clock className="w-6 h-6" />
                Início: {format(new Date(currentEvent.start_date), "dd/MM/yyyy - HH:mm", { locale: ptBR })}
              </p>
              <p className="flex items-center gap-3">
                <Clock className="w-6 h-6" />
                Término: {format(new Date(currentEvent.end_date), "dd/MM/yyyy - HH:mm", { locale: ptBR })}
              </p>
            </div>

            <p className="flex items-center gap-3 text-2xl font-semibold pt-4">
              <Hourglass className="w-7 h-7" />
              Tempo restante: {remainingDisplay}
            </p>
          </div>
        )}
      </div>

      {nextEvent && (
        <div className={`px-6 pb-4 pt-3 ${textColorClass}`}>
          <hr className={`${hrClass} mb-3`} />
          <div className="text-right">
            <p className="text-lg">
              <strong>Próximo evento:</strong> {nextOrganizer?.name}
              {nextOrganizer?.email ? ` (${nextOrganizer.email})` : ''}
            </p>
            <p className="text-lg font-semibold">{nextEvent.title}</p>
            <p className="text-base">
              Inicia: {format(new Date(nextEvent.start_date), "dd/MM/yyyy - HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
