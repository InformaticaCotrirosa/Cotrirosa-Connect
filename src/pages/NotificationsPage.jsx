import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bell, Calendar, Mail, Settings, AlertTriangle, Clock, CheckCheck } from 'lucide-react';
import { motion } from 'framer-motion';

const TYPE_ICONS = {
  convite: Calendar,
  reuniao: Clock,
  email: Mail,
  sistema: Settings,
  lembrete: Bell,
  alteracao: AlertTriangle,
};

const TYPE_COLORS = {
  convite: 'bg-blue-500/10 text-blue-600',
  reuniao: 'bg-violet-500/10 text-violet-600',
  email: 'bg-emerald-500/10 text-emerald-600',
  sistema: 'bg-slate-500/10 text-slate-600',
  lembrete: 'bg-orange-500/10 text-orange-600',
  alteracao: 'bg-red-500/10 text-red-600',
};

export default function NotificationsPage() {
  const { user } = useOutletContext();
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      if (!user) return [];
      return apiClient.listNotifications({ user_id: user.id, limit: 100 });
    },
    enabled: !!user,
    initialData: [],
  });

  const unread = notifications.filter(n => !n.is_read);

  const markAsRead = async (notification) => {
    if (!notification.is_read) {
      await apiClient.updateNotification(notification.id, { is_read: 1 });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadNotifications'] });
    }
  };

  const markAllRead = async () => {
    for (const n of unread) {
      await apiClient.updateNotification(n.id, { is_read: 1 });
    }
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['unreadNotifications'] });
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-heading font-bold">Notificações</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{unread.length} não lida{unread.length !== 1 ? 's' : ''}</p>
        </div>
        {unread.length > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={markAllRead}>
            <CheckCheck className="w-3.5 h-3.5" /> Marcar todas como lidas
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {notifications.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-xl border border-border">
            <Bell className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
          </div>
        ) : (
          notifications.map((notif, i) => {
            const Icon = TYPE_ICONS[notif.type] || Bell;
            const colorClass = TYPE_COLORS[notif.type] || TYPE_COLORS.sistema;
            return (
              <motion.button
                key={notif.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                onClick={() => markAsRead(notif)}
                className={`w-full text-left bg-card rounded-xl border border-border p-4 flex gap-3 hover:shadow-md transition-all ${
                  !notif.is_read ? 'border-primary/20 bg-primary/[0.02]' : ''
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm truncate ${!notif.is_read ? 'font-semibold' : 'font-medium'}`}>
                      {notif.title}
                    </p>
                    {!notif.is_read && (
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {notif.created_date ? formatDistanceToNow(new Date(notif.created_date), { addSuffix: true, locale: ptBR }) : ''}
                  </p>
                </div>
              </motion.button>
            );
          })
        )}
      </div>
    </div>
  );
}