import React from 'react';
import { motion } from 'framer-motion';
import { Check, X, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import apiClient from '@/api/apiClient';
import { useQueryClient } from '@tanstack/react-query';

export default function PendingInvitations({ invitations = [] }) {
  const queryClient = useQueryClient();
  const pending = invitations.filter(i => i.status === 'pendente');

  const handleResponse = async (invitation, status) => {
    await apiClient.updateEventInvitation(invitation.id, status);
    queryClient.invalidateQueries({ queryKey: ['invitations'] });
    queryClient.invalidateQueries({ queryKey: ['allEventInvitations'] });
    queryClient.invalidateQueries({ queryKey: ['events'] });
    queryClient.invalidateQueries({ queryKey: ['unreadNotifications'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="bg-card rounded-xl border border-border"
    >
      <div className="p-5 border-b border-border">
        <h3 className="font-heading font-semibold text-sm">Convites Pendentes de Aceite</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{pending.length} convite{pending.length !== 1 ? 's' : ''} aguardando</p>
      </div>
      <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
        {pending.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhum convite pendente</p>
          </div>
        ) : (
          pending.map((inv) => (
            <div key={inv.id} className="p-4">
              <p className="text-sm font-medium">{inv.event_title}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {inv.event_start ? format(new Date(inv.event_start), "dd/MM 'às' HH:mm", { locale: ptBR }) : ''}
                </span>
                <span>por {inv.inviter_name}</span>
              </div>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={() => handleResponse(inv, 'aceito')}
                >
                  <Check className="w-3 h-3 mr-1" /> Aceitar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs px-3"
                  onClick={() => handleResponse(inv, 'recusado')}
                >
                  <X className="w-3 h-3 mr-1" /> Recusar
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}