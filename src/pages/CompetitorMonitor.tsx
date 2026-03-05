
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Trash2, Target, TrendingUp, X, Lightbulb, Key, BookOpen, AlertCircle, Plus, RefreshCw, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import PageLoading from '../components/PageLoading';
import EmptyState from '../components/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import FriendlyError, { FriendlyErrorBadge } from '../components/FriendlyError';

interface FriendlyErrorData {
    code?: string;
    title: string;
    message: string;
    suggestion: string;
    severity: 'error' | 'warning' | 'info';
}

interface Competitor {
  id: number;
  user_id: string;
  nickname: string;
  avatar?: string;
  fans_count: number;
  notes_count: number;
  description: string;
  last_updated: string;
  status: 'active' | 'pending' | 'processing' | 'refreshing' | 'error';
  last_error?: string;
  analysis_result?: any;
  latest_notes?: any[];
  friendlyError?: FriendlyErrorData | null;
}

export default function CompetitorMonitor() {
  const navigate = useNavigate();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'error' | 'pending'>('all');
  
  // Polling State
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Analysis Modal State
  const [selectedAnalysis, setSelectedAnalysis] = useState<any | null>(null);
  const [selectedCompetitorName, setSelectedCompetitorName] = useState('');

  // Delete Modal State
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Batch Selection State
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  useEffect(() => {
    fetchCompetitors();
    return () => stopPolling();
  }, []);

  // Auto-polling effect: if any task is running, poll frequently
  useEffect(() => {
    const hasRunningTasks = competitors.some(c => ['pending', 'processing', 'refreshing'].includes(c.status));
    
    if (hasRunningTasks) {
        startPolling();
    } else {
        stopPolling();
    }
  }, [competitors]);

  const startPolling = () => {
    if (pollIntervalRef.current) return;
    pollIntervalRef.current = setInterval(fetchCompetitors, 3000); // Poll every 3s
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
    }
  };

  const fetchCompetitors = async () => {
    try {
      const res = await axios.get('/api/competitors');
      if (res.data.success && Array.isArray(res.data.data)) {
          setCompetitors(res.data.data);
      } else {
          setCompetitors([]);
      }
    } catch (error: any) {
      console.error('Failed to fetch competitors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    const competitor = competitors.find(c => c.id === id);
    if (!competitor) return;

    // Optimistic Update
    setCompetitors(prev => prev.map(c => c.id === id ? { ...c, status: 'refreshing' } : c));
    toast.success('已添加到更新队列');

    try {
        await axios.post(`/api/competitors/analyze`, { 
            url: `https://www.xiaohongshu.com/user/profile/${competitor.user_id}` 
        });
        // Polling will handle the rest
    } catch(e) {
        toast.error('启动更新失败');
        // Revert status on error
        fetchCompetitors();
    }
  };

  const toggleSelection = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
        newSelected.delete(id);
    } else {
        newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredCompetitors.length) {
        setSelectedIds(new Set());
    } else {
        setSelectedIds(new Set(filteredCompetitors.map(c => c.id)));
    }
  };

  const handleBatchRefresh = async () => {
    if (selectedIds.size === 0) return;
    
    setIsBatchProcessing(true);
    const toastId = toast.loading(`正在批量更新 ${selectedIds.size} 个账号...`);
    
    // Optimistic update
    setCompetitors(prev => prev.map(c => selectedIds.has(c.id) ? { ...c, status: 'refreshing' } : c));

    let successCount = 0;
    const ids = Array.from(selectedIds);
    
    // Process in chunks or sequence to avoid rate limiting
    for (const id of ids) {
        const competitor = competitors.find(c => c.id === id);
        if (!competitor) continue;
        
        try {
            await axios.post(`/api/competitors/analyze`, { 
                url: `https://www.xiaohongshu.com/user/profile/${competitor.user_id}` 
            });
            successCount++;
        } catch (e) {
            console.error(`Failed to refresh ${id}`, e);
        }
    }
    
    toast.success(`批量请求完成: 成功 ${successCount}/${ids.length}`, { id: toastId });
    setIsBatchProcessing(false);
    setSelectedIds(new Set()); // Clear selection
    // Polling will handle updates
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`确定要删除选中的 ${selectedIds.size} 个账号吗？此操作不可恢复。`)) return;

    setIsBatchProcessing(true);
    const toastId = toast.loading('正在批量删除...');
    
    let successCount = 0;
    const ids = Array.from(selectedIds);

    for (const id of ids) {
        try {
            await axios.delete(`/api/competitors/${id}`);
            successCount++;
        } catch (e) {
            console.error(`Failed to delete ${id}`, e);
        }
    }

    toast.success(`删除完成: 成功 ${successCount}/${ids.length}`, { id: toastId });
    setIsBatchProcessing(false);
    setSelectedIds(new Set());
    fetchCompetitors();
  };

  const confirmDelete = (id: number) => {
    setDeleteId(id);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    
    try {
      await axios.delete(`/api/competitors/${deleteId}`);
      toast.success('删除成功');
      setIsDeleteModalOpen(false);
      setDeleteId(null);
      fetchCompetitors();
    } catch (error) {
      toast.error('删除失败');
    }
  };

  const openAnalysis = (competitor: Competitor) => {
      if (['pending', 'processing', 'error'].includes(competitor.status)) {
          return;
      }
      if (!competitor.analysis_result || Object.keys(competitor.analysis_result).length === 0) {
          toast('暂无分析报告，请点击“更新数据”按钮', { icon: 'ℹ️' });
          return;
      }
      setSelectedCompetitorName(competitor.nickname);
      setSelectedAnalysis(competitor.analysis_result);
  };

  const filteredCompetitors = competitors.filter(competitor => {
    const matchesSearch = competitor.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        competitor.user_id.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'active') return matchesSearch && competitor.status === 'active';
    if (statusFilter === 'error') return matchesSearch && competitor.status === 'error';
    if (statusFilter === 'pending') return matchesSearch && ['pending', 'processing', 'refreshing'].includes(competitor.status);
    
    return matchesSearch;
  });

  const getStatusBadge = (status: string, lastError?: string) => {
      switch(status) {
          case 'pending':
          case 'processing':
          case 'refreshing':
              return (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 animate-pulse">
                      <RefreshCw size={12} className="mr-1 animate-spin" />
                      {status === 'pending' ? '初始化中...' : '数据更新中...'}
                  </span>
              );
          case 'error':
              return (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800" title={lastError}>
                      <AlertTriangle size={12} className="mr-1" />
                      更新失败
                  </span>
              );
          default:
              return (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle2 size={12} className="mr-1" />
                      监控中
                  </span>
              );
      }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader 
            title="对标账号监控" 
            icon={Target}
            description="监控竞品动向，AI 自动拆解爆款策略。"
        />
        <div className="flex flex-col sm:flex-row gap-4 max-w-2xl">
            <Skeleton className="h-10 flex-1 rounded-lg" />
            <Skeleton className="h-10 w-48 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col h-[280px]">
                    <div className="flex items-center mb-4">
                        <Skeleton className="w-12 h-12 rounded-full mr-3" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-16" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-4 bg-gray-50 rounded-lg p-3">
                        <div className="space-y-2 flex flex-col items-center">
                            <Skeleton className="h-3 w-8" />
                            <Skeleton className="h-4 w-12" />
                        </div>
                        <div className="space-y-2 flex flex-col items-center">
                            <Skeleton className="h-3 w-8" />
                            <Skeleton className="h-4 w-12" />
                        </div>
                    </div>
                    <Skeleton className="flex-1 rounded-lg mb-4" />
                    <div className="flex gap-2 mt-auto">
                        <Skeleton className="h-9 flex-1 rounded-lg" />
                        <Skeleton className="h-9 flex-1 rounded-lg" />
                    </div>
                </div>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <PageHeader 
            title="对标账号监控" 
            icon={Target}
            description="监控竞品动向，AI 自动拆解爆款策略。"
            action={
                <Link
                    to="/competitor/add"
                    className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <Plus size={18} className="mr-2" />
                    添加对标账号
                </Link>
            }
        />

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-4 max-w-2xl items-center">
            <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                    type="text"
                    placeholder="搜索昵称或 ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
            </div>
            <div className="relative w-full sm:w-48">
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="w-full appearance-none pl-4 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white"
                >
                    <option value="all">所有状态</option>
                    <option value="active">监控中</option>
                    <option value="pending">更新中</option>
                    <option value="error">更新失败</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
            </div>
            {/* Batch Select Toggle */}
            {filteredCompetitors.length > 0 && (
                <button 
                    onClick={handleSelectAll}
                    className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap
                        ${selectedIds.size === filteredCompetitors.length && filteredCompetitors.length > 0
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                    {selectedIds.size === filteredCompetitors.length ? '取消全选' : '全选'}
                </button>
            )}
        </div>



        {/* Batch Actions Bar (Floating) */}
        {selectedIds.size > 0 && (
            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white shadow-xl border border-gray-200 rounded-full px-6 py-3 flex items-center gap-4 z-40 animate-in slide-in-from-bottom-4 fade-in duration-300">
                <span className="text-sm font-bold text-gray-700">
                    已选择 {selectedIds.size} 项
                </span>
                <div className="h-4 w-px bg-gray-300"></div>
                <button 
                    onClick={handleBatchRefresh}
                    disabled={isBatchProcessing}
                    className="flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                >
                    <RefreshCw size={16} className={`mr-1.5 ${isBatchProcessing ? 'animate-spin' : ''}`} />
                    批量更新
                </button>
                <button 
                    onClick={handleBatchDelete}
                    disabled={isBatchProcessing}
                    className="flex items-center text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                    <Trash2 size={16} className="mr-1.5" />
                    批量删除
                </button>
                <button 
                    onClick={() => setSelectedIds(new Set())}
                    className="ml-2 text-gray-400 hover:text-gray-600"
                >
                    <X size={16} />
                </button>
            </div>
        )}

        {/* Competitors Grid */}
        {filteredCompetitors.length === 0 ? (
            <EmptyState
                title="暂无对标账号"
                description="添加对标账号，系统将自动监控其更新并拆解爆款策略。"
                icon={Target}
                action={
                    <Link
                        to="/competitor/add"
                        className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                    >
                        <Plus size={16} className="mr-2" />
                        添加第一个账号
                    </Link>
                }
                steps={[
                    { text: '复制小红书博主主页链接' },
                    { text: '粘贴链接并点击添加' },
                    { text: '系统自动抓取数据并分析' }
                ]}
                tip="支持批量添加，一次最多可添加 10 个对标账号"
            />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCompetitors.map((competitor) => (
              <div 
                key={competitor.id} 
                className={`bg-white rounded-xl shadow-sm border p-5 flex flex-col h-full hover:shadow-md transition-all relative group cursor-pointer
                    ${selectedIds.has(competitor.id) ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/10' : 'border-gray-200'}
                `}
                onClick={() => openAnalysis(competitor)}
              >
                {/* Selection Checkbox */}
                <div 
                    className="absolute top-3 left-3 z-10"
                    onClick={(e) => toggleSelection(competitor.id, e)}
                >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors
                        ${selectedIds.has(competitor.id) 
                            ? 'bg-indigo-600 border-indigo-600 text-white' 
                            : 'bg-white border-gray-300 text-transparent hover:border-indigo-400'
                        }`}
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                </div>

                {/* Header */}
                <div className="flex items-start justify-between mb-4 pl-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center overflow-hidden border border-indigo-100 flex-shrink-0">
                      {competitor.avatar ? (
                          <img src={competitor.avatar} alt={competitor.nickname} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                          <span className="text-indigo-600 font-bold text-lg">
                              {(competitor.nickname || 'U').charAt(0)}
                          </span>
                      )}
                    </div>
                    <div className="ml-3 min-w-0">
                      <h3 className="font-bold text-gray-900 line-clamp-1" title={competitor.nickname}>{competitor.nickname}</h3>
                      <div className="flex items-center mt-1 space-x-2">
                          {getStatusBadge(competitor.status, competitor.last_error)}
                      </div>
                    </div>
                  </div>
                  <button
                      onClick={() => confirmDelete(competitor.id)}
                      className="text-gray-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                      title="删除"
                  >
                      <Trash2 size={16} />
                  </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 mb-4 bg-gray-50 rounded-lg p-3">
                    <div className="text-center border-r border-gray-200">
                        <div className="text-xs text-gray-500 mb-1">粉丝数</div>
                        <div className="font-bold text-gray-900">{(competitor.fans_count || 0).toLocaleString()}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-gray-500 mb-1">笔记数</div>
                        <div className="font-bold text-gray-900">{(competitor.notes_count || 0).toLocaleString()}</div>
                    </div>
                </div>
                  
                {/* Analysis Preview */}
                {competitor.status === 'active' && competitor.analysis_result && !competitor.analysis_result.error ? (
                    <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-100 text-xs text-green-800 cursor-pointer hover:bg-green-100 transition-colors group" onClick={() => openAnalysis(competitor)}>
                        <div className="font-bold mb-1 flex items-center text-green-700">
                            <Lightbulb size={12} className="mr-1.5 fill-green-600 text-green-600"/> 
                            AI 策略分析
                        </div>
                        <div className="line-clamp-2 opacity-80 leading-relaxed group-hover:opacity-100">
                            {competitor.analysis_result.content_strategy || '点击查看详情'}
                        </div>
                    </div>
                ) : competitor.status === 'error' ? (
                    <div className="mb-4">
                        <FriendlyError 
                            error={competitor.friendlyError || {
                                title: '更新失败',
                                message: competitor.last_error || '未知错误',
                                suggestion: '请稍后重试，或检查账号状态',
                                severity: 'error'
                            }}
                            onRetry={() => handleRefresh(competitor.id, { stopPropagation: () => {} } as any)}
                        />
                    </div>
                ) : (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100 text-xs text-gray-500 flex items-center justify-center h-[72px]">
                        {['pending', 'processing', 'refreshing'].includes(competitor.status) ? (
                            <span className="flex items-center"><RefreshCw size={14} className="mr-2 animate-spin"/> 正在分析数据...</span>
                        ) : (
                            <span>暂无分析数据</span>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-auto pt-4 border-t border-gray-100">
                  <button
                    onClick={(e) => handleRefresh(competitor.id, e)}
                    disabled={['pending', 'processing', 'refreshing'].includes(competitor.status)}
                    className="flex-1 flex items-center justify-center px-3 py-2 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
                  >
                    <RefreshCw size={14} className={`mr-1.5 ${['pending', 'processing', 'refreshing'].includes(competitor.status) ? 'animate-spin' : ''}`} />
                    {['pending', 'processing', 'refreshing'].includes(competitor.status) ? '更新中' : '更新数据'}
                  </button>
                  <Link
                    to={`/competitor/${competitor.id}`}
                    className="flex-1 flex items-center justify-center px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
                  >
                    <BookOpen size={16} className="mr-1.5" />
                    查看详情
                  </Link>
                </div>
                
                {/* Last Updated */}
                <div className="mt-3 text-center">
                    <p className="text-[10px] text-gray-400 flex items-center justify-center">
                        <Clock size={10} className="mr-1" />
                        更新于 {competitor.last_updated ? formatDistanceToNow(new Date(competitor.last_updated), { addSuffix: true, locale: zhCN }) : '从未'}
                    </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Analysis Modal */}
        {selectedAnalysis && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
                    <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 flex items-center">
                                <Target className="mr-2 text-indigo-600" size={20}/> {selectedCompetitorName}
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">运营策略深度拆解报告</p>
                        </div>
                        <button onClick={() => setSelectedAnalysis(null)} className="text-gray-400 hover:text-gray-600 bg-white p-1.5 rounded-full border border-gray-200 hover:bg-gray-100 transition-colors"><X size={18}/></button>
                    </div>
                    
                    <div className="p-6 overflow-y-auto space-y-6 bg-white">
                        {selectedAnalysis.raw ? (
                            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                                {selectedAnalysis.raw}
                            </div>
                        ) : (
                            <>
                                {/* Strategy */}
                                <div className="bg-gradient-to-br from-indigo-50 to-white p-5 rounded-xl border border-indigo-100 shadow-sm">
                                    <h4 className="text-sm font-bold text-indigo-900 mb-3 flex items-center">
                                        <Lightbulb size={18} className="mr-2 text-indigo-600"/> 核心策略 (Content Strategy)
                                    </h4>
                                    <p className="text-gray-700 text-sm leading-relaxed">
                                        {selectedAnalysis.content_strategy || '分析中...'}
                                    </p>
                                </div>

                                {/* Keywords */}
                                <div>
                                    <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
                                        <Key size={18} className="mr-2 text-gray-500"/> 爆款关键词
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedAnalysis.keywords && typeof selectedAnalysis.keywords === 'string' ? selectedAnalysis.keywords.split(/[,，、]/).map((k: string, i: number) => (
                                            <span key={i} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-medium border border-gray-200">
                                                {k.trim()}
                                            </span>
                                        )) : <span className="text-gray-400 text-sm">无</span>}
                                    </div>
                                </div>

                                {/* Tips */}
                                <div className="bg-green-50 p-5 rounded-xl border border-green-100">
                                    <h4 className="text-sm font-bold text-green-900 mb-4 flex items-center">
                                        <TrendingUp size={18} className="mr-2 text-green-600"/> 抄作业建议 (Actionable Tips)
                                    </h4>
                                    {selectedAnalysis.strategies ? (
                                        <div className="space-y-3">
                                            {selectedAnalysis.strategies.map((strategy: any, index: number) => (
                                                <div key={index} className="bg-white p-4 rounded-lg border border-green-100 shadow-sm">
                                                    <div className="text-green-800 font-bold text-sm mb-2 flex items-start">
                                                        <span className="bg-green-100 text-green-600 rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2 flex-shrink-0 mt-0.5">{index + 1}</span>
                                                        {strategy.tip}
                                                    </div>
                                                    <div className="pl-7 space-y-1.5">
                                                        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                                            <span className="font-bold text-gray-700">推荐选题：</span>{strategy.suggested_topic}
                                                        </div>
                                                        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                                            <span className="font-bold text-gray-700">参考标题：</span>{strategy.suggested_title}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
                                            {selectedAnalysis.actionable_tips || '暂无建议'}
                                        </p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* Delete Confirmation Modal */}
        <Modal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            title="确认删除"
            footer={
                <div className="flex justify-end gap-3">
                    <button
                        onClick={() => setIsDeleteModalOpen(false)}
                        className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleDelete}
                        className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors shadow-sm"
                    >
                        确认删除
                    </button>
                </div>
            }
        >
            <div className="flex items-start p-2">
                <div className="bg-red-100 p-2 rounded-full mr-4 flex-shrink-0">
                    <AlertCircle className="text-red-600" size={24} />
                </div>
                <div>
                    <p className="text-gray-900 font-bold mb-1">您确定要删除该账号吗？</p>
                    <p className="text-gray-500 text-sm leading-relaxed">
                        删除后，该账号的监控数据、历史笔记抓取记录和 AI 分析报告将全部被清除，且无法恢复。
                    </p>
                </div>
            </div>
        </Modal>
    </div>
  );
}
