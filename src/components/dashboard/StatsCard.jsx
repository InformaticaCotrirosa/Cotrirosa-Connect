import React from 'react';
import { motion } from 'framer-motion';

export default function StatsCard({ title, value, subtitle, icon: Icon, color = 'primary', delay = 0 }) {
  const colorMap = {
    primary: 'bg-primary/10 text-primary',
    blue: 'bg-blue-500/10 text-blue-600',
    green: 'bg-emerald-500/10 text-emerald-600',
    orange: 'bg-orange-500/10 text-orange-600',
    purple: 'bg-violet-500/10 text-violet-600',
    red: 'bg-red-500/10 text-red-600',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="bg-card rounded-xl border border-border p-5 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold font-heading mt-1.5">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </motion.div>
  );
}