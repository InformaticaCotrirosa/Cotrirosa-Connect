import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, addMinutes, addDays, startOfDay, setHours, setMinutes, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Sparkles, X, UserPlus, Clock, DoorOpen, ChevronRight } from 'lucide-react';
import { DEFAULT_WORK_SCHEDULE, getWorkSchedule } from '@/components/settings/WorkScheduleEditor';
import { isUserInvolvedInEvent } from '@/lib/eventInvolvement';

/**
 * Generates candidate slot start times within a user's work schedule for a given day.
 */
function getSlotsForDay(day, schedule, stepMinutes = 30) {
  const slots = [];
  const s = schedule || DEFAULT_WORK_SCHEDULE;

  const parseTime = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    return setMinutes(setHours(startOfDay(day), h), m);
  };

  const addSlots = (periodStart, periodEnd) => {
    let cursor = parseTime(periodStart);
    const end = parseTime(periodEnd);
    while (cursor < end) {
      slots.push(new Date(cursor));
      cursor = addMinutes(cursor, stepMinutes);
    }
  };

  addSlots(s.morning_start, s.morning_end);
  if (s.has_lunch_break) {
    addSlots(s.afternoon_start, s.afternoon_end);
  }

  return slots;
}

/**
 * Intersects multiple users' work schedules to find common available slots.
 */
function findFreeSlots({ userIds, allUsers, allEvents, rooms, durationMinutes = 60, maxResults = 5 }) {
  const slots = [];
  const now = new Date();

  for (let dayOffset = 0; dayOffset < 14 && slots.length < maxResults; dayOffset++) {
    const day = addDays(startOfDay(now), dayOffset);
    const dayOfWeek = getDay(day);

    // Build intersection of work_days across all users
    const allWorkDays = userIds.map(uid => {
      const u = allUsers.find(u => u.id === uid);
      return getWorkSchedule(u).work_days;
    });
    const commonDay = allWorkDays.every(wds => wds.includes(dayOfWeek));
    if (!commonDay) continue;

    // Use the most restrictive schedule (narrowest window) — use first user as baseline
    // Actually: generate slots per-user and intersect times
    const firstUser = allUsers.find(u => u.id === userIds[0]);
    const baseSchedule = getWorkSchedule(firstUser);
    const candidateStarts = getSlotsForDay(day, baseSchedule);

    for (const slotStart of candidateStarts) {
      if (slots.length >= maxResults) break;
      const slotEnd = addMinutes(slotStart, durationMinutes);
      if (slotEnd <= now) continue;

      const overlap = (evStart, evEnd) => slotStart < evEnd && slotEnd > evStart;

      // Verify slot fits within ALL users' schedules
      const fitsAllSchedules = userIds.every(uid => {
        const u = allUsers.find(u => u.id === uid);
        const s = getWorkSchedule(u);
        // Check day
        if (!s.work_days.includes(dayOfWeek)) return false;
        // Check start time
        const startTimeStr = format(slotStart, 'HH:mm');
        const endTimeStr = format(addMinutes(slotEnd, -1), 'HH:mm');
        const inMorning = startTimeStr >= s.morning_start && endTimeStr < s.morning_end;
        if (s.has_lunch_break) {
          const inAfternoon = startTimeStr >= s.afternoon_start && endTimeStr < s.afternoon_end;
          return inMorning || inAfternoon;
        }
        return startTimeStr >= s.morning_start && endTimeStr < s.afternoon_end;
      });
      if (!fitsAllSchedules) continue;

      // Check all users are free from events
      const allUsersFree = userIds.every(uid => {
        return !allEvents.some(ev => {
          const isInvolved = isUserInvolvedInEvent(ev, uid);
          if (!isInvolved) return false;
          return overlap(new Date(ev.start_date), new Date(ev.end_date));
        });
      });
      if (!allUsersFree) continue;

      // Find a free room
      const freeRoom = rooms.find(room => {
        return !allEvents.some(ev => {
          if (ev.room_id !== room.id) return false;
          return overlap(new Date(ev.start_date), new Date(ev.end_date));
        });
      });

      slots.push({ start: slotStart, end: slotEnd, room: freeRoom || null });
    }
  }
  return slots;
}

