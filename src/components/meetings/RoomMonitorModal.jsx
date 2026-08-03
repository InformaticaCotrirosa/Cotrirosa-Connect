import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { RoomMonitorView } from './RoomMonitorView';

export default function RoomMonitorModal({ open, onOpenChange, room, allUsers, allEvents }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-full w-screen h-screen border-0 shadow-none flex flex-col p-0 overflow-hidden !rounded-none !translate-x-0 !translate-y-0 [&>button]:hidden"
        style={{ top: 0, left: 0 }}
      >
        <RoomMonitorView
          room={room}
          allUsers={allUsers}
          allEvents={allEvents}
          active={open}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
