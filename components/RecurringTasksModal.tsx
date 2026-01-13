import React from 'react';
import { Task } from '../types';
import { isSameDay, getDayLabel, formatDateFull } from '../utils';
import { X, Repeat, Check, Calendar, Clock } from 'lucide-react';

interface RecurringTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  onUpdate: (updatedTask: Task) => void;
  isDark: boolean;
}

const RecurringTasksModal: React.FC<RecurringTasksModalProps> = ({ isOpen, onClose, tasks, onUpdate, isDark }) => {
  if (!isOpen) return null;

  const today = new Date();
  const dayIndex = today.getDay();

  // Filter tasks that are recurring AND enabled for today (or have been completed today)
  const todaysRecurringTasks = tasks.filter(t => {
     if (!t.isRecurring || !t.recurringDays) return false;
     // Show if it's scheduled for today
     if (t.recurringDays.includes(dayIndex)) return true;
     return false;
  });

  const toggleDailyCompletion = (task: Task) => {
    const isCompletedToday = task.lastRecurringCompletion && isSameDay(new Date(task.lastRecurringCompletion), today);
    
    onUpdate({
      ...task,
      lastRecurringCompletion: isCompletedToday ? null : new Date() // Toggle logic
    });
  };

  const completedCount = todaysRecurringTasks.filter(t => 
    t.lastRecurringCompletion && isSameDay(new Date(t.lastRecurringCompletion), today)
  ).length;

  const baseClasses = isDark ? 'bg-slate-900 text-gray-100' : 'bg-white text-gray-800';
  const itemClasses = isDark ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200';

  const isLate = (timeStr?: string) => {
      if (!timeStr) return false;
      const [h, m] = timeStr.split(':').map(Number);
      const now = new Date();
      // Only late if current time > specified time TODAY
      if (now.getHours() > h) return true;
      if (now.getHours() === h && now.getMinutes() > m) return true;
      return false;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className={`w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] ${baseClasses}`}>
        
        {/* Header */}
        <div className={`px-6 py-5 border-b flex justify-between items-start ${isDark ? 'border-slate-700 bg-indigo-950/20' : 'border-indigo-100 bg-indigo-50/50'}`}>
          <div>
             <div className="flex items-center gap-2 mb-1">
                <div className="bg-indigo-500 p-1.5 rounded-lg text-white">
                    <Repeat size={18} />
                </div>
                <h2 className="text-xl font-bold text-indigo-600 dark:text-indigo-400">Rotinas Diárias</h2>
             </div>
             <p className="text-sm opacity-70 flex items-center gap-1">
               <Calendar size={12} /> {formatDateFull(today)}
             </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 pt-4 pb-0">
           <div className="flex justify-between text-xs font-semibold mb-1 opacity-70">
              <span>Progresso de hoje</span>
              <span>{Math.round((completedCount / (todaysRecurringTasks.length || 1)) * 100)}%</span>
           </div>
           <div className={`h-2 w-full rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`}>
              <div 
                className="h-full bg-indigo-500 transition-all duration-500 ease-out"
                style={{ width: `${(completedCount / (todaysRecurringTasks.length || 1)) * 100}%` }}
              ></div>
           </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
           {todaysRecurringTasks.length === 0 ? (
             <div className="text-center py-10 opacity-50">
               <div className="mb-2 flex justify-center"><Repeat size={40} className="text-gray-300 dark:text-gray-600" /></div>
               <p className="text-sm font-medium">Nenhuma tarefa recorrente para hoje.</p>
               <p className="text-xs">Aproveite o dia livre!</p>
             </div>
           ) : (
             todaysRecurringTasks.map(task => {
                const isDone = task.lastRecurringCompletion && isSameDay(new Date(task.lastRecurringCompletion), today);
                const late = !isDone && isLate(task.recurringTime);
                
                return (
                  <div 
                    key={task.id} 
                    onClick={() => toggleDailyCompletion(task)}
                    className={`group flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all active:scale-[0.98]
                      ${itemClasses}
                      ${isDone 
                        ? 'opacity-60 grayscale-[0.5]' 
                        : late 
                            ? (isDark ? 'border-red-900 bg-red-900/10' : 'border-red-200 bg-red-50')
                            : 'hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md'
                      }
                    `}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors
                         ${isDone 
                           ? 'bg-indigo-500 border-indigo-500 text-white' 
                           : late
                                ? 'border-red-400 text-red-400'
                                : 'border-gray-300 dark:border-gray-500 group-hover:border-indigo-400'}
                      `}>
                         {isDone && <Check size={14} strokeWidth={3} />}
                      </div>
                      <div>
                        <h4 className={`font-medium ${isDone ? 'line-through opacity-70' : ''}`}>{task.title}</h4>
                        <div className="flex flex-wrap gap-2 mt-1 items-center">
                          {/* Recurring Days Badges */}
                          <div className="flex gap-1">
                            {task.recurringDays?.map(d => (
                                <span key={d} className={`text-[10px] w-4 h-4 flex items-center justify-center rounded-sm 
                                    ${d === dayIndex 
                                    ? 'bg-indigo-100 text-indigo-700 font-bold dark:bg-indigo-900 dark:text-indigo-300' 
                                    : 'text-gray-400 bg-gray-100 dark:bg-slate-700 dark:text-gray-500'}
                                `}>
                                {getDayLabel(d)}
                                </span>
                            ))}
                          </div>
                          
                          {/* Time Badge */}
                          {task.recurringTime && (
                              <div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-mono
                                  ${late 
                                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 font-bold' 
                                    : 'bg-gray-100 text-gray-500 dark:bg-slate-700'
                                  }
                              `}>
                                  <Clock size={10} />
                                  {task.recurringTime}
                              </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
             })
           )}
        </div>
      </div>
    </div>
  );
};

export default RecurringTasksModal;