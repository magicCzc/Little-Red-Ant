import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Loader2, ChevronUp, ChevronDown, CheckCircle2, XCircle, Clock, Activity } from 'lucide-react';
import { useSafeAsync } from '../hooks/useSafeAsync';
import { Link } from 'react-router-dom';

interface Task {
    id: string;
    type: string;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    payload: any;
    created_at: string;
    updated_at: string;
}

export default function TaskMonitor() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);
    const { isMounted } = useSafeAsync();
    const pollInterval = useRef<NodeJS.Timeout | null>(null);
    const tasksRef = useRef<Task[]>([]); // Ref to access latest state in timeouts

    useEffect(() => {
        tasksRef.current = tasks;
    }, [tasks]);

    useEffect(() => {
        fetchActiveTasks();
        startPolling();
        return () => stopPolling();
    }, []);

    const startPolling = () => {
        stopPolling();
        pollInterval.current = setInterval(fetchActiveTasks, 3000);
    };

    const stopPolling = () => {
        if (pollInterval.current) {
            clearInterval(pollInterval.current);
            pollInterval.current = null;
        }
    };

    const fetchActiveTasks = async () => {
        try {
            // Using a specific instance to avoid global interceptors for background polling
            // This prevents auto-logout or error toasts if background polling fails (e.g. 401/409)
            const res = await axios.get('/api/tasks/active', {
                skipAuthRefresh: true // Custom config if we had an interceptor logic for it
            } as any);

            if (!isMounted.current) return;
            
            const newActiveTasks: Task[] = res.data;
            const newActiveIds = new Set(newActiveTasks.map(t => t.id));
            
            setTasks(prevTasks => {
                const updatedTasks = [...prevTasks];
                
                // 1. Update existing active tasks & Add new ones
                newActiveTasks.forEach(newTask => {
                    const index = updatedTasks.findIndex(t => t.id === newTask.id);
                    if (index !== -1) {
                        updatedTasks[index] = { ...updatedTasks[index], ...newTask };
                    } else {
                        // Check if it was recently completed (to avoid re-adding completed tasks as active if API lags)
                        const isRecentlyCompleted = updatedTasks.find(t => t.id === newTask.id && (t.status === 'COMPLETED' || t.status === 'FAILED'));
                        if (!isRecentlyCompleted) {
                            updatedTasks.push(newTask);
                            if (!isExpanded) setIsExpanded(true); // Auto-expand on new task
                        }
                    }
                });

                // 2. Detect tasks that disappeared (Completed or Failed)
                // Filter for tasks that were PENDING/PROCESSING but are NOT in the new active list
                const disappearedTasks = updatedTasks.filter(t => 
                    (t.status === 'PENDING' || t.status === 'PROCESSING') && 
                    !newActiveIds.has(t.id)
                );

                disappearedTasks.forEach(async (task) => {
                    // Fetch final status to be sure
                    try {
                        const statusRes = await axios.get(`/api/tasks/${task.id}`);
                        const finalTask = statusRes.data;
                        
                        setTasks(current => {
                            const idx = current.findIndex(t => t.id === task.id);
                            if (idx !== -1) {
                                const newCurrent = [...current];
                                newCurrent[idx] = { ...newCurrent[idx], status: finalTask.status, updated_at: new Date().toISOString() };
                                
                                // Dispatch Global Event for UI Refresh
                                if (finalTask.status === 'COMPLETED') {
                                    window.dispatchEvent(new CustomEvent('TASK_COMPLETED', { 
                                        detail: { id: task.id, type: task.type, status: finalTask.status, payload: task.payload } 
                                    }));
                                }
                                
                                return newCurrent;
                            }
                            return current;
                        });

                        // Remove after 5 seconds
                        setTimeout(() => {
                            setTasks(current => current.filter(t => t.id !== task.id));
                        }, 5000);

                    } catch (e) {
                        // If 404 or error, assume completed or just remove
                         setTasks(current => current.filter(t => t.id !== task.id));
                    }
                });

                return updatedTasks;
            });

        } catch (error) {
            console.error('Failed to fetch active tasks', error);
        }
    };

    // Derived state for UI
    const processingCount = tasks.filter(t => t.status === 'PENDING' || t.status === 'PROCESSING').length;
    const completedCount = tasks.filter(t => t.status === 'COMPLETED').length;
    const failedCount = tasks.filter(t => t.status === 'FAILED').length;

    // State for timestamp to force image refresh
    const [previewTimestamp, setPreviewTimestamp] = useState(Date.now());

    useEffect(() => {
        // Only refresh preview images if there are processing tasks that use screenshots
        const hasActiveVisualTasks = tasks.some(t => 
            (t.type === 'PUBLISH' || t.type === 'SCRAPE_STATS') && 
            (t.status === 'PROCESSING' || t.status === 'FAILED')
        );

        if (!hasActiveVisualTasks) return;

        const interval = setInterval(() => {
            setPreviewTimestamp(Date.now());
        }, 2000);
        return () => clearInterval(interval);
    }, [tasks]);

    if (tasks.length === 0) return null;

    const getTaskLabel = (type: string) => {
        switch (type) {
            case 'PUBLISH': return '发布笔记';
            case 'GENERATE_CONTENT': return 'AI生成';
            case 'GENERATE_VIDEO': return '视频生成';
            case 'SCRAPE_STATS': return '数据同步';
            case 'SCRAPE_COMMENTS': return '评论采集';
            case 'CHECK_HEALTH': return '全量体检';
            default: return type;
        }
    };

    return (
        <div className="fixed bottom-4 right-4 z-50 w-80 sm:w-96 shadow-lg rounded-lg overflow-hidden border border-indigo-100 bg-white animate-in slide-in-from-bottom-5 duration-300">
            {/* Header / Summary Bar */}
            <div 
                className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors
                    ${failedCount > 0 ? 'bg-red-600 hover:bg-red-700' : 
                      completedCount > 0 && processingCount === 0 ? 'bg-green-600 hover:bg-green-700' : 
                      'bg-indigo-600 hover:bg-indigo-700'}
                `}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center text-white">
                    {processingCount > 0 ? (
                        <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    ) : failedCount > 0 ? (
                        <XCircle className="mr-2 h-4 w-4" />
                    ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    <span className="font-medium text-sm">
                        {processingCount > 0 ? `${processingCount} 个任务进行中...` : 
                         failedCount > 0 ? `${failedCount} 个任务失败` :
                         '任务已完成'}
                    </span>
                </div>
                <div className="flex items-center text-indigo-100">
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                </div>
            </div>

            {/* Expanded List */}
            {isExpanded && (
                <div className="max-h-64 overflow-y-auto bg-white">
                    {tasks.map(task => (
                        <div key={task.id} className="p-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-xs font-bold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                                    {getTaskLabel(task.type)}
                                </span>
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center ${
                                    task.status === 'PROCESSING' ? 'bg-blue-50 text-blue-600' : 
                                    task.status === 'PENDING' ? 'bg-yellow-50 text-yellow-600' :
                                    task.status === 'COMPLETED' ? 'bg-green-50 text-green-600' :
                                    'bg-red-50 text-red-600'
                                }`}>
                                    {task.status === 'PROCESSING' && <Loader2 size={10} className="animate-spin mr-1" />}
                                    {task.status === 'COMPLETED' && <CheckCircle2 size={10} className="mr-1" />}
                                    {task.status === 'FAILED' && <XCircle size={10} className="mr-1" />}
                                    
                                    {task.status === 'PROCESSING' ? '执行中' : 
                                     task.status === 'PENDING' ? '排队中' :
                                     task.status === 'COMPLETED' ? '已完成' : '失败'}
                                </span>
                            </div>
                            <div className="text-xs text-gray-500 truncate font-mono">
                                ID: {task.id.substring(0, 8)}
                            </div>
                            <div className="text-[10px] text-gray-400 mt-1 flex items-center justify-between">
                                <span className="flex items-center">
                                    <Clock size={10} className="mr-1" />
                                    {new Date(task.created_at).toLocaleTimeString()}
                                </span>
                                {task.updated_at && task.status !== 'PENDING' && (
                                    <span>
                                        耗时: {Math.max(1, Math.round((new Date(task.updated_at).getTime() - new Date(task.created_at).getTime()) / 1000))}s
                                    </span>
                                )}
                            </div>
                            
                            {/* Live Preview for Publish Tasks */}
                            {(task.type === 'PUBLISH' || task.type === 'SCRAPE_STATS') && (task.status === 'PROCESSING' || task.status === 'FAILED') && (
                                <div className="mt-2 bg-gray-100 rounded overflow-hidden relative group">
                                    <div className="absolute top-1 right-1 bg-black/60 text-white text-[8px] px-1 rounded z-10 flex items-center">
                                        <Activity size={8} className="mr-1 animate-pulse text-green-400" />
                                        实时预览
                                    </div>
                                    <img 
                                        src={`/screenshots/${task.id}.jpg?t=${previewTimestamp}`}
                                        alt="Live Preview" 
                                        className="w-full h-auto object-cover opacity-90 hover:opacity-100 transition-opacity"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                    <div className="p-2 bg-gray-50 text-center border-t border-gray-100">
                        <Link to="/tasks" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center justify-center">
                            <Activity size={12} className="mr-1" />
                            查看全部任务 &rarr;
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
