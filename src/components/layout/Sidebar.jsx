import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/AuthContext';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/calendar', label: 'Agenda', icon: Calendar },
  { path: '/meetings', label: 'Reuniões', icon: DoorOpen },
  { path: '/team', label: 'Equipe', icon: Users },
  { path: '/notifications', label: 'Notificações', icon: Bell, badge: true },
];

export default function Sidebar({ collapsed, setCollapsed, unreadNotifs = 0 }) {
  const location = useLocation();
  const { logout } = useAuth();

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="h-screen bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border fixed left-0 top-0 z-40"
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-sidebar-border shrink-0">
          <AnimatePresence mode="wait">
            {!collapsed ? (
              <motion.div
                key="full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 overflow-hidden"
              >
                <div className="w-9 h-9 shrink-0 rounded-md bg-sidebar-primary flex items-center justify-center overflow-hidden">
                  <img
                    src="/Icone.png"
                    alt="Cotrirosa"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <p className="font-display font-bold text-sm text-sidebar-foreground truncate">Cotrirosa</p>
                  <p className="text-[10px] text-sidebar-foreground/50 truncate">Comunicação Corporativa</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="mini"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mx-auto"
              >
                <div className="w-9 h-9 rounded-md bg-sidebar-primary flex items-center justify-center overflow-hidden">
                  <img
                    src="/Icone.png"
                    alt="Cotrirosa"
                    className="w-full h-full object-contain"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/' && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            const badgeCount = item.path === '/notifications' ? unreadNotifs : 0;

            const link = (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200 group relative
                  ${isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  }
                  ${collapsed ? 'justify-center px-0' : ''}
                `}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                {!collapsed && (
                  <span className="truncate font-medium">{item.label}</span>
                )}
                {badgeCount > 0 && !collapsed && (
                  <Badge className="ml-auto h-5 min-w-5 px-1.5 text-[10px] bg-destructive text-destructive-foreground border-0">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </Badge>
                )}
                {badgeCount > 0 && collapsed && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-sidebar" />
                )}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {item.label}
                    {badgeCount > 0 && ` (${badgeCount})`}
                  </TooltipContent>
                </Tooltip>
              );
            }
            return link;
          })}
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 border-t border-sidebar-border space-y-1">
          {collapsed ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link to="/settings" className="flex items-center justify-center rounded-lg px-3 py-2.5 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
                    <Settings className="w-[18px] h-[18px]" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">Configurações</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={handleLogout} className="w-full flex items-center justify-center rounded-lg px-3 py-2.5 text-sidebar-foreground/70 hover:bg-destructive/20 hover:text-destructive transition-colors">
                    <LogOut className="w-[18px] h-[18px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Sair</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <Link to="/settings" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
                <Settings className="w-[18px] h-[18px]" />
                <span className="font-medium">Configurações</span>
              </Link>
              <button onClick={logout} className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 hover:bg-destructive/20 hover:text-destructive transition-colors">
                <LogOut className="w-[18px] h-[18px]" />
                <span className="font-medium">Sair</span>
              </button>
            </>
          )}
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shadow-sm"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </motion.aside>
    </TooltipProvider>
  );
}