export default function SuggestionDialog({ open, onOpenChange, allUsers, allEvents, rooms, user, onApply }) {
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [suggestions, setSuggestions] = useState(null);

  const availableUsers = allUsers.filter(u => u.id !== user?.id && !selectedUserIds.includes(u.id));

  const addUser = (uid) => {
    if (!uid || selectedUserIds.includes(uid)) return;
    setSelectedUserIds(prev => [...prev, uid]);
    setSuggestions(null);
  };

  const removeUser = (uid) => {
    setSelectedUserIds(prev => prev.filter(id => id !== uid));
    setSuggestions(null);
  };

  const handleGenerate = () => {
    const allIds = user?.id ? [user.id, ...selectedUserIds] : selectedUserIds;
    const results = findFreeSlots({ userIds: allIds, allUsers, allEvents, rooms, durationMinutes });
    setSuggestions(results);
  };

  const handleApply = (slot) => {
    onApply({
      start_date: format(slot.start, "yyyy-MM-dd'T'HH:mm"),
      end_date: format(slot.end, "yyyy-MM-dd'T'HH:mm"),
      room_id: slot.room?.id || '',
      participants: selectedUserIds,
      participant_names: selectedUserIds.map(uid => allUsers.find(u => u.id === uid)?.full_name || ''),
    });
    onOpenChange(false);
  };

  const handleClose = () => {
    setSelectedUserIds([]);
    setSuggestions(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Sugestão de Horário
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Selecione os participantes e a duração — o sistema encontrará horários dentro do expediente de todos.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs">Participantes</Label>
            <Select onValueChange={addUser} value="">
              <SelectTrigger className="mt-1">
                <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
                  <UserPlus className="w-3.5 h-3.5" /> Adicionar participante
                </span>
              </SelectTrigger>
              <SelectContent>
                {availableUsers.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground text-center">Todos já adicionados</div>
                ) : (
                  availableUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            <div className="flex flex-wrap gap-2 mt-2">
              {user && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs border bg-primary/10 border-primary/30 text-primary">
                  {user.full_name || user.email}
                  <span className="text-primary/60 ml-0.5">(você)</span>
                </div>
              )}
              {selectedUserIds.map(uid => {
                const u = allUsers.find(u => u.id === uid);
                return (
                  <div key={uid} className="flex items-center gap-1 px-2 py-1 rounded-full text-xs border bg-secondary border-border text-foreground">
                    {u?.full_name || u?.email || 'Usuário'}
                    <button onClick={() => removeUser(uid)} className="ml-0.5 hover:opacity-70">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <Label className="text-xs">Duração</Label>
            <Select value={String(durationMinutes)} onValueChange={v => { setDurationMinutes(Number(v)); setSuggestions(null); }}>
              <SelectTrigger className="mt-1">
                <span className="flex items-center gap-1.5 text-sm">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <SelectValue />
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 minutos</SelectItem>
                <SelectItem value="60">1 hora</SelectItem>
                <SelectItem value="90">1h 30min</SelectItem>
                <SelectItem value="120">2 horas</SelectItem>
                <SelectItem value="180">3 horas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleGenerate} className="w-full gap-2" disabled={selectedUserIds.length === 0}>
            <Sparkles className="w-4 h-4" /> Buscar horários livres
          </Button>

          {suggestions !== null && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {suggestions.length === 0
                  ? 'Nenhum horário livre encontrado nos próximos 14 dias dentro do expediente.'
                  : `${suggestions.length} horário(s) sugerido(s) dentro do expediente:`}
              </p>
              {suggestions.map((slot, i) => (
                <button
                  key={i}
                  onClick={() => handleApply(slot)}
                  className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/30 transition-colors text-left group"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                      {format(slot.start, "EEE, dd/MM 'às' HH:mm", { locale: ptBR })} – {format(slot.end, "HH:mm")}
                    </div>
                    {slot.room ? (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <DoorOpen className="w-3 h-3 shrink-0" />
                        {slot.room.type === 'carro' ? '🚗 ' : '🏢 '}{slot.room.name} — {slot.room.capacity} pessoas
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">Sem sala disponível</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Usar <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}