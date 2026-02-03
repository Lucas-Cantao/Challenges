import React, { useState, useEffect } from 'react';
import { Task, TaskStatus } from '../types';
import { getStatusColor, isDueSoon, isDueToday, getDaysOverdue, calculateCurrentTaskTime, formatTime, formatTimeShort, isPastDeadline } from '../utils';
import { AlertCircle, Clock, CheckCircle2, XCircle, Calendar, Star, CalendarPlus, MessageSquare, GitMerge } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onClick: (task: Task) => void;
  onTogglePriority?: (task: Task, e: React.MouseEvent) => void;
  isPriorityColumn?: boolean;
  subtaskCount?: number;
  isDark: boolean;
  style?: React.CSSProperties;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  draggable?: boolean;
}

const TaskCard: React.FC<TaskCardProps> = ({ 
  task, 
  onClick, 
  onTogglePriority,
  isPriorityColumn = false,
  subtaskCount = 0,
  isDark,
  style,
  onDragStart,
  onDragOver,
  onDrop,
  draggable
}) => {
  const isSoon = task.deadline ? isDueSoon(task.deadline) : false;
  const isToday = task.deadline ? isDueToday(task.deadline) : false;
  // Precise check: If deadline is passed, it is overdue
  const isLate = task.deadline ? isPastDeadline(task.deadline) : false;
  const daysOverdue = task.deadline ? getDaysOverdue(task.deadline) : 0;
  
  // Get Last Comment
  const lastComment = task.comments && task.comments.length > 0 
    ? task.comments[task.comments.length - 1] 
    : null;
  
  // Timer state for running tasks
  const [runningTime, setRunningTime] = useState<number | null>(null);

  useEffect(() => {
    let interval: number;

    if (task.timerStartedAt) {
      // Update immediately
      setRunningTime(calculateCurrentTaskTime(task));
      
      // Update every second
      interval = window.setInterval(() => {
        setRunningTime(calculateCurrentTaskTime(task));
      }, 1000);
    } else {
      setRunningTime(null);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [task.timerStartedAt, task.elapsedTimeSeconds]);

  // Visual cues logic
  let borderColor = isDark ? 'border-navy-800' : 'border-white';
  let bgColor = isDark ? 'bg-navy-800' : 'bg-white';
  let contentOpacity = '';
  let titleDecoration = '';
  let contentFilter = '';

  // Specific styles based on Status
  if (task.status === TaskStatus.COMPLETED) {
    borderColor = 'border-green-500';
    contentOpacity = 'opacity-75';
    titleDecoration = 'line-through text-gray-400 dark:text-gray-500';
  } else if (task.status === TaskStatus.CANCELLED) {
    borderColor = 'border-gray-500';
    contentOpacity = 'opacity-60';
    contentFilter = 'grayscale';
    titleDecoration = 'text-gray-400 dark:text-gray-500';
  } else if (task.status === TaskStatus.LATE) {
    borderColor = 'border-red-600';
  } else if (task.status === TaskStatus.TODO) {
    // Deadline logic only for TODO
    if (isLate) {
      borderColor = 'border-red-600';
    } else if (isToday) {
      borderColor = 'border-orange-500';
    } else if (isSoon) {
      borderColor = 'border-yellow-400';
    }
  }

  const StatusIcon = () => {
    switch (task.status) {
      case TaskStatus.COMPLETED: return <CheckCircle2 size={16} />;
      case TaskStatus.LATE: return <AlertCircle size={16} />;
      case TaskStatus.CANCELLED: return <XCircle size={16} />;
      default: return <Clock size={16} />;
    }
  };

  const getStatusText = () => {
    if (task.status === TaskStatus.TODO && isLate) {
        // If overdue by 0 days (meaning just hours/minutes), show "Atrasado" or "Vencido hoje"
        if (daysOverdue <= 1 && isToday) return "Atrasado";
        return `Vencido há ${daysOverdue} dia${daysOverdue > 1 ? 's' : ''}`;
    }
    return task.status;
  };

  return (
    <div
      onClick={() => onClick(task)}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={style}
      className={`
        relative group cursor-pointer rounded-xl border-l-4 p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:scale-[1.01]
        ${borderColor}
        ${bgColor}
        ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}
        ${contentOpacity}
        ${contentFilter}
      `}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0 pr-8">
          <h4 className={`font-semibold truncate pr-2 ${titleDecoration ? titleDecoration : (isDark ? 'text-gray-100' : 'text-gray-800')}`}>
            {task.title}
          </h4>
          
          {!isPriorityColumn && (
             <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
               {task.deadline ? (
                 <span className={`flex items-center gap-1 
                    ${isToday && !isLate && task.status === TaskStatus.TODO ? 'text-orange-500 font-bold' : ''}
                    ${isLate ? 'text-red-500 font-bold' : ''}
                    ${isSoon && !isLate && task.status === TaskStatus.TODO ? 'text-yellow-600 font-bold' : ''}
                 `}>
                   <Calendar size={12} />
                   <span>
                        {task.deadline.toLocaleDateString('pt-BR')} 
                        <span className="opacity-70 ml-1 font-mono">
                            {formatTimeShort(task.deadline)}
                        </span>
                   </span>
                 </span>
               ) : (
                 <span className="flex items-center gap-1 text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded font-medium">
                    <CalendarPlus size={12} />
                    Definir Prazo
                 </span>
               )}

               {task.requester && (
                 <span className="truncate max-w-[100px] bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                   Por: {task.requester}
                 </span>
               )}
             </div>
          )}
        </div>

        {/* Priority Toggle Button */}
        <button
          onClick={(e) => onTogglePriority && onTogglePriority(task, e)}
          className={`absolute top-4 right-4 p-1 rounded-full transition-colors z-10 
            ${task.isPriority 
              ? 'text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/30' 
              : 'text-gray-300 hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-slate-700'
            }`}
          title={task.isPriority ? "Remover prioridade" : "Adicionar prioridade"}
        >
          <Star size={18} fill={task.isPriority ? "currentColor" : "none"} />
        </button>

      </div>

      {/* Last Comment Snippet */}
      {lastComment && (
        <div className="mt-3 flex items-start gap-1.5 text-xs text-gray-500 dark:text-gray-400 opacity-90 overflow-hidden">
            <MessageSquare size={12} className="mt-0.5 shrink-0" />
            <span className="truncate italic">"{lastComment.text}"</span>
        </div>
      )}
      
      <div className="mt-3 flex items-center justify-between">
         <div className="flex items-center gap-2">
            <div className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(task.status, isDark, task.deadline)}`}>
                <StatusIcon />
                <span className={`${isPriorityColumn ? 'hidden lg:inline' : ''}`}>{getStatusText()}</span>
            </div>
            
            {/* Subtask Indicator */}
            {subtaskCount > 0 && (
                <div className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 border ${isDark ? 'border-slate-700 text-slate-400' : 'border-gray-200 text-gray-500'}`}>
                    <GitMerge size={12} className="rotate-90" />
                    <span>{subtaskCount}</span>
                </div>
            )}
         </div>

         {/* Active Timer Indicator */}
         {runningTime !== null && (
           <div className="flex items-center gap-1.5 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded-md text-red-600 dark:text-red-400 animate-pulse">
              <Clock size={12} className="animate-spin-slow" />
              <span className="font-mono text-xs font-bold">{formatTime(runningTime)}</span>
           </div>
         )}
      </div>
    </div>
  );
};

export default TaskCard;