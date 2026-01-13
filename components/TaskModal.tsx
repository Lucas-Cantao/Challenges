import React, { useState, useEffect } from 'react';
import { Task, TaskStatus, Comment } from '../types';
import { formatDateFull, formatTime, getStatusColor, toInputDate, toInputTime, calculateCurrentTaskTime } from '../utils';
import { X, Play, Pause, Send, Calendar, User, AlignLeft, Clock, Star, AlertTriangle, Check, X as XIcon } from 'lucide-react';

interface TaskModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedTask: Task) => void;
  isDark: boolean;
}

const TaskModal: React.FC<TaskModalProps> = ({ task, isOpen, onClose, onUpdate, isDark }) => {
  const [displayTime, setDisplayTime] = useState(0);
  const [newComment, setNewComment] = useState('');
  
  // State for inline confirmation
  const [pendingStatus, setPendingStatus] = useState<TaskStatus | null>(null);

  // Timer Synchronization
  useEffect(() => {
    let interval: number;

    if (task) {
        setDisplayTime(calculateCurrentTaskTime(task));

        if (task.timerStartedAt) {
          interval = window.setInterval(() => {
            setDisplayTime(calculateCurrentTaskTime(task));
          }, 1000);
        }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [task, task?.timerStartedAt, task?.elapsedTimeSeconds]); 

  // Reset local state when task changes or closes
  useEffect(() => {
     if (!isOpen) {
        setPendingStatus(null);
        setNewComment('');
     }
  }, [isOpen, task?.id]);

  const toggleTimer = () => {
    if (!task) return;

    if (task.timerStartedAt) {
      // PAUSE
      const currentTotal = calculateCurrentTaskTime(task);
      onUpdate({
        ...task,
        elapsedTimeSeconds: currentTotal,
        timerStartedAt: null
      });
    } else {
      // START
      onUpdate({
        ...task,
        timerStartedAt: new Date()
      });
    }
  };

  const handleClose = () => {
    setPendingStatus(null);
    onClose();
  };

  // 1. Initial Click: Set pending status if confirmation is needed
  const initiateStatusChange = (newStatus: TaskStatus) => {
    if (!task) return;

    // If changing TO Completed or Cancelled, require confirmation
    if (newStatus === TaskStatus.COMPLETED || newStatus === TaskStatus.CANCELLED) {
        setPendingStatus(newStatus);
    } else {
        // Moving back to TODO (if allowed in logic) doesn't strictly need confirmation, 
        // but current logic blocks edits once locked anyway. 
        // If we were to allow unlocking, we'd do it here immediately.
        executeStatusUpdate(newStatus);
    }
  };

  // 2. Final Execution
  const executeStatusUpdate = (newStatus: TaskStatus) => {
    if (!task) return;

    const shouldRemovePriority = newStatus === TaskStatus.COMPLETED || newStatus === TaskStatus.CANCELLED;
    const updatedPriority = shouldRemovePriority ? false : task.isPriority;
    
    let updates: Partial<Task> = {
      status: newStatus,
      isPriority: updatedPriority,
    };

    // Auto-stop timer
    if ((newStatus === TaskStatus.COMPLETED || newStatus === TaskStatus.CANCELLED) && task.timerStartedAt) {
       const currentTotal = calculateCurrentTaskTime(task);
       updates.elapsedTimeSeconds = currentTotal;
       updates.timerStartedAt = null;
    }

    onUpdate({ 
        ...task, 
        ...updates
    });
    setPendingStatus(null);
  };

  const cancelStatusChange = () => {
    setPendingStatus(null);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!task) return;
    const val = e.target.value;
    if (!val) {
      onUpdate({ ...task, deadline: null });
      return;
    }
    const [y, m, d] = val.split('-').map(Number);
    
    const currentDeadline = task.deadline ? new Date(task.deadline) : new Date();
    const hours = task.deadline ? currentDeadline.getHours() : 23;
    const minutes = task.deadline ? currentDeadline.getMinutes() : 59;
    const seconds = task.deadline ? currentDeadline.getSeconds() : 59;

    const newDate = new Date(y, m - 1, d, hours, minutes, seconds);
    onUpdate({ ...task, deadline: newDate });
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!task || !task.deadline) return;
      const val = e.target.value;
      if (!val) return; 

      const [h, m] = val.split('-')[0].split(':').map(Number);
      
      const newDate = new Date(task.deadline);
      newDate.setHours(h, m, 0);
      onUpdate({ ...task, deadline: newDate });
  };

  const togglePriority = () => {
    if (task) {
      onUpdate({ ...task, isPriority: !task.isPriority });
    }
  };

  const handleAddComment = () => {
    if (!task || !newComment.trim()) return;
    const comment: Comment = {
      id: Date.now().toString(),
      text: newComment,
      createdAt: new Date(),
    };
    onUpdate({
      ...task,
      comments: [...task.comments, comment],
    });
    setNewComment('');
  };

  if (!isOpen || !task) return null;

  const baseClasses = isDark ? 'bg-slate-900 text-gray-100' : 'bg-white text-gray-800';
  const inputClasses = isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900';
  
  const isLocked = task.status === TaskStatus.COMPLETED || task.status === TaskStatus.CANCELLED;
  const isRunning = !!task.timerStartedAt;
  const selectableStatuses = [TaskStatus.TODO, TaskStatus.COMPLETED, TaskStatus.CANCELLED];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className={`w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${baseClasses}`}>
        
        {/* Header */}
        <div className={`px-6 py-4 border-b flex justify-between items-center ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
          <div className="flex items-center gap-3">
             <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusColor(task.status, isDark, task.deadline)}`}>
               {task.status}
             </div>
             
             <button 
               onClick={togglePriority}
               disabled={isLocked || !!pendingStatus}
               className={`flex items-center gap-1 text-xs font-bold border px-2 py-0.5 rounded-full transition-colors
                 ${(isLocked || !!pendingStatus) ? 'opacity-50 cursor-not-allowed' : ''}
                 ${task.isPriority 
                   ? 'text-amber-500 border-amber-500 bg-amber-50 dark:bg-amber-900/20' 
                   : 'text-gray-400 border-gray-300 dark:border-slate-600 hover:border-amber-400 hover:text-amber-500'
                 }`}
             >
                <Star size={12} fill={task.isPriority ? "currentColor" : "none"} />
                {task.isPriority ? 'Prioridade' : 'Marcar Prioridade'}
             </button>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 relative">
          
          {/* Title */}
          <div>
            <h2 className={`text-2xl font-bold leading-tight ${task.status === TaskStatus.COMPLETED ? 'line-through text-gray-400' : ''}`}>
                {task.title}
            </h2>
          </div>

          {/* Meta Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="flex items-start gap-3">
               <Calendar className="text-blue-500 mt-0.5" size={20} />
               <div className="flex-1">
                 <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Prazo</p>
                 <div className="flex items-center gap-2">
                   <input
                      type="date"
                      disabled={isLocked || !!pendingStatus}
                      value={task.deadline ? toInputDate(task.deadline) : ''}
                      onChange={handleDateChange}
                      className={`text-sm font-semibold bg-transparent outline-none py-1 w-32
                         ${(isLocked || !!pendingStatus) ? 'cursor-not-allowed text-gray-500' : isDark ? 'text-gray-200 hover:bg-white/5' : 'text-gray-800 hover:bg-black/5'}
                         rounded transition-colors
                         ${isDark ? '[&::-webkit-calendar-picker-indicator]:invert' : ''}
                      `}
                   />
                   {task.deadline && (
                       <input 
                         type="time"
                         disabled={isLocked || !!pendingStatus}
                         value={toInputTime(task.deadline)}
                         onChange={handleTimeChange}
                         className={`text-sm font-semibold bg-transparent outline-none py-1 w-20
                            ${(isLocked || !!pendingStatus) ? 'cursor-not-allowed text-gray-500' : isDark ? 'text-gray-200 hover:bg-white/5' : 'text-gray-800 hover:bg-black/5'}
                            rounded transition-colors [color-scheme:${isDark ? 'dark' : 'light'}]
                         `}
                       />
                   )}
                 </div>
                 {!task.deadline && !isLocked && !pendingStatus && (
                    <p className="text-xs text-orange-500 font-medium">Clique para definir data</p>
                 )}
               </div>
             </div>
             <div className="flex items-start gap-3">
               <User className="text-purple-500 mt-0.5" size={20} />
               <div>
                 <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Solicitante</p>
                 <p className="text-sm">{task.requester || 'Não informado'}</p>
               </div>
             </div>
          </div>

          {/* Description */}
          <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-gray-50'}`}>
             <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400">
               <AlignLeft size={18} />
               <span className="text-sm font-medium">Observações</span>
             </div>
             <p className="text-sm leading-relaxed whitespace-pre-wrap">
               {task.description || 'Nenhuma observação adicionada.'}
             </p>
          </div>

          {/* Timer Section */}
          <div className={`p-6 rounded-xl flex flex-col items-center justify-center gap-4 border transition-all
             ${isRunning 
                ? (isDark ? 'bg-red-900/10 border-red-900/50' : 'bg-red-50 border-red-100') 
                : (isDark ? 'bg-navy-800 border-slate-700' : 'bg-blue-50 border-blue-100')
             }
          `}>
             <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Clock size={20} className={isRunning ? 'text-red-500 animate-pulse' : ''} />
                <span className="text-sm font-medium">{isRunning ? 'Cronômetro Rodando' : 'Tempo de Execução'}</span>
             </div>
             <div className={`text-5xl font-mono font-bold tracking-widest ${isRunning ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'}`}>
                {formatTime(displayTime)}
             </div>
             <button
               onClick={toggleTimer}
               disabled={isLocked || !!pendingStatus}
               className={`flex items-center gap-2 px-6 py-2 rounded-full font-medium transition-all duration-300 shadow-md active:scale-95
                 ${(isLocked || !!pendingStatus) ? 'opacity-50 cursor-not-allowed bg-gray-200 text-gray-500 dark:bg-slate-700 dark:text-gray-400' : 
                   isRunning 
                     ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/20' 
                     : 'bg-green-500 text-white hover:bg-green-600 shadow-green-500/20'
                 }`}
             >
               {isRunning ? <><Pause size={18} fill="currentColor" /> Pausar</> : <><Play size={18} fill="currentColor" /> Iniciar</>}
             </button>
          </div>

          {/* Comments Section */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Comentários</h3>
            <div className="space-y-3 mb-4">
              {task.comments.length === 0 && (
                <p className="text-sm text-gray-400 italic">Sem comentários ainda.</p>
              )}
              {task.comments.map((comment) => (
                <div key={comment.id} className={`p-3 rounded-lg text-sm ${isDark ? 'bg-slate-800' : 'bg-gray-100'}`}>
                  <p>{comment.text}</p>
                  <p className="text-xs text-gray-500 mt-1 text-right">{new Date(comment.createdAt).toLocaleString('pt-BR')}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                disabled={isLocked || !!pendingStatus}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={(isLocked || !!pendingStatus) ? "Tarefa bloqueada" : "Adicionar comentário..."}
                className={`flex-1 px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputClasses} ${(isLocked || !!pendingStatus) ? 'opacity-50 cursor-not-allowed' : ''}`}
                onKeyDown={(e) => e.key === 'Enter' && (!isLocked && !pendingStatus) && handleAddComment()}
              />
              <button 
                onClick={handleAddComment}
                disabled={isLocked || !!pendingStatus}
                className={`p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ${(isLocked || !!pendingStatus) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions - Dynamic Content based on confirmation state */}
        <div className={`px-6 py-4 border-t ${isDark ? 'border-slate-700 bg-slate-900' : 'border-gray-100 bg-gray-50'}`}>
           {pendingStatus ? (
             // CONFIRMATION STATE UI
             <div className="flex items-center justify-between animate-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-amber-100 text-amber-600 rounded-full dark:bg-amber-900/30 dark:text-amber-400">
                      <AlertTriangle size={20} />
                   </div>
                   <div>
                      <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                         Confirma a alteração para "{pendingStatus}"?
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                         A tarefa será bloqueada.
                      </p>
                   </div>
                </div>
                <div className="flex gap-2">
                   <button
                     onClick={cancelStatusChange}
                     className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors
                        ${isDark ? 'border-slate-600 text-gray-300 hover:bg-slate-800' : 'border-gray-300 text-gray-600 hover:bg-gray-100'}
                     `}
                   >
                     Cancelar
                   </button>
                   <button
                     onClick={() => executeStatusUpdate(pendingStatus)}
                     className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 shadow-md flex items-center gap-1"
                   >
                     <Check size={16} /> Confirmar
                   </button>
                </div>
             </div>
           ) : (
             // DEFAULT BUTTONS
             <div className="flex flex-wrap gap-2 justify-end">
                {selectableStatuses.map((status) => {
                  const isCurrentStatus = task.status === status;
                  const isDisabled = isCurrentStatus || isLocked;

                  return (
                    <button
                      key={status}
                      onClick={() => initiateStatusChange(status)}
                      disabled={isDisabled}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors border shadow-sm
                          ${isDisabled
                            ? 'opacity-50 cursor-not-allowed border-transparent bg-gray-200 dark:bg-slate-800 text-gray-500' 
                            : `hover:opacity-80 border-gray-200 dark:border-slate-600 active:scale-95 ${isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-white hover:bg-gray-50'}`
                          }
                      `}
                    >
                      {status}
                    </button>
                  );
                })}
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default TaskModal;