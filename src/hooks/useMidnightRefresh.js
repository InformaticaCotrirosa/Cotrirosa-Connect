import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

function msUntilNextMidnight() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0); // próximo dia à 00:00:00 local
  return Math.max(1000, next.getTime() - now.getTime());
}

function todayKey(date = new Date()) {
  return date.toDateString();
}

/**
 * Força re-render e invalida queries do calendário à meia-noite (horário local).
 * Retorna a chave do dia atual para dependências de filtro "hoje".
 */
export function useMidnightRefresh(enabled = true) {
  const queryClient = useQueryClient();
  const [dayKey, setDayKey] = useState(() => todayKey());
  const dayKeyRef = useRef(dayKey);
  dayKeyRef.current = dayKey;

  useEffect(() => {
    if (!enabled) return undefined;

    let timeoutId;

    const refreshForNewDay = () => {
      const key = todayKey();
      if (key !== dayKeyRef.current) {
        dayKeyRef.current = key;
        setDayKey(key);
      }
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      queryClient.invalidateQueries({ queryKey: ['allEventInvitations'] });
      queryClient.invalidateQueries({ queryKey: ['allEventsForMonitor'] });
    };

    const schedule = () => {
      timeoutId = setTimeout(() => {
        refreshForNewDay();
        schedule();
      }, msUntilNextMidnight());
    };

    schedule();

    // PC acordou do sleep / aba voltou após a meia-noite
    const onVisible = () => {
      if (document.visibilityState === 'hidden') return;
      if (todayKey() !== dayKeyRef.current) {
        refreshForNewDay();
      }
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [enabled, queryClient]);

  return dayKey;
}
