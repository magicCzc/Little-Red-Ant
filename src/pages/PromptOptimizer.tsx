import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Layout, CheckCircle, XCircle, TrendingUp, 
    MessageSquare, AlertTriangle, ArrowRight 
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Optimization {
    id: number;
    target_style: string;
    analysis_report: string;
    optimized_template: string;
    performance_metrics: {
        sample_count: number;
        avg_likes: number;
    } | null;
    status: 'PENDING' | 'APPLIED' | 'REJECTED';
    created_at: string;
}

const PromptOptimizer: React.FC = () => {
    const [optimizations, setOptimizations] = useState<Optimization[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'PENDING' | 'APPLIED' | 'REJECTED'>('PENDING');

    useEffect(() => {
        fetchOptimizations();
    }, []);

    const fetchOptimizations = async () => {
        try {
            const res = await axios.get('/api/optimizations');
            if (res.data.success) {
                setOptimizations(res.data.data);
            }
        } catch (error) {
            toast.error('Failed to load optimizations');
        } finally {
            setLoading(false);
        }
    };

    const handleApply = async (id: number) => {
        if (!confirm('Are you sure you want to apply this optimization? This will update the global prompt template.')) return;
        
        try {
            await axios.post(`/api/optimizations/${id}/apply`);
            toast.success('Optimization applied successfully!');
            fetchOptimizations();
        } catch (error) {
            toast.error('Failed to apply optimization');
        }
    };

    const handleReject = async (id: number) => {
        try {
            await axios.post(`/api/optimizations/${id}/reject`);
            toast.success('Optimization rejected');
            fetchOptimizations();
        } catch (error) {
            toast.error('Failed to reject optimization');
        }
    };

    const filtered = optimizations.filter(o => o.status === activeTab);

    return (
        <div className="max-w-6xl mx-auto p-6">
            <header className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <TrendingUp className="text-red-600" />
                    提示词优化 (Prompt Optimizer)
                </h1>
                <p className="text-gray-500 mt-2">
                    AI 自我迭代中心。系统会自动分析高表现笔记，并在此提出优化建议。
                </p>
            </header>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-gray-200 mb-6">
                {(['PENDING', 'APPLIED', 'REJECTED'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === tab 
                                ? 'border-red-600 text-red-600' 
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {tab === 'PENDING' ? '待处理建议' : tab === 'APPLIED' ? '已应用' : '已拒绝'}
                        <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                            {optimizations.filter(o => o.status === tab).length}
                        </span>
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500">Loading...</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <MessageSquare className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                    <h3 className="text-lg font-medium text-gray-900">暂无数据</h3>
                    <p className="text-gray-500">
                        {activeTab === 'PENDING' 
                            ? '暂无优化建议。请等待定时任务积累足够的高赞笔记数据。' 
                            : '没有相关记录'}
                    </p>
                </div>
            ) : (
                <div className="grid gap-6">
                    {filtered.map(opt => (
                        <div key={opt.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            {/* Header */}
                            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-900">{opt.target_style}</span>
                                        <span className="text-xs text-gray-500">
                                            #{opt.id} • {new Date(opt.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                    {opt.performance_metrics && (
                                        <div className="flex gap-4 mt-1 text-xs text-gray-600">
                                            <span>样本数: {opt.performance_metrics.sample_count}</span>
                                            <span className="text-red-600 font-medium">
                                                平均点赞: {opt.performance_metrics.avg_likes}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                {activeTab === 'PENDING' && (
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleReject(opt.id)}
                                            className="px-3 py-1.5 text-gray-600 hover:bg-white border border-transparent hover:border-gray-300 rounded-md text-sm transition-all"
                                        >
                                            忽略
                                        </button>
                                        <button 
                                            onClick={() => handleApply(opt.id)}
                                            className="px-3 py-1.5 bg-red-600 text-white hover:bg-red-700 rounded-md text-sm shadow-sm flex items-center gap-1"
                                        >
                                            <CheckCircle size={14} />
                                            应用优化
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Analysis Report */}
                                <div>
                                    <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center">
                                        <Layout size={16} className="mr-2" />
                                        AI 归因分析
                                    </h4>
                                    <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 leading-relaxed whitespace-pre-wrap border border-blue-100">
                                        {opt.analysis_report}
                                    </div>
                                </div>

                                {/* Optimized Prompt */}
                                <div>
                                    <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center">
                                        <ArrowRight size={16} className="mr-2" />
                                        建议的新 Prompt
                                    </h4>
                                    <div className="bg-gray-900 p-4 rounded-lg text-sm text-green-400 font-mono overflow-auto max-h-64 leading-relaxed">
                                        {opt.optimized_template}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PromptOptimizer;
