import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { BarChart, Eye, Heart, MessageCircle, Star, RefreshCw, Loader2, ArrowLeft, TrendingUp, Download, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, BarChart as ReBarChart, Bar } from 'recharts';

interface SummaryStats {
  account_name: string;
  total_notes: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_collects: number;
}

interface NoteStat {
  note_id: string;
  title: string;
  cover_image: string;
  views: number;
  likes: number;
  comments: number;
  collects: number;
  publish_date: string;
  xsec_token?: string;
  record_date: string;
}

interface EngagementStats {
  intents: {
    PRAISE: number;
    COMPLAINT: number;
    INQUIRY: number;
    OTHER: number;
  };
  replyStats: {
    total: number;
    replied: number;
    rate: number;
  };
  dailyTrend: { date: string; count: number }[];
}

export default function Analytics() {
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [engagement, setEngagement] = useState<EngagementStats | null>(null);
  const [notes, setNotes] = useState<NoteStat[]>([]);
  // Use pagination state as the single source of truth for the list params
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false); // Specific loader for the list
  const [refreshing, setRefreshing] = useState(false);

  const fetchSummaryAndChart = async (signal?: AbortSignal) => {
    try {
      const [summaryRes, historyRes, engagementRes] = await Promise.all([
        axios.get('/api/analytics/summary', { signal }),
        axios.get('/api/analytics/history', { signal }),
        axios.get('/api/analytics/engagement', { signal })
      ]);
      setSummary(summaryRes.data);
      setEngagement(engagementRes.data);
      
      if (Array.isArray(historyRes.data)) {
          // Backend now returns pre-aggregated data: { date, views, likes, ... }
          setChartData(historyRes.data);
      }
    } catch (error) {
      if (!axios.isCancel(error)) {
        console.error('Failed to fetch summary/chart:', error);
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  // Fetch notes specifically based on current pagination state
  const fetchNotes = async (signal?: AbortSignal) => {
      setListLoading(true);
      try {
          const { page, pageSize } = pagination;
          const res = await axios.get(`/api/analytics/notes?page=${page}&pageSize=${pageSize}`, { signal });
          if (res.data.data) {
              setNotes(res.data.data);
              // Only update total, preserve current page/pageSize to avoid loops
              setPagination(prev => ({ 
                  ...prev, 
                  total: res.data.total 
              }));
          } else if (Array.isArray(res.data)) {
              // Fallback for legacy API
              setNotes(res.data);
              setPagination(prev => ({ ...prev, total: res.data.length }));
          }
      } catch (e) { 
          if (!axios.isCancel(e)) {
            console.error(e); 
          }
      } finally {
          if (!signal?.aborted) {
            setListLoading(false);
          }
      }
  };

  // Initial Load
  useEffect(() => {
    const controller = new AbortController();
    fetchSummaryAndChart(controller.signal);
    return () => controller.abort();
  }, []);

  // Reactive Fetching: Trigger fetchNotes whenever page or pageSize changes
  useEffect(() => {
    const controller = new AbortController();
    fetchNotes(controller.signal);
    return () => controller.abort();
  }, [pagination.page, pagination.pageSize]);

  const handlePageChange = (newPage: number) => {
      if (newPage > 0 && newPage <= Math.ceil(pagination.total / pagination.pageSize)) {
          setPagination(prev => ({ ...prev, page: newPage }));
      }
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newSize = parseInt(e.target.value);
      // Reset to page 1 when changing page size
      setPagination(prev => ({ ...prev, pageSize: newSize, page: 1 }));
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await axios.post('/api/analytics/refresh');
      const { taskId } = res.data;
      
      let attempts = 0;
      let taskStatus = 'PENDING';
      
      while (taskStatus === 'PENDING' || taskStatus === 'PROCESSING') {
          await new Promise(r => setTimeout(r, 2000));
          attempts++;
          
          try {
              const taskRes = await axios.get(`/api/tasks/${taskId}`);
              taskStatus = taskRes.data.status;
              
              if (taskStatus === 'COMPLETED') {
                  // Refresh all data
                  await fetchSummaryAndChart();
                  await fetchNotes();
                  toast.success('数据同步完成！');
                  return;
              } else if (taskStatus === 'FAILED') {
                  throw new Error(taskRes.data.error || '同步失败');
              }
              
              if (attempts > 120) throw new Error('同步超时，请稍后重试');
          } catch (pollErr: any) {
              if (pollErr.message.includes('失败') || pollErr.message.includes('超时')) throw pollErr;
          }
      }
      
    } catch (error: any) {
      console.error('Refresh failed:', error);
      const msg = error.response?.data?.error || error.message || '未知错误';
      toast.error(`数据更新失败: ${msg}\n请确保已绑定“创作权限”且账号状态正常。`);
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenInBrowser = async (noteId: string) => {
      try {
          await axios.post('/api/accounts/open-note', { noteId });
      } catch (error: any) {
          console.error('Failed to open note:', error);
          toast.error(`打开失败: ${error.response?.data?.error || '请确保账号已登录'}`);
      }
  };

  const handleExport = () => {
      // Use the proxy to download the file
      window.location.href = '/api/analytics/export';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  const COLORS = {
      PRAISE: '#10B981', // Green
      COMPLAINT: '#EF4444', // Red
      INQUIRY: '#3B82F6', // Blue
      OTHER: '#9CA3AF' // Gray
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center">

            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <BarChart className="mr-2 text-indigo-600" />
                数据看板
                </h1>
                {summary && (
                    <p className="text-sm text-gray-500 mt-1">
                        当前账号: <span className="font-medium text-indigo-600">{summary.account_name}</span>
                    </p>
                )}
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
                onClick={handleExport}
                className="flex items-center px-4 py-2 rounded-md text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors shadow-sm"
                title="导出数据为 Excel"
            >
                <Download className="mr-2" size={16} />
                导出 Excel
            </button>
          
            <button
                onClick={handleRefresh}
                disabled={refreshing}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium text-white transition-colors shadow-sm
                ${refreshing ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}
                `}
            >
                <RefreshCw className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} size={16} />
                {refreshing ? '正在同步数据...' : '同步最新数据'}
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-500">总阅读量</h3>
                <Eye size={16} className="text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{summary.total_views.toLocaleString()}</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-500">总点赞</h3>
                <Heart size={16} className="text-red-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{summary.total_likes.toLocaleString()}</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-500">总收藏</h3>
                <Star size={16} className="text-yellow-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{summary.total_collects.toLocaleString()}</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-500">总评论</h3>
                <MessageCircle size={16} className="text-green-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{summary.total_comments.toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* Engagement Analysis Section */}
        {engagement && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* 1. Reply Rate Card */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
                    <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center">
                           <MessageCircle className="mr-2 text-indigo-600" size={20} />
                           互动响应率
                        </h3>
                        <p className="text-sm text-gray-500">已回复评论占比</p>
                    </div>
                    <div className="mt-4 flex items-end">
                        <span className="text-4xl font-bold text-gray-900">{engagement.replyStats.rate}%</span>
                        <span className="text-sm text-gray-500 ml-2 mb-1">
                            ({engagement.replyStats.replied} / {engagement.replyStats.total})
                        </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4">
                        <div 
                            className="bg-indigo-600 h-2.5 rounded-full" 
                            style={{ width: `${engagement.replyStats.rate}%` }}
                        ></div>
                    </div>
                </div>

                {/* 2. Intent Distribution Pie Chart */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                        <Heart className="mr-2 text-pink-500" size={20} />
                        评论意图分布
                    </h3>
                    <div className="h-48 w-full flex items-center">
                        <ResponsiveContainer width="60%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: '夸奖', value: engagement.intents.PRAISE },
                                        { name: '询单', value: engagement.intents.INQUIRY },
                                        { name: '吐槽', value: engagement.intents.COMPLAINT },
                                        { name: '其他', value: engagement.intents.OTHER },
                                    ]}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={60}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    <Cell fill={COLORS.PRAISE} />
                                    <Cell fill={COLORS.INQUIRY} />
                                    <Cell fill={COLORS.COMPLAINT} />
                                    <Cell fill={COLORS.OTHER} />
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="flex flex-col space-y-2 text-sm w-[40%] pl-2">
                            <div className="flex items-center"><span className="w-3 h-3 rounded-full mr-2 bg-green-500"></span>夸奖: {engagement.intents.PRAISE}</div>
                            <div className="flex items-center"><span className="w-3 h-3 rounded-full mr-2 bg-blue-500"></span>询单: {engagement.intents.INQUIRY}</div>
                            <div className="flex items-center"><span className="w-3 h-3 rounded-full mr-2 bg-red-500"></span>吐槽: {engagement.intents.COMPLAINT}</div>
                            <div className="flex items-center"><span className="w-3 h-3 rounded-full mr-2 bg-gray-400"></span>其他: {engagement.intents.OTHER}</div>
                        </div>
                    </div>
                </div>

                {/* 3. Daily Comments Bar Chart */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                        <TrendingUp className="mr-2 text-green-600" size={20} />
                        近7天新增评论
                    </h3>
                    <div className="h-48 w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <ReBarChart data={engagement.dailyTrend}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" tickFormatter={(v) => v.substring(5)} tick={{fontSize: 12}} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    cursor={{fill: 'transparent'}}
                                />
                                <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="评论数" />
                            </ReBarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        )}

        {/* Trend Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
                <TrendingUp className="mr-2 text-indigo-600" size={20} />
                近30天流量趋势
            </h3>
            {chartData.length > 0 ? (
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorInteraction" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#82ca9d" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="date" />
                            <YAxis />
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <Tooltip 
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                            />
                            <Legend />
                            <Area 
                                type="monotone" 
                                dataKey="views" 
                                name="总阅读量" 
                                stroke="#8884d8" 
                                fillOpacity={1} 
                                fill="url(#colorViews)" 
                            />
                            <Area 
                                type="monotone" 
                                dataKey="interaction" 
                                name="总互动 (赞+藏+评)" 
                                stroke="#82ca9d" 
                                fillOpacity={1} 
                                fill="url(#colorInteraction)" 
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="h-64 flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg">
                    <BarChart size={48} className="mb-2 opacity-50" />
                    <p>暂无历史趋势数据 (需等待定时任务运行)</p>
                </div>
            )}
        </div>

        {/* Recent Notes Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden relative">
          {listLoading && (
              <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center">
                  <Loader2 className="animate-spin text-indigo-600" size={24} />
              </div>
          )}
          
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">近期笔记表现</h3>
            <div className="flex items-center text-sm text-gray-500">
                <span className="mr-2">每页显示:</span>
                <select 
                    value={pagination.pageSize}
                    onChange={handlePageSizeChange}
                    disabled={listLoading}
                    className="border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
                >
                    <option value="10">10条</option>
                    <option value="20">20条</option>
                    <option value="50">50条</option>
                    <option value="100">100条</option>
                </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    笔记
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    阅读
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    点赞
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    收藏
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    评论
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {notes.map((note) => (
                  <tr key={note.note_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          {note.cover_image ? (
                            <a href={note.xsec_token ? `https://www.xiaohongshu.com/explore/${note.note_id}?xsec_token=${note.xsec_token}&xsec_source=pc_feed` : `https://www.xiaohongshu.com/explore/${note.note_id}?xsec_source=pc_feed`} target="_blank" rel="noopener noreferrer">
                                <img className="h-10 w-10 rounded object-cover hover:opacity-80 transition-opacity" src={note.cover_image} alt="" />
                            </a>
                          ) : (
                            <div className="h-10 w-10 rounded bg-gray-200 flex items-center justify-center">
                              <span className="text-xs text-gray-500">No Img</span>
                            </div>
                          )}
                        </div>
                        <div className="ml-4 flex flex-col">
                          <div className="flex items-center">
                              <a href={note.xsec_token ? `https://www.xiaohongshu.com/explore/${note.note_id}?xsec_token=${note.xsec_token}&xsec_source=pc_feed` : `https://www.xiaohongshu.com/explore/${note.note_id}?xsec_source=pc_feed`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-gray-900 truncate max-w-xs hover:text-indigo-600 hover:underline" title={note.title}>
                                {note.title}
                              </a>
                              <button 
                                  onClick={() => handleOpenInBrowser(note.note_id)} 
                                  className="ml-2 text-gray-400 hover:text-indigo-600 p-1 rounded-full hover:bg-indigo-50 transition-colors"
                                  title="以当前身份查看 (RPA浏览器 - 自动登录)"
                              >
                                  <Eye size={14} />
                              </button>
                              <a 
                                  href={note.xsec_token ? `https://www.xiaohongshu.com/explore/${note.note_id}?xsec_token=${note.xsec_token}&xsec_source=pc_feed` : `https://www.xiaohongshu.com/explore/${note.note_id}?xsec_source=pc_feed`} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="ml-1 text-gray-300 hover:text-gray-500 p-1"
                                  title="普通浏览器打开 (需手动登录)"
                              >
                                  <ExternalLink size={12} />
                              </a>
                          </div>
                          <div className="text-xs text-gray-500" title={`发布时间: ${note.publish_date ? new Date(note.publish_date).toLocaleString() : '未知'}`}>
                            {note.publish_date ? new Date(note.publish_date).toLocaleDateString() : '发布时间未知'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {note.views}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {note.likes}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {note.collects}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {note.comments}
                    </td>
                  </tr>
                ))}
                {notes.length === 0 && !listLoading && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                      暂无数据，请点击右上角“同步最新数据”
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                      <p className="text-sm text-gray-700">
                          显示 <span className="font-medium">{pagination.total > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0}</span> 到 <span className="font-medium">{Math.min(pagination.page * pagination.pageSize, pagination.total)}</span> 条，共 <span className="font-medium">{pagination.total}</span> 条
                      </p>
                  </div>
                  <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                          <button
                              onClick={() => handlePageChange(pagination.page - 1)}
                              disabled={pagination.page === 1 || listLoading}
                              className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${
                                  pagination.page === 1 || listLoading ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
                              }`}
                          >
                              上一页
                          </button>
                          
                          <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                              第 {pagination.page} 页 / 共 {totalPages > 0 ? totalPages : 1} 页
                          </span>

                          <button
                              onClick={() => handlePageChange(pagination.page + 1)}
                              disabled={pagination.page >= totalPages || listLoading}
                              className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                                  pagination.page >= totalPages || listLoading ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
                              }`}
                          >
                              下一页
                          </button>
                      </nav>
                  </div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
