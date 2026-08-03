import React from 'react';
import { ChevronLeft, ChevronRight, Plus, CalendarDays, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
}) {
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