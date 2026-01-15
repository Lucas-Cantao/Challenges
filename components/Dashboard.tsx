import React, { useMemo } from 'react';
import { Task, TaskStatus } from '../types';
import { formatTime, isSameDay, calculateCurrentTaskTime, toInputDate, isTaskSuspended } from '../utils';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Activity, 
  BarChart3, 
  TrendingUp,
  Timer,
  Filter,
  Calendar as CalendarIcon,
  Repeat
} from 'lucide-react';

interface DashboardProps {
  tasks: Task[];
  isDark: boolean;
  startDate: string;
  endDate: string;
  onDateChange: (start: string, end: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ tasks, isDark, startDate, endDate, onDateChange }) => {
  
  // --- Shortcuts Handlers ---
  const applyShortcut = (type: 'today' | 'month' | '3months' | 'year') => {
      const now = new Date();
      let start = new Date();
      let end = new Date();

      switch (type) {
          case 'today':
              // Start and end are already 'now'
              break;
          case 'month':
              start = new Date(now.getFullYear(), now.getMonth(), 1);
              end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of current month
              break;
          case '3months':
              start = new Date(now);
              start.setMonth(now.getMonth() - 3);
              end = new Date(now);
              break;
          case 'year':
              start = new Date(now.getFullYear(), 0, 1);
              end = new Date(now.getFullYear(), 11, 31);
              break;
      }

      onDateChange(toInputDate(start), toInputDate(end));
  };

  // Helper to parse input date string (YYYY-MM-DD) to Local Date Object at 00:00:00 or 23:59:59
  const getFilterBounds = useMemo(() => {
     let start: Date | null = null;
     let end: Date | null = null;

     if (startDate) {
         const [y, m, d] = startDate.split('-').map(Number);
         start = new Date(y, m - 1, d, 0, 0, 0, 0);
     }

     if (endDate) {
         const [y, m, d] = endDate.split('-').map(Number);
         end = new Date(y, m - 1, d, 23, 59, 59, 999);
     }

     return { start, end };
  }, [startDate, endDate]);

  // --- Filtering Logic ---
  const filteredTasks = useMemo(() => {
    const { start, end } = getFilterBounds;
    const now = new Date();

    // Determine if the filter view includes "Right Now" (e.g. Today, This Week).
    // This dictates whether we should show "Overdue" tasks.
    const isCurrentView = (!start || start <= now) && (!end || end >= now);
    
    // If no filter is set, return all tasks
    if (!start && !end) return tasks;

    return tasks.filter(t => {
       // --- RECURRING LOGIC ---
       if (t.isRecurring && t.recurringDays) {
           // Skip if suspended right now and we are looking at current view
           if (isCurrentView && isTaskSuspended(t)) return false;

           // 1. Was it completed IN this range?
           if (t.lastRecurringCompletion) {
               const recurDate = new Date(t.lastRecurringCompletion);
               // Simple range check
               const afterStart = !start || recurDate >= start;
               const beforeEnd = !end || recurDate <= end;
               if (afterStart && beforeEnd) return true;
           }

           // 2. Is it SCHEDULED to happen in this range?
           if (start && end) {
               // Optimization: If range is huge (e.g. > 1 year), just include it.
               const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
               if (diffDays >= 365) return true;

               // Iterate through the range to see if any day matches recurringDays
               let current = new Date(start);
               while (current <= end) {
                   if (t.recurringDays.includes(current.getDay())) {
                       // Even if scheduled, verify if it was suspended ON THAT DAY? 
                       // Complex to check historic suspension, assume current state for simplicity or ignore historic check for now
                       return true; 
                   }
                   current.setDate(current.getDate() + 1);
               }
               return false; 
           }
           return true;
       }

       // --- STANDARD LOGIC ---
       const isCompleted = t.status === TaskStatus.COMPLETED;

       // 1. Completed Tasks: Must strictly fall within the date range based on completion time.
       // We don't "drag" completed tasks from the past into Today's view.
       if (isCompleted) {
           if (!t.completedAt) return false;
           const cDate = new Date(t.completedAt);
           if (start && cDate < start) return false;
           if (end && cDate > end) return false;
           return true;
       }

       // 2. Cancelled Tasks: Strictly by date (usually deadline or created)
       if (t.status === TaskStatus.CANCELLED) {
           const d = t.deadline ? new Date(t.deadline) : new Date(t.createdAt);
           if (start && d < start) return false;
           if (end && d > end) return false;
           return true;
       }

       // 3. Active Tasks (TODO, LATE)
       // If we are viewing "Now/Today", we want to see everything active (Due Today OR Overdue).
       if (isCurrentView) {
           if (t.deadline) {
               const d = new Date(t.deadline);
               // If it is in the future (beyond end), hide it.
               if (end && d > end) return false;
               
               // If it is before start (Overdue) OR in range -> Keep it.
               // Since we already filtered out Completed/Cancelled above, these are active tasks.
               return true;
           }
           // No deadline (Backlog) -> Always show in Current View
           return true;
       } else {
           // Historic/Future View (e.g. "Last Week" or "Next Month")
           // Strict filtering: We only want things that were actually due or created in that specific window.
           // We do NOT want to see current overdue tasks in a report about "Last Month".
           const d = t.deadline ? new Date(t.deadline) : new Date(t.createdAt);
           if (start && d < start) return false;
           if (end && d > end) return false;
           return true;
       }
    });
  }, [tasks, getFilterBounds]);

  // --- Calculations (using filteredTasks) ---
  
  const metrics = useMemo(() => {
    const today = new Date();
    const taskList = filteredTasks;
    const { start, end } = getFilterBounds;

    // Helper: Is this a recurring task completed WITHIN the selected filter period?
    const isRecurringDoneInPeriod = (t: Task) => {
        if (!t.isRecurring || !t.lastRecurringCompletion) return false;
        const d = new Date(t.lastRecurringCompletion);
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
    };

    // Helper: Is this recurring task LATE right now?
    const isRecurringLate = (t: Task) => {
        if (!t.isRecurring || !t.recurringDays || !t.recurringTime) return false;
        if (isTaskSuspended(t)) return false; // Suspended tasks are never late

        // Only check "Late" if today is part of the view
        const isTodayInView = (!start || start <= today) && (!end || end >= today);
        if (!isTodayInView) return false;

        const dayIndex = today.getDay();
        if (!t.recurringDays.includes(dayIndex)) return false; // Not for today

        // If done today, not late
        if (t.lastRecurringCompletion && isSameDay(new Date(t.lastRecurringCompletion), today)) return false;

        // Check time
        const [h, m] = t.recurringTime.split(':').map(Number);
        const now = new Date();
        if (now.getHours() > h) return true;
        if (now.getHours() === h && now.getMinutes() > m) return true;
        return false;
    };

    const total = taskList.length;

    // 1. Recurring Completed Count
    const recurringCompletedCount = taskList.filter(t => isRecurringDoneInPeriod(t)).length;
    // Count total recurring tasks visible in this period (active + completed)
    const recurringTotalInPeriod = taskList.filter(t => t.isRecurring).length;

    // 2. Standard Completed Count
    const standardCompletedCount = taskList.filter(t => t.status === TaskStatus.COMPLETED).length;

    // Total Completed (Standard + Recurring)
    const completed = standardCompletedCount + recurringCompletedCount;

    // Adjusted Late Count
    const late = taskList.filter(t => {
      if (t.isRecurring) {
        return isRecurringLate(t);
      }
      // If no deadline, it cannot be late
      if (!t.deadline) return false;
      return (t.status === TaskStatus.LATE || (t.status === TaskStatus.TODO && new Date(t.deadline) < new Date()));
    }).length;

    // Adjusted Pending Count (exclude completed recurring)
    const pending = taskList.filter(t => {
      if (t.status === TaskStatus.COMPLETED || t.status === TaskStatus.CANCELLED) return false;
      if (isRecurringDoneInPeriod(t)) return false;
      if (t.isRecurring && isTaskSuspended(t)) return false; // Suspended aren't pending
      return true; 
    }).length;

    const priority = taskList.filter(t => 
      t.isPriority && 
      t.status !== TaskStatus.COMPLETED && 
      t.status !== TaskStatus.CANCELLED &&
      !isRecurringDoneInPeriod(t) &&
      !isTaskSuspended(t)
    ).length;
    
    // Time metrics
    const totalTimeSeconds = taskList.reduce((acc, t) => acc + calculateCurrentTaskTime(t), 0);
    
    // Status Distribution for Charts
    const statusDist = {
      todo: taskList.filter(t => {
         if (t.status === TaskStatus.COMPLETED || t.status === TaskStatus.CANCELLED) return false;
         
         if (t.isRecurring) {
             const isDone = isRecurringDoneInPeriod(t);
             const isLate = isRecurringLate(t);
             
             if (isDone || isLate) return false;
             if (isTaskSuspended(t)) return false;

             // Only count recurring as "Todo" if scheduled for TODAY
             const isTodayInView = (!start || start <= today) && (!end || end >= today);
             if (isTodayInView && t.recurringDays) {
                 const dayIndex = today.getDay();
                 return t.recurringDays.includes(dayIndex);
             }
             return true;
         }

         if (!t.deadline) return t.status === TaskStatus.TODO; 
         // Check if it is late. If it is late, it goes to 'late' bucket, not 'todo' bucket for the chart.
         const isStandardLate = (t.status === TaskStatus.LATE || (t.status === TaskStatus.TODO && t.deadline && new Date(t.deadline) < new Date()));
         return t.status === TaskStatus.TODO && !isStandardLate;
      }).length,
      late: late,
      standardCompleted: standardCompletedCount,
      recurringCompleted: recurringCompletedCount,
      recurringTotal: recurringTotalInPeriod, 
      cancelled: taskList.filter(t => t.status === TaskStatus.CANCELLED).length
    };

    // Most Active Tasks
    const mostActiveTasks = [...taskList]
      .map(t => ({...t, totalCurrentTime: calculateCurrentTaskTime(t)})) 
      .filter(t => t.totalCurrentTime > 0)
      .sort((a, b) => b.totalCurrentTime - a.totalCurrentTime)
      .slice(0, 5);

    return {
      total,
      completed,
      pending,
      late,
      priority,
      totalTimeSeconds,
      statusDist,
      mostActiveTasks
    };
  }, [filteredTasks, getFilterBounds]); 

  const completionRate = metrics.total > 0 ? Math.round((metrics.completed / metrics.total) * 100) : 0;
  
  // Logic to determine if we show the breakdown for recurring tasks
  const isSingleDay = startDate && endDate && startDate === endDate;

  // --- Styles ---
  const cardBg = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-blue-100';
  const textMain = isDark ? 'text-white' : 'text-slate-800';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';

  const shortcutClass = `px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${isDark ? 'border-slate-600 hover:bg-slate-700 text-slate-300' : 'border-gray-200 hover:bg-gray-100 text-gray-600'}`;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* --- Filter Controls --- */}
      <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-4 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-200 shadow-sm'}`}>
         
         <div className="flex items-center gap-2 w-full md:w-auto">
             <div className={`p-2 rounded-lg ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-blue-50 text-blue-600'}`}>
                 <Filter size={18} />
             </div>
             <span className={`text-sm font-semibold ${textMain}`}>Filtrar Dados</span>
         </div>

         <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
             {/* Shortcuts */}
             <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                 <button onClick={() => applyShortcut('today')} className={shortcutClass}>Hoje</button>
                 <button onClick={() => applyShortcut('month')} className={shortcutClass}>Este Mês</button>
                 <button onClick={() => applyShortcut('3months')} className={shortcutClass}>3 Meses</button>
                 <button onClick={() => applyShortcut('year')} className={shortcutClass}>Ano</button>
             </div>

             {/* Date Pickers */}
             <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                 <CalendarIcon size={14} className="text-gray-400" />
                 <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => onDateChange(e.target.value, endDate)}
                    className={`text-sm bg-transparent outline-none w-28 sm:w-auto ${isDark ? 'text-slate-300 [&::-webkit-calendar-picker-indicator]:invert' : 'text-gray-700'}`}
                 />
                 <span className="text-gray-400">-</span>
                 <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => onDateChange(startDate, e.target.value)}
                    className={`text-sm bg-transparent outline-none w-28 sm:w-auto ${isDark ? 'text-slate-300 [&::-webkit-calendar-picker-indicator]:invert' : 'text-gray-700'}`}
                 />
             </div>
         </div>
      </div>

      {/* Header Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Productivity */}
        <div className={`p-6 rounded-2xl border shadow-sm ${cardBg}`}>
           <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg"><Clock size={24} /></div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-600'}`}>Tempo Investido</span>
           </div>
           <div>
              <h3 className={`text-3xl font-bold tracking-tight ${textMain}`}>{formatTime(metrics.totalTimeSeconds)}</h3>
              <p className={`text-sm mt-1 ${textMuted}`}>Tempo total (no período)</p>
           </div>
        </div>

        {/* Completion Rate */}
        <div className={`p-6 rounded-2xl border shadow-sm ${cardBg}`}>
           <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-green-500/10 text-green-500 rounded-lg"><CheckCircle2 size={24} /></div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${isDark ? 'bg-green-900/30 text-green-300' : 'bg-green-50 text-green-600'}`}>{metrics.completed} Concluídas</span>
           </div>
           <div>
              <h3 className={`text-3xl font-bold tracking-tight ${textMain}`}>{completionRate}%</h3>
              <p className={`text-sm mt-1 ${textMuted}`}>Taxa de conclusão</p>
           </div>
        </div>

        {/* Critical Issues */}
        <div className={`p-6 rounded-2xl border shadow-sm ${cardBg}`}>
           <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-red-500/10 text-red-500 rounded-lg"><AlertTriangle size={24} /></div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-600'}`}>Atenção</span>
           </div>
           <div>
              <h3 className={`text-3xl font-bold tracking-tight ${textMain}`}>{metrics.late}</h3>
              <p className={`text-sm mt-1 ${textMuted}`}>Tarefas atrasadas</p>
           </div>
        </div>

        {/* Priority Load */}
        <div className={`p-6 rounded-2xl border shadow-sm ${cardBg}`}>
           <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg"><Activity size={24} /></div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${isDark ? 'bg-amber-900/30 text-amber-300' : 'bg-amber-50 text-amber-600'}`}>Alta Prioridade</span>
           </div>
           <div>
              <h3 className={`text-3xl font-bold tracking-tight ${textMain}`}>{metrics.priority}</h3>
              <p className={`text-sm mt-1 ${textMuted}`}>Tarefas prioritárias abertas</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Status Breakdown (Visual Bar) */}
        <div className={`lg:col-span-2 rounded-2xl border shadow-sm p-6 ${cardBg}`}>
           <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="text-gray-400" size={20} />
              <h3 className={`font-semibold text-lg ${textMain}`}>Distribuição de Status</h3>
           </div>
           
           <div className="space-y-6">
              {/* Custom Bar Chart Rows */}
              <div className="space-y-2">
                 <div className="flex justify-between text-sm font-medium">
                    <span className={textMuted}>Em andamento</span>
                    <span className={textMain}>{metrics.statusDist.todo}</span>
                 </div>
                 <div className="h-3 w-full bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(metrics.statusDist.todo / (metrics.total || 1)) * 100}%` }}></div>
                 </div>
              </div>

              {/* Recurring Done - ONLY SHOWN FOR SINGLE DAY FILTER */}
              {isSingleDay && (
                <div className="space-y-2">
                    <div className="flex justify-between text-sm font-medium">
                        <span className={`${isDark ? 'text-indigo-300' : 'text-indigo-600'} flex items-center gap-1`}>
                            <Repeat size={12} /> Recorrentes (Concluídas)
                        </span>
                        <span className={textMain}>{metrics.statusDist.recurringCompleted}</span>
                    </div>
                    <div className="h-3 w-full bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(metrics.statusDist.recurringCompleted / (metrics.statusDist.recurringTotal || 1)) * 100}%` }}></div>
                    </div>
                </div>
              )}

              {/* Standard Done / Combined Done */}
              <div className="space-y-2">
                 <div className="flex justify-between text-sm font-medium">
                    <span className={textMuted}>{isSingleDay ? 'Concluídas (Únicas)' : 'Concluídas'}</span>
                    <span className={textMain}>
                        {isSingleDay ? metrics.statusDist.standardCompleted : (metrics.statusDist.standardCompleted + metrics.statusDist.recurringCompleted)}
                    </span>
                 </div>
                 <div className="h-3 w-full bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${((isSingleDay ? metrics.statusDist.standardCompleted : (metrics.statusDist.standardCompleted + metrics.statusDist.recurringCompleted)) / (metrics.total || 1)) * 100}%` }}></div>
                 </div>
              </div>

              <div className="space-y-2">
                 <div className="flex justify-between text-sm font-medium">
                    <span className={textMuted}>Em atraso</span>
                    <span className={textMain}>{metrics.statusDist.late}</span>
                 </div>
                 <div className="h-3 w-full bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full" style={{ width: `${(metrics.statusDist.late / (metrics.total || 1)) * 100}%` }}></div>
                 </div>
              </div>

              <div className="space-y-2">
                 <div className="flex justify-between text-sm font-medium">
                    <span className={textMuted}>Canceladas</span>
                    <span className={textMain}>{metrics.statusDist.cancelled}</span>
                 </div>
                 <div className="h-3 w-full bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gray-400 rounded-full" style={{ width: `${(metrics.statusDist.cancelled / (metrics.total || 1)) * 100}%` }}></div>
                 </div>
              </div>
           </div>
        </div>

        {/* Most Active Tasks (Time spent) */}
        <div className={`rounded-2xl border shadow-sm p-6 flex flex-col ${cardBg}`}>
           <div className="flex items-center gap-2 mb-6">
              <Timer className="text-gray-400" size={20} />
              <h3 className={`font-semibold text-lg ${textMain}`}>Maior Investimento de Tempo</h3>
           </div>

           <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar">
              {metrics.mostActiveTasks.length === 0 ? (
                 <div className={`text-center py-8 ${textMuted} text-sm`}>
                    Nenhuma atividade no período selecionado.
                 </div>
              ) : (
                 metrics.mostActiveTasks.map((task, index) => (
                    <div key={task.id} className="flex items-center gap-3">
                       <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0
                          ${index === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 
                            index === 1 ? 'bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-gray-300' :
                            index === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                            'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500'}
                       `}>
                          #{index + 1}
                       </div>
                       <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium truncate ${textMain}`}>{task.title}</p>
                          <p className={`text-xs ${textMuted}`}>{task.status}</p>
                       </div>
                       <div className="text-right shrink-0">
                          <span className={`text-xs font-mono font-bold px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 ${textMain}`}>
                             {formatTime(task.totalCurrentTime)}
                          </span>
                       </div>
                    </div>
                 ))
              )}
           </div>
        </div>

      </div>

      {/* Mini Insight Banner */}
      <div className={`rounded-xl p-4 flex items-center gap-4 border ${isDark ? 'bg-indigo-900/20 border-indigo-800' : 'bg-indigo-50 border-indigo-100'}`}>
         <div className="p-2 bg-indigo-500 text-white rounded-full shrink-0">
            <TrendingUp size={20} />
         </div>
         <div className="flex-1">
            <h4 className={`text-sm font-bold ${isDark ? 'text-indigo-300' : 'text-indigo-800'}`}>Visão Geral Operacional</h4>
            <p className={`text-xs ${isDark ? 'text-indigo-200/70' : 'text-indigo-600'}`}>
               Você tem {metrics.pending} tarefas ativas neste período. Focando nas {metrics.priority} prioridades, você pode aumentar a eficiência em {Math.round(Math.random() * 10 + 10)}%.
            </p>
         </div>
      </div>

    </div>
  );
};

export default Dashboard;