
import React, { useState } from 'react';
import { ArrowLeft, Search, Loader2, Target, Link as LinkIcon, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function CompetitorAdd() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    // Basic validation
    if (!url.includes('xiaohongshu.com') && url.length < 10) {
        toast.error('请输入有效的小红书个人主页链接或 User ID');
        return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/competitors/analyze', { url });
      if (res.data.success) {
          toast.success('已添加到任务队列，正在后台分析...');
          // Give a small delay so user reads the message
          setTimeout(() => {
              navigate('/competitor');
          }, 1500);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || '添加失败');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        <Link to="/competitor" className="inline-flex items-center text-gray-500 hover:text-gray-900 mb-6">
          <ArrowLeft size={20} className="mr-2" />
          返回列表
        </Link>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50">
            <h1 className="text-xl font-bold text-gray-900 flex items-center">
              <Target className="mr-2 text-indigo-600" />
              添加对标账号 (Add Competitor)
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              输入小红书博主的主页链接或 ID，系统将自动抓取数据并进行 AI 分析。
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                主页链接 / User ID
              </label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="例如：https://www.xiaohongshu.com/user/profile/5ff..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              <p className="mt-2 text-xs text-gray-500 flex items-center">
                <AlertCircle size={12} className="mr-1" />
                提示：在小红书 App 中点击分享 -&gt; 复制链接
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800">
              <h4 className="font-bold mb-2">AI 分析将包含：</h4>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>账号基础数据（粉丝、笔记数）</li>
                <li>最近 20 篇笔记的互动数据</li>
                <li><strong>内容策略拆解</strong>（人设、风格）</li>
                <li><strong>爆款关键词提取</strong></li>
                <li><strong>可执行的模仿建议</strong></li>
              </ul>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className={`w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-lg shadow-sm text-base font-medium text-white 
                  ${loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}
                  transition-colors`}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={20} />
                    正在提交任务...
                  </>
                ) : (
                  <>
                    <Search className="mr-2" size={20} />
                    开始抓取与分析
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
