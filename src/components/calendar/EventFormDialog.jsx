import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import apiClient from '@/api/apiClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

import { Trash2, X, AlertTriangle, UserPlus, DoorOpen, Sparkles, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import SuggestionDialog from './SuggestionDialog';
import { getWorkSchedule, isEventWithinSchedule } from '@/components/settings/WorkScheduleEditor';
import { getEventOrganizerId, isUserInvolvedInEvent } from '@/lib/eventInvolvement';
import { getWideEventsFetchRange } from '@/lib/eventsRange';

const defaultForm = {
  title: '', description: '', location: '', event_type: 'interno',
  start_date: '', end_date: '', all_day: false, priority: 'media',
  color: '#22c55e', is_recurring: false, recurrence_rule: '',
  participants: [], participant_names: [],
  room_id: '',
};

export default function EventFormDialog({ open, onOpenChange, event, initialDate, user }) {
  const readOnly = !!event?._readOnly;
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState({});
  const [roomConflicts, setRoomConflicts] = useState([]);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [recurrenceCheck, setRecurrenceCheck] = useState(null);
  const [checkingRecurrence, setCheckingRecurrence] = useState(false);
  const [creatingRecurrence, setCreatingRecurrence] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editScopeOpen, setEditScopeOpen] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();
  const conflictRange = useMemo(() => getWideEventsFetchRange(), []);

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => apiClient.listUsers({ limit: 1000 }),
    initialData: [],
  });

  const { data: allEvents = [] } = useQuery({
    queryKey: ['allEventsForConflict', conflictRange.from],
    queryFn: () => apiClient.listCalendarEvents({
      limit: 5000,
      from: conflictRange.from,
      to: conflictRange.to,
    }),
    initialData: [],
    enabled: open,
    staleTime: 0,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => apiClient.listMeetingRooms({ limit: 1000 }),
    initialData: [],
  });

  const bookableRooms = useMemo(
    () => rooms.filter((r) => r.is_active !== false),
    [rooms]
  );

  const roomOptions = useMemo(() => {
    const list = [...bookableRooms];
    if (form.room_id) {
      const current = rooms.find((r) => r.id === form.room_id);
      if (current && current.is_active === false && !list.some((r) => r.id === current.id)) {
        list.unshift(current);
      }
    }
    return list;
  }, [bookableRooms, rooms, form.room_id]);

  // Fetch invitations for the current event to show participant status
  const { data: eventInvitations = [] } = useQuery({
    queryKey: ['eventInvitations', event?.id],
    queryFn: () => apiClient.listEventInvitations({ event_id: event?.id, limit: 100 }),
    initialData: [],
    enabled: !!event?.id && open,
  });

  // Map participant ID → invitation status
  const inviteStatusByUser = React.useMemo(() => {
    const map = {};
    for (const inv of eventInvitations) {
      if (inv.invitee_id) map[inv.invitee_id] = inv.status;
    }
    return map;
  }, [eventInvitations]);

  useEffect(() => {
    if (event) {
      setForm({
        ...defaultForm,
        ...event,
        start_date: event.start_date ? format(new Date(event.start_date), "yyyy-MM-dd'T'HH:mm") : '',
        end_date: event.end_date ? format(new Date(event.end_date), "yyyy-MM-dd'T'HH:mm") : '',
      });
    } else if (initialDate) {
      const start = new Date(initialDate);
      const end = new Date(start);
      end.setHours(end.getHours() + 1);
      setForm({
        ...defaultForm,
        start_date: format(start, "yyyy-MM-dd'T'HH:mm"),
        end_date: format(end, "yyyy-MM-dd'T'HH:mm"),
      });
    } else {
      setForm(defaultForm);
    }
    setConflicts({});
    setRoomConflicts([]);
  }, [event, initialDate, open]);

  // Auto-set event color from selected room
  useEffect(() => {
    if (form.room_id) {
      const room = rooms.find(r => r.id === form.room_id);
      if (room?.color) {
        setForm(prev => ({ ...prev, color: room.color }));
      }
    }
  }, [form.room_id, rooms]);

  useEffect(() => {
    if (!form.start_date || !form.end_date) {
      setConflicts({});
      setRoomConflicts([]);
      return;
    }
    const newStart = new Date(form.start_date);
    const newEnd = new Date(form.end_date);
    if (isNaN(newStart) || isNaN(newEnd) || newStart >= newEnd) {
      setConflicts({});
      setRoomConflicts([]);
      return;
    }

    if (form.room_id) {
      const rc = allEvents.filter(ev => {
        if (ev.id === event?.id) return false;
        if (ev.room_id !== form.room_id) return false;
        const evStart = new Date(ev.start_date);
        const evEnd = new Date(ev.end_date);
        return newStart < evEnd && newEnd > evStart;
      });
      setRoomConflicts(rc);
    } else {
      setRoomConflicts([]);
    }

    if (form.participants.length === 0) {
      setConflicts({});
      return;
    }

    const newConflicts = {};
    const allParticipantsToCheck = [...form.participants];
    if (user?.id && !allParticipantsToCheck.includes(user.id)) {
      allParticipantsToCheck.push(user.id);
    }

    for (const uid of allParticipantsToCheck) {
      const userConflicts = allEvents.filter(ev => {
        if (ev.id === event?.id) return false;
        const isInvolved = isUserInvolvedInEvent(ev, uid);
        if (!isInvolved) return false;
        const evStart = new Date(ev.start_date);
        const evEnd = new Date(ev.end_date);
        return newStart < evEnd && newEnd > evStart;
      });
      if (userConflicts.length > 0) {
        newConflicts[uid] = userConflicts;
      }
    }
    setConflicts(newConflicts);
  }, [form.participants, form.room_id, form.start_date, form.end_date, allEvents]);

  const handleSave = async () => {
    if (!form.title || !form.start_date || !form.end_date) return;
    const data = {
      ...form,
      start_date: new Date(form.start_date).toISOString(),
      end_date: new Date(form.end_date).toISOString(),
      organizer_name: user?.full_name || '',
    };

    // Edição de série recorrente: perguntar escopo
    if (event?.id && event?.recurrence_group_id) {
      setPendingSaveData(data);
      setEditScopeOpen(true);
      return;
    }

    // Nova série recorrente: preview até o fim do ano
    if (!event?.id && form.is_recurring && form.recurrence_rule) {
      setCheckingRecurrence(true);
      setRecurrenceCheck({});
      try {
        const preview = await apiClient.previewRecurrence({
          start_date: data.start_date,
          end_date: data.end_date,
          recurrence_rule: form.recurrence_rule,
        });
        setRecurrenceCheck({
          totalInstances: preview.totalInstances,
          conflicts: [],
          hasConflicts: false,
          pendingData: data,
        });
      } catch (e) {
        setRecurrenceCheck({
          totalInstances: 0,
          conflicts: [],
          hasConflicts: false,
          error: e?.message || 'Erro ao calcular recorrência',
        });
      } finally {
        setCheckingRecurrence(false);
      }
      return;
    }

    await doSave(data);
  };

  const doSave = async (data, scope = 'single') => {
    setSaving(true);
    setCreatingRecurrence(true);
    try {
      if (!event?.id) {
        await apiClient.createCalendarEvent(data);
      } else {
        await apiClient.updateCalendarEvent(event.id, { ...data, scope });
      }
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['allEventsForConflict'] });
      queryClient.invalidateQueries({ queryKey: ['allEventsForMonitor'] });
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      queryClient.invalidateQueries({ queryKey: ['allEventInvitations'] });
      queryClient.invalidateQueries({ queryKey: ['eventInvitations'] });
      queryClient.invalidateQueries({ queryKey: ['unreadNotifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setRecurrenceCheck(null);
      setEditScopeOpen(false);
      setPendingSaveData(null);
      onOpenChange(false);
    } catch (e) {
      setRecurrenceCheck({
        totalInstances: 0,
        conflicts: [],
        hasConflicts: false,
        error: e?.message || 'Erro desconhecido ao salvar',
      });
    } finally {
      setSaving(false);
      setCreatingRecurrence(false);
    }
  };

  const confirmRecurrence = () => {
    const data = recurrenceCheck?.pendingData || {
      ...form,
      start_date: new Date(form.start_date).toISOString(),
      end_date: new Date(form.end_date).toISOString(),
      organizer_name: user?.full_name || '',
    };
    doSave(data);
  };

  const handleDelete = () => {
    if (event?.recurrence_group_id) {
      setDeleteConfirmOpen(true);
      return;
    }
    doDelete('single');
  };

  const doDelete = async (scope = 'single') => {
    if (!event?.id) return;
    setDeleting(true);
    try {
      await apiClient.deleteCalendarEvent(event.id, scope === 'future' ? { scope: 'future' } : {});
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['allEventsForConflict'] });
      queryClient.invalidateQueries({ queryKey: ['allEventsForMonitor'] });
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      queryClient.invalidateQueries({ queryKey: ['allEventInvitations'] });
      queryClient.invalidateQueries({ queryKey: ['eventInvitations'] });
      queryClient.invalidateQueries({ queryKey: ['unreadNotifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setDeleteConfirmOpen(false);
      onOpenChange(false);
    } catch (e) {
      console.error('Error deleting event:', e);
      setRecurrenceCheck({
        error: e?.message || 'Erro ao excluir evento',
      });
    } finally {
      setDeleting(false);
    }
  };

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const addParticipant = (userId) => {
    if (!userId || form.participants.includes(userId)) return;
    const u = allUsers.find(u => u.id === userId);
    update('participants', [...form.participants, userId]);
    update('participant_names', [...form.participant_names, u?.full_name || '']);
  };

  const removeParticipant = (userId) => {
    const idx = form.participants.indexOf(userId);
    const newP = form.participants.filter(id => id !== userId);
    const newN = form.participant_names.filter((_, i) => i !== idx);
    update('participants', newP);
    update('participant_names', newN);
  };

  const handleSuggestionApply = ({ start_date, end_date, room_id, participants, participant_names }) => {
    setForm(prev => ({ ...prev, start_date, end_date, room_id, participants, participant_names }));
  };

  // Determines if schedule validation should be skipped for this event
  const skipScheduleCheck = (() => {
    if (!form.start_date || !form.end_date) return true;
    const start = new Date(form.start_date);
    const end = new Date(form.end_date);
    // Skip if event spans multiple days (trip, multi-day event)
    const startDay = start.toDateString();
    const endDay = end.toDateString();
    if (startDay !== endDay) return true;
    return false;
  })();

  // Check if event crosses lunch break (event with lunch included) — skip schedule check in this case
  const crossesLunchBreak = (() => {
    if (!form.start_date || !form.end_date || skipScheduleCheck) return false;
    const start = new Date(form.start_date);
    const end = new Date(form.end_date);
    // Check if any participant has a lunch break and event spans it
    const allParticipantsToCheck = [...form.participants];
    if (user?.id && !allParticipantsToCheck.includes(user.id)) allParticipantsToCheck.push(user.id);
    for (const uid of allParticipantsToCheck) {
      const u = allUsers.find(u => u.id === uid) || (uid === user?.id ? user : null);
      const s = getWorkSchedule(u);
      if (!s.has_lunch_break) continue;
      const startTime = `${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}`;
      const endTime = `${String(end.getHours()).padStart(2,'0')}:${String(end.getMinutes()).padStart(2,'0')}`;
      // Starts before lunch and ends after lunch start = crosses lunch
      if (startTime < s.morning_end && endTime > s.morning_end) return true;
    }
    return false;
  })();

  const shouldValidateSchedule = !skipScheduleCheck && !crossesLunchBreak;

  // Schedule violations (only when validation applies)
  const scheduleViolations = (() => {
    if (!shouldValidateSchedule) return [];
    const violations = [];
    const allParticipantsToCheck = [...form.participants];
    if (user?.id && !allParticipantsToCheck.includes(user.id)) allParticipantsToCheck.push(user.id);
    for (const uid of allParticipantsToCheck) {
      const u = allUsers.find(u => u.id === uid) || (uid === user?.id ? user : null);
      const schedule = getWorkSchedule(u);
      if (!isEventWithinSchedule(new Date(form.start_date), new Date(form.end_date), schedule)) {
        const pIdx = form.participants.indexOf(uid);
        const name = form.participant_names[pIdx] || u?.full_name || u?.email || (uid === user?.id ? 'Você' : 'Usuário');
        violations.push(name);
      }
    }
    return violations;
  })();
  const hasScheduleViolation = scheduleViolations.length > 0;

  // Helper: check if a user is free at the selected time slot
  const isUserFreeAtSelectedTime = (uid) => {
    if (!form.start_date || !form.end_date) return true;
    const newStart = new Date(form.start_date);
    const newEnd = new Date(form.end_date);
    if (isNaN(newStart) || isNaN(newEnd) || newStart >= newEnd) return true;
    return !allEvents.some(ev => {
      if (ev.id === event?.id) return false;
      if (!isUserInvolvedInEvent(ev, uid)) return false;
      const evStart = new Date(ev.start_date);
      const evEnd = new Date(ev.end_date);
      return newStart < evEnd && newEnd > evStart;
    });
  };

  // Helper: check if a user is within their work schedule at the selected time (respecting exceptions)
  const isUserWithinScheduleForEvent = (uid) => {
    if (!shouldValidateSchedule) return true;
    const u = allUsers.find(u => u.id === uid) || (uid === user?.id ? user : null);
    const schedule = getWorkSchedule(u);
    return isEventWithinSchedule(new Date(form.start_date), new Date(form.end_date), schedule);
  };

  // Only show users with status "disponivel", free at the time, and within schedule
  const availableUsers = allUsers.filter(u => {
    if (u.id === user?.id) return false;
    if (form.participants.includes(u.id)) return false;
    if (u.status && u.status !== 'disponivel') return false;
    if (!isUserFreeAtSelectedTime(u.id)) return false;
    if (!isUserWithinScheduleForEvent(u.id)) return false;
    return true;
  });

  const hasConflicts = Object.keys(conflicts).length > 0;
  const hasRoomConflict = roomConflicts.length > 0;
  const hasInvalidDates = !!(form.start_date && form.end_date && new Date(form.start_date) >= new Date(form.end_date));
  const cannotSave = hasConflicts || hasRoomConflict || hasScheduleViolation || (form.is_recurring && !form.recurrence_rule) || !form.room_id || hasInvalidDates;
  const selectedRoom = rooms.find(r => r.id === form.room_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {event ? (readOnly ? 'Visualizar Evento' : 'Editar Evento') : 'Novo Evento'}
          </DialogTitle>
          {readOnly && (
            <p className="text-xs text-muted-foreground mt-1">Você não tem permissão para editar este evento.</p>
          )}
        </DialogHeader>

        {event && (() => {
          const creator = allUsers.find(u => u.id === getEventOrganizerId(event));
          const creatorName = creator?.full_name || event.organizer_name || 'Desconhecido';
          const creatorEmail = creator?.email || '';
          return (
            <p className="text-xs font-medium text-red-600 mb-1">
              Criado por: <strong>{creatorName}</strong>{creatorEmail ? ` (${creatorEmail})` : ''}
            </p>
          );
        })()}

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs">Título *</Label>
            <Input value={form.title} onChange={e => update('title', e.target.value)} placeholder="Título do evento" className="mt-1" disabled={readOnly} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Início *</Label>
              <Input type="datetime-local" value={form.start_date} onChange={e => update('start_date', e.target.value)} className={`mt-1 ${hasInvalidDates ? 'border-destructive' : ''}`} disabled={readOnly || form.all_day} />
            </div>
            <div>
              <Label className="text-xs">Término *</Label>
              <Input type="datetime-local" value={form.end_date} onChange={e => update('end_date', e.target.value)} className={`mt-1 ${hasInvalidDates ? 'border-destructive' : ''}`} disabled={readOnly || form.all_day} />
            </div>
          </div>
          {hasInvalidDates && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> O término do evento deve ser após o início
            </p>
          )}

          <div className="flex items-center gap-2">
            <Switch
              checked={form.all_day}
              onCheckedChange={v => {
                update('all_day', v);
                if (v) {
                  const schedule = getWorkSchedule(user);
                  const baseDate = form.start_date
                    ? new Date(form.start_date)
                    : new Date();
                  const [sh, sm] = schedule.morning_start.split(':').map(Number);
                  const [eh, em] = schedule.afternoon_end.split(':').map(Number);
                  const start = new Date(baseDate);
                  start.setHours(sh, sm, 0, 0);
                  const end = new Date(baseDate);
                  end.setHours(eh, em, 0, 0);
                  update('start_date', format(start, "yyyy-MM-dd'T'HH:mm"));
                  update('end_date', format(end, "yyyy-MM-dd'T'HH:mm"));
                }
              }}
              disabled={readOnly}
            />
            <Label className="text-xs">Dia inteiro</Label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Prioridade</Label>
              <Select value={form.priority} onValueChange={v => update('priority', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={form.event_type} onValueChange={v => update('event_type', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reuniao">Reunião</SelectItem>
                  <SelectItem value="visita">Visita</SelectItem>
                  <SelectItem value="interno">Interno</SelectItem>
                  <SelectItem value="externo">Externo</SelectItem>
                  <SelectItem value="treinamento">Treinamento</SelectItem>
                  <SelectItem value="assembleia">Assembleia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Sala de Reunião *</Label>
            <Select value={form.room_id || ''} onValueChange={v => update('room_id', v)}>
              <SelectTrigger className={`mt-1 ${!form.room_id ? 'border-orange-400' : ''} ${hasRoomConflict ? 'border-amber-400' : ''}`}>
                <span className="flex items-center gap-1.5 text-sm">
                  <DoorOpen className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                  {selectedRoom ? <>{selectedRoom.type === 'carro' ? '🚗 ' : '🏢 '}{selectedRoom.name}</> : <span className="text-muted-foreground">Selecione uma sala</span>}
                </span>
              </SelectTrigger>
              <SelectContent>
                {roomOptions.map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.type === 'carro' ? '🚗 ' : '🏢 '}{r.name} — {r.capacity} pessoas
                    {r.is_active === false ? ' (inativa)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!form.room_id && (
              <p className="text-xs text-orange-600 mt-1">A seleção da sala é obrigatória</p>
            )}
            {hasRoomConflict && (
              <div className="mt-2 p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-1">
                <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Sala ocupada — não é possível salvar
                </p>
                {roomConflicts.map(ev => (
                  <p key={ev.id} className="text-xs text-amber-700">
                    "{ev.title}" em {format(new Date(ev.start_date), "dd/MM 'às' HH:mm")} até {format(new Date(ev.end_date), "HH:mm")}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Participants */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Participantes</Label>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setShowSuggestion(true)}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  <Sparkles className="w-3 h-3" /> Sugestão
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <Select onValueChange={addParticipant} value="">
                <SelectTrigger>
                  <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
                    <UserPlus className="w-3.5 h-3.5" /> Adicionar participante
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.length === 0 ? (
                    <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                      Nenhum usuário disponível neste horário
                    </div>
                  ) : (
                    availableUsers.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {form.participants.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.participants.map((uid, idx) => {
                  const hasConflict = !!conflicts[uid];
                  const u = allUsers.find(u => u.id === uid);
                  const name = form.participant_names[idx] || u?.full_name || u?.email || 'Usuário';
                  const invitationStatus = inviteStatusByUser[uid];
                  const isAccepted = invitationStatus === 'aceito';
                  const isPending = !invitationStatus || invitationStatus === 'pendente';
                  return (
                    <div
                      key={uid}
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${
                        hasConflict
                          ? 'bg-amber-50 border-amber-300 text-amber-800'
                          : 'bg-secondary border-border text-foreground'
                      }`}
                    >
                      {hasConflict && <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />}
                      {!hasConflict && event?.id && isAccepted && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      )}
                      {!hasConflict && event?.id && isPending && (
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                      {name}
                      {!readOnly && (
                        <button onClick={() => removeParticipant(uid)} className="ml-0.5 hover:opacity-70">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {hasScheduleViolation && (
              <div className="mt-2 p-3 rounded-lg bg-orange-50 border border-orange-200 space-y-1">
                <p className="text-xs font-semibold text-orange-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Fora do expediente — não é possível salvar
                </p>
                {scheduleViolations.map((name, i) => (
                  <p key={i} className="text-xs text-orange-700">
                    <strong>{name}</strong> não está disponível neste horário (fora do expediente cadastrado)
                  </p>
                ))}
              </div>
            )}

            {hasConflicts && (
              <div className="mt-2 p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-1.5">
                <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Conflito de agenda — não é possível salvar
                </p>
                {Object.entries(conflicts).map(([uid, evts]) => {
                  const pIdx = form.participants.indexOf(uid);
                  const u = allUsers.find(u => u.id === uid);
                  const name = form.participant_names[pIdx]
                    || u?.full_name
                    || u?.email
                    || (uid === user?.id ? user?.full_name : null)
                    || evts[0]?.organizer_name
                    || 'Usuário';
                  return evts.map(ev => (
                    <p key={ev.id} className="text-xs text-amber-700">
                      <strong>{name}</strong> já tem "{ev.title}" em{' '}
                      {format(new Date(ev.start_date), "dd/MM 'às' HH:mm")} até{' '}
                      {format(new Date(ev.end_date), "dd/MM 'às' HH:mm")}
                    </p>
                  ));
                })}
              </div>
            )}
          </div>



          <div>
            <Label className="text-xs">Descrição</Label>
            <Textarea value={form.description} onChange={e => update('description', e.target.value)} placeholder="Detalhes do evento..." className="mt-1" rows={3} />
          </div>

          <div className="flex items-center gap-2">
            <Switch id="recurring-switch" checked={form.is_recurring} onCheckedChange={v => update('is_recurring', v)} disabled={readOnly} />
            <Label htmlFor="recurring-switch" className="text-xs cursor-pointer">Evento recorrente</Label>
          </div>
          {form.is_recurring && (
            <div>
              <Select value={form.recurrence_rule} onValueChange={v => update('recurrence_rule', v)}>
                <SelectTrigger className={!form.recurrence_rule ? 'border-orange-400' : ''}>
                  <SelectValue placeholder="Selecione a frequência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diário</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="biweekly">Quinzenal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
              {!form.recurrence_rule && (
                <p className="text-xs text-orange-600 mt-1">Selecione a frequência da recorrência</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {event && !readOnly && (
            <Button variant="destructive" size="sm" onClick={handleDelete} className="mr-auto gap-1">
              <Trash2 className="w-3.5 h-3.5" /> Excluir
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>{readOnly ? 'Fechar' : 'Cancelar'}</Button>
          {!readOnly && (
            <Button onClick={handleSave} disabled={saving || checkingRecurrence || !form.title || cannotSave}>
              {saving || creatingRecurrence ? 'Salvando...' : checkingRecurrence ? 'Verificando...' : event ? 'Atualizar' : 'Criar Evento'}
            </Button>
          )}
        </DialogFooter>

        {/* Recurrence confirmation dialog */}
        <Dialog open={!!recurrenceCheck} onOpenChange={() => setRecurrenceCheck(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading text-lg">
                {checkingRecurrence ? 'Verificando disponibilidade...' : recurrenceCheck?.error ? 'Erro ao salvar' : 'Confirmação de Recorrência'}
              </DialogTitle>
            </DialogHeader>
            {checkingRecurrence ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : recurrenceCheck?.error ? (
              <div className="space-y-3">
                <p className="text-sm text-destructive">{recurrenceCheck.error}</p>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRecurrenceCheck(null)}>Fechar</Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                  {recurrenceCheck?.isUpdate ? (
                    <>
                      <p>As alterações serão aplicadas. <span className="font-semibold">{recurrenceCheck?.totalInstances || 0}</span> instâncias serão recriadas.</p>
                      <p className="text-muted-foreground text-xs">As instâncias antigas serão removidas e substituídas com os dados atualizados.</p>
                    </>
                  ) : (
                    <p><span className="font-semibold">{recurrenceCheck?.totalInstances || 0}</span> eventos recorrentes serão criados</p>
                  )}
                  {recurrenceCheck?.hasConflicts && (
                    <span className="text-amber-600"> — <AlertTriangle className="w-3.5 h-3.5 inline" /> há conflitos em algumas datas</span>
                  )}
                </div>
                {recurrenceCheck?.hasConflicts && (
                  <div className="max-h-48 overflow-y-auto space-y-1.5">
                    {recurrenceCheck.conflicts.map((c, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded bg-amber-50 border border-amber-100 text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                        <span className="text-amber-800">{c.message}</span>
                      </div>
                    ))}
                  </div>
                )}
                {!recurrenceCheck?.hasConflicts && (
                  <p className="text-sm text-muted-foreground">
                    Serão criadas ocorrências até 31/12 do ano da data inicial, conforme a frequência selecionada.
                  </p>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRecurrenceCheck(null)}>Cancelar</Button>
                  <Button onClick={confirmRecurrence} disabled={creatingRecurrence || saving}>
                    {creatingRecurrence ? 'Criando...' : `Criar ${recurrenceCheck?.totalInstances || 0} eventos`}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Escopo ao editar série recorrente */}
        <Dialog open={editScopeOpen} onOpenChange={setEditScopeOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-heading text-lg">Alterar evento recorrente</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Deseja aplicar as alterações apenas neste evento ou neste e em todas as ocorrências futuras até o fim da série?
            </p>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setEditScopeOpen(false)} disabled={saving}>Cancelar</Button>
              <Button
                variant="secondary"
                disabled={saving}
                onClick={() => doSave(pendingSaveData, 'single')}
              >
                Só este
              </Button>
              <Button
                disabled={saving}
                onClick={() => doSave(pendingSaveData, 'future')}
              >
                {saving ? 'Salvando...' : 'Este e os próximos'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Excluir série recorrente */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-heading text-lg">Excluir evento recorrente</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm">
                Este evento faz parte de uma série. Escolha o que deseja excluir.
              </p>
              <p className="text-sm font-medium">{event?.title}</p>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>Cancelar</Button>
              <Button variant="secondary" onClick={() => doDelete('single')} disabled={deleting}>
                Só este
              </Button>
              <Button variant="destructive" onClick={() => doDelete('future')} disabled={deleting}>
                {deleting ? 'Excluindo...' : 'Este e os próximos'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <SuggestionDialog
          open={showSuggestion}
          onOpenChange={setShowSuggestion}
          allUsers={allUsers}
          allEvents={allEvents}
          rooms={bookableRooms}
          user={user}
          onApply={handleSuggestionApply}
        />
      </DialogContent>
    </Dialog>
  );
}