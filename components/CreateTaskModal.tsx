import React, { useState } from 'react';
import { Task, TaskStatus } from '../types';
import { getDayLabel } from '../utils';
import { X, Calendar, Flag, User, FileText, Repeat, Clock } from 'lucide-react';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (task: Omit<Task, 'id' | 'createdAt' | 'comments' | 'elapsedTimeSeconds' | 'userID'>) => void;
  isDark: boolean;
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ isOpen, onClose, onCreate, isDark }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');
  const [requester, setRequester] = useState('');
  const [isPriority, setIsPriority] = useState(false);
  const [hasDeadline, setHasDeadline] = useState(true);
  
  // Recurring state
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [recurringTime, setRecurringTime] = useState('');

  const toggleDay = (dayIndex: number) => {
    if (selectedDays.includes(dayIndex)) {
      setSelectedDays(selectedDays.filter(d => d !== dayIndex));
    } else {
      setSelectedDays([...selectedDays, dayIndex]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let finalDeadline: Date | null = null;
    
    // Construct Date object if deadline is active and not recurring
    if (hasDeadline && deadlineDate && !isRecurring) {
      const [year, month, day] = deadlineDate.split('-').map(Number);
      
      if (deadlineTime) {
          const [hours, minutes] = deadlineTime.split(':').map(Number);
          finalDeadline = new Date(year, month - 1, day, hours, minutes);
      } else {
          // Default to end of day if no time specified? Or noon? 
          // Better to default to 23:59 if no time set for deadlines
          // But here, if we leave it blank, let's say 23:59:59
          finalDeadline = new Date(year, month - 1, day, 23, 59, 59);
      }
    }

    onCreate({
      title,
      description,
      deadline: finalDeadline,
      requester,
      isPriority,
      status: TaskStatus.TODO,
      isRecurring,
      recurringDays: isRecurring ? selectedDays : [],
      recurringTime: isRecurring ? recurringTime : undefined,
      lastRecurringCompletion: null,
      timerStartedAt: null // Initialize timer state
    });
    
    // Reset form
    setTitle('');
    setDescription('');
    setDeadlineDate('');
    setDeadlineTime('');
    setRequester('');
    setIsPriority(false);
    setIsRecurring(false);
    setSelectedDays([]);
    setRecurringTime('');
    setHasDeadline(true);
    onClose();
  };

  if (!isOpen) return null;

  const baseClasses = isDark ? 'bg-slate-900 text-gray-100' : 'bg-white text-gray-800';
  const inputClasses = isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900';
  const labelClasses = 'block text-sm font-medium mb-1 text-gray-500 dark:text-gray-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className={`w-full max-w-lg rounded-2xl shadow-2xl ${baseClasses} max-h-[90vh] overflow-y-auto`}>
        <div className={`px-6 py-4 border-b flex justify-between items-center ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
          <h2 className="text-xl font-bold">Nova Tarefa</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelClasses}>Título da Tarefa</label>
            <input
              required
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none transition-all ${inputClasses}`}
              placeholder="Ex: Atualizar relatório de vendas"
            />
          </div>

          {/* Deadline Field - Own Line */}
          <div className={isRecurring ? 'opacity-50 pointer-events-none' : ''}>
            <label className={labelClasses}>Prazo</label>
            <div className="flex items-center gap-2 mb-2">
                <input 
                  type="checkbox" 
                  checked={hasDeadline} 
                  onChange={(e) => setHasDeadline(e.target.checked)}
                  disabled={isRecurring}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-500">Definir data</span>
            </div>
            <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    disabled={!hasDeadline || isRecurring}
                    type="date"
                    value={deadlineDate}
                    onChange={(e) => setDeadlineDate(e.target.value)}
                    className={`w-full px-2 py-2.5 text-xs sm:text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 ${inputClasses}`}
                  />
                </div>
                <div className="relative w-32">
                  <input
                    disabled={!hasDeadline || isRecurring}
                    type="time"
                    value={deadlineTime}
                    onChange={(e) => setDeadlineTime(e.target.value)}
                    className={`w-full px-2 py-2.5 text-xs sm:text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 ${inputClasses} [color-scheme:${isDark ? 'dark' : 'light'}]`}
                  />
                </div>
            </div>
          </div>

          {/* Requester Field - Own Line */}
          <div>
            <label className={labelClasses}>Solicitante (Opcional)</label>
            <div className="relative">
              <input
                type="text"
                value={requester}
                onChange={(e) => setRequester(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none ${inputClasses}`}
                placeholder="Nome"
              />
              <User className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" size={20} />
            </div>
          </div>

          {/* Recurring Section */}
          <div className={`p-4 rounded-xl border transition-all ${isRecurring ? (isDark ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-indigo-50 border-indigo-200') : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200')}`}>
             <div className="flex items-center justify-between mb-3">
               <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-md ${isRecurring ? 'bg-indigo-500 text-white' : 'bg-gray-300 text-gray-500 dark:bg-slate-600'}`}>
                    <Repeat size={16} />
                  </div>
                  <span className={`font-medium text-sm ${isRecurring ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500'}`}>Tarefa Recorrente</span>
               </div>
               <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="sr-only peer" />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-500"></div>
                </label>
             </div>
             
             {isRecurring && (
               <div className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-3">
                 <div>
                    <p className="text-xs text-gray-500 mb-2">Selecione os dias da semana:</p>
                    <div className="flex justify-between gap-1">
                        {[0,1,2,3,4,5,6].map((day) => (
                        <button
                            key={day}
                            type="button"
                            onClick={() => toggleDay(day)}
                            className={`w-8 h-8 rounded-full text-xs font-bold transition-all
                            ${selectedDays.includes(day) 
                                ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30 scale-105' 
                                : 'bg-white text-gray-500 border border-gray-200 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-400 hover:border-indigo-300'}
                            `}
                        >
                            {getDayLabel(day)}
                        </button>
                        ))}
                    </div>
                    {selectedDays.length === 0 && <p className="text-xs text-red-400 mt-2">* Selecione pelo menos um dia</p>}
                 </div>

                 {/* Recurring Time Input */}
                 <div className="pt-2 border-t border-indigo-100 dark:border-indigo-500/30">
                     <label className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        <Clock size={12} />
                        Horário limite (Opcional)
                     </label>
                     <input
                      type="time"
                      value={recurringTime}
                      onChange={(e) => setRecurringTime(e.target.value)}
                      className={`w-32 px-2 py-1.5 text-sm rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none ${inputClasses} [color-scheme:${isDark ? 'dark' : 'light'}]`}
                    />
                 </div>
               </div>
             )}
          </div>

          <div>
             <label className={labelClasses}>Observações</label>
             <div className="relative">
               <textarea
                 rows={3}
                 value={description}
                 onChange={(e) => setDescription(e.target.value)}
                 className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none resize-none ${inputClasses}`}
                 placeholder="Detalhes adicionais..."
               />
               <FileText className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" size={20} />
             </div>
          </div>

          <div className={`flex items-center gap-3 p-3 rounded-lg border ${isPriority ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800' : isDark ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
            <div className={`p-2 rounded-full ${isPriority ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-500 dark:bg-slate-700'}`}>
              <Flag size={20} />
            </div>
            <div className="flex-1">
              <p className={`font-medium ${isPriority ? 'text-amber-700 dark:text-amber-400' : ''}`}>Marcar como Prioridade</p>
              <p className="text-xs text-gray-500">Tarefas prioritárias aparecem na caixa de destaque.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={isPriority} onChange={(e) => setIsPriority(e.target.checked)} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-amber-500"></div>
            </label>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isRecurring && selectedDays.length === 0}
              className="px-6 py-2.5 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Criar Tarefa
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTaskModal;