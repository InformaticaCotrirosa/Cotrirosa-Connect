import React from 'react';
import { motion } from 'framer-motion';
import { CalendarPlus, CalendarDays, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

const actions = [
  { label: 'Novo Evento', icon: CalendarPlus, path: '/calendar?new=true', color: 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20' },
  { label: 'Minha Agenda', icon: CalendarDays, path: '/calendar?mine=true', color: 'bg-cyan-500/10 text-cyan-600 hover:bg-cyan-500/20' },
  { label: 'Agenda Completa', icon: CalendarDays, path: '/calendar', color: 'bg-violet-500/10 text-violet-600 hover:bg-violet-500/20' },
  { label: 'Ver Equipe', icon: Users, path: '/team', color: 'bg-orange-500/10 text-orange-600 hover:bg-orange-500/20' },
];

export default function QuickActions() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="grid grid-cols-2 md:grid-cols-4 gap-3"
    >
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.label}
            to={action.path}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border border-border transition-all duration-200 ${action.color}`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-xs font-medium">{action.label}</span>
          </Link>
        );
      })}
    </motion.div>
  );
}