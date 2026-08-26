import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, ChevronDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TYPE_FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'sala_reuniao', label: 'Salas' },
  { key: 'carro', label: 'Carros' },
];

export default function CalendarHeader({
  currentDate,
  setCurrentDate,
  view,
  setView,
  onNewEvent,
  mineFilterActive,
  onClearMineFilter,
  typeFilter = 'all',
  onTypeFilterChange,
  resourceOptions = [],
  selectedResourceIds = [],
  onToggleResource,
  onClearResourceFilter,
  userOptions = [],
  selectedUserIds = [],
  onToggleUser,
  onClearUserFilter,
}) {
  const [userSearch, setUserSearch] = useState('');

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return userOptions;
    return userOptions.filter((u) => {
      const name = String(u.full_name || '').toLowerCase();
      const email = String(u.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [userOptions, userSearch]);

  const selectedUserLabel = () => {
    if (selectedUserIds.length === 0) return 'Todos os usuários';
    if (selectedUserIds.length === 1) {
      return userOptions.find((u) => selectedUserIds.includes(String(u.id)))?.full_name || '1 usuário';
    }
    return `${selectedUserIds.length} usuários`;
  };

  const navigate = (dir) => {
    const fn = dir === 'next'
      ? (view === 'month' ? addMonths : view === 'week' ? addWeeks : addDays)
      : (view === 'month' ? subMonths : view === 'week' ? subWeeks : subDays);
    setCurrentDate(fn(currentDate, 1));
  };

  const goToday = () => setCurrentDate(new Date());

  const title = view === 'month'
    ? format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })
    : view === 'week'
    ? `Semana de ${format(currentDate, "d 'de' MMMM", { locale: ptBR })}`
    : format(currentDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });

  const views = [
    { key: 'day', label: 'Dia' },
    { key: 'week', label: 'Semana' },
    { key: 'month', label: 'Mês' },
    { key: 'list', label: 'Lista' },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-3 flex-wrap">
        {onToggleUser && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5 max-w-[220px]">
                <span className="truncate">{selectedUserLabel()}</span>
                <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-2">
              <div className="flex items-center justify-between px-2 py-1.5">
                <p className="text-xs font-medium">Escolher usuários</p>
                {selectedUserIds.length > 0 && (
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={onClearUserFilter}
                  >
                    Limpar
                  </button>
                )}
              </div>
              <div className="relative px-1 pb-2">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Buscar por nome ou e-mail..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-0.5">
                {filteredUsers.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-muted-foreground text-center">
                    Nenhum usuário encontrado
                  </p>
                ) : (
                  filteredUsers.map((item) => {
                    const id = String(item.id);
                    const checked = selectedUserIds.includes(id);
                    return (
                      <label
                        key={id}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/70 cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => onToggleUser?.(id)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{item.full_name || 'Sem nome'}</span>
                          {item.email && (
                            <span className="block truncate text-[10px] text-muted-foreground">{item.email}</span>
                          )}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
              <p className="px-2 pt-1.5 text-[10px] text-muted-foreground">
                Sem seleção: mostra todos os usuários.
              </p>
            </PopoverContent>
          </Popover>
        )}
        {onTypeFilterChange && (
          <div className="flex bg-muted rounded-lg p-0.5" role="group" aria-label="Filtrar por tipo">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => onTypeFilterChange(f.key)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                  typeFilter === f.key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
        {typeFilter !== 'all' && resourceOptions.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5 max-w-[220px]">
                <span className="truncate">
                  {selectedResourceIds.length === 0
                    ? (typeFilter === 'carro' ? 'Todos os carros' : 'Todas as salas')
                    : selectedResourceIds.length === 1
                      ? (resourceOptions.find((r) => selectedResourceIds.includes(String(r.id)))?.name
                        || (typeFilter === 'carro' ? '1 carro' : '1 sala'))
                      : `${selectedResourceIds.length} ${typeFilter === 'carro' ? 'carros' : 'salas'}`}
                </span>
                <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-2">
              <div className="flex items-center justify-between px-2 py-1.5">
                <p className="text-xs font-medium">
                  {typeFilter === 'carro' ? 'Escolher carros' : 'Escolher salas'}
                </p>
                {selectedResourceIds.length > 0 && (
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={onClearResourceFilter}
                  >
                    Limpar
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto space-y-0.5">
                {resourceOptions.map((item) => {
                  const id = String(item.id);
                  const checked = selectedResourceIds.includes(id);
                  return (
                    <label
                      key={id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/70 cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => onToggleResource?.(id)}
                      />
                      <span className="truncate">{item.name}</span>
                    </label>
                  );
                })}
              </div>
              <p className="px-2 pt-1.5 text-[10px] text-muted-foreground">
                Sem seleção: mostra {typeFilter === 'carro' ? 'todos os carros' : 'todas as salas'}.
              </p>
            </PopoverContent>
          </Popover>
        )}
        <Button variant="outline" size="sm" onClick={goToday} className="text-xs h-8">
          Hoje
        </Button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('prev')}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('next')}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <h2 className="text-lg font-heading font-semibold capitalize">{title}</h2>
        {mineFilterActive && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs font-medium text-cyan-700">
            Minha Agenda
            <button onClick={onClearMineFilter} className="hover:opacity-70 ml-0.5">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex bg-muted rounded-lg p-0.5">
          {views.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                view === v.key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <Button size="sm" className="h-8 gap-1.5" onClick={onNewEvent}>
          <Plus className="w-3.5 h-3.5" /> Novo Evento
        </Button>
      </div>
    </div>
  );
}