import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/apiClient';
import { useCalendarRealtime } from '@/hooks/useCalendarRealtime';
import { RoomMonitorView } from '@/components/meetings/RoomMonitorView';
import { getWideEventsFetchRange } from '@/lib/eventsRange';

/**
 * Página fullscreen para tablet na sala.
 * URL: /monitor/:roomId
 * Atualiza via WebSocket + polling a cada 15s.
 */
export default function RoomMonitorPage() {
  const { roomId } = useParams();
  useCalendarRealtime(true);

  const eventsRange = React.useMemo(() => getWideEventsFetchRange(), []);

  const { data: rooms = [], isLoading: loadingRooms } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => apiClient.listMeetingRooms({ limit: 500 }),
    initialData: [],
    refetchInterval: 60_000,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => apiClient.listUsers({ limit: 1000 }),
    initialData: [],
    staleTime: 5 * 60_000,
  });

  const { data: allEvents = [] } = useQuery({
    queryKey: ['allEventsForMonitor', eventsRange.from],
    queryFn: () => apiClient.listCalendarEvents({
      limit: 5000,
      from: eventsRange.from,
      to: eventsRange.to,
    }),
    initialData: [],
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const room = rooms.find((r) => String(r.id) === String(roomId));

  if (loadingRooms && !room) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#98FB98]">
        <div className="w-10 h-10 border-4 border-black/20 border-t-black/60 rounded-full animate-spin" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-muted text-foreground p-6">
        <p className="text-xl font-medium">Sala não encontrada</p>
        <Link to="/meetings" className="text-primary underline text-sm">
          Voltar para Reuniões
        </Link>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50">
      <RoomMonitorView
        room={room}
        allUsers={allUsers}
        allEvents={allEvents}
        active
      />
    </div>
  );
}
