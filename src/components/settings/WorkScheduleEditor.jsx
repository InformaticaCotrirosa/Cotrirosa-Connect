import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

const DAYS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

export const DEFAULT_WORK_SCHEDULE = {
  work_days: [1, 2, 3, 4, 5],
  morning_start: '07:42',
  morning_end: '12:00',
  afternoon_start: '13:30',
  afternoon_end: '18:00',
  has_lunch_break: true,
};

export function getWorkSchedule(user) {
  return user?.work_schedule || DEFAULT_WORK_SCHEDULE;
}

/**
 * Returns true if a given Date falls within the user's work schedule.
 */
export function isWithinWorkSchedule(date, schedule) {
  const s = schedule || DEFAULT_WORK_SCHEDULE;
  const dayOfWeek = date.getDay();
  if (!s.work_days.includes(dayOfWeek)) return false;

  const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  const inMorning = timeStr >= s.morning_start && timeStr < s.morning_end;
  if (s.has_lunch_break) {
    const inAfternoon = timeStr >= s.afternoon_start && timeStr < s.afternoon_end;
    return inMorning || inAfternoon;
  }
  return timeStr >= s.morning_start && timeStr < s.afternoon_end;
}

/**
 * Returns true if an event interval [start, end) is fully within work hours.
 * Checks both the start time and the end time (minus 1 min).
 */
export function isEventWithinSchedule(startDate, endDate, schedule) {
  const s = schedule || DEFAULT_WORK_SCHEDULE;
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (!isWithinWorkSchedule(start, s)) return false;

  // Check end time is not beyond the last period end
  const endCheck = new Date(end.getTime() - 60000); // subtract 1 min
  const endTimeStr = `${String(endCheck.getHours()).padStart(2, '0')}:${String(endCheck.getMinutes()).padStart(2, '0')}`;

  if (s.has_lunch_break) {
    const afterMorningEnd = endTimeStr >= s.morning_end && endTimeStr < s.afternoon_start;
    if (afterMorningEnd) return false; // spans lunch
    const beyondAfternoon = endTimeStr >= s.afternoon_end;
    if (beyondAfternoon) return false;
  } else {
    const beyondEnd = endTimeStr >= s.afternoon_end;
    if (beyondEnd) return false;
  }

  return true;
}

export default function WorkScheduleEditor({ value, onChange }) {
  const schedule = value || DEFAULT_WORK_SCHEDULE;

  const toggleDay = (day) => {
    const days = schedule.work_days.includes(day)
      ? schedule.work_days.filter(d => d !== day)
      : [...schedule.work_days, day].sort();
    onChange({ ...schedule, work_days: days });
  };

  const update = (field, val) => onChange({ ...schedule, [field]: val });

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs mb-2 block">Dias de trabalho</Label>
        <div className="flex gap-1.5 flex-wrap">
          {DAYS.map(d => (
            <button
              key={d.value}
              type="button"
              onClick={() => toggleDay(d.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                schedule.work_days.includes(d.value)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:bg-accent'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={schedule.has_lunch_break}
          onCheckedChange={v => update('has_lunch_break', v)}
        />
        <Label className="text-xs">Intervalo de almoço (horário partido)</Label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">
            {schedule.has_lunch_break ? 'Manhã — início' : 'Expediente — início'}
          </Label>
          <Input
            type="time"
            value={schedule.morning_start}
            onChange={e => update('morning_start', e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">
            {schedule.has_lunch_break ? 'Manhã — fim' : 'Expediente — fim'}
          </Label>
          <Input
            type="time"
            value={schedule.has_lunch_break ? schedule.morning_end : schedule.afternoon_end}
            onChange={e => update(schedule.has_lunch_break ? 'morning_end' : 'afternoon_end', e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      {schedule.has_lunch_break && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Tarde — início</Label>
            <Input
              type="time"
              value={schedule.afternoon_start}
              onChange={e => update('afternoon_start', e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Tarde — fim</Label>
            <Input
              type="time"
              value={schedule.afternoon_end}
              onChange={e => update('afternoon_end', e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
        <span className="font-medium text-foreground">Resumo: </span>
        {schedule.work_days.length === 0
          ? 'Nenhum dia selecionado'
          : DAYS.filter(d => schedule.work_days.includes(d.value)).map(d => d.label).join(', ')
        }
        {schedule.work_days.length > 0 && (
          <>
            {' · '}
            {schedule.morning_start}–{schedule.has_lunch_break ? schedule.morning_end : schedule.afternoon_end}
            {schedule.has_lunch_break && ` / ${schedule.afternoon_start}–${schedule.afternoon_end}`}
          </>
        )}
      </div>
    </div>
  );
}