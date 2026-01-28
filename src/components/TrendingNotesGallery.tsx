import React, { useState, useEffect } from 'react';
import { Loader2, RefreshCw, Flame, Eye, Heart, User, ExternalLink, Wand2, Sparkles, X, LayoutGrid, LayoutList, Trash2, Search, Calendar, MessageSquare, Star, Play, Download, Database } from 'lucide-react';
import { useSafeAsync } from '../hooks/useSafeAsync';
import axios from 'axios';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface TrendingNote {
  id: number;
  note_id: string;
  title: string;
  cover_url: string;
  author_name: string;
  likes_count: number;
  comments_count: number;
  collects_count: number;
  note_url: string;
  scraped_at: string;
  content: string;
  type?: 'video' | 'image';
  transcript?: string;
  video_url?: string;
  analysis_result?: any;
}

interface TrendingNotesGalleryProps {
  onSelect?: (note: TrendingNote) => void;
  initialTab?: string;
}

const TrendingNotesGallery: React.FC<TrendingNotesGalleryProps> = ({ onSelect, initialTab = 'recommend' }) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState<string>(initialTab);
  const [notes, setNotes] = useState<TrendingNote[]>([]);
  
  const CATEGORIES = [
    { id: 'recommend', name: '推荐' },
    { id: 'video', name: '视频' },
    { id: 'fashion', name: '穿搭' },
      { id: 'beauty', name: '美妆' },
      { id: 'food', name: '美食' },
      { id: 'home', name: '家居' },
      { id: 'travel', name: '旅行' },
      { id: 'tech', name: '数码' },
      { id: 'emotion', name: '情感' },
      { id: 'baby', name: '母婴' },
      { id: 'movie', name: '影视' },
      { id: 'knowledge', name: '知识' },
      { id: 'game', name: '游戏' },
      { id: 'fitness', name: '运动' },
      { id: 'career', name: '职场' },
      { id: 'pets', name: '萌宠' },
      { id: 'photography', name: '摄影' },
      { id: 'art', name: '艺术' },
      { id: 'music', name: '音乐' },
      { id: 'books', name: '读书' },
      { id: 'automobile', name: '汽车' },
      { id: 'wedding', name: '婚嫁' },
      { id: 'outdoors', name: '户外' },
      { id: 'acg', name: '二次元' },
      { id: 'sports', name: '体育' },
      { id: 'news', name: '热点' },
  ];

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0 });
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<any>(null);
  const [currentNote, setCurrentNote] = useState<TrendingNote | null>(null);
  const [deleteNoteId, setDeleteNoteId] = useState<number | null>(null);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<number>>(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Use safeRequest from hook if needed, or just use isMounted for simple effects
  const { isMounted } = useSafeAsync();

  const handleBatchExportExcel = () => {
      const notesToExport = notes.filter(n => selectedNoteIds.has(n.id));
      if (notesToExport.length === 0) {
          toast.error('请先选择要导出的笔记');
          return;
      }

      const data = notesToExport.map(n => {
          const analysis = n.analysis_result || {};
          return {
              '标题': n.title,
              '作者': n.author_name,
              '链接': n.note_url,
              '点赞数': n.likes_count,
              '钩子类型': analysis.hook_type || '',
              '钩子分析': analysis.hook_analysis || '',
              '情绪价值': analysis.tone || '',
              '互动策略': analysis.cta_strategy || '',
              '仿写建议': analysis.remix_template || '',
              '分析时间': new Date().toLocaleDateString()
          };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "爆款分析");
      XLSX.writeFile(wb, `爆款分析库_${new Date().toLocaleDateString()}.xlsx`);
      toast.success(`已导出 ${notesToExport.length} 条分析记录`);
  };

  const fetchNotes = async (page = 1) => {
    setLoading(true);
    try {
      // Default sort by likes_count now
      let url = `/api/trending-notes?page=${page}&limit=${pagination.limit}&sort=likes_count`;
      
      if (selectedCategory === 'analyzed') {
          url += '&analyzed=true';
      } else {
          url += `&category=${selectedCategory}`;
      }

      if (searchQuery) {
          url += `&search=${encodeURIComponent(searchQuery)}`;
      }
      if (selectedDate) {
          url += `&date=${selectedDate}`;
      }

      const response = await axios.get(url);
      if (isMounted.current) {
        const data = response.data;
        if (data.data) {
            setNotes(data.data);
            setPagination(prev => ({ ...prev, page, total: data.pagination.total }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch trending notes:', error);
      // toast.error('获取热门笔记失败'); // Optional
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchNotes(1);
  }, [selectedCategory, selectedDate]); // Trigger on category or date change

  const handleSearch = (e: React.FormEvent) => {
      e.preventDefault();
      fetchNotes(1);
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await axios.post('/api/trending-notes/scrape', { category: selectedCategory });
      const { taskId } = res.data;
      
      if (taskId) {
          const toastId = toast.loading(`正在获取${CATEGORIES.find(c => c.id === selectedCategory)?.name || ''}领域的最新数据...`);
          
          // Poll for completion
          let attempts = 0;
          let taskStatus = 'PENDING';
          
          while (attempts < 60) { // Max 2 mins
              await new Promise(r => setTimeout(r, 2000));
              
              try {
                  const taskRes = await axios.get(`/api/tasks/${taskId}`);
                  taskStatus = taskRes.data.status;
                  
                  if (taskStatus === 'COMPLETED') {
                      toast.success('抓取完成，列表已更新', { id: toastId });
                      await fetchNotes(1);
                      return;
                  } else if (taskStatus === 'FAILED') {
                      toast.error('抓取任务失败', { id: toastId });
                      return;
                  }
              } catch (e) {
                  // Ignore poll errors
              }
              attempts++;
          }
          toast.dismiss(toastId);
          toast.error('任务超时，请手动刷新');
      } else {
          toast.success(`正在获取${CATEGORIES.find(c => c.id === selectedCategory)?.name}领域的最新数据...`);
          setTimeout(() => {
            if (isMounted.current) fetchNotes(1);
          }, 3000);
      }
    } catch (error) {
      console.error('Failed to trigger scrape', error);
      toast.error('启动抓取失败');
    } finally {
      if (isMounted.current) {
        setRefreshing(false);
      }
    }
  };

  const handleDeleteClick = (id: number) => {
      setDeleteNoteId(id);
  };

  const confirmDelete = async () => {
      if (!deleteNoteId) return;
      try {
          await axios.delete(`/api/trending-notes/${deleteNoteId}`);
          setNotes(prev => prev.filter(n => n.id !== deleteNoteId));
          toast.success('删除成功');
      } catch(e) {
          toast.error('删除失败');
      } finally {
          setDeleteNoteId(null);
      }
  };

  const handleRefreshNote = async (id: number) => {
      try {
          await axios.post(`/api/trending-notes/${id}/refresh`);
          toast.success('已触发更新，请稍后刷新');
      } catch(e) {
          toast.error('更新失败');
      }
  };

  const toggleSelectNote = (id: number) => {
      const newSelected = new Set(selectedNoteIds);
      if (newSelected.has(id)) {
          newSelected.delete(id);
      } else {
          newSelected.add(id);
      }
      setSelectedNoteIds(newSelected);
  };

  const toggleSelectAll = () => {
      if (selectedNoteIds.size === notes.length && notes.length > 0) {
          setSelectedNoteIds(new Set());
      } else {
          setSelectedNoteIds(new Set(notes.map(n => n.id)));
      }
  };

  const handleBatchDelete = async () => {
      if (selectedNoteIds.size === 0) return;
      setIsBatchDeleting(true);
  };

  const confirmBatchDelete = async () => {
      try {
          const ids = Array.from(selectedNoteIds);
          await axios.post('/api/trending-notes/batch-delete', { ids });
          setNotes(prev => prev.filter(n => !selectedNoteIds.has(n.id)));
          setSelectedNoteIds(new Set());
          toast.success(`成功删除 ${ids.length} 条笔记`);
      } catch (e) {
          toast.error('批量删除失败');
      } finally {
          setIsBatchDeleting(false);
      }
  };

  const handleAnalyze = async (note: TrendingNote) => {
      if (note.analysis_result) {
          setCurrentNote(note);
          setCurrentAnalysis(note.analysis_result);
          setShowAnalysisModal(true);
          return;
      }

      setAnalyzingId(note.note_id);
      try {
          // Show immediate feedback
          const toastId = toast.loading('正在进行深度分析（抓取正文+AI拆解），请稍候...');
          
          const res = await axios.post(`/api/trending-notes/${note.note_id}/analyze`);
          const { taskId, status, result } = res.data;

          if (status === 'COMPLETED') {
              // Already done
              setCurrentNote(note);
              setCurrentAnalysis(result);
              setShowAnalysisModal(true);
              toast.success('分析完成！', { id: toastId });
          } else {
              // Poll for result with better feedback
              let attempts = 0;
              const maxAttempts = 60; // Increased timeout to 120s
              
              while (attempts < maxAttempts) {
                  await new Promise(r => setTimeout(r, 2000));
                  attempts++;
                  
                  // Update progress every 5 attempts
                  if (attempts % 5 === 0) {
                      toast.loading(`正在分析中... (${attempts * 2}秒)`, { id: toastId });
                  }
                  
                  const taskRes = await axios.get(`/api/tasks/${taskId}`);
                  if (taskRes.data.status === 'COMPLETED') {
                      setCurrentNote(note);
                      setCurrentAnalysis(taskRes.data.result.analysis);
                      setShowAnalysisModal(true);
                      toast.success('分析完成！', { id: toastId });
                      fetchNotes(pagination.page); // Refresh list to show analyzed status
                      break;
                  } else if (taskRes.data.status === 'FAILED') {
                      throw new Error(taskRes.data.error || '分析失败，请稍后重试');
                  }
              }
              
              if (attempts >= maxAttempts) {
                  throw new Error('分析超时，请稍后重试');
              }
          }
      } catch (error: any) {
          toast.dismiss(); // Clear pending toasts
          console.error('Analysis failed:', error);
          
          // Provide more user-friendly error messages
          let errorMessage = '分析失败';
          if (error.message.includes('无法获取笔记内容')) {
              errorMessage = '无法获取笔记内容，可能是网络问题或笔记已被删除';
          } else if (error.message.includes('timeout') || error.message.includes('超时')) {
              errorMessage = '分析耗时较长，请稍后在任务中心查看结果';
          } else if (error.message.includes('Anti-bot')) {
              errorMessage = '遇到反爬虫验证，请稍后重试';
          } else {
              errorMessage = error.message || '分析失败，请稍后重试';
          }
          
          toast.error(errorMessage);
      } finally {
          setAnalyzingId(null);
      }
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  const handleExportAnalysis = () => {
      if (!currentAnalysis || !currentNote) return;

      const report = `
【爆款笔记拆解报告】
来源：${currentNote.title}
作者：${currentNote.author_name}
分析时间：${new Date().toLocaleString()}

================================

1. 🎣 钩子 (Hook)
[${currentAnalysis.hook_type}]
${currentAnalysis.hook_analysis}

2. 🏗️ 结构拆解 (Structure)
${currentAnalysis.structure_breakdown?.map((s: string, i: number) => `${i+1}. ${s}`).join('\n')}

3. 💖 情绪价值 (Tone)
${currentAnalysis.tone}

4. 💬 互动策略 (CTA)
${currentAnalysis.cta_strategy}

5. ✨ 仿写建议 (Remix Tips)
${currentAnalysis.remix_template}

================================
Generated by Little Red Ant AI
`;

      const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `爆款拆解_${currentNote.title.substring(0, 10)}_${Date.now()}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('分析报告已导出');
  };

  return (
    <div className="mt-6">
      {/* Categories Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex flex-wrap gap-2 flex-1">
            {CATEGORIES.map(category => (
            <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-3 py-1.5 text-sm rounded-full transition-colors flex items-center ${
                selectedCategory === category.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
                {(category as any).icon}
                {category.name}
            </button>
            ))}
          </div>
      </div>

      {/* Filters & Actions Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
        
        {/* Left: Search & Date */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <form onSubmit={handleSearch} className="relative">
                <input 
                    type="text" 
                    placeholder="搜索标题、内容或作者..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-1.5 text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 w-full sm:w-64"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
            </form>

            <div className="relative">
                <input 
                    type="date" 
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="pl-9 pr-3 py-1.5 text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
            </div>
        </div>

        {/* Right: View Mode & Actions */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            {/* Batch Actions */}
            {notes.length > 0 && (
              <div className="flex items-center gap-2 mr-2 border-r border-gray-200 pr-4">
                  <button 
                      onClick={toggleSelectAll}
                      className="text-sm text-gray-600 hover:text-indigo-600 px-2 py-1"
                  >
                      {selectedNoteIds.size === notes.length ? '取消' : '全选'}
                  </button>
                  {selectedNoteIds.size > 0 && (
                      <div className="flex items-center gap-2">
                          {selectedCategory === 'analyzed' && (
                              <button 
                                  onClick={handleBatchExportExcel}
                                  className="flex items-center gap-1 text-sm bg-green-50 text-green-700 px-3 py-1.5 rounded-md hover:bg-green-100 transition-colors border border-green-200"
                              >
                                  <Download size={14} />
                                  导出Excel ({selectedNoteIds.size})
                              </button>
                          )}
                          <button 
                              onClick={handleBatchDelete}
                              className="flex items-center gap-1 text-sm bg-red-50 text-red-600 px-3 py-1.5 rounded-md hover:bg-red-100 transition-colors"
                          >
                              <Trash2 size={14} />
                              删除 ({selectedNoteIds.size})
                          </button>
                      </div>
                  )}
              </div>
            )}

            <div className="flex bg-gray-100 p-1 rounded-md">
                <button 
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    title="卡片视图"
                >
                    <LayoutGrid size={16} />
                </button>
                <button 
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    title="列表视图"
                >
                    <LayoutList size={16} />
                </button>
            </div>
            
            <button 
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:bg-indigo-400 transition-colors whitespace-nowrap"
            >
              <RefreshCw size={16} className={`mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? '获取中...' : '获取最新'}
            </button>
        </div>
      </div>

      {loading && notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="animate-spin text-indigo-500 mb-4" size={32} />
          <p className="text-gray-500">加载热门笔记中...</p>
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <Flame className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">暂无热门笔记数据</p>
          <button 
            onClick={handleRefresh}
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            点击获取最新数据
          </button>
        </div>
      ) : (
        <>
          {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {notes.map(note => (
              <div key={note.id} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group">
                {/* Cover Image */}
                <div className="relative pt-[133%] bg-gray-100 overflow-hidden">
                  {/* Selection Checkbox */}
                  <div className="absolute top-2 left-2 z-30">
                      <input 
                          type="checkbox"
                          checked={selectedNoteIds.has(note.id)}
                          onChange={(e) => {
                              e.stopPropagation();
                              toggleSelectNote(note.id);
                          }}
                          className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 shadow-sm"
                      />
                  </div>

                  {/* Fallback (Always rendered behind) */}
                  <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center text-gray-400 z-0">
                      无封面
                  </div>
                  
                  {note.cover_url && (
                    <img 
                      src={note.cover_url} 
                      alt={note.title} 
                      referrerPolicy="no-referrer"
                      className="absolute top-0 left-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 z-10"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  
                  {/* Video Icon */}
                  {note.type === 'video' && (
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/40 rounded-full p-2 z-10 pointer-events-none">
                          <Play size={20} className="text-white fill-white pl-0.5" />
                      </div>
                  )}

                  {/* Likes Overlay (z-20 to be on top of image) */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8 flex items-center justify-between text-white text-xs font-medium z-20">
                    <div className="flex items-center gap-2">
                        <span className="flex items-center"><Heart size={12} className="mr-1 fill-current" /> {note.likes_count > 10000 ? `${(note.likes_count / 10000).toFixed(1)}w` : note.likes_count}</span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-3">
                  <h4 className="text-sm font-bold text-gray-900 line-clamp-2 h-10 mb-2" title={note.title}>
                    {note.title}
                  </h4>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <div className="flex items-center overflow-hidden">
                      <User size={12} className="mr-1 flex-shrink-0" />
                      <span className="truncate max-w-[80px]">{note.author_name || '未知作者'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                        <span className="flex items-center" title="收藏">
                            <Star size={10} className="mr-0.5" /> 
                            {note.collects_count === -1 ? '-' : (note.collects_count > 10000 ? `${(note.collects_count / 10000).toFixed(1)}w` : note.collects_count)}
                        </span>
                        <span className="flex items-center" title="评论">
                            <MessageSquare size={10} className="mr-0.5" /> 
                            {note.comments_count === -1 ? '-' : (note.comments_count > 10000 ? `${(note.comments_count / 10000).toFixed(1)}w` : note.comments_count)}
                        </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5 items-center">
                    <button 
                      onClick={() => handleAnalyze(note)}
                      disabled={analyzingId === note.note_id}
                      className="flex-1 py-1.5 flex justify-center items-center text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 rounded hover:bg-indigo-100 transition-colors font-medium"
                    >
                      {analyzingId === note.note_id ? (
                          <Loader2 size={12} className="animate-spin mr-1" />
                      ) : (
                          <Sparkles size={12} className="mr-1" />
                      )}
                      {note.analysis_result ? '查看分析' : '深度分析'}
                    </button>
                    
                    <button
                        onClick={() => handleRefreshNote(note.id)}
                        className="w-7 h-7 flex justify-center items-center text-gray-500 hover:text-indigo-600 hover:bg-gray-50 rounded border border-transparent hover:border-gray-200 transition-all"
                        title="更新数据"
                    >
                        <RefreshCw size={13} />
                    </button>
                    
                    <a 
                      href={note.note_url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="w-7 h-7 flex justify-center items-center text-gray-500 hover:text-indigo-600 hover:bg-gray-50 rounded border border-transparent hover:border-gray-200 transition-all"
                      title="查看原文"
                    >
                      <Eye size={13} />
                    </a>

                    <button
                        onClick={() => handleDeleteClick(note.id)}
                        className="w-7 h-7 flex justify-center items-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-100 transition-all"
                        title="删除"
                    >
                        <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          ) : (
            <div className="space-y-4">
                {notes.map(note => (
                    <div key={note.id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 flex gap-4 hover:shadow-md transition-shadow">
                        {/* Image */}
                        <div className="w-40 h-28 flex-shrink-0 relative bg-gray-100 rounded overflow-hidden">
                            {/* Selection Checkbox */}
                            <div className="absolute top-2 left-2 z-30">
                                <input 
                                    type="checkbox"
                                    checked={selectedNoteIds.has(note.id)}
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        toggleSelectNote(note.id);
                                    }}
                                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 shadow-sm"
                                />
                            </div>

                            <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center text-gray-400 z-0 bg-slate-50">
                                <Database size={20} className="mb-1 opacity-20" />
                                <span className="text-[8px] uppercase tracking-widest opacity-40">No Cover</span>
                            </div>
                            {note.cover_url && (
                              <img 
                                src={note.cover_url.startsWith('http://') ? note.cover_url.replace('http://', 'https://') : note.cover_url} 
                                alt={note.title} 
                                referrerPolicy="no-referrer" 
                                className="absolute top-0 left-0 w-full h-full object-cover z-10" 
                                onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                              />
                            )}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0 flex flex-col">
                            <div className="flex justify-between items-start">
                                <h4 className="text-base font-bold text-gray-900 line-clamp-1 mb-1">{note.title}</h4>
                                <div className="flex items-center text-xs text-gray-500 gap-3">
                                    <span className="flex items-center"><Heart size={12} className="mr-1" /> {note.likes_count}</span>
                                    <span className="flex items-center"><User size={12} className="mr-1" /> {note.author_name}</span>
                                </div>
                            </div>
                            <p className="text-sm text-gray-500 line-clamp-2 mb-auto mt-1">{note.content || note.title}</p>
                            
                            <div className="flex items-center justify-between mt-3">
                                <div className="flex items-center gap-2">
                                  {note.analysis_result && (
                                      <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded text-xs flex items-center">
                                          <Sparkles size={10} className="mr-1" /> 已分析
                                      </span>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleAnalyze(note)} disabled={analyzingId === note.note_id} className="px-3 py-1.5 flex items-center text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 rounded hover:bg-indigo-100 transition-colors">
                                        {analyzingId === note.note_id ? <Loader2 size={12} className="animate-spin mr-1" /> : <Sparkles size={12} className="mr-1" />}
                                        {note.analysis_result ? '查看分析' : '深度分析'}
                                    </button>
                                    <button onClick={() => handleRefreshNote(note.id)} className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-50 rounded" title="更新"><RefreshCw size={14} /></button>
                                    <a href={note.note_url} target="_blank" rel="noreferrer" className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-50 rounded" title="查看原文"><Eye size={14} /></a>
                                    <button onClick={() => handleDeleteClick(note.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="删除"><Trash2 size={14} /></button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
          )}
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-8 space-x-2">
              <button
                onClick={() => fetchNotes(Math.max(1, pagination.page - 1))}
                disabled={pagination.page === 1}
                className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                上一页
              </button>
              <span className="px-3 py-1 text-sm text-gray-600 flex items-center">
                {pagination.page} / {totalPages}
              </span>
              <button
                onClick={() => fetchNotes(Math.min(totalPages, pagination.page + 1))}
                disabled={pagination.page === totalPages}
                className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}

      {/* Analysis Modal */}
      {showAnalysisModal && currentAnalysis && (
        <NoteAnalysisModal
            note={currentNote}
            analysis={currentAnalysis}
            onClose={() => setShowAnalysisModal(false)}
            onSelect={(note) => {
                if (onSelect) onSelect({ ...note, analysis_result: currentAnalysis });
            }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteNoteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
                <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                    <Trash2 className="text-red-600" size={24} />
                </div>
                <h3 className="text-lg font-medium text-center text-gray-900 mb-2">确认删除?</h3>
                <p className="text-sm text-center text-gray-500 mb-6">
                    您确定要删除这条笔记吗？此操作无法撤销。
                </p>
                <div className="flex justify-end space-x-3">
                    <button 
                        onClick={() => setDeleteNoteId(null)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 w-full"
                    >
                        取消
                    </button>
                    <button 
                        onClick={confirmDelete}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 w-full"
                    >
                        确认删除
                    </button>
                </div>
            </div>
        </div>
      )}
      {/* Batch Delete Confirmation Modal */}
      {isBatchDeleting && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
                <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                    <Trash2 className="text-red-600" size={24} />
                </div>
                <h3 className="text-lg font-medium text-center text-gray-900 mb-2">确认批量删除?</h3>
                <p className="text-sm text-center text-gray-500 mb-6">
                    您确定要删除选中的 {selectedNoteIds.size} 条笔记吗？此操作无法撤销。
                </p>
                <div className="flex justify-end space-x-3">
                    <button 
                        onClick={() => setIsBatchDeleting(false)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 w-full"
                    >
                        取消
                    </button>
                    <button 
                        onClick={confirmBatchDelete}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 w-full"
                    >
                        确认删除
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default TrendingNotesGallery;
