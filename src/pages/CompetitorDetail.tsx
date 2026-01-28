
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    ArrowLeft, Target, RefreshCw, AlertTriangle, Lightbulb, Key, TrendingUp, 
    BookOpen, ExternalLink, Calendar, Heart, Clock, CheckCircle2, Search, Filter, Wand2,
    Sparkles, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow, format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import PageLoading from '../components/PageLoading';
import EmptyState from '../components/EmptyState';
import NoteAnalysisModal from '../components/NoteAnalysisModal';

interface CompetitorDetailData {
    id: number;
    user_id: string;
    nickname: string;
    avatar?: string;
    fans_count: number;
    notes_count: number;
    description: string;
    last_updated: string;
    status: string;
    analysis_result: any;
    notes: any[];
    stats_history: any[];
}

export default function CompetitorDetail() {
    const { id } = useParams<{ id: string }>();
    const [data, setData] = useState<CompetitorDetailData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    // Notes Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'likes' | 'date'>('likes');

    // Chart State
    const [chartMetric, setChartMetric] = useState<'fans' | 'likes'>('fans');
    const navigate = useNavigate();

    useEffect(() => {
        if (id) fetchDetail();
    }, [id]);

    const fetchDetail = async () => {
        try {
            const res = await axios.get(`/api/competitors/${id}`);
            if (res.data.success) {
                setData(res.data.data);
            } else {
                toast.error('获取详情失败');
            }
        } catch (e) {
            console.error(e);
            toast.error('网络错误');
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        if (!data) return;
        setRefreshing(true);
        try {
            await axios.post(`/api/competitors/analyze`, { 
                url: `https://www.xiaohongshu.com/user/profile/${data.user_id}` 
            });
            toast.success('已加入更新队列');
            // Wait a bit then refresh status
            setTimeout(fetchDetail, 2000);
        } catch(e) {
            toast.error('启动更新失败');
        } finally {
            setRefreshing(false);
        }
    };

    if (loading) return <PageLoading message="加载详情中..." />;
    if (!data) return <EmptyState title="未找到数据" description="该账号不存在或已被删除" icon={AlertTriangle} />;

    // Prepare Chart Data (Deduplicate by date)
    const chartDataMap = new Map();
    data.stats_history?.forEach(h => {
        const dateStr = format(new Date(h.record_date), 'MM-dd');
        // Always keep the latest record for the day
        chartDataMap.set(dateStr, {
            date: dateStr,
            fans: h.fans_count,
            likes: h.likes_count
        });
    });
    const chartData = Array.from(chartDataMap.values());

    // Chart State (Removed duplicate declaration)
    // const [chartMetric, setChartMetric] = useState<'fans' | 'likes'>('fans');

    // Filter & Sort Notes
    const filteredNotes = (data.notes || [])
        .filter(n => n.title.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => {
            if (sortBy === 'likes') return b.likes - a.likes;
            // Date sort (fallback to ID if date missing)
            if (a.publish_date && b.publish_date) {
                 return new Date(b.publish_date).getTime() - new Date(a.publish_date).getTime();
            }
            return b.id - a.id;
        });

    return (
        <div className="space-y-6">
            {/* Header / Nav */}
            <div className="flex items-center justify-between">
                <Link to="/competitor" className="text-gray-500 hover:text-gray-900 flex items-center transition-colors">
                    <ArrowLeft size={20} className="mr-1" /> 返回列表
                </Link>
                <div className="text-sm text-gray-400">
                    最后更新: {formatDistanceToNow(new Date(data.last_updated), { addSuffix: true, locale: zhCN })}
                </div>
            </div>

            {/* Profile Card & Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Profile Info */}
                <div className="lg:col-span-1 bg-white rounded-xl p-6 border border-gray-200 shadow-sm flex flex-col">
                    <div className="flex items-center mb-6">
                        <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center overflow-hidden border-2 border-indigo-100 mr-4">
                             {data.avatar ? (
                                <img src={data.avatar} alt={data.nickname} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                                <span className="text-indigo-600 font-bold text-2xl">{data.nickname.charAt(0)}</span>
                            )}
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">{data.nickname}</h1>
                            <p className="text-gray-500 text-sm mt-1 flex items-center">
                                ID: {data.user_id}
                                <a href={`https://www.xiaohongshu.com/user/profile/${data.user_id}`} target="_blank" rel="noreferrer" className="ml-2 text-indigo-400 hover:text-indigo-600">
                                    <ExternalLink size={14} />
                                </a>
                            </p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-gray-50 p-3 rounded-lg text-center">
                            <div className="text-xs text-gray-500 mb-1">粉丝总数</div>
                            <div className="text-lg font-bold text-gray-900">{data.fans_count.toLocaleString()}</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg text-center">
                            <div className="text-xs text-gray-500 mb-1">笔记总数</div>
                            <div className="text-lg font-bold text-gray-900">{data.notes_count.toLocaleString()}</div>
                        </div>
                    </div>

                    <div className="mt-auto">
                        <button 
                            onClick={handleRefresh}
                            disabled={refreshing || ['pending', 'processing', 'refreshing'].includes(data.status)}
                            className="w-full py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <RefreshCw size={18} className={`mr-2 ${refreshing || ['pending', 'processing', 'refreshing'].includes(data.status) ? 'animate-spin' : ''}`} />
                            {['pending', 'processing', 'refreshing'].includes(data.status) ? '正在更新...' : '立即更新数据'}
                        </button>
                    </div>
                </div>

                {/* Charts */}
                <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-gray-900 flex items-center">
                            <TrendingUp size={18} className="mr-2 text-indigo-600" />
                            数据趋势 (近30天)
                        </h3>
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button 
                                onClick={() => setChartMetric('fans')}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${chartMetric === 'fans' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                粉丝趋势
                            </button>
                            <button 
                                onClick={() => setChartMetric('likes')}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${chartMetric === 'likes' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                获赞趋势
                            </button>
                        </div>
                    </div>

                    {chartData.length > 1 ? (
                        <div className="h-64 w-full">
                             <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="date" tick={{fontSize: 12, fill: '#9CA3AF'}} axisLine={false} tickLine={false} />
                                    <YAxis tick={{fontSize: 12, fill: '#9CA3AF'}} axisLine={false} tickLine={false} />
                                    <Tooltip 
                                        contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}
                                        itemStyle={{color: '#4B5563', fontSize: '12px'}}
                                    />
                                    {chartMetric === 'fans' ? (
                                        <Line type="monotone" dataKey="fans" stroke="#4F46E5" strokeWidth={2} dot={{r: 4, fill: '#4F46E5'}} activeDot={{r: 6}} name="粉丝数" animationDuration={500} />
                                    ) : (
                                        <Line type="monotone" dataKey="likes" stroke="#EC4899" strokeWidth={2} dot={{r: 4, fill: '#EC4899'}} activeDot={{r: 6}} name="获赞数" animationDuration={500} />
                                    )}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-64 flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                            <TrendingUp size={32} className="mb-2 opacity-50" />
                            <p className="text-sm">暂无足够历史数据，请持续监控</p>
                        </div>
                    )}
                </div>
            </div>

            {/* AI Analysis Report */}
            {data.analysis_result && !data.analysis_result.error && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
                        <h3 className="font-bold text-gray-900 flex items-center">
                            <Lightbulb size={18} className="mr-2 text-indigo-600" />
                            AI 深度策略拆解
                        </h3>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h4 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">核心策略</h4>
                            <p className="text-gray-800 leading-relaxed bg-indigo-50/50 p-4 rounded-lg border border-indigo-50">
                                {data.analysis_result.content_strategy || '分析中...'}
                            </p>
                            
                            <h4 className="text-sm font-bold text-gray-500 mt-6 mb-3 uppercase tracking-wider">爆款关键词</h4>
                            <div className="flex flex-wrap gap-2">
                                {data.analysis_result.keywords && typeof data.analysis_result.keywords === 'string' 
                                    ? data.analysis_result.keywords.split(/[,，、]/).map((k: string, i: number) => (
                                        <span key={i} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-medium border border-gray-200">
                                            {k.trim()}
                                        </span>
                                    )) 
                                    : <span className="text-gray-400 text-sm">无</span>
                                }
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-bold text-green-600 mb-3 uppercase tracking-wider flex items-center">
                                <CheckCircle2 size={14} className="mr-1.5" /> 
                                抄作业建议
                            </h4>
                            <div className="space-y-3">
                                {data.analysis_result.strategies?.map((strategy: any, index: number) => (
                                    <div key={index} className="bg-white p-3 rounded-lg border border-green-100 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="text-green-800 font-bold text-sm mb-1.5">
                                            {index + 1}. {strategy.tip}
                                        </div>
                                        <div className="text-xs text-gray-500 pl-4 border-l-2 border-green-100 ml-1 mb-2">
                                            推荐选题：{strategy.suggested_topic}
                                        </div>
                                        <button 
                                            onClick={() => navigate('/generate', { 
                                                state: { 
                                                    topic: strategy.suggested_topic,
                                                    style: strategy.tip, // Pass strategy tip as style hint
                                                    remix_structure: {
                                                        // Pass the full strategy context to help AI understand
                                                        hook_type: "基于竞品分析",
                                                        hook_analysis: strategy.tip,
                                                        structure_breakdown: [
                                                            `参考竞品: ${data.nickname}`,
                                                            `核心策略: ${data.analysis_result.content_strategy}`,
                                                            `关键词: ${data.analysis_result.keywords}`
                                                        ],
                                                        cta_strategy: "引导评论互动"
                                                    },
                                                    fromAnalysis: true
                                                } 
                                            })}
                                            className="w-full py-1.5 bg-green-50 text-green-700 text-xs font-medium rounded hover:bg-green-100 transition-colors flex items-center justify-center"
                                        >
                                            <Wand2 size={12} className="mr-1" /> 使用此策略一键创作
                                        </button>
                                    </div>
                                )) || <p className="text-gray-400 text-sm">暂无建议</p>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Notes Grid */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h3 className="font-bold text-gray-900 flex items-center">
                        <BookOpen size={18} className="mr-2 text-indigo-600" />
                        笔记库 ({filteredNotes.length})
                    </h3>
                    
                    {/* Filters */}
                    <div className="flex items-center space-x-3 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-64">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                            <input 
                                type="text" 
                                placeholder="搜索笔记标题..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>
                        <div className="relative">
                            <select 
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as 'likes' | 'date')}
                                className="appearance-none bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg py-1.5 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                            >
                                <option value="likes">按热度排序</option>
                                <option value="date">按时间排序</option>
                            </select>
                            <Filter className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={12} />
                        </div>
                    </div>
                </div>

                {filteredNotes.length === 0 ? (
                    <div className="p-12 text-center text-gray-400 flex flex-col items-center">
                        <Search size={48} className="mb-4 opacity-20" />
                        <p>没有找到相关笔记</p>
                        {searchTerm && <button onClick={() => setSearchTerm('')} className="mt-2 text-indigo-600 text-sm hover:underline">清除搜索</button>}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 p-6">
                        {filteredNotes.map((note) => (
                            <div 
                                key={note.id} 
                                className="group block bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-all hover:border-indigo-200 cursor-pointer relative"
                                onClick={() => handleAnalyzeNote(note)}
                            >
                                    <div className="aspect-[3/4] bg-gray-100 relative overflow-hidden">
                                    {note.cover ? (
                                        <img 
                                            src={note.cover} 
                                            alt={note.title} 
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                                            referrerPolicy="no-referrer"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).onerror = null; 
                                                (e.target as HTMLImageElement).src = 'https://placehold.co/300x400/e2e8f0/94a3b8?text=No+Cover';
                                            }}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 bg-gray-50">
                                            <Target size={32} className="mb-2 opacity-50" />
                                            <span className="text-xs">无封面</span>
                                        </div>
                                    )}
                                    
                                    {/* Analyzing Overlay */}
                                    {analyzingId === note.note_id && (
                                        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white z-20">
                                            <Loader2 size={24} className="animate-spin mb-2" />
                                            <span className="text-xs font-medium">分析中...</span>
                                        </div>
                                    )}

                                    {/* Hover Overlay for Analysis Hint */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors z-10 flex items-center justify-center opacity-0 group-hover:opacity-100">
                                        <div className="bg-white/90 text-indigo-600 px-3 py-1 rounded-full text-xs font-bold shadow-sm flex items-center transform translate-y-4 group-hover:translate-y-0 transition-all">
                                            <Sparkles size={12} className="mr-1" /> 点击深度分析
                                        </div>
                                    </div>

                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-8 pointer-events-none">
                                        <div className="flex items-center text-white text-xs font-medium">
                                            <Heart size={12} className="mr-1 fill-white" />
                                            {note.likes.toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-3">
                                    <h4 className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug group-hover:text-indigo-600 transition-colors" title={note.title}>
                                        {note.title}
                                    </h4>
                                    <div className="mt-2 text-[10px] text-gray-400 flex items-center justify-between">
                                        <div className="flex items-center">
                                            <Clock size={10} className="mr-1" />
                                            {note.publish_date ? (
                                                format(new Date(note.publish_date), 'yyyy-MM-dd')
                                            ) : (
                                                <span className="italic opacity-70">未知时间</span>
                                            )}
                                        </div>
                                        <a 
                                            href={note.url} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            onClick={(e) => e.stopPropagation()} 
                                            className="text-gray-400 hover:text-indigo-600 p-1"
                                            title="查看原文"
                                        >
                                            <ExternalLink size={12} />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Analysis Modal */}
            {showAnalysisModal && currentAnalysis && (
                <NoteAnalysisModal
                    note={currentNote}
                    analysis={currentAnalysis}
                    onClose={() => setShowAnalysisModal(false)}
                    onSelect={(note) => {
                        navigate('/generate', { 
                            state: { 
                                remixNote: {
                                    title: note.title,
                                    structure: note.analysis_result || currentAnalysis,
                                    type: note.type 
                                }
                            } 
                        });
                        toast.success(`已引用结构：${note.title}`);
                    }}
                />
            )}
        </div>
    );
}
