import React, { useState, useEffect } from 'react';
import { Loader2, RefreshCw, Flame, Eye, Heart, User, Sparkles, X, LayoutGrid, LayoutList, Trash2, Search, Calendar, MessageSquare, Star, Play, Download, Database, Wand2, Video, Image as ImageIcon } from 'lucide-react';
import { useSafeAsync } from '../hooks/useSafeAsync';
import axios from 'axios';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';

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

const ViralKnowledgeBase: React.FC = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list'); // Default to list for library
  const [notes, setNotes] = useState<TrendingNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selection & Batch Actions
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<number>>(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [deleteNoteId, setDeleteNoteId] = useState<number | null>(null);

  // Analysis Modal
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [currentNote, setCurrentNote] = useState<TrendingNote | null>(null);

  const { isMounted } = useSafeAsync();

  const fetchNotes = async (page = 1) => {
    setLoading(true);
    try {
      // Always fetch analyzed=true for this component
      // sort=updated_at DESC ensures latest analyzed items appear first
      let url = `/api/trending-notes?page=${page}&limit=${pagination.limit}&sort=updated_at&analyzed=true`;

      if (searchQuery) {
          url += `&search=${encodeURIComponent(searchQuery)}`;
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
      console.error('Failed to fetch knowledge base:', error);
      toast.error('获取爆款库失败');
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchNotes(1);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
      e.preventDefault();
      fetchNotes(1);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchNotes(1);
    setRefreshing(false);
  };

  // --- Batch Actions ---

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

  const handleBatchDelete = () => {
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
      XLSX.writeFile(wb, `爆款知识库_${new Date().toLocaleDateString()}.xlsx`);
      toast.success(`已导出 ${notesToExport.length} 条分析记录`);
  };

  // --- Single Item Actions ---

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

  const handleViewAnalysis = (note: TrendingNote) => {
      setCurrentNote(note);
      setShowAnalysisModal(true);
  };

  const handleRemix = (note: TrendingNote) => {
      if (!note.analysis_result) return;
      navigate('/generate', { 
        state: { 
            remixNote: {
                title: note.title,
                structure: note.analysis_result,
                type: note.type // Pass the note type correctly
            }
        } 
      });
      toast.success(`已引用结构：${note.title}`);
  };

  const handleExportSingleReport = () => {
    if (!currentNote || !currentNote.analysis_result) return;
    const analysis = currentNote.analysis_result;
    
    const report = `
【爆款笔记拆解报告】
来源：${currentNote.title}
作者：${currentNote.author_name}
类型：${currentNote.type === 'video' ? '视频笔记' : '图文笔记'}
分析时间：${new Date().toLocaleString()}

================================

1. ${currentNote.type === 'video' ? '🎬 视觉与分镜分析' : '🖼️ 视觉与排版分析'}
${analysis.visual_analysis || '（暂无视觉分析数据）'}

2. 🎣 钩子 (Hook)
[${analysis.hook_type}]
${analysis.hook_analysis}

3. ${currentNote.type === 'video' ? '🏗️ 脚本结构' : '🏗️ 图文结构'}
${analysis.structure_breakdown?.map((s: string, i: number) => `${i+1}. ${s}`).join('\n')}

4. 💖 情绪价值 (Tone)
${analysis.tone}

5. 💬 互动策略 (CTA)
${analysis.cta_strategy}

6. ✨ 仿写建议 (Remix Tips)
${analysis.remix_template}

================================
Generated by Little Red Ant AI
`;
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `爆款拆解_${currentNote.title.substring(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('报告已导出');
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="space-y-6">
       {/* Header / Toolbar */}
       <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="flex items-center text-lg font-bold text-gray-800">
                    <Database className="mr-2 text-indigo-600" />
                    我的爆款库
                    <span className="ml-2 text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {pagination.total}
                    </span>
                </div>
                
                {/* Search */}
                <form onSubmit={handleSearch} className="relative flex-1 md:w-64">
                    <input 
                        type="text" 
                        placeholder="搜索我的爆款..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-3 py-1.5 text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 w-full"
                    />
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                </form>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                 {/* Batch Ops */}
                 {selectedNoteIds.size > 0 && (
                      <div className="flex items-center gap-2 mr-2 border-r border-gray-200 pr-4 animate-in fade-in slide-in-from-right-4 duration-200">
                          <span className="text-xs text-gray-500">已选 {selectedNoteIds.size} 项</span>
                          <button 
                              onClick={handleBatchExportExcel}
                              className="flex items-center gap-1 text-sm bg-green-50 text-green-700 px-3 py-1.5 rounded-md hover:bg-green-100 transition-colors border border-green-200"
                          >
                              <Download size={14} />
                              导出Excel
                          </button>
                          <button 
                              onClick={handleBatchDelete}
                              className="flex items-center gap-1 text-sm bg-red-50 text-red-600 px-3 py-1.5 rounded-md hover:bg-red-100 transition-colors"
                          >
                              <Trash2 size={14} />
                              删除
                          </button>
                      </div>
                  )}

                  <button 
                      onClick={toggleSelectAll}
                      className="text-sm text-gray-600 hover:text-indigo-600 px-3 py-1.5 border border-gray-200 rounded-md"
                  >
                      {selectedNoteIds.size === notes.length && notes.length > 0 ? '取消全选' : '本页全选'}
                  </button>

                 {/* View Toggle */}
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
                  className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-50 rounded-md transition-colors"
                  title="刷新列表"
                >
                  <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                </button>
            </div>
       </div>

       {/* Content Area */}
       {loading && notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-lg border border-gray-100">
            <Loader2 className="animate-spin text-indigo-500 mb-4" size={32} />
            <p className="text-gray-500">正在加载知识库...</p>
          </div>
       ) : notes.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-lg border border-dashed border-gray-300">
            <Database className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">知识库为空</h3>
            <p className="text-gray-500 mb-4 mt-2">您还没有保存任何爆款分析。</p>
            <button 
              onClick={() => navigate('/gallery')}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              <Flame className="mr-2" size={16} />
              去发现爆款
            </button>
          </div>
       ) : (
          <>
            {viewMode === 'list' ? (
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-4 py-3 text-left w-10">
                                    <input 
                                        type="checkbox"
                                        checked={selectedNoteIds.size > 0 && selectedNoteIds.size === notes.length}
                                        onChange={toggleSelectAll}
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                </th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">
                                    笔记信息
                                </th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    钩子/亮点
                                </th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                                    数据表现
                                </th>
                                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                                    操作
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {notes.map(note => (
                                <tr key={note.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <input 
                                            type="checkbox"
                                            checked={selectedNoteIds.has(note.id)}
                                            onChange={() => toggleSelectNote(note.id)}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-start">
                                            <div className="h-16 w-24 flex-shrink-0 bg-gray-100 rounded overflow-hidden mr-4 relative border border-gray-100 group">
                                                {note.cover_url ? (
                                                    <img className="h-full w-full object-cover" src={note.cover_url} alt="" referrerPolicy="no-referrer" />
                                                ) : (
                                                    <div className="flex items-center justify-center h-full w-full text-xs text-gray-400">No Image</div>
                                                )}
                                                <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                                                    {note.type === 'video' ? (
                                                        <div className="bg-black/50 p-1.5 rounded-full">
                                                            <Play size={16} className="text-white fill-white" />
                                                        </div>
                                                    ) : (
                                                        <div className="bg-black/30 p-1.5 rounded-full">
                                                            <ImageIcon size={16} className="text-white" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                                        note.type === 'video' 
                                                            ? 'bg-purple-50 text-purple-600 border-purple-100' 
                                                            : 'bg-blue-50 text-blue-600 border-blue-100'
                                                    }`}>
                                                        {note.type === 'video' ? '视频' : '图文'}
                                                    </span>
                                                    <div className="text-sm font-medium text-gray-900 line-clamp-1" title={note.title}>
                                                        {note.title}
                                                    </div>
                                                </div>
                                                <div className="text-xs text-gray-500 flex items-center">
                                                    <User size={12} className="mr-1" />
                                                    {note.author_name}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        {note.analysis_result ? (
                                            <div className="text-sm">
                                                <div className="mb-1">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-800">
                                                        {note.analysis_result.hook_type || '未知钩子'}
                                                    </span>
                                                </div>
                                                <p className="text-gray-500 text-xs line-clamp-2" title={note.analysis_result.hook_analysis}>
                                                    {note.analysis_result.hook_analysis}
                                                </p>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 text-xs italic">数据解析中...</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <div className="text-xs text-gray-500 space-y-1">
                                            <div className="flex items-center"><Heart size={12} className="mr-1.5 text-red-400" /> {note.likes_count}</div>
                                            <div className="flex items-center"><Star size={12} className="mr-1.5 text-amber-400" /> {note.collects_count}</div>
                                            <div className="flex items-center"><MessageSquare size={12} className="mr-1.5 text-blue-400" /> {note.comments_count}</div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end gap-2">
                                            <button 
                                                onClick={() => handleViewAnalysis(note)}
                                                className="text-indigo-600 hover:text-indigo-900 flex items-center px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                                            >
                                                <Sparkles size={14} className="mr-1" />
                                                详情
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteClick(note.id)}
                                                className="text-gray-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {notes.map(note => (
                        <div key={note.id} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group relative">
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

                             {/* Cover Image */}
                            <div className="relative pt-[133%] bg-gray-100 overflow-hidden">
                                {note.cover_url ? (
                                    <img 
                                        src={note.cover_url} 
                                        alt={note.title} 
                                        referrerPolicy="no-referrer"
                                        className="absolute top-0 left-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                ) : (
                                    <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center text-gray-400">无封面</div>
                                )}
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8 flex items-center justify-between text-white text-xs font-medium">
                                    <span className="flex items-center"><Heart size={12} className="mr-1 fill-current" /> {note.likes_count}</span>
                                </div>
                            </div>

                            <div className="p-3">
                                <h4 className="text-sm font-bold text-gray-900 line-clamp-2 h-10 mb-2" title={note.title}>{note.title}</h4>
                                <div className="flex gap-2 mt-3">
                                    <button 
                                        onClick={() => handleViewAnalysis(note)}
                                        className="flex-1 py-1.5 flex justify-center items-center text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 rounded hover:bg-indigo-100 transition-colors"
                                    >
                                        <Sparkles size={12} className="mr-1" />
                                        分析详情
                                    </button>
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
       {showAnalysisModal && currentNote && currentNote.analysis_result && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-xl font-bold text-gray-900">
                            <Sparkles className="inline-block mr-2 text-indigo-600" size={24} />
                            爆款笔记拆解
                        </h3>
                        <button onClick={() => setShowAnalysisModal(false)} className="text-gray-400 hover:text-gray-600">
                            <X size={24} />
                        </button>
                    </div>
                    
                    <div className="space-y-4">
                        {/* Visual Report Section - New! */}
                        {currentNote.analysis_result.visual_analysis && (
                             <div className="bg-purple-50 p-4 rounded-md border border-purple-100">
                                <h4 className="font-medium text-purple-900 mb-2 flex items-center">
                                    {currentNote.type === 'video' ? <Video size={16} className="mr-2"/> : <ImageIcon size={16} className="mr-2"/>}
                                    {currentNote.type === 'video' ? '🎬 视觉与分镜分析' : '🖼️ 视觉与排版分析'}
                                </h4>
                                <div className="text-sm text-purple-800 whitespace-pre-wrap leading-relaxed bg-white/50 p-3 rounded border border-purple-100/50">
                                    {currentNote.analysis_result.visual_analysis}
                                </div>
                            </div>
                        )}

                        <div className="bg-gray-50 p-4 rounded-md">
                            <h4 className="font-medium text-gray-900 mb-2">🎣 钩子 (Hook)</h4>
                            <div className="text-sm text-gray-600">
                                <span className="font-semibold text-indigo-600">[{currentNote.analysis_result.hook_type}]</span> {currentNote.analysis_result.hook_analysis}
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-md">
                            <h4 className="font-medium text-gray-900 mb-2">
                                {currentNote.type === 'video' ? '🏗️ 脚本结构拆解' : '🏗️ 图文结构拆解'}
                            </h4>
                            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                                {currentNote.analysis_result.structure_breakdown?.map((item: string, i: number) => (
                                    <li key={i}>{item}</li>
                                ))}
                            </ul>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-50 p-4 rounded-md">
                                <h4 className="font-medium text-gray-900 mb-2">🎭 情绪价值</h4>
                                <p className="text-sm text-gray-600">{currentNote.analysis_result.tone}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-md">
                                <h4 className="font-medium text-gray-900 mb-2">💬 互动策略</h4>
                                <p className="text-sm text-gray-600">{currentNote.analysis_result.cta_strategy}</p>
                            </div>
                        </div>

                            <div className="bg-indigo-50 p-4 rounded-md border border-indigo-100">
                                <h4 className="font-medium text-indigo-900 mb-2">✨ 仿写建议</h4>
                                <p className="text-sm text-indigo-800 whitespace-pre-wrap">{currentNote.analysis_result.remix_template}</p>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-gray-100">
                            <button 
                                onClick={handleExportSingleReport}
                                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 flex items-center"
                            >
                                <Download size={16} className="mr-2" />
                                导出报告
                            </button>
                            <button 
                                onClick={() => setShowAnalysisModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                            >
                                关闭
                            </button>
                            <button 
                                onClick={() => {
                                    handleRemix(currentNote);
                                    setShowAnalysisModal(false);
                                }}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center"
                            >
                                <Wand2 size={16} className="mr-2" />
                                {currentNote.type === 'video' ? '使用此结构生成脚本' : '使用此结构仿写笔记'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
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

export default ViralKnowledgeBase;
