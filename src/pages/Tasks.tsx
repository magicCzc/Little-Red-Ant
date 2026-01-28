import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Clock, ArrowLeft, Loader2, RefreshCw, CheckCircle, XCircle, PlayCircle, AlertCircle, Eye, Calendar, List, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

interface Task {
  id: string;
  type: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  payload: any;
  result?: any;
  error?: string;
  scheduled_at?: string;
  created_at: string;
  updated_at: string;
  progress?: number;
  attempts?: number;
}

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchTasks();
    
    // Auto-refresh every 5 seconds if there are active tasks
    const interval = setInterval(() => {
        if (viewMode === 'list') {
            setTasks(currentTasks => {
                const hasActive = currentTasks.some(t => t.status === 'PENDING' || t.status === 'PROCESSING');
                if (hasActive) {
                    fetchTasks(true);
                }
                return currentTasks;
            });
        }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [viewMode, currentDate, page, pageSize]);

  const fetchTasks = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);
    
    try {
      let url = '/api/tasks';
      let params: any = {};

      if (viewMode === 'calendar') {
          const year = currentDate.getFullYear();
          const month = currentDate.getMonth();
          const start = new Date(year, month, 1).toISOString();
          const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
          params = { start_date: start, end_date: end };
          // Calendar mode gets all tasks for the month, no pagination for now or handled differently
      } else {
          params = { page, pageSize };
      }

      const res = await axios.get(url, { params });
      
      if (res.data.pagination) {
          setTasks(res.data.data);
          setPagination({
              total: res.data.pagination.total,
              totalPages: res.data.pagination.totalPages
          });
      } else if (Array.isArray(res.data)) {
           // Fallback for calendar or legacy
           setTasks(res.data);
      } else if (res.data.data && Array.isArray(res.data.data)) {
            // Should be covered by pagination check, but just in case
            setTasks(res.data.data);
      } else {
          // Unexpected format
          console.error('Unexpected task response format:', res.data);
          setTasks([]);
      }
      
    } catch (error) {
      console.error('Failed to fetch tasks', error);
      if (!isBackground) toast.error('获取任务列表失败');
      setTasks([]); // Ensure array
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRetry = async (taskId: string) => {
      try {
          await axios.post(`/api/tasks/${taskId}/retry`);
          toast.success('任务已重试');
          fetchTasks(true);
      } catch (e) {
          toast.error('重试失败');
      }
  };

  const [confirmingTask, setConfirmingTask] = useState<string | null>(null);

  const handleCancel = (taskId: string) => {
      setConfirmingTask(taskId);
  };

  const confirmCancel = async () => {
      if (!confirmingTask) return;
      
      try {
          await axios.post(`/api/tasks/${confirmingTask}/cancel`);
          toast.success('任务已终止');
          fetchTasks(true);
      } catch (e) {
          toast.error('终止任务失败');
      } finally {
          setConfirmingTask(null);
      }
  };

  const getStatusIcon = (status: string) => {
      switch (status) {
        case 'COMPLETED': return <CheckCircle className="text-green-500" size={16} />;
        case 'FAILED': return <XCircle className="text-red-500" size={16} />;
        case 'PROCESSING': return <Loader2 className="animate-spin text-blue-500" size={16} />;
        case 'CANCELLED': return <XCircle className="text-gray-400" size={16} />;
        default: return <Clock className="text-gray-400" size={16} />;
      }
  };

  const getStatusText = (task: Task) => {
      if (task.status === 'PENDING' && task.scheduled_at) {
          const scheduledTime = new Date(task.scheduled_at).getTime();
          if (scheduledTime > Date.now()) {
              return '已计划';
          }
      }

      switch (task.status) {
          case 'COMPLETED': return '已完成';
          case 'FAILED': return '失败';
          case 'PROCESSING': return '执行中';
          case 'PENDING': return '排队中';
          case 'CANCELLED': return '已终止';
          default: return task.status;
      }
  };

  const getTaskName = (type: string) => {
      switch (type) {
          case 'PUBLISH': return '发布笔记';
          case 'SCRAPE_STATS': return '同步数据';
          case 'SCRAPE_COMMENTS': return '抓取评论';
          case 'SCRAPE_TRENDS': return '抓取热点';
          case 'SCRAPE_COMPETITOR': return '更新对标账号数据';
          case 'GENERATE_CONTENT': return 'AI生成文案';
          case 'GENERATE_IMAGE': return 'AI生成配图';
          case 'GENERATE_VIDEO': return 'AI生成视频';
          default: return type;
      }
  };

  const handleViewResult = (task: Task) => {
      if (task.status !== 'COMPLETED' || !task.result) return;

      try {
          // Safety check for result validity
          if (task.type === 'GENERATE_CONTENT') {
              // Ensure result matches GeneratedContent structure
              if (typeof task.result === 'object' && task.result.title) {
                 navigate('/generate', { state: { generatedResult: task.result } });
              } else {
                 toast.error('结果数据格式无效');
              }
          } else if (task.type === 'GENERATE_VIDEO') {
              if (task.result.url) window.open(task.result.url, '_blank');
              else toast.error('视频链接无效');
          } else if (task.type === 'GENERATE_IMAGE') {
              if (task.result.url) window.open(task.result.url, '_blank');
              else toast.error('图片链接无效');
          }
      } catch (e) {
          console.error('View result failed', e);
          toast.error('无法查看详情');
      }
  };
  
  // --- Calendar Helpers ---
  const getDaysInMonth = (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const days = new Date(year, month + 1, 0).getDate();
      const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
      return { days, firstDay };
  };

  const changeMonth = (delta: number) => {
      const newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() + delta);
      setCurrentDate(newDate);
  };

  const renderCalendar = () => {
      const { days, firstDay } = getDaysInMonth(currentDate);
      const cells = [];
      
      for (let i = 0; i < firstDay; i++) {
          cells.push(<div key={`empty-${i}`} className="h-32 bg-gray-50 border border-gray-100/50"></div>);
      }
      
      for (let d = 1; d <= days; d++) {
          const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          
          const dayTasks = tasks.filter(t => {
              const targetDate = t.scheduled_at ? new Date(t.scheduled_at) : new Date(t.created_at);
              return targetDate.getDate() === d && targetDate.getMonth() === currentDate.getMonth() && targetDate.getFullYear() === currentDate.getFullYear();
          });
          
          const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), d).toDateString();

          cells.push(
              <div key={d} className={`h-32 border border-gray-100 p-2 overflow-hidden hover:bg-gray-50 transition-colors relative group ${isToday ? 'bg-indigo-50/30 ring-1 ring-inset ring-indigo-200' : 'bg-white'}`}>
                  <div className={`text-sm font-medium mb-1 ${isToday ? 'text-indigo-600' : 'text-gray-700'}`}>
                      {d} {isToday && <span className="text-xs ml-1 font-normal">(今天)</span>}
                  </div>
                  <div className="space-y-1 overflow-y-auto max-h-[calc(100%-1.5rem)] no-scrollbar">
                      {dayTasks.map(task => (
                          <div key={task.id} className={`
                              text-xs p-1.5 rounded border flex items-center gap-1.5 cursor-pointer hover:shadow-sm transition-shadow
                              ${task.status === 'FAILED' ? 'bg-red-50 border-red-100 text-red-700' : 
                                task.status === 'COMPLETED' ? 'bg-green-50 border-green-100 text-green-700' : 
                                task.status === 'PROCESSING' ? 'bg-blue-50 border-blue-100 text-blue-700' :
                                'bg-gray-50 border-gray-200 text-gray-600'}
                          `} title={`${getTaskName(task.type)} - ${getStatusText(task)}`}>
                              {getStatusIcon(task.status)}
                              <span className="truncate flex-1">{task.payload?.title || getTaskName(task.type)}</span>
                              {task.scheduled_at && <span className="text-[10px] opacity-75">{new Date(task.scheduled_at).getHours()}:{String(new Date(task.scheduled_at).getMinutes()).padStart(2, '0')}</span>}
                          </div>
                      ))}
                  </div>
                  {dayTasks.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                          <span className="text-xs text-gray-300">+ 添加任务</span>
                      </div>
                  )}
              </div>
          );
      }
      
      return cells;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 relative">
      {confirmingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-lg shadow-xl max-w-sm w-full overflow-hidden transform transition-all scale-100 opacity-100">
                <div className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-red-100 rounded-full flex-shrink-0">
                            <AlertCircle className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">终止任务</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                确定要强制终止此任务吗？此操作无法撤销。
                            </p>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={() => setConfirmingTask(null)}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            取消
                        </button>
                        <button 
                            onClick={confirmCancel}
                            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                            确认终止
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <div className="flex items-center">

                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                    <PlayCircle className="mr-2 text-indigo-600" />
                    任务中心
                </h1>
            </div>
            
            <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-md flex items-center text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <List size={16} className="mr-2" /> 列表视图
                </button>
                <button
                    onClick={() => setViewMode('calendar')}
                    className={`p-2 rounded-md flex items-center text-sm font-medium transition-colors ${viewMode === 'calendar' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <Calendar size={16} className="mr-2" /> 内容日历
                </button>
            </div>

            <button
                onClick={() => fetchTasks()}
                className={`p-2 rounded-full hover:bg-gray-200 transition-colors ${refreshing ? 'animate-spin' : ''}`}
                title="刷新"
            >
                <RefreshCw size={20} className="text-gray-600" />
            </button>
        </div>

        {viewMode === 'calendar' ? (
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                {/* Calendar Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50/50">
                    <h2 className="text-lg font-semibold text-gray-800">
                        {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
                    </h2>
                    <div className="flex space-x-2">
                        <button onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-white rounded-md border border-transparent hover:border-gray-200 hover:shadow-sm transition-all text-gray-600">
                            <ChevronLeft size={20} />
                        </button>
                        <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-md hover:bg-gray-50 text-gray-600">
                            今天
                        </button>
                        <button onClick={() => changeMonth(1)} className="p-1.5 hover:bg-white rounded-md border border-transparent hover:border-gray-200 hover:shadow-sm transition-all text-gray-600">
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
                
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500 text-center py-2">
                    <div>周日</div>
                    <div>周一</div>
                    <div>周二</div>
                    <div>周三</div>
                    <div>周四</div>
                    <div>周五</div>
                    <div>周六</div>
                </div>
                
                {/* Calendar Grid */}
                <div className="grid grid-cols-7 bg-gray-200 gap-px border-b border-gray-200">
                    {loading && !refreshing ? (
                        <div className="col-span-7 h-96 flex items-center justify-center bg-white">
                             <Loader2 className="animate-spin text-indigo-500" size={32} />
                        </div>
                    ) : renderCalendar()}
                </div>
                
                <div className="p-4 bg-gray-50 text-xs text-gray-500 flex gap-4">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> 执行中</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> 已完成</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> 失败</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-gray-400"></div> 排队/草稿</div>
                </div>
            </div>
        ) : (
            // List View
            loading && !refreshing && tasks.length === 0 ? (
            <div className="text-center py-20">
                <Loader2 className="animate-spin h-8 w-8 mx-auto text-indigo-600 mb-2" />
                <p className="text-gray-500">加载中...</p>
            </div>
            ) : (
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">任务类型</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">耗时/详情</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {tasks.map(task => (
                                <tr key={task.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            {getStatusIcon(task.status)}
                                            <div className="flex flex-col ml-2 w-full max-w-[140px]">
                                                <div className="flex justify-between items-center">
                                                    <span className={`text-sm font-medium 
                                                        ${task.status === 'COMPLETED' ? 'text-green-600' : 
                                                        task.status === 'FAILED' ? 'text-red-600' : 'text-gray-900'}`}>
                                                        {getStatusText(task)}
                                                    </span>
                                                    {task.status === 'PROCESSING' && (
                                                        <span className="text-xs text-blue-600 font-bold">{task.progress || 0}%</span>
                                                    )}
                                                </div>
                                                
                                                {/* Progress Bar for Processing */}
                                                {task.status === 'PROCESSING' && (
                                                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1 overflow-hidden">
                                                        <div 
                                                            className="bg-blue-500 h-1.5 rounded-full transition-all duration-500 ease-out" 
                                                            style={{ width: `${task.progress || 5}%` }}
                                                        ></div>
                                                    </div>
                                                )}
                                                
                                                {task.scheduled_at && task.status === 'PENDING' && (
                                                    <span className="text-xs text-indigo-500">
                                                        计划: {new Date(task.scheduled_at).toLocaleString()}
                                                    </span>
                                                )}
                                                {task.status === 'FAILED' && task.attempts ? (
                                                     <span className="text-[10px] text-red-400">重试次数: {task.attempts}</span>
                                                ) : null}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {getTaskName(task.type)}
                                        <div className="text-xs text-gray-400 font-mono mt-0.5">{task.id.substring(0, 8)}...</div>
                                        {task.payload?.title && <div className="text-xs text-gray-500 truncate max-w-[150px]">{task.payload.title}</div>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(task.created_at).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {task.error ? (
                                            <div className="flex items-start text-red-500">
                                                <AlertCircle size={16} className="mr-1 flex-shrink-0 mt-0.5" />
                                                <span className="line-clamp-2 max-w-[200px]" title={task.error}>{task.error}</span>
                                            </div>
                                        ) : (
                                            <span>
                                                {task.updated_at && task.created_at ? 
                                                    `${((new Date(task.updated_at).getTime() - new Date(task.created_at).getTime()) / 1000).toFixed(1)}s` 
                                                    : '-'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {task.status === 'COMPLETED' && task.type === 'GENERATE_CONTENT' && (
                                            <button 
                                                onClick={() => handleViewResult(task)} 
                                                className="text-indigo-600 hover:text-indigo-900 flex items-center text-xs font-medium bg-indigo-50 px-2 py-1 rounded"
                                            >
                                                <Eye size={14} className="mr-1" /> 查看结果
                                            </button>
                                        )}
                                        {task.status === 'FAILED' && (
                                            <button 
                                                onClick={() => handleRetry(task.id)}
                                                className="text-red-600 hover:text-red-900 flex items-center text-xs font-medium bg-red-50 px-2 py-1 rounded"
                                            >
                                                <RotateCw size={14} className="mr-1" /> 重试
                                            </button>
                                        )}
                                        {(task.status === 'PENDING' || task.status === 'PROCESSING') && (
                                            <button 
                                                onClick={() => handleCancel(task.id)}
                                                className="text-gray-600 hover:text-gray-900 flex items-center text-xs font-medium bg-gray-100 px-2 py-1 rounded ml-2"
                                                title="终止任务"
                                            >
                                                <XCircle size={14} className="mr-1" /> 终止
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {tasks.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                                        暂无任务记录
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {viewMode === 'list' && pagination.totalPages > 1 && (
                    <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                        <div className="flex-1 flex justify-between sm:hidden">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                            >
                                上一页
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                                disabled={page === pagination.totalPages}
                                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                            >
                                下一页
                            </button>
                        </div>
                        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm text-gray-700">
                                    显示 <span className="font-medium">{(page - 1) * pageSize + 1}</span> 到 <span className="font-medium">{Math.min(page * pageSize, pagination.total)}</span> 条，共 <span className="font-medium">{pagination.total}</span> 条
                                </p>
                            </div>
                            <div>
                                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        <span className="sr-only">Previous</span>
                                        <ChevronLeft size={16} />
                                    </button>
                                    
                                    {/* Simple Page Indicator */}
                                    <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                        第 {page} 页 / 共 {pagination.totalPages} 页
                                    </span>

                                    <button
                                        onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                                        disabled={page === pagination.totalPages}
                                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        <span className="sr-only">Next</span>
                                        <ChevronRight size={16} />
                                    </button>
                                </nav>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            )
        )}
      </div>
    </div>
  );
}
