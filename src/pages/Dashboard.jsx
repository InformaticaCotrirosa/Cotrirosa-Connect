import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/apiClient';
import { Calendar, Clock, CalendarDays } from 'lucide-react';
import StatsCard from '../components/dashboard/StatsCard';
import QuickActions from '../components/dashboard/QuickActions';
import TodayEvents from '../components/dashboard/TodayEvents';
import PendingInvitations from '../components/dashboard/PendingInvitations';
import { useCalendarRealtime } from '@/hooks/useCalendarRealtime';
import { useMidnightRefresh } from '@/hooks/useMidnightRefresh';
import { isUserInvolvedInEventOrInvite } from '@/lib/eventInvolvement';
import { getWideEventsFetchRange } from '@/lib/eventsRange';

export default function Dashboard() {
  const { user } = useOutletContext();

  useCalendarRealtime(true, { userId: user?.id, showInvitationToast: false });
  const dayKey = useMidnightRefresh(true);

  const eventsRange = React.useMemo(() => getWideEventsFetchRange(), []);

  const { data: events = [] } = useQuery({
    queryKey: ['events', 'dashboard', eventsRange.from],
    queryFn: () => apiClient.listCalendarEvents({
      limit: 5000,
      from: eventsRange.from,
      to: eventsRange.to,
    }),
    initialData: [],
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ['invitations'],
    queryFn: async () => {
      if (!user) return [];
      return apiClient.listEventInvitations({ invitee_id: user.id, limit: 50 });
    },
    enabled: !!user,
    initialData: [],
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const { data: allInvitations = [] } = useQuery({
    queryKey: ['allEventInvitations'],
    queryFn: () => apiClient.listEventInvitations({ limit: 500 }),
    initialData: [],
    refetchInterval: 60_000,
  });

  const { pendingEventIds, confirmedEventIds } = React.useMemo(() => {
    const pending = new Set();
    const confirmed = new Set();
    const eventsWithParticipants = events.filter(e => Array.isArray(e.participants) && e.participants.length > 0);
    for (const event of eventsWithParticipants) {
      const eventInvites = allInvitations.filter(i => i.event_id === event.id);
      if (eventInvites.length === 0) {
        pending.add(event.id);
        continue;
      }
      const allAccepted = eventInvites.every(i => i.status === 'aceito');
      if (allAccepted) {
        confirmed.add(event.id);
      } else {
        pending.add(event.id);
      }
    }
    return { pendingEventIds: pending, confirmedEventIds: confirmed };
  }, [events, allInvitations]);

  const today = new Date();

  const invitedEventIds = React.useMemo(() => new Set(
    invitations
      .filter((i) => i.status !== 'recusado')
      .map((i) => String(i.event_id))
  ), [invitations]);

  const myEvents = events.filter((e) =>
    isUserInvolvedInEventOrInvite(e, user?.id, invitedEventIds)
  );

  // dayKey muda à meia-noite e força recalcular "Eventos Hoje"
  const todayEvents = myEvents.filter(
    (e) => new Date(e.start_date).toDateString() === dayKey
  );
  const pendingInvites = invitations.filter(i => i.status === 'pendente');

  // Futuros: após hoje (criados por mim ou em que sou convidado)
  const futureEvents = myEvents
    .filter((e) => {
      const start = new Date(e.start_date);
      return start.toDateString() !== dayKey && start > today;
    })
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

  const greeting = () => {
    const hour = today.getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">
          {greeting()}, {user?.full_name?.split(' ')[0] || 'Colaborador'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aqui está o resumo da sua agenda e comunicações.
        </p>
      </div>

      <QuickActions />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatsCard
          title="Eventos Hoje"
          value={todayEvents.length}
          subtitle="Seus compromissos de hoje"
          icon={Calendar}
          color="green"
          delay={0}
        />
        <StatsCard
          title="Convites Pendentes de Aceite"
          value={pendingInvites.length}
          subtitle="Aguardando sua resposta"
          icon={Clock}
          color="orange"
          delay={0.05}
        />
        <StatsCard
          title="Eventos Futuros"
          value={futureEvents.length}
          subtitle="Próximos dias (seus)"
          icon={CalendarDays}
          color="purple"
          delay={0.1}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <TodayEvents
            key={dayKey}
            events={myEvents}
            userId={user?.id}
            dayKey={dayKey}
            pendingEventIds={pendingEventIds}
            confirmedEventIds={confirmedEventIds}
          />
        </div>
        <div className="space-y-6">
          <PendingInvitations invitations={invitations} />
        </div>
      </div>
    </div>
  );
}
