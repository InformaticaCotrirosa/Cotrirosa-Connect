import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/apiClient';
import CalendarHeader from '../components/calendar/CalendarHeader';
import MonthView from '../components/calendar/MonthView';
import WeekView from '../components/calendar/WeekView';
import DayView from '../components/calendar/DayView';
import ListView from '../components/calendar/ListView';
import EventFormDialog from '../components/calendar/EventFormDialog';
import { useCalendarRealtime } from '@/hooks/useCalendarRealtime';
import { isUserInvolvedInEvent, isUserOrganizer } from '@/lib/eventInvolvement';
import { getEventsFetchRange } from '@/lib/eventsRange';

export default function CalendarPage() {
  const { user } = useOutletContext();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month');
  const [showEventForm, setShowEventForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [initialDate, setInitialDate] = useState(null);
  const [mineFilter, setMineFilter] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const queryClient = useQueryClient();

  useCalendarRealtime(true, { userId: user?.id, showInvitationToast: false });

  const calendarYear = currentDate.getFullYear();
  const fetchRange = React.useMemo(
    () => getEventsFetchRange(new Date(calendarYear, 0, 1)),
    [calendarYear]
  );

  const { data: events = [] } = useQuery({
    queryKey: ['events', fetchRange.year],
    queryFn: () => apiClient.listCalendarEvents({
      limit: 5000,
      from: fetchRange.from,
      to: fetchRange.to,
    }),
    initialData: [],
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => apiClient.listMeetingRooms({ limit: 1000 }),
    initialData: [],
    staleTime: 5 * 60_000,
  });

  const roomTypeById = React.useMemo(() => {
    const map = new Map();
    for (const room of rooms) {
      map.set(String(room.id), room.type || 'sala_reuniao');
    }
    return map;
  }, [rooms]);

  // Fetch invitations to detect pending events (pulsing animation)
  const { data: allInvitations = [] } = useQuery({
    queryKey: ['allEventInvitations'],
    queryFn: () => apiClient.listEventInvitations({ limit: 500 }),
    initialData: [],
  });

  // Compute event status based on participant invitations
  const { pendingEventIds, confirmedEventIds } = React.useMemo(() => {
    const pending = new Set();
    const confirmed = new Set();
    const eventsWithParticipants = events.filter(e => Array.isArray(e.participants) && e.participants.length > 0);
    for (const event of eventsWithParticipants) {
      const eventInvites = allInvitations.filter(i => i.event_id === event.id);
      if (eventInvites.length === 0) {
        // No invitations sent yet — treat as pending
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

  // Check URL for ?new=true and ?mine=true
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === 'true') {
      setShowEventForm(true);
    }
    if (params.get('mine') === 'true') {
      setMineFilter(true);
    }
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const handleNewEvent = () => {
    setSelectedEvent(null);
    setInitialDate(null);
    setShowEventForm(true);
  };

  const handleEventClick = (event) => {
    const canEdit = user?.role === 'admin' || isUserOrganizer(event, user?.id);
    setSelectedEvent({ ...event, _readOnly: !canEdit });
    setInitialDate(null);
    setShowEventForm(true);
  };

  const handleDayClick = (day) => {
    if (view === 'month') {
      setCurrentDate(day);
      setView('day');
    }
  };

  const handleSlotClick = (date) => {
    setSelectedEvent(null);
    setInitialDate(date);
    setShowEventForm(true);
  };

  const clearMineFilter = () => setMineFilter(false);

  const filteredEvents = React.useMemo(() => {
    let list = events.filter((e) => e.status !== 'cancelado');
    if (mineFilter) {
      list = list.filter((e) => isUserInvolvedInEvent(e, user?.id));
    }
    if (typeFilter !== 'all') {
      list = list.filter((e) => {
        if (!e.room_id) return false;
        return roomTypeById.get(String(e.room_id)) === typeFilter;
      });
    }
    return list;
  }, [events, mineFilter, user?.id, typeFilter, roomTypeById]);

  return (
    <div className="max-w-7xl mx-auto">
      <CalendarHeader
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        view={view}
        setView={setView}
        onNewEvent={handleNewEvent}
        mineFilterActive={mineFilter}
        onClearMineFilter={clearMineFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
      />

      {view === 'month' && (
        <MonthView
          currentDate={currentDate}
          events={filteredEvents}
          pendingEventIds={pendingEventIds}
          confirmedEventIds={confirmedEventIds}
          onDayClick={handleDayClick}
          onEventClick={handleEventClick}
        />
      )}
      {view === 'week' && (
        <WeekView
          currentDate={currentDate}
          events={filteredEvents}
          pendingEventIds={pendingEventIds}
          confirmedEventIds={confirmedEventIds}
          onEventClick={handleEventClick}
          onSlotClick={handleSlotClick}
        />
      )}
      {view === 'day' && (
        <DayView
          currentDate={currentDate}
          events={filteredEvents}
          pendingEventIds={pendingEventIds}
          confirmedEventIds={confirmedEventIds}
          onEventClick={handleEventClick}
          onSlotClick={handleSlotClick}
        />
      )}
      {view === 'list' && (
        <ListView events={filteredEvents} pendingEventIds={pendingEventIds} confirmedEventIds={confirmedEventIds} onEventClick={handleEventClick} />
      )}

      <EventFormDialog
        open={showEventForm}
        onOpenChange={setShowEventForm}
        event={selectedEvent}
        initialDate={initialDate}
        user={user}
      />
    </div>
  );
}