
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, MessageSquare, RefreshCw, Send, 
  Bot, User, Clock, CheckCircle, AlertTriangle, Trash2, ChevronLeft, ChevronRight 
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Comment {
  id: string;
  user_nickname: string;
  user_avatar: string;
  content: string;
  create_time: string;
  reply_status: 'UNREAD' | 'READ' | 'REPLIED' | 'IGNORED';
  parent_id?: string;
  intent?: 'PRAISE' | 'COMPLAINT' | 'INQUIRY' | 'OTHER';
  ai_reply_suggestion?: string;
  type?: 'COMMENT' | 'MENTION';
}

const INTENT_CONFIG = {
  PRAISE: { label: '夸奖', color: 'bg-green-50 text-green-600 border-green-200', icon: '🥰' },
  COMPLAINT: { label: '吐槽', color: 'bg-red-50 text-red-600 border-red-200', icon: '😤' },
  INQUIRY: { label: '询单', color: 'bg-blue-50 text-blue-600 border-blue-200', icon: '💎' },
  OTHER: { label: '其他', color: 'bg-gray-50 text-gray-600 border-gray-200', icon: '💬' }
};

export default function Engagement() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'REPLIED'>('ALL');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  
  // Default page size reduced to 10 for better UX on smaller screens
  const [pageSize, setPageSize] = useState(10); 
  
  const [scraping, setScraping] = useState(false);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [sending, setSending] = useState(false);
  const [activeAccount, setActiveAccount] = useState<any>(null);

  const fetchActiveAccount = async () => {
      try {
          const res = await axios.get('/api/accounts');
          if (Array.isArray(res.data)) {
              const active = res.data.find((a: any) => a.is_active);
              setActiveAccount(active);
          }
      } catch (e) {
          console.error('Failed to fetch active account', e);
      }
  };

  useEffect(() => {
      fetchActiveAccount();
  }, []);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/comments', {
        params: { 
            status: filter === 'ALL' ? undefined : filter,
            page,
            pageSize
        }
      });
      // Ensure data is array
      setComments(Array.isArray(res.data.data) ? res.data.data : []);
      if (res.data.pagination) {
          setPagination({
              total: res.data.pagination.total,
              totalPages: res.data.pagination.totalPages
          });
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
      toast.error('加载评论失败');
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1); // Reset page on filter change
  }, [filter]);

  useEffect(() => {
    fetchComments();
  }, [page, filter]);

  const handleScrape = async () => {
    setScraping(true);
    const toastId = toast.loading('正在同步评论...');
    try {
      const res = await axios.post('/api/comments/scrape');
      const { taskId } = res.data;
      
      // Poll Task Status
      let taskStatus = 'PENDING';
      let attempts = 0;
      
      while (taskStatus === 'PENDING' || taskStatus === 'PROCESSING') {
          await new Promise(r => setTimeout(r, 2000));
          attempts++;
          
          try {
              const taskRes = await axios.get(`/api/tasks/${taskId}`);
              const task = taskRes.data;
              taskStatus = task.status;
              
              if (taskStatus === 'COMPLETED') {
                  toast.success(`同步完成！发现 ${task.result.count} 条评论`, { id: toastId });
                  fetchComments();
                  return;
              } else if (taskStatus === 'FAILED') {
                  throw new Error(task.error || '任务执行失败');
              }
              
              if (attempts > 60) throw new Error('同步超时');
          } catch (e: any) {
              if (e.message.includes('超时') || e.message.includes('失败')) throw e;
          }
      }
    } catch (error: any) {
      toast.error(`抓取失败: ${error.response?.data?.error || error.message}`, { id: toastId });
    } finally {
      setScraping(false);
    }
  };

  const handleReply = async (commentId: string) => {
    if (!replyContent.trim()) return;
    setSending(true);
    try {
      await axios.post('/api/comments/reply', {
        commentId,
        content: replyContent
      });
      toast.success('回复已发送！');
      setReplyingId(null);
      setReplyContent('');
      fetchComments();
    } catch (error: any) {
      toast.error(`回复失败: ${error.response?.data?.error || error.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleIgnore = async (id: string) => {
    if (!window.confirm('确定忽略该评论吗？')) return;
    try {
      await axios.post(`/api/comments/${id}/ignore`);
      toast.success('已忽略该评论');
      fetchComments();
    } catch (e: any) {
      toast.error('操作失败');
    }
  };

  const generateAiReply = (content: string) => {
    // If there is already a suggestion, use it first
    const comment = comments.find(c => c.content === content);
    if (comment && comment.ai_reply_suggestion) {
        setReplyContent(comment.ai_reply_suggestion);
        return;
    }

    // Mock AI Reply for now, or call an endpoint
    const replies = [
        "感谢关注！我们会继续努力的 💪",
        "哈哈，你说得对！😂",
        "宝子很有眼光哦 ✨",
        "收到建议啦，这就去改！🫡"
    ];
    setReplyContent(replies[Math.floor(Math.random() * replies.length)]);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">

            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <MessageSquare className="w-7 h-7 mr-2 text-pink-500" />
                互动中心
              </h1>
              <p className="text-gray-500 text-sm mt-1">管理评论与粉丝互动</p>
            </div>
          </div>
          
          <button 
            onClick={handleScrape}
            disabled={scraping}
            className={`
              flex items-center px-4 py-2 rounded-lg text-white font-medium transition-all
              ${scraping ? 'bg-gray-400 cursor-not-allowed' : 'bg-pink-500 hover:bg-pink-600 shadow-md hover:shadow-lg'}
            `}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${scraping ? 'animate-spin' : ''}`} />
            {scraping ? '正在抓取...' : '同步最新评论'}
          </button>
        </div>

        {/* Filters */}
        <div className="flex justify-between items-end border-b border-gray-200 mb-6 pb-1">
            <div className="flex space-x-2">
            {[
                { key: 'ALL', label: '全部评论' },
                { key: 'UNREAD', label: '待回复' },
                { key: 'REPLIED', label: '已回复' }
            ].map((tab) => (
                <button
                key={tab.key}
                onClick={() => setFilter(tab.key as any)}
                className={`
                    px-4 py-2 text-sm font-medium rounded-t-lg transition-colors relative top-[1px]
                    ${filter === tab.key 
                    ? 'bg-white text-pink-600 border border-b-white border-gray-200' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}
                `}
                >
                {tab.label}
                </button>
            ))}
            </div>
            
            <div className="flex items-center text-sm text-gray-500 mb-2">
                <span className="mr-2">每页:</span>
                <select 
                    value={pageSize}
                    onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                    }}
                    disabled={loading}
                    className="border-gray-300 rounded-md text-xs py-1 pl-2 pr-6 focus:ring-pink-500 focus:border-pink-500 disabled:opacity-50"
                >
                    <option value="10">10条</option>
                    <option value="20">20条</option>
                    <option value="50">50条</option>
                    <option value="100">100条</option>
                </select>
            </div>
        </div>

        {/* List */}
        {loading ? (
           <div className="flex justify-center py-12">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
           </div>
        ) : comments.length === 0 ? (
           <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
             <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
             <p className="text-gray-500 mb-2">暂无评论数据</p>
             {activeAccount ? (
                 <p className="text-sm text-gray-400">当前账号 "{activeAccount.nickname}" 暂无新评论，请点击右上角同步</p>
             ) : (
                 <p className="text-sm text-red-400">未检测到活跃账号，请先在账号矩阵中激活一个账号</p>
             )}
           </div>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-start space-x-4">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {comment.user_avatar ? (
                      <img src={comment.user_avatar} alt={comment.user_nickname} className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                        <User size={20} />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm flex items-center">
                            {comment.user_nickname}
                            {comment.type === 'MENTION' && (
                                <span className="ml-2 px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded border border-blue-100 font-normal">
                                    @了你
                                </span>
                            )}
                        </h3>
                        <p className="text-xs text-gray-400 flex items-center mt-1">
                          <Clock size={12} className="mr-1" />
                          {new Date(comment.create_time).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {comment.reply_status === 'REPLIED' && (
                          <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full flex items-center">
                            <CheckCircle size={10} className="mr-1" /> 已回复
                          </span>
                        )}
                        {comment.reply_status === 'UNREAD' && (
                          <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded-full flex items-center">
                            <AlertTriangle size={10} className="mr-1" /> 待处理
                          </span>
                        )}
                        {/* Intent Badge */}
                        {comment.intent && INTENT_CONFIG[comment.intent] && (
                          <span className={`text-xs px-2 py-1 rounded-full border flex items-center ${INTENT_CONFIG[comment.intent].color}`}>
                             <span className="mr-1">{INTENT_CONFIG[comment.intent].icon}</span>
                             {INTENT_CONFIG[comment.intent].label}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="mt-2 text-gray-800 text-sm leading-relaxed bg-gray-50 p-3 rounded-lg">
                      {comment.content}
                    </p>

                    {/* AI Suggestion (Quick Action) */}
                    {comment.ai_reply_suggestion && !replyingId && comment.reply_status === 'UNREAD' && (
                        <div 
                          onClick={() => {
                              setReplyingId(comment.id);
                              setReplyContent(comment.ai_reply_suggestion!);
                          }}
                          className="mt-2 cursor-pointer group"
                        >
                            <div className="flex items-start space-x-2 bg-gradient-to-r from-purple-50 to-pink-50 p-2 rounded-lg border border-purple-100 hover:border-purple-300 transition-colors">
                                <Bot size={16} className="text-purple-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-xs text-purple-700 font-medium mb-0.5 flex items-center">
                                        AI 建议回复 
                                        <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-purple-400 text-[10px]">点击使用</span>
                                    </p>
                                    <p className="text-xs text-gray-600 line-clamp-1 group-hover:line-clamp-none transition-all">
                                        {comment.ai_reply_suggestion}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action Area */}
                    <div className="mt-3">
                      {replyingId === comment.id ? (
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 animate-in fade-in slide-in-from-top-2">
                           <div className="flex justify-between items-center mb-2">
                              <span className="text-xs font-semibold text-blue-700">回复 @{comment.user_nickname}</span>
                              <button 
                                onClick={() => generateAiReply(comment.content)}
                                className="text-xs flex items-center text-purple-600 hover:text-purple-800 bg-white px-2 py-1 rounded border border-purple-200 shadow-sm"
                              >
                                <Bot size={12} className="mr-1" /> AI 帮我想
                              </button>
                           </div>
                           <textarea
                             value={replyContent}
                             onChange={(e) => setReplyContent(e.target.value)}
                             placeholder="输入回复内容（注意：禁止包含导流违禁词）..."
                             className="w-full text-sm p-2 border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-h-[80px]"
                           />
                           <div className="flex justify-end space-x-2 mt-2">
                             <button 
                               onClick={() => setReplyingId(null)}
                               className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-200 rounded"
                             >
                               取消
                             </button>
                             <button 
                               onClick={() => handleReply(comment.id)}
                               disabled={sending || !replyContent.trim()}
                               className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center disabled:opacity-50"
                             >
                               {sending ? <RefreshCw className="w-3 h-3 animate-spin mr-1"/> : <Send className="w-3 h-3 mr-1"/>}
                               发送回复
                             </button>
                           </div>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-3">
                          <button 
                            onClick={() => {
                              setReplyingId(comment.id);
                              setReplyContent('');
                            }}
                            className="text-sm text-gray-500 hover:text-blue-600 font-medium flex items-center transition-colors"
                          >
                            <MessageSquare size={14} className="mr-1" />
                            回复
                          </button>
                          <button 
                            onClick={() => handleIgnore(comment.id)}
                            className="p-1 text-gray-400 hover:text-gray-600 rounded flex items-center text-sm"
                            title="忽略"
                          >
                            <Trash2 size={14} className="mr-1"/> 忽略
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {comments.length > 0 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 rounded-b-xl sticky bottom-0 z-10 shadow-md">
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
                            显示第 <span className="font-medium">{page}</span> 页，共 <span className="font-medium">{pagination.totalPages}</span> 页，总计 <span className="font-medium">{pagination.total}</span> 条
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
                            
                            <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                第 {page} 页
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
    </div>
  );
}
