import React, { useState, useEffect, useMemo } from 'react';
import { Moon, Sun, Plus, LayoutDashboard, CheckSquare, GripVertical, ChevronDown, ChevronRight, Filter, Calendar as CalendarIcon, CalendarOff, Repeat, List, WifiOff, AlertTriangle, LogOut } from 'lucide-react';
import { Task, TaskStatus, DayGroup, WeekGroup, Theme, Comment } from './types';
import { formatDateFull, getWeekBounds, toInputDate } from './utils';
import TaskCard from './components/TaskCard';
import TaskModal from './components/TaskModal';
import CreateTaskModal from './components/CreateTaskModal';
import RecurringTasksModal from './components/RecurringTasksModal';
import Dashboard from './components/Dashboard';
import Login from './components/Login';

// Firebase Realtime Database & Auth Imports
import { ref, onValue, push, set, update, database, auth, onAuthStateChanged, signOut, query, orderByChild, equalTo } from './firebase';

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [theme, setTheme] = useState<Theme>('light');
  const [viewMode, setViewMode] = useState<'list' | 'dashboard'>('list'); 
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  
  // Auth State
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Loading & Error States
  const [isLoading, setIsLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Date Filter State
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  // Initialize Date Filter
  useEffect(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 3);
    const end = new Date(today);
    end.setDate(today.getDate() + 3);

    setFilterStartDate(toInputDate(start));
    setFilterEndDate(toInputDate(end));
  }, []);

  // --- Authentication Listener ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- Realtime Database Synchronization ---

  useEffect(() => {
    if (!user) {
        setTasks([]);
        return;
    }

    setIsLoading(true);

    // Using query to fetch only tasks for the current user
    // Note: This requires .indexOn: ["userID"] in Firebase Rules for optimal performance
    const tasksRef = query(ref(database, 'tasks'), orderByChild('userID'), equalTo(user.uid));
    
    const safetyTimeout = setTimeout(() => {
        if (isLoading) {
            setIsLoading(false);
            // Don't show error immediately on empty state, but if it persists
        }
    }, 5000);

    const unsubscribe = onValue(tasksRef, (snapshot) => {
      clearTimeout(safetyTimeout);
      setConnectionError(null);

      const data = snapshot.val();
      
      if (data) {
        const loadedTasks: Task[] = Object.entries(data).map(([key, value]: [string, any]) => {
          return {
            ...value,
            id: key, 
            createdAt: value.createdAt ? new Date(value.createdAt) : new Date(),
            deadline: value.deadline ? new Date(value.deadline) : null,
            completedAt: value.completedAt ? new Date(value.completedAt) : undefined,
            timerStartedAt: value.timerStartedAt ? new Date(value.timerStartedAt) : null,
            lastRecurringCompletion: value.lastRecurringCompletion ? new Date(value.lastRecurringCompletion) : null,
            comments: (value.comments || []).map((c: any) => ({
                ...c,
                createdAt: c.createdAt ? new Date(c.createdAt) : new Date()
            })),
            elapsedTimeSeconds: value.elapsedTimeSeconds || 0,
            isPriority: !!value.isPriority,
            status: value.status || TaskStatus.TODO,
            title: value.title || 'Sem título'
          } as Task;
        });
        setTasks(loadedTasks);
      } else {
        setTasks([]);
      }
      
      setIsLoading(false);
    }, (error) => {
      clearTimeout(safetyTimeout);
      console.error("Database read failed: ", error);
      setConnectionError("Erro ao carregar tarefas. Verifique sua conexão.");
      setIsLoading(false);
    });

    return () => {
        unsubscribe(); 
        clearTimeout(safetyTimeout);
    };
  }, [user]); // Re-run when user changes

  // Toggle Theme
  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // --- CRUD Operations (Realtime Database) ---

  const handleCreateTask = async (newTaskData: Omit<Task, 'id' | 'createdAt' | 'comments' | 'elapsedTimeSeconds' | 'userID'>) => {
    if (!user) return;
    
    try {
        const tasksRef = ref(database, 'tasks');
        const newTaskRef = push(tasksRef);
        
        const taskToSave = {
          ...newTaskData,
          id: newTaskRef.key,
          userID: user.uid, // Assign Current User ID (Updated to userID)
          createdAt: new Date().toISOString(),
          deadline: newTaskData.deadline ? newTaskData.deadline.toISOString() : null,
          description: newTaskData.description || "",
          requester: newTaskData.requester || "",
          comments: [],
          elapsedTimeSeconds: 0,
          priorityOrder: tasks.length,
          lastRecurringCompletion: null,
          timerStartedAt: null,
          completedAt: null,
          isRecurring: !!newTaskData.isRecurring,
          recurringDays: newTaskData.recurringDays || [],
          recurringTime: newTaskData.recurringTime || ""
        };

        await set(newTaskRef, taskToSave);
    } catch (err: any) {
        alert("Erro ao criar tarefa: " + err.message);
    }
  };

  const handleUpdateTask = async (updatedTask: Task) => {
    if (selectedTask && selectedTask.id === updatedTask.id) {
        setSelectedTask(updatedTask);
    }
    
    try {
        const taskRef = ref(database, `tasks/${updatedTask.id}`);
        // ... (rest of update logic remains the same, fields are just serialized)
        const existingTask = tasks.find(t => t.id === updatedTask.id);
        let completedAt = existingTask?.completedAt;
        
        if (existingTask) {
            const wasCompleted = existingTask.status === TaskStatus.COMPLETED;
            const isCompleted = updatedTask.status === TaskStatus.COMPLETED;
            if (isCompleted && !wasCompleted) completedAt = new Date();
            else if (!isCompleted && wasCompleted) completedAt = undefined;
        }

        const dataToUpdate = {
            ...updatedTask,
            // Ensure basic fields are kept
            userID: updatedTask.userID, // Keep owner (Updated to userID)
            title: updatedTask.title,
            description: updatedTask.description || "",
            status: updatedTask.status,
            isPriority: updatedTask.isPriority,
            requester: updatedTask.requester || "",
            completedAt: completedAt ? completedAt.toISOString() : null,
            deadline: updatedTask.deadline ? updatedTask.deadline.toISOString() : null,
            createdAt: updatedTask.createdAt.toISOString(),
            timerStartedAt: updatedTask.timerStartedAt ? updatedTask.timerStartedAt.toISOString() : null,
            elapsedTimeSeconds: updatedTask.elapsedTimeSeconds,
            isRecurring: !!updatedTask.isRecurring,
            recurringDays: updatedTask.recurringDays || [],
            recurringTime: updatedTask.recurringTime || "",
            lastRecurringCompletion: updatedTask.lastRecurringCompletion ? updatedTask.lastRecurringCompletion.toISOString() : null,
            comments: updatedTask.comments.map(c => ({
                ...c,
                createdAt: c.createdAt.toISOString()
            }))
        };

        await update(taskRef, dataToUpdate);
    } catch (err) {
        console.error("Update failed", err);
    }
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  const handleTogglePriority = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    handleUpdateTask({ ...task, isPriority: !task.isPriority });
  };

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault();
    if (!draggedTaskId || draggedTaskId === targetTaskId) return;

    const items = [...tasks];
    const draggedItem = items.find(i => i.id === draggedTaskId);
    const targetItem = items.find(i => i.id === targetTaskId);

    if (draggedItem && targetItem) {
      const priorityList = items.filter(t => t.isPriority).sort((a, b) => (a.priorityOrder || 0) - (b.priorityOrder || 0));
      const draggedIndex = priorityList.findIndex(t => t.id === draggedTaskId);
      const targetIndex = priorityList.findIndex(t => t.id === targetTaskId);
      
      const newPriorityList = [...priorityList];
      const [removed] = newPriorityList.splice(draggedIndex, 1);
      newPriorityList.splice(targetIndex, 0, removed);

      const updates: { [key: string]: any } = {};
      newPriorityList.forEach((t, index) => {
          updates[`tasks/${t.id}/priorityOrder`] = index;
      });

      try {
        await update(ref(database), updates);
      } catch (err) {
        console.error("Batch update failed", err);
      }
    }
    setDraggedTaskId(null);
  };

  // --- Grouping Logic ---

  const { start: weekStart, end: weekEnd } = useMemo(() => getWeekBounds(new Date()), []);

  const organizedTasks = useMemo(() => {
    const nonPriorityTasks = tasks.filter(t => !t.isPriority);
    
    // Manual parsing
    let fStart: Date | null = null;
    if (filterStartDate) {
        const [y, m, d] = filterStartDate.split('-').map(Number);
        fStart = new Date(y, m - 1, d, 0, 0, 0, 0);
    }
    
    let fEnd: Date | null = null;
    if (filterEndDate) {
        const [y, m, d] = filterEndDate.split('-').map(Number);
        fEnd = new Date(y, m - 1, d, 23, 59, 59, 999);
    }

    const filteredList = nonPriorityTasks.filter(task => {
        if (!task.deadline) return false; 
        if (!fStart || !fEnd) return true;
        
        const d = new Date(task.deadline);
        return d >= fStart && d <= fEnd; 
    });
    
    const pastWeeks: WeekGroup[] = [];
    const currentWeek: DayGroup[] = [];
    const futureWeeks: WeekGroup[] = [];
    
    const currentWeekMap = new Map<string, Task[]>();
    const pastWeekMap = new Map<string, Task[]>();
    const futureWeekMap = new Map<string, Task[]>();
    
    const sortedTasks = [...filteredList].sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return b.deadline.getTime() - a.deadline.getTime();
    });

    sortedTasks.forEach(task => {
      if (!task.deadline) return;

      const d = new Date(task.deadline);
      d.setHours(0,0,0,0);
      const ws = new Date(weekStart); ws.setHours(0,0,0,0);
      const we = new Date(weekEnd); we.setHours(23,59,59,999);

      if (d < ws) {
        const { start } = getWeekBounds(d);
        const key = start.toISOString();
        if (!pastWeekMap.has(key)) pastWeekMap.set(key, []);
        pastWeekMap.get(key)?.push(task);
      } else if (d > we) {
        const { start } = getWeekBounds(d);
        const key = start.toISOString();
        if (!futureWeekMap.has(key)) futureWeekMap.set(key, []);
        futureWeekMap.get(key)?.push(task);
      } else {
        const dateKey = d.toISOString();
        if (!currentWeekMap.has(dateKey)) currentWeekMap.set(dateKey, []);
        currentWeekMap.get(dateKey)?.push(task);
      }
    });

    const currentDates = Array.from(currentWeekMap.keys()).map(d => new Date(d));
    currentDates.sort((a, b) => b.getTime() - a.getTime());
    currentDates.forEach(date => {
        currentWeek.push({
            date,
            tasks: currentWeekMap.get(date.toISOString()) || []
        });
    });

    const futureStarts = Array.from(futureWeekMap.keys()).map(d => new Date(d));
    futureStarts.sort((a, b) => b.getTime() - a.getTime());
    futureStarts.forEach(start => {
        const { end } = getWeekBounds(start);
        futureWeeks.push({
            startDate: start,
            endDate: end,
            tasks: futureWeekMap.get(start.toISOString()) || [],
            label: `Semana de ${start.toLocaleDateString('pt-BR')} até ${end.toLocaleDateString('pt-BR')}`
        });
    });

    const pastStarts = Array.from(pastWeekMap.keys()).map(d => new Date(d));
    pastStarts.sort((a, b) => b.getTime() - a.getTime());
    pastStarts.forEach(start => {
        const { end } = getWeekBounds(start);
        pastWeeks.push({
            startDate: start,
            endDate: end,
            tasks: pastWeekMap.get(start.toISOString()) || [],
            label: `Semana de ${start.toLocaleDateString('pt-BR')} até ${end.toLocaleDateString('pt-BR')}`
        });
    });

    return { pastWeeks, currentWeek, futureWeeks };
  }, [tasks, weekStart, weekEnd, filterStartDate, filterEndDate]);

  const priorityTasks = useMemo(() => {
    return tasks
      .filter(t => t.isPriority)
      .sort((a, b) => (a.priorityOrder || 0) - (b.priorityOrder || 0));
  }, [tasks]);

  const noDeadlineTasks = useMemo(() => {
    return tasks.filter(t => !t.deadline && !t.isPriority && !t.isRecurring);
  }, [tasks]);

  const toggleWeekExpand = (key: string) => {
    const newSet = new Set(expandedWeeks);
    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);
    setExpandedWeeks(newSet);
  };

  const isDark = theme === 'dark';

  if (authLoading) {
     return (
        <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-babyblue-50'}`}>
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
     );
  }

  // If not logged in, show Login Screen
  if (!user) {
     return <Login isDark={isDark} />;
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-babyblue-50 text-slate-800'}`}>
      
      {/* Header */}
      <header className={`sticky top-0 z-40 backdrop-blur-md border-b px-6 py-4 flex flex-col md:flex-row gap-4 md:items-center justify-between transition-colors ${isDark ? 'bg-slate-900/80 border-slate-700' : 'bg-white/80 border-babyblue-100'}`}>
        <div className="flex items-center justify-between md:justify-start gap-4">
            <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
                <CheckSquare className="text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Challenges</h1>
            </div>

            {/* User Info (Mobile: Right side) */}
            <div className="md:hidden flex items-center gap-2">
               <button 
                    onClick={toggleTheme}
                    className={`p-2 rounded-full transition-colors ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-yellow-400' : 'bg-white hover:bg-gray-100 text-slate-600 border border-gray-200'}`}
                >
                    {isDark ? <Sun size={20} /> : <Moon size={20} />}
                </button>
            </div>
        </div>
        
        <div className="flex items-center justify-end gap-2 sm:gap-4">
          
          <div className={`flex items-center p-1 rounded-full border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
             <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-full transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-600'}`}
                title="Lista de Tarefas"
             >
                <List size={18} />
             </button>
             <button
                onClick={() => setViewMode('dashboard')}
                className={`p-1.5 rounded-full transition-all ${viewMode === 'dashboard' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-600'}`}
                title="Dashboard Operacional"
             >
                <LayoutDashboard size={18} />
             </button>
          </div>

          <button 
             onClick={() => setIsRecurringModalOpen(true)}
             className={`p-2 rounded-full transition-colors ${isDark ? 'bg-indigo-900/40 text-indigo-400 hover:bg-indigo-900/60' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'} border border-transparent`}
             title="Tarefas Recorrentes"
          >
             <Repeat size={20} />
          </button>

          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full font-medium transition-transform active:scale-95 shadow-lg shadow-blue-500/20"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Nova Tarefa</span>
          </button>
          
          <button 
            onClick={toggleTheme}
            className={`hidden md:block p-2 rounded-full transition-colors ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-yellow-400' : 'bg-white hover:bg-gray-100 text-slate-600 border border-gray-200'}`}
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <button 
            onClick={() => signOut(auth)}
            className={`ml-2 p-2 rounded-full transition-colors border ${isDark ? 'bg-slate-800 hover:bg-red-900/30 text-gray-400 hover:text-red-400 border-slate-700' : 'bg-white hover:bg-red-50 text-gray-500 hover:text-red-500 border-gray-200'}`}
            title="Sair"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Error Banner */}
      {connectionError && (
          <div className="bg-red-500 text-white px-4 py-2 text-center text-sm font-semibold flex items-center justify-center gap-2 animate-in slide-in-from-top">
              <AlertTriangle size={16} />
              {connectionError}
          </div>
      )}

      {/* Main Content */}
      {viewMode === 'dashboard' ? (
        <main className="p-4 lg:p-8 max-w-[1600px] mx-auto">
           <Dashboard 
             tasks={tasks} 
             isDark={isDark}
             startDate={filterStartDate}
             endDate={filterEndDate}
             onDateChange={(start, end) => {
                 setFilterStartDate(start);
                 setFilterEndDate(end);
             }}
           />
        </main>
      ) : (
        <main className="p-4 lg:p-8 max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Calendar/Task List */}
          <div className="lg:col-span-8 space-y-8">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-gray-200 dark:border-slate-700">
               <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 uppercase text-xs font-bold tracking-wider">
                  <LayoutDashboard size={14} />
                  <span>Cronograma de Atividades</span>
               </div>

               <div className="relative z-30 flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700">
                  <Filter size={14} className="text-gray-400" />
                  <div className="flex items-center gap-2">
                     <input 
                        type="date" 
                        value={filterStartDate}
                        onChange={(e) => setFilterStartDate(e.target.value)}
                        style={{ colorScheme: isDark ? 'dark' : 'light' }}
                        className={`text-sm font-medium bg-transparent outline-none cursor-pointer ${isDark ? 'text-gray-300 [&::-webkit-calendar-picker-indicator]:invert' : 'text-gray-600'}`}
                     />
                     <span className="text-gray-400">-</span>
                     <input 
                        type="date" 
                        value={filterEndDate}
                        onChange={(e) => setFilterEndDate(e.target.value)}
                        style={{ colorScheme: isDark ? 'dark' : 'light' }}
                        className={`text-sm font-medium bg-transparent outline-none cursor-pointer ${isDark ? 'text-gray-300 [&::-webkit-calendar-picker-indicator]:invert' : 'text-gray-600'}`}
                     />
                  </div>
               </div>
            </div>
            
            {/* Loading Indicator for Tasks */}
            {isLoading && (
                <div className="py-12 flex flex-col items-center justify-center opacity-50 animate-pulse">
                     <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                     <p className="text-sm">Sincronizando tarefas...</p>
                </div>
            )}

            {!isLoading && (
                <>
                {organizedTasks.futureWeeks.map(week => {
                const key = week.startDate.toISOString();
                const isExpanded = expandedWeeks.has(key);
                return (
                    <div key={key} className={`rounded-xl border overflow-hidden transition-all ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-blue-100 bg-white'}`}>
                    <button 
                        onClick={() => toggleWeekExpand(key)}
                        className="w-full flex items-center justify-between p-4 hover:bg-black/5 transition-colors text-left"
                    >
                        <span className="font-semibold text-sm text-gray-500">{week.label}</span>
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    {isExpanded && (
                        <div className="p-4 space-y-3 bg-black/5 dark:bg-black/20">
                        {week.tasks.map(task => (
                            <TaskCard 
                            key={task.id} 
                            task={task} 
                            onClick={handleTaskClick} 
                            onTogglePriority={handleTogglePriority}
                            isDark={isDark} 
                            />
                        ))}
                        </div>
                    )}
                    </div>
                );
                })}

                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                {organizedTasks.currentWeek.length === 0 && organizedTasks.futureWeeks.length === 0 && organizedTasks.pastWeeks.length === 0 && (
                    <div className="text-center py-10 opacity-50 flex flex-col items-center gap-2">
                    <CalendarIcon size={48} className="text-gray-300 dark:text-gray-700" />
                    <p>Nenhuma tarefa encontrada.</p>
                    <p className="text-xs text-gray-400">Comece criando uma nova tarefa!</p>
                    </div>
                )}
                
                {organizedTasks.currentWeek.map(dayGroup => (
                    <div key={dayGroup.date.toISOString()} className="relative pl-4 sm:pl-0">
                        <div className="sticky top-20 z-10 mb-4 inline-block">
                        <div className={`px-4 py-1.5 rounded-full text-sm font-semibold shadow-sm backdrop-blur-md border 
                            ${isDark ? 'bg-slate-800/90 border-slate-600 text-blue-300' : 'bg-white/90 border-blue-100 text-blue-700'}`}>
                            {formatDateFull(dayGroup.date)}
                        </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {dayGroup.tasks.map(task => (
                            <TaskCard 
                            key={task.id} 
                            task={task} 
                            onClick={handleTaskClick} 
                            onTogglePriority={handleTogglePriority}
                            isDark={isDark} 
                            />
                        ))}
                        </div>
                        
                        <div className={`absolute left-0 top-10 bottom-0 w-0.5 ${isDark ? 'bg-slate-800' : 'bg-blue-100'} -z-10 hidden sm:block`} style={{ left: '20px' }}></div>
                    </div>
                ))}
                </div>

                {organizedTasks.pastWeeks.map(week => {
                const key = week.startDate.toISOString();
                const isExpanded = expandedWeeks.has(key);
                return (
                    <div key={key} className={`rounded-xl border overflow-hidden transition-all ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-blue-100 bg-white'}`}>
                    <button 
                        onClick={() => toggleWeekExpand(key)}
                        className="w-full flex items-center justify-between p-4 hover:bg-black/5 transition-colors text-left"
                    >
                        <div className="flex items-center gap-2">
                            <CalendarOff size={16} className="text-red-400" />
                            <span className="font-semibold text-sm text-gray-500">{week.label}</span>
                        </div>
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    {isExpanded && (
                        <div className="p-4 space-y-3 bg-black/5 dark:bg-black/20">
                        {week.tasks.map(task => (
                            <TaskCard 
                            key={task.id} 
                            task={task} 
                            onClick={handleTaskClick} 
                            onTogglePriority={handleTogglePriority}
                            isDark={isDark} 
                            />
                        ))}
                        </div>
                    )}
                    </div>
                );
                })}
                </>
            )}

          </div>

          <div className="lg:col-span-4 space-y-8">
             
             <div className={`rounded-2xl border p-4 sm:p-6 ${isDark ? 'bg-slate-900 border-amber-900/30' : 'bg-white border-amber-100 shadow-sm'}`}>
                <div className="flex items-center gap-2 mb-4 text-amber-500">
                   <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/20">
                     <CheckSquare size={18} />
                   </div>
                   <h2 className="font-bold text-lg">Prioridade Alta</h2>
                </div>

                <div 
                   className="space-y-3 min-h-[100px]"
                   onDragOver={handleDragOver}
                >
                   {priorityTasks.length === 0 && (
                      <p className="text-sm text-gray-400 italic text-center py-4 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl">
                        {isLoading ? '...' : 'Nenhuma prioridade definida.'}
                      </p>
                   )}
                   {priorityTasks.map(task => (
                      <TaskCard 
                        key={task.id} 
                        task={task} 
                        onClick={handleTaskClick} 
                        onTogglePriority={handleTogglePriority}
                        isPriorityColumn={true}
                        isDark={isDark} 
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onDrop={(e) => handleDrop(e, task.id)}
                        style={{ cursor: 'grab' }}
                      />
                   ))}
                </div>
             </div>

             <div className={`rounded-2xl border p-4 sm:p-6 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200 shadow-sm'}`}>
                <div className="flex items-center gap-2 mb-4 text-gray-500">
                   <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-slate-800">
                     <List size={18} />
                   </div>
                   <h2 className="font-bold text-lg">Backlog / Sem Data</h2>
                </div>
                
                <div className="space-y-3">
                   {noDeadlineTasks.length === 0 && (
                      <p className="text-sm text-gray-400 italic text-center">{isLoading ? '...' : 'Tudo organizado!'}</p>
                   )}
                   {noDeadlineTasks.slice(0, 5).map(task => (
                      <TaskCard 
                        key={task.id} 
                        task={task} 
                        onClick={handleTaskClick} 
                        onTogglePriority={handleTogglePriority}
                        isDark={isDark} 
                      />
                   ))}
                   {noDeadlineTasks.length > 5 && (
                      <p className="text-xs text-center text-gray-400 mt-2">
                        + {noDeadlineTasks.length - 5} outras tarefas
                      </p>
                   )}
                </div>
             </div>

          </div>
        </main>
      )}

      <CreateTaskModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateTask}
        isDark={isDark}
      />

      <TaskModal 
        task={selectedTask}
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onUpdate={handleUpdateTask}
        isDark={isDark}
      />

      <RecurringTasksModal
         isOpen={isRecurringModalOpen}
         onClose={() => setIsRecurringModalOpen(false)}
         tasks={tasks}
         onUpdate={handleUpdateTask}
         isDark={isDark}
         onEditTask={(task) => {
             setIsRecurringModalOpen(false);
             handleTaskClick(task);
         }}
      />

    </div>
  );
};

export default App;