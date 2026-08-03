import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/apiClient';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { UNITS, ROLES, STATUS_COLORS } from '@/lib/constants';

export default function TeamPage() {
  const { user } = useOutletContext();
  const [search, setSearch] = useState('');
  const [filterUnit, setFilterUnit] = useState('all');
  const [filterRole, setFilterRole] = useState('all');

  const { data: users = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => apiClient.listUsers({ limit: 1000 }),
    initialData: [],
  });

  const filtered = users.filter(u => {
    const matchSearch = !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
    const matchUnit = filterUnit === 'all' || u.unit === filterUnit;
    const matchRole = filterRole === 'all' || u.role === filterRole;
    return matchSearch && matchUnit && matchRole;
  });

  const statusLabels = {
    disponivel: 'Disponível',
    ocupado: 'Ocupado',
    ausente: 'Ausente',
    nao_perturbe: 'Não perturbe',
    ferias: 'Férias',
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-heading font-bold">Equipe</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{users.length} colaboradores cadastrados</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterUnit} onValueChange={setFilterUnit}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Unidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Unidades</SelectItem>
            {Object.entries(UNITS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Cargo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Cargos</SelectItem>
            {Object.entries(ROLES).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum colaborador encontrado</p>
          </div>
        ) : (
          filtered.map((u, i) => {
            const initials = (u.full_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            const status = u.status || 'disponivel';
            return (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="bg-card rounded-xl border border-border p-4 hover:shadow-md hover:border-primary/20 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card"
                      style={{ backgroundColor: STATUS_COLORS[status] }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.full_name || 'Sem nome'}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {u.role && <Badge variant="secondary" className="text-[10px]">{ROLES[u.role] || u.role}</Badge>}
                      {u.unit && <Badge variant="outline" className="text-[10px]">{UNITS[u.unit]?.label || u.unit}</Badge>}
                    </div>
                    {u.position && (
                      <p className="text-[10px] text-muted-foreground mt-1.5">{u.position}</p>
                    )}
                    <p className="text-[10px] mt-1 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
                      {statusLabels[status]}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}