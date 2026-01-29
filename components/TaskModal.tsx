import React, { useState, useEffect } from 'react';
import { Task, TaskStatus, Comment } from '../types';
import { formatDateFull, formatTime, getStatusColor, toInputDate, toInputTime, calculateCurrentTaskTime, getDayLabel } from '../utils';
import { X, Play, Pause, Send, Calendar, User, AlignLeft, Clock, Star, AlertTriangle, Check, X as XIcon, Pencil, Save, Repeat, PauseCircle, CheckSquare, Square } from 'lucide-react';

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

  // State for Comment Completion Confirmation (stores comment ID)
  const [pendingCommentCompletion, setPendingCommentCompletion] = useState<string | null>(null);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editRequester, setEditRequester] = useState('');
  
  // Recurring Edit State
  const [editIsRecurring, setEditIsRecurring] = useState(false);
  const [editRecurringDays, setEditRecurringDays] = useState<number[]>([]);
  const [editRecurringTime, setEditRecurringTime] = useState('');

  // Suspension State
  const [editIsSuspended, setEditIsSuspended] = useState(false);
  const [editSuspensionType, setEditSuspensionType] = useState<'indefinite' | 'until'>('indefinite');
  const [editSuspendedUntil, setEditSuspendedUntil] = useState('');

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
        setPendingCommentCompletion(null);
        setNewComment('');
        setIsEditing(false);
     }
  }, [isOpen, task?.id]);

  // Sync edit state with task data
  useEffect(() => {
    if (task) {
        setEditTitle(task.title);
        setEditDescription(task.description || '');
        setEditRequester(task.requester || '');
        
        setEditIsRecurring(!!task.isRecurring);
        setEditRecurringDays(task.recurringDays || []);
        setEditRecurringTime(task.recurringTime || '');

        setEditIsSuspended(!!task.isSuspended);
        if (task.suspendedUntil) {
            setEditSuspensionType('until');
            setEditSuspendedUntil(toInputDate(task.suspendedUntil));
        } else {
            setEditSuspensionType('indefinite');
            setEditSuspendedUntil('');
        }
    }
  }, [task]); 
  
  const startEditing = () => {
     if (task) {
        setEditTitle(task.title);
        setEditDescription(task.description || '');
        setEditRequester(task.requester || '');
        
        setEditIsRecurring(!!task.isRecurring);
        setEditRecurringDays(task.recurringDays || []);
        setEditRecurringTime(task.recurringTime || '');

        setEditIsSuspended(!!task.isSuspended);
        if (task.suspendedUntil) {
            setEditSuspensionType('until');
            setEditSuspendedUntil(toInputDate(task.suspendedUntil));
        } else {
            setEditSuspensionType('indefinite');
            setEditSuspendedUntil('');
        }

        setIsEditing(true);
     }
  };

  const cancelEditing = () => {
      setIsEditing(false);
  };

  const saveEditing = () => {
      if (!task) return;

      // Logic to resolve suspension date
      let finalSuspendedUntil: Date | null = null;
      if (editIsSuspended && editSuspensionType === 'until' && editSuspendedUntil) {
         const [y, m, d] = editSuspendedUntil.split('-').map(Number);
         finalSuspendedUntil = new Date(y, m - 1, d);
      }

      onUpdate({
          ...task,
          title: editTitle,
          description: editDescription,
          requester: editRequester,
          isRecurring: editIsRecurring,
          recurringDays: editIsRecurring ? editRecurringDays : [],
          recurringTime: editIsRecurring ? editRecurringTime : '',
          
          isSuspended: editIsRecurring ? editIsSuspended : false,
          suspendedUntil: (editIsRecurring && editIsSuspended) ? finalSuspendedUntil : null
      });
      setIsEditing(false);
  };

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
    setPendingCommentCompletion(null);
    setIsEditing(false);
    onClose();
  };

  // 1. Initial Click: Set pending status if confirmation is needed
  const initiateStatusChange = (newStatus: TaskStatus) => {
    if (!task) return;

    // If changing TO Completed or Cancelled, require confirmation
    if (newStatus === TaskStatus.COMPLETED || newStatus === TaskStatus.CANCELLED) {
        setPendingStatus(newStatus);
    } else {
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

    // LOGIC CHANGE: If completing a task with NO deadline, set deadline to NOW.
    // This moves it out of "No Deadline" list into the dated list.
    if (newStatus === TaskStatus.COMPLETED && !task.deadline) {
        updates.deadline = new Date();
    }

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

  const toggleRecurringDay = (dayIndex: number) => {
    if (editRecurringDays.includes(dayIndex)) {
      setEditRecurringDays(editRecurringDays.filter(d => d !== dayIndex));
    } else {
      setEditRecurringDays([...editRecurringDays, dayIndex]);
    }
  };

  const handleAddComment = () => {
    if (!task || !newComment.trim()) return;
    const comment: Comment = {
      id: Date.now().toString(),
      text: newComment,
      createdAt: new Date(),
      isCompleted: false
    };
    onUpdate({
      ...task,
      comments: [...task.comments, comment],
    });
    setNewComment('');
  };

  // --- Comment Checkbox Logic ---

  const initiateCommentToggle = (commentId: string) => {
    if (!task) return;
    const comment = task.comments.find(c => c.id === commentId);
    if (!comment) return;

    if (comment.isCompleted) {
        // Unchecking is usually safe to do without confirmation (or less risky), 
        // but if we want consistency, we could confirm both. 
        // For better UX, checking "Done" requires confirmation to prevent accidental closure.
        // Unchecking "Done" is usually an intentional "Oops" fix, so we can make it instant.
        updateCommentStatus(commentId, false);
    } else {
        // Requires confirmation to Mark as Done
        setPendingCommentCompletion(commentId);
    }
  };

  const confirmCommentCompletion = () => {
      if (pendingCommentCompletion) {
          updateCommentStatus(pendingCommentCompletion, true);
          setPendingCommentCompletion(null);
      }
  };

  const updateCommentStatus = (commentId: string, status: boolean) => {
      if (!task) return;
      const updatedComments = task.comments.map(c => 
          c.id === commentId ? { ...c, isCompleted: status } : c
      );
      onUpdate({ ...task, comments: updatedComments });
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
             {!isEditing && (
                 <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusColor(task.status, isDark, task.deadline)}`}>
                    {task.status}
                 </div>
             )}
             
             <button 
               onClick={togglePriority}
               disabled={isLocked || !!pendingStatus || isEditing}
               className={`flex items-center gap-1 text-xs font-bold border px-2 py-0.5 rounded-full transition-colors
                 ${(isLocked || !!pendingStatus || isEditing) ? 'opacity-50 cursor-not-allowed' : ''}
                 ${task.isPriority 
                   ? 'text-amber-500 border-amber-500 bg-amber-50 dark:bg-amber-900/20' 
                   : 'text-gray-400 border-gray-300 dark:border-slate-600 hover:border-amber-400 hover:text-amber-500'
                 }`}
             >
                <Star size={12} fill={task.isPriority ? "currentColor" : "none"} />
                {task.isPriority ? 'Prioridade' : 'Marcar Prioridade'}
             </button>
          </div>
          <div className="flex items-center gap-2">
             {!isEditing ? (
                 <button 
                    onClick={startEditing}
                    disabled={isLocked}
                    className={`p-2 rounded-full transition-colors ${isLocked ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400'}`}
                    title="Editar Tarefa"
                 >
                    <Pencil size={18} />
                 </button>
             ) : (
                 <div className="flex items-center gap-2 mr-2">
                     <button 
                        onClick={cancelEditing}
                        className="p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors"
                        title="Cancelar Edição"
                     >
                        <XIcon size={18} />
                     </button>
                     <button 
                        onClick={saveEditing}
                        className="p-2 rounded-full bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-600 dark:text-green-400 transition-colors"
                        title="Salvar Alterações"
                     >
                        <Save size={18} />
                     </button>
                 </div>
             )}
             <button onClick={handleClose} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                <X size={20} />
             </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 relative">
          
          {/* Title Section */}
          <div>
            {isEditing ? (
                <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Título</label>
                    <input 
                        type="text" 
                        value={editTitle} 
                        onChange={(e) => setEditTitle(e.target.value)}
                        className={`w-full text-xl font-bold p-2 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none ${inputClasses}`}
                    />
                </div>
            ) : (
                <div className="flex items-center gap-3">
                    <h2 className={`text-2xl font-bold leading-tight ${task.status === TaskStatus.COMPLETED ? 'line-through text-gray-400' : ''}`}>
                        {task.title}
                    </h2>
                    {task.isSuspended && (
                        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${isDark ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>
                            <PauseCircle size={14} />
                            <span>Suspensa {task.suspendedUntil ? `até ${new Date(task.suspendedUntil).toLocaleDateString()}` : 'Indefinidamente'}</span>
                        </div>
                    )}
                </div>
            )}
          </div>

          {/* Meta Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {/* Deadline */}
             <div className="flex items-start gap-3">
               <Calendar className="text-blue-500 mt-0.5" size={20} />
               <div className="flex-1">
                 <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Prazo</p>
                 <div className="flex items-center gap-2">
                   <input
                      type="date"
                      disabled={isLocked || !!pendingStatus || isEditing} 
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
             
             {/* Requester */}
             <div className="flex items-start gap-3">
               <User className="text-purple-500 mt-0.5" size={20} />
               <div className="flex-1">
                 <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Solicitante</p>
                 {isEditing ? (
                     <input 
                        type="text" 
                        value={editRequester}
                        onChange={(e) => setEditRequester(e.target.value)}
                        className={`w-full mt-1 p-1.5 text-sm rounded border focus:ring-2 focus:ring-blue-500 outline-none ${inputClasses}`}
                        placeholder="Nome do solicitante"
                     />
                 ) : (
                    <p className="text-sm">{task.requester || 'Não informado'}</p>
                 )}
               </div>
             </div>
          </div>
          
          {/* Recurring Settings (Visible if Recurring OR Editing) */}
          {(task.isRecurring || isEditing) && (
              <div className={`p-4 rounded-xl border transition-all ${isDark ? 'bg-indigo-900/20 border-indigo-500/30' : 'bg-indigo-50 border-indigo-100'}`}>
                 <div className="flex items-center justify-between mb-3">
                     <div className="flex items-center gap-2">
                        <Repeat size={16} className="text-indigo-500" />
                        <span className="font-semibold text-sm text-indigo-600 dark:text-indigo-400">Configuração de Recorrência</span>
                     </div>
                     {isEditing && (
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={editIsRecurring} onChange={(e) => setEditIsRecurring(e.target.checked)} className="sr-only peer" />
                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-500"></div>
                        </label>
                     )}
                 </div>

                 {(!isEditing && task.isRecurring) && (
                     <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap gap-2 items-center">
                            <div className="flex gap-1">
                                {task.recurringDays?.sort().map(d => (
                                    <span key={d} className={`text-xs w-5 h-5 flex items-center justify-center rounded bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200 font-bold`}>
                                        {getDayLabel(d)}
                                    </span>
                                ))}
                            </div>
                            {task.recurringTime && (
                                <div className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 rounded ml-2">
                                    <Clock size={12} /> {task.recurringTime}
                                </div>
                            )}
                        </div>
                     </div>
                 )}

                 {(isEditing && editIsRecurring) && (
                     <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        {/* Days & Time */}
                        <div className="space-y-3">
                            <div>
                                <p className="text-xs text-gray-500 mb-2">Dias da semana:</p>
                                <div className="flex gap-1">
                                    {[0,1,2,3,4,5,6].map((day) => (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => toggleRecurringDay(day)}
                                        className={`w-7 h-7 rounded-full text-xs font-bold transition-all
                                        ${editRecurringDays.includes(day) 
                                            ? 'bg-indigo-500 text-white shadow-md' 
                                            : 'bg-white text-gray-500 border border-gray-200 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-400'}
                                        `}
                                    >
                                        {getDayLabel(day)}
                                    </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock size={14} className="text-gray-400" />
                                <input
                                    type="time"
                                    value={editRecurringTime}
                                    onChange={(e) => setEditRecurringTime(e.target.value)}
                                    className={`text-sm p-1 rounded border focus:ring-2 focus:ring-indigo-500 outline-none ${inputClasses} [color-scheme:${isDark ? 'dark' : 'light'}]`}
                                />
                            </div>
                        </div>

                        {/* Suspension Controls */}
                        <div className={`border-t pt-3 ${isDark ? 'border-slate-700' : 'border-indigo-100'}`}>
                           <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                                    <PauseCircle size={16} />
                                    <span>Suspender Recorrência</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={editIsSuspended} onChange={(e) => setEditIsSuspended(e.target.checked)} className="sr-only peer" />
                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-amber-500"></div>
                                </label>
                           </div>

                           {editIsSuspended && (
                               <div className="bg-amber-50 dark:bg-amber-900/10 p-3 rounded-lg space-y-2 animate-in slide-in-from-top-1">
                                  <div className="flex items-center gap-4 text-sm">
                                     <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                          type="radio" 
                                          name="suspension" 
                                          checked={editSuspensionType === 'indefinite'} 
                                          onChange={() => setEditSuspensionType('indefinite')}
                                          className="text-amber-500 focus:ring-amber-500"
                                        />
                                        <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>Indeterminado</span>
                                     </label>
                                     <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                          type="radio" 
                                          name="suspension" 
                                          checked={editSuspensionType === 'until'} 
                                          onChange={() => setEditSuspensionType('until')}
                                          className="text-amber-500 focus:ring-amber-500"
                                        />
                                        <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>Até uma data</span>
                                     </label>
                                  </div>
                                  
                                  {editSuspensionType === 'until' && (
                                      <div className="flex items-center gap-2 mt-2">
                                          <span className="text-xs text-gray-500">Voltar em:</span>
                                          <input 
                                            type="date"
                                            value={editSuspendedUntil}
                                            onChange={(e) => setEditSuspendedUntil(e.target.value)}
                                            className={`text-sm p-1 rounded border focus:ring-2 focus:ring-amber-500 outline-none ${inputClasses} [color-scheme:${isDark ? 'dark' : 'light'}]`}
                                          />
                                      </div>
                                  )}
                               </div>
                           )}
                        </div>
                     </div>
                 )}
              </div>
          )}

          {/* Description */}
          <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-gray-50'}`}>
             <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400">
               <AlignLeft size={18} />
               <span className="text-sm font-medium">Observações</span>
             </div>
             {isEditing ? (
                 <textarea 
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={4}
                    className={`w-full p-2 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none resize-none ${inputClasses}`}
                    placeholder="Adicione detalhes..."
                 />
             ) : (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {task.description || 'Nenhuma observação adicionada.'}
                </p>
             )}
          </div>

          {/* Timer Section - Hide in edit mode */}
          {!isEditing && (
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
          )}

          {/* Comments Section */}
          {!isEditing && (
            <div>
                <h3 className="text-lg font-semibold mb-3">Comentários</h3>
                <div className="space-y-3 mb-4">
                {task.comments.length === 0 && (
                    <p className="text-sm text-gray-400 italic">Sem comentários ainda.</p>
                )}
                {task.comments.map((comment) => (
                    <div 
                        key={comment.id} 
                        className={`p-3 rounded-lg text-sm flex gap-3
                            ${isDark ? 'bg-slate-800' : 'bg-gray-100'}
                            ${comment.isCompleted ? 'opacity-50' : ''}
                        `}
                    >
                        {/* Checkbox / Confirmation Area */}
                        <div className="flex-shrink-0 pt-0.5">
                            {pendingCommentCompletion === comment.id ? (
                                <div className="flex flex-col gap-1 items-center animate-in zoom-in duration-200">
                                    <button 
                                        onClick={confirmCommentCompletion}
                                        className="p-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                                        title="Confirmar"
                                    >
                                        <Check size={14} />
                                    </button>
                                    <button 
                                        onClick={() => setPendingCommentCompletion(null)}
                                        className="p-1 bg-red-400 text-white rounded hover:bg-red-500 transition-colors"
                                        title="Cancelar"
                                    >
                                        <XIcon size={14} />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => !isLocked && initiateCommentToggle(comment.id)}
                                    disabled={isLocked}
                                    className={`transition-colors ${comment.isCompleted ? 'text-green-500' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    {comment.isCompleted ? <CheckSquare size={20} /> : <Square size={20} />}
                                </button>
                            )}
                        </div>

                        {/* Text Content */}
                        <div className="flex-1 min-w-0">
                            <p className={`whitespace-pre-wrap ${comment.isCompleted ? 'line-through text-gray-500' : ''}`}>
                                {comment.text}
                            </p>
                            <div className="flex justify-between items-center mt-1">
                                {pendingCommentCompletion === comment.id && (
                                    <span className="text-xs text-orange-500 font-bold animate-pulse">Confirmar conclusão?</span>
                                )}
                                <p className="text-xs text-gray-500 ml-auto">
                                    {new Date(comment.createdAt).toLocaleString('pt-BR')}
                                </p>
                            </div>
                        </div>
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
          )}
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
           ) : isEditing ? (
             // EDITING ACTIONS
             <div className="flex justify-end gap-3">
                 <button 
                    onClick={cancelEditing}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                 >
                    Cancelar Edição
                 </button>
                 <button 
                    onClick={saveEditing}
                    className="px-6 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-500/20 flex items-center gap-2"
                 >
                    <Save size={16} /> Salvar Alterações
                 </button>
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