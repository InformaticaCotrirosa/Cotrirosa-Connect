import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import apiClient from '@/api/apiClient';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useCalendarRealtime } from '@/hooks/useCalendarRealtime';

export default function AppLayout() {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  useCalendarRealtime(!!user, { userId: user?.id, showInvitationToast: true });

  const { data: unreadNotifs = 0 } = useQuery({
    queryKey: ['unreadNotifications', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const invitations = await apiClient.listEventInvitations({ limit: 50 });
      return invitations.filter(invite => invite.status === 'pendente').length;
    },
    initialData: 0,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  // Responsive collapse
  useEffect(() => {
    const checkWidth = () => {
      if (window.innerWidth < 768) {
        setCollapsed(true);
      }
    };
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        unreadNotifs={unreadNotifs}
      />
      <motion.div
        initial={false}
        animate={{ marginLeft: collapsed ? 72 : 260 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="min-h-screen flex flex-col"
      >
        <TopBar
          user={user}
          unreadNotifs={unreadNotifs}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
        />
        <main className="flex-1 p-4 md:p-6">
          <Outlet context={{ user }} />
        </main>
      </motion.div>
    </div>
  );
}