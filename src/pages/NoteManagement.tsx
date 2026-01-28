import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { 
    Layout, Search, Filter, Trash2, ExternalLink, 
    Eye, RefreshCw, MoreVertical, FileText, CheckCircle,
    Loader2, Calendar, AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Modal from '../components/Modal';

interface Note {
    id: number;
    note_id: string;
    title: string;
    cover_image: string;
    views: number;
    likes: number;
    comments: number;
    collects: number;
    publish_date: string;
    account_id: number;
    account_name: string;
    account_avatar: string;
    project_id?: string;
    project_title?: string;
    xsec_token?: string;
}

const NoteManagement: React.FC = () => {
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
    const [keyword, setKeyword] = useState('');
    
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const [activeAccount, setActiveAccount] = useState<any>(null);
    const [accountLoading, setAccountLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    // Fetch Active Account
    useEffect(() => {
        const fetchAccount = async () => {
            try {
                const res = await axios.get('/api/accounts/primary-status');
                setActiveAccount(res.data);
            } catch (e) {
                console.error('No active account found');
            } finally {
                setAccountLoading(false);
            }
        };
        fetchAccount();
    }, []);

    // Fetch Data
    const fetchNotes = async () => {
        if (!activeAccount) return;

        setLoading(true);
        try {
            const res = await axios.get('/api/notes', {
                params: {
                    page: pagination.page,
                    pageSize: pagination.pageSize,
                    keyword: keyword,
                    accountId: activeAccount.id
                }
            });
            if (res.data.success) {
                setNotes(res.data.data);
                setPagination(prev => ({ ...prev, total: res.data.total }));
            }
        } catch (error) {
            toast.error('Failed to load notes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeAccount) {
            fetchNotes();
        }
    }, [pagination.page, pagination.pageSize, activeAccount]); // Depend on activeAccount

    const handleDeleteClick = (noteId: string) => {
        setDeleteId(noteId);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!deleteId) return;
        try {
            await axios.delete(`/api/notes/${deleteId}`);
            toast.success('已删除记录');
            setNotes(prev => prev.filter(n => n.note_id !== deleteId));
            setIsDeleteModalOpen(false);
            setDeleteId(null);
        } catch (error) {
            toast.error('删除失败');
        }
    };

    const handleRefreshStats = async () => {
        if (refreshing) return;
        setRefreshing(true);
        const toastId = toast.loading('正在启动同步任务...');
        
        try {
            const res = await axios.post('/api/analytics/refresh');
            const { taskId } = res.data;
            
            toast.loading('同步任务运行中，请稍候...', { id: toastId });
            
            // Poll for completion
            let attempts = 0;
            let taskStatus = 'PENDING';
            
            while (taskStatus === 'PENDING' || taskStatus === 'PROCESSING') {
                await new Promise(r => setTimeout(r, 2000));
                attempts++;
                
                try {
                    const taskRes = await axios.get(`/api/tasks/${taskId}`);
                    taskStatus = taskRes.data.status;
                    
                    if (taskStatus === 'COMPLETED') {
                        toast.success('数据同步完成！', { id: toastId });
                        fetchNotes(); // Refresh the table
                        return;
                    } else if (taskStatus === 'FAILED') {
                        throw new Error(taskRes.data.error || '任务执行失败');
                    }
                    
                    if (attempts > 120) throw new Error('同步超时，请稍后重试');
                } catch (e: any) {
                    if (e.message.includes('失败') || e.message.includes('超时')) throw e;
                    // Ignore network glitches during polling
                }
            }
        } catch (error: any) {
            console.error('Refresh failed:', error);
            toast.error(`同步失败: ${error.message || '未知错误'}`, { id: toastId });
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

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                            <FileText className="mr-2 text-indigo-600" />
                            笔记管理
                        </h1>
                        <p className="text-sm text-gray-500 mt-1 flex items-center">
                            管理已发布的笔记内容
                            {activeAccount && (
                                <span className="ml-2 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium border border-indigo-100 flex items-center">
                                    <img src={activeAccount.avatar} className="w-3 h-3 rounded-full mr-1" alt="" />
                                    当前账号: {activeAccount.nickname}
                                </span>
                            )}
                        </p>
                    </div>
                    
                    <div className="flex gap-2">
                        <button 
                            onClick={handleRefreshStats}
                            disabled={refreshing}
                            className={`px-4 py-2 border rounded-lg text-sm font-medium flex items-center shadow-sm transition-colors
                                ${refreshing 
                                    ? 'bg-indigo-50 text-indigo-400 border-indigo-100 cursor-not-allowed' 
                                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                }
                            `}
                        >
                            <RefreshCw size={16} className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                            {refreshing ? '正在同步...' : '同步最新数据'}
                        </button>
                    </div>
                </div>

                {/* Account Warning */}
                {!accountLoading && !activeAccount && (
                    <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center">
                            <div className="bg-yellow-100 p-2 rounded-full mr-3">
                                <ExternalLink className="text-yellow-700" size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-medium text-yellow-800">未检测到活跃账号</h3>
                                <p className="text-xs text-yellow-600 mt-1">请先在“账号矩阵”中激活一个账号，以便管理其笔记。</p>
                            </div>
                        </div>
                        <Link to="/accounts" className="px-4 py-2 bg-yellow-100 text-yellow-800 text-xs font-medium rounded hover:bg-yellow-200 transition-colors">
                            去管理账号
                        </Link>
                    </div>
                )}

                {/* Filters */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            type="text"
                            placeholder="搜索笔记标题..."
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && fetchNotes()}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    
                    <div className="flex gap-2">
                         <select 
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                            onChange={(e) => setPagination(prev => ({ ...prev, pageSize: Number(e.target.value), page: 1 }))}
                            value={pagination.pageSize}
                        >
                            <option value="10">10条 / 页</option>
                            <option value="20">20条 / 页</option>
                            <option value="50">50条 / 页</option>
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">笔记内容</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">所属账号</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">发布时间</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">数据表现</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">关联工程</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-10 text-center">
                                            <Loader2 className="animate-spin mx-auto text-indigo-600" size={24} />
                                        </td>
                                    </tr>
                                ) : notes.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                                            暂无笔记记录
                                        </td>
                                    </tr>
                                ) : (
                                    notes.map((note) => (
                                        <tr key={note.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="h-12 w-12 flex-shrink-0 bg-gray-100 rounded-md overflow-hidden border border-gray-200">
                                                        {note.cover_image ? (
                                                            <img className="h-full w-full object-cover" src={note.cover_image} alt="" />
                                                        ) : (
                                                            <div className="h-full w-full flex items-center justify-center text-gray-300">
                                                                <FileText size={20} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="ml-4">
                                                        <div className="text-sm font-medium text-gray-900 truncate max-w-[200px]" title={note.title}>
                                                            {note.title || '无标题'}
                                                        </div>
                                                        <div className="text-xs text-gray-500 font-mono mt-1">
                                                            ID: {note.note_id.substring(0, 8)}...
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    {note.account_avatar && (
                                                        <img className="h-6 w-6 rounded-full mr-2" src={note.account_avatar} alt="" />
                                                    )}
                                                    <span className="text-sm text-gray-700">{note.account_name || '未知账号'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-500 flex items-center">
                                                    <Calendar size={14} className="mr-1.5" />
                                                    {note.publish_date ? new Date(note.publish_date).toLocaleDateString() : '-'}
                                                </div>
                                                <div className="text-xs text-gray-400 mt-0.5 ml-5">
                                                    {note.publish_date ? new Date(note.publish_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex space-x-4 text-sm text-gray-500">
                                                    <div className="flex flex-col items-center">
                                                        <span className="font-bold text-gray-900">{note.views}</span>
                                                        <span className="text-[10px]">阅读</span>
                                                    </div>
                                                    <div className="flex flex-col items-center">
                                                        <span className="font-bold text-gray-900">{note.likes}</span>
                                                        <span className="text-[10px]">点赞</span>
                                                    </div>
                                                    <div className="flex flex-col items-center">
                                                        <span className="font-bold text-gray-900">{note.collects}</span>
                                                        <span className="text-[10px]">收藏</span>
                                                    </div>
                                                    <div className="flex flex-col items-center">
                                                        <span className="font-bold text-gray-900">{note.comments}</span>
                                                        <span className="text-[10px]">评论</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {note.project_id ? (
                                                    <Link 
                                                        to={`/video-studio/${note.project_id}`}
                                                        className="inline-flex items-center px-2.5 py-1.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                                                    >
                                                        <Layout size={12} className="mr-1" />
                                                        查看工程
                                                    </Link>
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic">无关联工程</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end space-x-2">
                                                    <button 
                                                        onClick={() => handleOpenInBrowser(note.note_id)} 
                                                        className="p-1 text-gray-400 hover:text-indigo-600 rounded-full hover:bg-gray-100 transition-colors"
                                                        title="以当前身份查看 (RPA浏览器 - 自动登录)"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    <a 
                                                        href={note.xsec_token 
                                                            ? `https://www.xiaohongshu.com/explore/${note.note_id}?xsec_token=${note.xsec_token}&xsec_source=pc_feed`
                                                            : `https://www.xiaohongshu.com/explore/${note.note_id}?xsec_source=pc_feed`} 
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="p-1 text-gray-400 hover:text-indigo-600 rounded-full hover:bg-gray-100 transition-colors"
                                                        title="在普通浏览器查看"
                                                    >
                                                        <ExternalLink size={16} />
                                                    </a>
                                                    <button 
                                                        onClick={() => handleDeleteClick(note.note_id)}
                                                        className="p-1 text-gray-400 hover:text-red-600 rounded-full hover:bg-gray-100 transition-colors"
                                                        title="删除记录"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* Pagination */}
                    <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                            共 {pagination.total} 条记录
                        </div>
                        <div className="flex gap-2">
                            <button 
                                disabled={pagination.page === 1}
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
                            >
                                上一页
                            </button>
                            <button 
                                disabled={pagination.page * pagination.pageSize >= pagination.total}
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
                            >
                                下一页
                            </button>
                        </div>
                    </div>
                </div>

                {/* Delete Modal */}
                <Modal
                    isOpen={isDeleteModalOpen}
                    onClose={() => setIsDeleteModalOpen(false)}
                    title="确认删除笔记记录"
                    footer={
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium"
                            >
                                取消
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-md text-sm font-medium"
                            >
                                确认删除
                            </button>
                        </div>
                    }
                >
                    <div className="flex items-start p-2">
                        <AlertCircle className="text-red-500 mr-3 flex-shrink-0" size={24} />
                        <div>
                            <p className="text-gray-700 font-medium mb-1">您确定要删除这条笔记记录吗？</p>
                            <p className="text-gray-500 text-sm">
                                此操作仅删除本地数据库中的记录，<strong className="text-gray-700">不会</strong>删除小红书线上发布的笔记。
                            </p>
                        </div>
                    </div>
                </Modal>
            </div>
        </div>
    );
};

export default NoteManagement;
