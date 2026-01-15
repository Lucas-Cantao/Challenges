import { Task, TaskStatus } from './types';

// Format: "1 de Janeiro de 2025, Segunda-Feira"
export const formatDateFull = (date: Date): string => {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  }).format(date);
};

// Format: "1 Jan"
export const formatDateShort = (date: Date): string => {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
  }).format(date);
};

// Format: "14:30"
export const formatTimeShort = (date: Date): string => {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

// Format for HTML Input type="date" (YYYY-MM-DD) handling timezone
export const toInputDate = (date: Date): string => {
  const offset = date.getTimezoneOffset();
  const d = new Date(date.getTime() - (offset * 60 * 1000));
  return d.toISOString().split('T')[0];
};

// Format for HTML Input type="time" (HH:MM)
export const toInputTime = (date: Date): string => {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
};

export const isSameDay = (d1: Date, d2: Date): boolean => {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

export const getDayLabel = (dayIndex: number): string => {
  const labels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  return labels[dayIndex];
};

export const isDueSoon = (deadline: Date | null | undefined): boolean => {
  if (!deadline) return false;
  const now = new Date();
  const diffTime = deadline.getTime() - now.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24); // Floating point days
  
  // "Soon" means within the next 24 hours but not late yet
  return diffDays > 0 && diffDays <= 1;
};

export const isDueToday = (deadline: Date | null | undefined): boolean => {
  if (!deadline) return false;
  return isSameDay(new Date(), deadline);
};

// Checks if precise time has passed
export const isPastDeadline = (deadline: Date | null | undefined): boolean => {
  if (!deadline) return false;
  return new Date() > deadline;
};

export const getDaysOverdue = (deadline: Date | null | undefined): number => {
  if (!deadline) return 0;
  const now = new Date();
  
  if (now <= deadline) return 0;
  
  const diffTime = now.getTime() - deadline.getTime();
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return days === 0 ? 1 : days; // If it's overdue by minutes, count as 1 day/started overdue
};

export const getStatusColor = (status: TaskStatus, isDark: boolean, deadline?: Date | null) => {
  // Overdue logic overrides default TODO color if not completed/cancelled
  if (status === TaskStatus.TODO && deadline) {
    const isLate = isPastDeadline(deadline);
    const today = isDueToday(deadline);
    const soon = isDueSoon(deadline);

    if (isLate) {
      return isDark ? 'text-red-400 bg-red-900/30' : 'text-red-700 bg-red-100';
    }
    if (today && !isLate) {
      return isDark ? 'text-orange-400 bg-orange-900/30' : 'text-orange-700 bg-orange-100';
    }
    if (soon) {
      return isDark ? 'text-yellow-400 bg-yellow-900/30' : 'text-yellow-700 bg-yellow-100';
    }
  }

  switch (status) {
    case TaskStatus.COMPLETED:
      return isDark ? 'text-green-400 bg-green-900/30' : 'text-green-700 bg-green-100';
    case TaskStatus.LATE:
      return isDark ? 'text-red-400 bg-red-900/30' : 'text-red-700 bg-red-100';
    case TaskStatus.CANCELLED:
      return isDark ? 'text-gray-400 bg-gray-700/30' : 'text-gray-500 bg-gray-200';
    case TaskStatus.TODO:
    default:
      return isDark ? 'text-blue-400 bg-blue-900/30' : 'text-blue-700 bg-blue-100';
  }
};

export const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// Helper to calculate total seconds including currently running time
export const calculateCurrentTaskTime = (task: Task): number => {
  if (!task.timerStartedAt) return task.elapsedTimeSeconds;
  
  const start = new Date(task.timerStartedAt).getTime();
  const now = Date.now();
  const diffSeconds = Math.floor((now - start) / 1000);
  
  return task.elapsedTimeSeconds + diffSeconds;
};

// Helper to determine week boundaries
export const getWeekBounds = (date: Date) => {
  const start = new Date(date);
  const day = start.getDay(); // 0 is Sunday
  
  start.setDate(start.getDate() - day);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

// Check if a recurring task is effectively suspended for TODAY
export const isTaskSuspended = (task: Task): boolean => {
  if (!task.isRecurring || !task.isSuspended) return false;
  
  // If indefinite suspension (no date set), it is suspended.
  if (!task.suspendedUntil) return true;
  
  const now = new Date();
  // Suspended Until means "Suspended inclusive of this date". 
  // So if today is 10th and suspendedUntil is 10th, it is still suspended.
  // It resumes on the 11th.
  const suspensionEnd = new Date(task.suspendedUntil);
  suspensionEnd.setHours(23, 59, 59, 999); 
  
  return now <= suspensionEnd;
};