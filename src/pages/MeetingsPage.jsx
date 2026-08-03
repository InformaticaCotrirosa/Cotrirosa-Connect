import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/apiClient';
import { format, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, MapPin, Users, Check, X, Calendar, Pencil, Trash2, GripVertical, Monitor, ExternalLink } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { motion } from 'framer-motion';
import { UNITS } from '@/lib/constants';
import EventFormDialog from '../components/calendar/EventFormDialog';
import RoomMonitorModal from '../components/meetings/RoomMonitorModal';
import { useCalendarRealtime } from '@/hooks/useCalendarRealtime';
import { getWideEventsFetchRange } from '@/lib/eventsRange';

export default function MeetingsPage() {
  const { user } = useOutletContext();
  const [showForm, setShowForm] = useState(false);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [roomForm, setRoomForm] = useState({
    name: '', type: 'sala_reuniao', unit: '', capacity: '', resources: '', color: '#22c55e', is_active: true,
  });
  const [savingRoom, setSavingRoom] = useState(false);
  const [deletingRoom, setDeletingRoom] = useState(null);
  const [monitorRoom, setMonitorRoom] = useState(null);
  const queryClient = useQueryClient();

  useCalendarRealtime(true, { userId: user?.id, showInvitationToast: false });

  const eventsRange = React.useMemo(() => getWideEventsFetchRange(), []);

  const openEditRoom = (room) => {
    setEditingRoom(room);
    setRoomForm({
      name: room.name,
      type: room.type || 'sala_reuniao',
      unit: room.unit,
      capacity: String(room.capacity ?? ''),
      resources: (room.resources || []).join(', '),
      color: room.color || '#22c55e',
      is_active: room.is_active !== false,
    });
    setShowRoomForm(true);
  };

  const openNewRoom = () => {
    setEditingRoom(null);
    setRoomForm({
      name: '', type: 'sala_reuniao', unit: '', capacity: '', resources: '', color: '#22c55e', is_active: true,
    });
    setShowRoomForm(true);
  };

  const handleSaveRoom = async () => {
    if (!roomForm.name || !roomForm.unit || !roomForm.capacity) return;
    setSavingRoom(true);
    const payload = {
      name: roomForm.name,
      type: roomForm.type,
      unit: roomForm.unit,
      location: roomForm.unit,
      capacity: Number(roomForm.capacity),
      resources: roomForm.resources ? roomForm.resources.split(',').map(r => r.trim()).filter(Boolean) : [],
      color: roomForm.color || '#22c55e',
      is_active: roomForm.is_active !== false,
    };
    if (editingRoom) {
      await apiClient.updateMeetingRoom(editingRoom.id, payload);
    } else {
      await apiClient.createMeetingRoom(payload);
    }
    queryClient.invalidateQueries({ queryKey: ['rooms'] });
    setSavingRoom(false);
    setShowRoomForm(false);
    setRoomForm({
      name: '', type: 'sala_reuniao', unit: '', capacity: '', resources: '', color: '#22c55e', is_active: true,
    });
    setEditingRoom(null);
  };

  const handleDeleteRoom = async () => {
    if (!deletingRoom) return;
    await apiClient.deleteMeetingRoom(deletingRoom.id);
    queryClient.invalidateQueries({ queryKey: ['rooms'] });
    setDeletingRoom(null);
  };

  const { data: events = [] } = useQuery({
    queryKey: ['events', 'meetings', eventsRange.from],
    queryFn: async () => {
      const all = await apiClient.listCalendarEvents({
        limit: 5000,
        from: eventsRange.from,
        to: eventsRange.to,
      });
      return all.filter(e => e.event_type === 'reuniao');
    },
    initialData: [],
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ['invitations'],
    queryFn: async () => {
      if (!user) return [];
      return apiClient.listEventInvitations({ invitee_id: user.id, limit: 30 });
    },
    enabled: !!user,
    initialData: [],
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => apiClient.listMeetingRooms({ limit: 1000 }),
    initialData: [],
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => apiClient.listUsers({ limit: 1000 }),
    initialData: [],
  });

  const { data: allEventsForMonitor = [] } = useQuery({
    queryKey: ['allEventsForMonitor', eventsRange.from],
    queryFn: () => apiClient.listCalendarEvents({
      limit: 5000,
      from: eventsRange.from,
      to: eventsRange.to,
    }),
    initialData: [],
    // Polling enquanto o modal do monitor estiver aberto (fallback do WebSocket)
    refetchInterval: monitorRoom ? 15_000 : false,
    refetchIntervalInBackground: true,
  });

  const sortedRooms = [...rooms].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const handleReorderRooms = async (result) => {
    if (!result.destination || result.source.index === result.destination.index) return;
    const reordered = [...sortedRooms];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    const updates = reordered.map((room, idx) => apiClient.updateMeetingRoom(room.id, { sort_order: idx }));
    await Promise.all(updates);
    queryClient.invalidateQueries({ queryKey: ['rooms'] });
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === 'true') {
      setShowForm(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const now = new Date();
  const upcoming = events.filter(e => isAfter(new Date(e.start_date), now));
  const past = events.filter(e => !isAfter(new Date(e.start_date), now));
  const pending = invitations.filter(i => i.status === 'pendente');

  const respondInvite = async (inv, status) => {
    await apiClient.updateEventInvitation(inv.id, status);
    queryClient.invalidateQueries({ queryKey: ['invitations'] });
  };

  const MeetingCard = ({ event }) => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="hover:shadow-md hover:border-primary/20 transition-all">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{event.title}</p>
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(event.start_date), "dd/MM 'às' HH:mm", { locale: ptBR })}
                </span>
                {event.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {event.location}
                  </span>
                )}
                {event.participants?.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" /> {event.participants.length} participantes
                  </span>
                )}
              </div>
              {event.description && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{event.description}</p>
              )}
            </div>
            <Badge variant="secondary" className="text-[10px] shrink-0"
              style={{ backgroundColor: (event.color || '#3b82f6') + '15', color: event.color || '#3b82f6' }}
            >
              {event.status || 'confirmado'}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-heading font-bold">Reuniões</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Gerenciamento de reuniões e salas</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowForm(true)}>
          <Plus className="w-3.5 h-3.5" /> Nova Reunião
        </Button>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Próximas ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="invites">Convites ({pending.length})</TabsTrigger>
          <TabsTrigger value="rooms">Salas ({rooms.length})</TabsTrigger>
          <TabsTrigger value="past">Anteriores</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-3 mt-4">
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma reunião próxima</p>
          ) : (
            upcoming.map(e => <MeetingCard key={e.id} event={e} />)
          )}
        </TabsContent>

        <TabsContent value="invites" className="space-y-3 mt-4">
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum convite pendente</p>
          ) : (
            pending.map(inv => (
              <Card key={inv.id}>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{inv.event_title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {inv.event_start ? format(new Date(inv.event_start), "dd/MM 'às' HH:mm", { locale: ptBR }) : ''} • Convidado por {inv.inviter_name}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs" onClick={() => respondInvite(inv, 'aceito')}>
                      <Check className="w-3 h-3 mr-1" /> Aceitar
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => respondInvite(inv, 'recusado')}>
                      <X className="w-3 h-3 mr-1" /> Recusar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="rooms" className="mt-4">
          {user?.role === 'admin' && (
            <div className="flex justify-end mb-3">
              <Button size="sm" className="gap-1.5" onClick={openNewRoom}>
                <Plus className="w-3.5 h-3.5" /> Nova Sala
              </Button>
            </div>
          )}
          {sortedRooms.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma sala cadastrada</p>
          ) : (
            <DragDropContext onDragEnd={handleReorderRooms}>
              <Droppable droppableId="rooms" direction="horizontal">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {sortedRooms.map((room, index) => (
                      <Draggable key={room.id} draggableId={room.id} index={index} isDragDisabled={user?.role !== 'admin'}>
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`${snapshot.isDragging ? 'shadow-lg ring-2 ring-primary/30' : ''} ${room.is_active === false ? 'opacity-60' : ''}`}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {user?.role === 'admin' && (
                                    <span {...provided.dragHandleProps} className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing shrink-0">
                                      <GripVertical className="w-4 h-4" />
                                    </span>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: room.color || '#22c55e' }} />
                                      <p className="font-medium text-sm">{room.name}</p>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                      <Badge variant="outline" className="text-[10px]">{room.type === 'carro' ? '🚗 Carro' : '🏢 Sala de reunião'}</Badge>
                                      {room.is_active === false ? (
                                        <Badge variant="secondary" className="text-[10px] bg-muted text-muted-foreground">Inativa</Badge>
                                      ) : (
                                        <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 border-0">Ativa</Badge>
                                      )}
                                      <span className="text-xs text-muted-foreground">Capacidade: {room.capacity} pessoas</span>
                                    </div>
                                    {room.resources?.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-2">
                                        {room.resources.map((r, i) => (
                                          <Badge key={i} variant="secondary" className="text-[10px]">{r}</Badge>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setMonitorRoom(room)} title="Monitor da sala">
                                    <Monitor className="w-4 h-4 text-blue-500" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    title="Abrir monitor em tela cheia (tablet)"
                                    onClick={() => window.open(`/monitor/${room.id}`, '_blank', 'noopener,noreferrer')}
                                  >
                                    <ExternalLink className="w-4 h-4 text-blue-500" />
                                  </Button>
                                  {user?.role === 'admin' && (
                                    <>
                                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditRoom(room)}>
                                        <Pencil className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletingRoom(room)}>
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-3 mt-4">
          {past.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma reunião anterior</p>
          ) : (
            past.slice(0, 20).map(e => <MeetingCard key={e.id} event={e} />)
          )}
        </TabsContent>
      </Tabs>

      <EventFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        event={null}
        initialDate={null}
        user={user}
      />

      <RoomMonitorModal
        open={!!monitorRoom}
        onOpenChange={(open) => { if (!open) setMonitorRoom(null); }}
        room={monitorRoom}
        allUsers={allUsers}
        allEvents={allEventsForMonitor}
      />

      <AlertDialog open={!!deletingRoom} onOpenChange={open => !open && setDeletingRoom(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sala</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja excluir a sala <strong>{deletingRoom?.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRoom} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showRoomForm} onOpenChange={setShowRoomForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">{editingRoom ? 'Editar Sala' : 'Nova Sala de Reunião'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input value={roomForm.name} onChange={e => setRoomForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Sala de Reuniões A" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Tipo *</Label>
              <Select value={roomForm.type} onValueChange={v => setRoomForm(p => ({ ...p, type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sala_reuniao">Sala de reunião</SelectItem>
                  <SelectItem value="carro">Carro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Unidade *</Label>
                <Select value={roomForm.unit} onValueChange={v => setRoomForm(p => ({ ...p, unit: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(UNITS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Capacidade *</Label>
                <Input type="number" value={roomForm.capacity} onChange={e => setRoomForm(p => ({ ...p, capacity: e.target.value }))} placeholder="Ex: 10" className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Recursos (separados por vírgula)</Label>
              <Input value={roomForm.resources} onChange={e => setRoomForm(p => ({ ...p, resources: e.target.value }))} placeholder="Ex: Projetor, TV, Videoconferência" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Cor de identificação</Label>
              <div className="flex items-center gap-3 mt-1">
                <input type="color" value={roomForm.color || '#22c55e'} onChange={e => setRoomForm(p => ({ ...p, color: e.target.value }))} className="h-9 w-14 rounded-md border border-input cursor-pointer p-0.5" />
                <span className="text-xs text-muted-foreground">Escolha uma cor para identificar visualmente esta sala</span>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <div>
                <Label className="text-xs">Sala ativa</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Desativada não aparece no agendamento de reuniões
                </p>
              </div>
              <Switch
                checked={roomForm.is_active !== false}
                onCheckedChange={(checked) => setRoomForm((p) => ({ ...p, is_active: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoomForm(false)}>Cancelar</Button>
            <Button onClick={handleSaveRoom} disabled={savingRoom || !roomForm.name || !roomForm.unit || !roomForm.capacity}>
              {savingRoom ? 'Salvando...' : editingRoom ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}