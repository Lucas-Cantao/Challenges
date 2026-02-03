export enum TaskStatus {
  TODO = 'Em andamento',
  COMPLETED = 'Concluído',
  LATE = 'Em atraso',
  CANCELLED = 'Cancelada',
}

export interface Comment {
  id: string;
  text: string;
  createdAt: Date;
  isCompleted?: boolean; // Checkbox status
}

export interface Task {
  id: string;
  userID: string; // Owner of the task (Renamed from userId)
  title: string;
  description?: string; // Observações
  deadline?: Date | null; // Prazo (null = indeterminado)
  requester?: string; // Solicitante
  isPriority: boolean;
  status: TaskStatus;
  createdAt: Date;
  completedAt?: Date; // New field for metrics
  comments: Comment[];
  priorityOrder?: number; // For Drag and Drop ordering
  elapsedTimeSeconds: number; // Stored accumulated time
  timerStartedAt?: Date | null; // Timestamp when the current session started (if running)
  
  // Hierarchy
  parentId?: string | null; // ID of the parent task

  // Recurring Logic
  isRecurring?: boolean; 
  recurringDays?: number[]; // 0 = Sunday, 1 = Monday, etc.
  recurringTime?: string; // "HH:MM" for daily deadline
  lastRecurringCompletion?: Date | null; // Stores the date of the last "daily" completion

  // Suspension Logic
  isSuspended?: boolean;
  suspendedUntil?: Date | null; // If null/undefined and isSuspended=true, it is indefinitely suspended.
}

export interface DayGroup {
  date: Date;
  tasks: Task[];
}

export interface WeekGroup {
  startDate: Date;
  endDate: Date;
  tasks: Task[];
  label: string;
}

export type Theme = 'light' | 'dark';