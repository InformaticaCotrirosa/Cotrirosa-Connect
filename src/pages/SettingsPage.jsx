import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { User, Bell, Users, Clock } from 'lucide-react';
import { UNITS, ROLES } from '@/lib/constants';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import WorkScheduleEditor, { DEFAULT_WORK_SCHEDULE } from '@/components/settings/WorkScheduleEditor';

export default function SettingsPage() {
  const { user } = useOutletContext();
  const { checkUserAuth } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    full_name: '', position: '', phone: '', email_signature: '', status: 'disponivel', unit: '',
    work_schedule: DEFAULT_WORK_SCHEDULE,
  });
  const [saving, setSaving] = useState(false);
  const [changingRole, setChangingRole] = useState(null);
  const [togglingUserId, setTogglingUserId] = useState(null);
  const [userStatusFilter, setUserStatusFilter] = useState('all'); // all | active | inactive

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => apiClient.listUsers({ limit: 200 }),
    enabled: user?.role === 'admin',
    initialData: [],
  });

  const filteredUsers = allUsers.filter((u) => {
    const isActive = u.status !== 'desativado';
    if (userStatusFilter === 'active') return isActive;
    if (userStatusFilter === 'inactive') return !isActive;
    return true;
  });

  const activeCount = allUsers.filter((u) => u.status !== 'desativado').length;
  const inactiveCount = allUsers.length - activeCount;

  const handleRoleChange = async (targetUser, newRole) => {
    setChangingRole(targetUser.id);
    try {
      await apiClient.updateUser(targetUser.id, { role: newRole });
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      toast({ title: `Perfil de ${targetUser.full_name} atualizado para ${ROLES[newRole]}` });
    } catch (error) {
      toast({
        title: 'Erro ao alterar perfil',
        description: error.message || 'Não foi possível atualizar o usuário.',
      });
    } finally {
      setChangingRole(null);
    }
  };

  const handleActiveToggle = async (targetUser, active) => {
    if (targetUser.id === user.id) {
      toast({ title: 'Você não pode desativar a si mesmo' });
      return;
    }
    setTogglingUserId(targetUser.id);
    try {
      const newStatus = active ? 'disponivel' : 'desativado';
      await apiClient.updateUser(targetUser.id, { status: newStatus });
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      toast({
        title: active
          ? `${targetUser.full_name || 'Usuário'} reativado`
          : `${targetUser.full_name || 'Usuário'} desativado`,
        description: active
          ? 'O usuário voltará a aparecer nos agendamentos e poderá fazer login.'
          : 'O usuário não poderá fazer login nem ser convidado para reuniões.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao alterar status',
        description: error.message || 'Não foi possível atualizar o usuário.',
      });
    } finally {
      setTogglingUserId(null);
    }
  };

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || '',
        position: user.position || '',
        phone: user.phone || '',
        email_signature: user.email_signature || '',
        status: user.status || 'disponivel',
        unit: user.unit || '',
        work_schedule: user.work_schedule || DEFAULT_WORK_SCHEDULE,
      });
    }
  }, [user]);

  const handleSave = async () => {
    if (!form.full_name?.trim()) {
      toast({ title: 'Informe o nome completo' });
      return;
    }
    setSaving(true);
    try {
      await apiClient.updateUser(user.id, {
        ...form,
        full_name: form.full_name.trim(),
      });
      await checkUserAuth();
      toast({ title: 'Perfil atualizado com sucesso!' });
    } catch (error) {
      toast({ title: 'Erro ao atualizar perfil', description: error.message || 'Tente novamente.' });
    } finally {
      setSaving(false);
    }
  };

  const initials = (user?.full_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-heading font-bold">Configurações</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Gerencie seu perfil e preferências</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile" className="gap-1.5">
            <User className="w-3.5 h-3.5" /> Perfil
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Expediente
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5">
            <Bell className="w-3.5 h-3.5" /> Notificações
          </TabsTrigger>
          {user?.role === 'admin' && (
            <TabsTrigger value="users" className="gap-1.5">
              <Users className="w-3.5 h-3.5" /> Usuários
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-lg font-heading font-semibold">{user?.full_name}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{ROLES[user?.role] || user?.role}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-xs">Nome completo *</Label>
                  <Input
                    value={form.full_name}
                    onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                    placeholder="Seu nome completo"
                    className="mt-1"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Cargo</Label>
                    <Input value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value }))} placeholder="Seu cargo" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Telefone</Label>
                    <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="(00) 00000-0000" className="mt-1" />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Unidade</Label>
                    <Select value={form.unit} onValueChange={v => setForm(p => ({ ...p, unit: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(UNITS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Status de presença</Label>
                    <Select
                      value={form.status === 'desativado' ? 'disponivel' : form.status}
                      onValueChange={v => setForm(p => ({ ...p, status: v }))}
                      disabled={form.status === 'desativado'}
                    >
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="disponivel">Disponível</SelectItem>
                        <SelectItem value="ocupado">Ocupado</SelectItem>
                        <SelectItem value="ausente">Ausente</SelectItem>
                        <SelectItem value="nao_perturbe">Não perturbe</SelectItem>
                        <SelectItem value="ferias">Férias</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.status === 'desativado' && (
                      <p className="text-[11px] text-destructive mt-1">
                        Conta desativada por um administrador. Contate o suporte para reativação.
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Assinatura de E-mail</Label>
                  <Textarea
                    value={form.email_signature}
                    onChange={e => setForm(p => ({ ...p, email_signature: e.target.value }))}
                    placeholder="Sua assinatura para e-mails corporativos..."
                    className="mt-1"
                    rows={3}
                  />
                </div>
              </div>

              <Button onClick={handleSave} disabled={saving || !form.full_name?.trim()} className="mt-6">
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <div className="mb-4">
                <p className="text-sm font-medium">Horário de Expediente</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Define os horários em que reuniões podem ser agendadas para você. O sistema bloqueará agendamentos fora deste intervalo.
                </p>
              </div>
              <WorkScheduleEditor
                value={form.work_schedule}
                onChange={ws => setForm(p => ({ ...p, work_schedule: ws }))}
              />
              <Button onClick={handleSave} disabled={saving} className="mt-6">
                {saving ? 'Salvando...' : 'Salvar Expediente'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                Configurações de notificação serão adicionadas em breve. Atualmente você recebe todas as notificações automaticamente.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {user?.role === 'admin' && (
          <TabsContent value="users" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <div className="p-4 border-b space-y-3">
                  <div>
                    <p className="text-sm font-medium">Gerenciar Usuários</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Altere o perfil de acesso e ative/desative colaboradores
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground mr-1">Filtrar:</span>
                    {[
                      { id: 'all', label: `Todos (${allUsers.length})` },
                      { id: 'active', label: `Ativos (${activeCount})` },
                      { id: 'inactive', label: `Inativos (${inactiveCount})` },
                    ].map((opt) => (
                      <Button
                        key={opt.id}
                        type="button"
                        size="sm"
                        variant={userStatusFilter === opt.id ? 'default' : 'outline'}
                        className="h-7 text-xs"
                        onClick={() => setUserStatusFilter(opt.id)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="divide-y">
                  {filteredUsers.map(u => {
                    const initials = (u.full_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                    const isCurrentUser = u.id === user.id;
                    const isActive = u.status !== 'desativado';
                    return (
                      <div key={u.id} className={`flex items-center gap-3 p-4 ${!isActive ? 'opacity-60' : ''}`}>
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{u.full_name || 'Sem nome'}</p>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                          {!isActive && (
                            <Badge variant="secondary" className="text-[10px] mt-1">Desativado</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {!isCurrentUser && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground hidden sm:inline">
                                {isActive ? 'Ativo' : 'Inativo'}
                              </span>
                              <Switch
                                checked={isActive}
                                disabled={togglingUserId === u.id}
                                onCheckedChange={(checked) => handleActiveToggle(u, checked)}
                                title={isActive ? 'Desativar usuário' : 'Reativar usuário'}
                              />
                            </div>
                          )}
                          {isCurrentUser ? (
                            <Badge variant="secondary" className="text-[10px]">
                              {ROLES[u.role] || u.role} (você)
                            </Badge>
                          ) : (
                            <Select
                              value={u.role || 'user'}
                              onValueChange={newRole => handleRoleChange(u, newRole)}
                              disabled={changingRole === u.id || !isActive}
                            >
                              <SelectTrigger className="w-44 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(ROLES).map(([k, v]) => (
                                  <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {userStatusFilter === 'inactive'
                        ? 'Nenhum usuário inativo'
                        : userStatusFilter === 'active'
                          ? 'Nenhum usuário ativo'
                          : 'Nenhum usuário encontrado'}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}