import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '@/lib/socket';
import { toast } from '@/components/ui/use-toast';

const CALENDAR_QUERY_KEYS = [
  ['events'],
  ['allEventsForMonitor'],
  ['allEventsForConflict'],
];

const INVITATION_QUERY_KEYS = [
  ['invitations'],
  ['allEventInvitations'],
  ['eventInvitations'],
  ['unreadNotifications'],
  ['notifications'],
];

/**
 * Mantém calendário, convites e notificações sincronizados via Socket.IO.
 * @param {boolean} enabled
 * @param {{ userId?: string, showInvitationToast?: boolean }} [options]
 */
export function useCalendarRealtime(enabled = true, options = {}) {
  const { userId, showInvitationToast = true } = options;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const socket = getSocket();
    socket.emit('subscribe:monitor');
    if (userId) {
      socket.emit('subscribe:calendar', userId);
      socket.emit('subscribe:invitations', userId);
      socket.emit('subscribe:notifications', userId);
    }

    const invalidateCalendar = () => {
      CALENDAR_QUERY_KEYS.forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey });
      });
    };

    const invalidateInvitations = () => {
      INVITATION_QUERY_KEYS.forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey });
      });
    };

    const invalidateAll = () => {
      invalidateCalendar();
      invalidateInvitations();
    };

    const onInvitationReceived = (payload) => {
      invalidateInvitations();
      if (showInvitationToast) {
        toast({
          title: 'Novo convite de reunião',
          description: payload?.event_title
            ? `Confirme presença em "${payload.event_title}".`
            : 'Você foi convidado para uma reunião. Confirme no Dashboard.',
        });
      }
    };

    const onNotificationNew = () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadNotifications'] });
    };

    socket.on('calendar:changed', invalidateAll);
    socket.on('event:created', invalidateAll);
    socket.on('event:updated', invalidateAll);
    socket.on('event:deleted', invalidateAll);
    socket.on('invitation:received', onInvitationReceived);
    socket.on('invitation:updated', invalidateInvitations);
    socket.on('notification:new', onNotificationNew);

    return () => {
      socket.off('calendar:changed', invalidateAll);
      socket.off('event:created', invalidateAll);
      socket.off('event:updated', invalidateAll);
      socket.off('event:deleted', invalidateAll);
      socket.off('invitation:received', onInvitationReceived);
      socket.off('invitation:updated', invalidateInvitations);
      socket.off('notification:new', onNotificationNew);
    };
  }, [enabled, userId, queryClient, showInvitationToast]);
}
