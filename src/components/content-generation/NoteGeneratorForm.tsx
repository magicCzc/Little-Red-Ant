import React from 'react';
import { FileText, BookOpen, Send, Loader2 } from 'lucide-react';

interface NoteGeneratorFormProps {
    topic: string;
    setTopic: (val: string) => void;
    keywords: string;
    setKeywords: (val: string) => void;
    style: string;
    setStyle: (val: string) => void;
    contentType: 'note' | 'article' | 'video_script';
    setContentType: (val: 'note' | 'article' | 'video_script') => void;
    promptTemplates: {id: number, name: string, template: string}[];
    activeAccount: any;
    loading: boolean;
    onGenerate: (e: React.FormEvent) => void;
    errorMsg: string | null;
}

export default function NoteGeneratorForm({
    topic, setTopic, keywords, setKeywords, style, setStyle,
    contentType, setContentType, promptTemplates, activeAccount,
    loading, onGenerate, errorMsg
}: NoteGeneratorFormProps) {
    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
             {/* Header */}
             <div className="mb-4 pb-2 border-b border-gray-100 flex items-center text-gray-600">
                <FileText size={18} className="mr-2" />
                <h3 className="text-sm font-bold">笔记参数配置</h3>
            </div>

            <form onSubmit={onGenerate} className="space-y-4">
                {/* Content Type Selector */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        创作类型
                    </label>
                    <div className="flex space-x-2 bg-gray-50 p-1 rounded-md border border-gray-200">
                        <button
                            type="button"
                            onClick={() => setContentType('note')}
                            className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${contentType === 'note' ? 'bg-white text-indigo-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <FileText size={14} className="inline mr-1" />
                            图文笔记
                        </button>
                        <button
                            type="button"
                            onClick={() => setContentType('article')}
                            className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${contentType === 'article' ? 'bg-white text-indigo-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <BookOpen size={14} className="inline mr-1" />
                            深度长文
                        </button>
                    </div>
                </div>

                {/* Topic Input */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {contentType === 'article' ? '文章标题' : '核心选题'} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder={contentType === 'article' ? "例如：2024年人工智能发展深度解析" : "例如：新手宝妈如何给宝宝做辅食 (生成图文笔记)"}
                        required
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    />
                </div>

                {/* Keywords Input */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        关键词
                    </label>
                    <input
                        type="text"
                        value={keywords}
                        onChange={(e) => setKeywords(e.target.value)}
                        placeholder="例如：简单, 营养"
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    />
                </div>

                {/* Style Selector */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        创作策略 / 风格
                    </label>
                    
                    <div className="space-y-2">
                        {/* 1. Template Quick Select */}
                        <select
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val) setStyle(val);
                            }}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-xs bg-gray-50"
                            defaultValue=""
                        >
                            <option value="" disabled>✨ 选择预设风格模版...</option>
                            {promptTemplates.map(opt => (
                                <option key={opt.id} value={opt.name}>{opt.name}</option>
                            ))}
                        </select>

                        {/* 2. Custom Style Textarea */}
                        <textarea
                            value={style}
                            onChange={(e) => setStyle(e.target.value)}
                            placeholder={activeAccount?.persona?.tone ? `默认使用人设风格: ${activeAccount.persona.tone}。您也可以在此输入具体指令，例如"小红书爆款风格，多用emoji"` : "输入具体的风格要求或策略指令..."}
                            className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm min-h-[100px]"
                        />
                        <p className="text-xs text-gray-400 text-right">
                            {style.length > 0 ? `已输入 ${style.length} 字` : '可输入详细的生成指令或策略'}
                        </p>
                    </div>
                </div>

                {errorMsg && (
                    <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md">
                        {errorMsg}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading || !topic.trim()}
                    className={`
                        w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                        ${loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}
                    `}
                >
                    {loading ? (
                        <>
                            <Loader2 className="animate-spin mr-2" size={18} />
                            生成中...
                        </>
                    ) : (
                        <>
                            <Send className="mr-2" size={18} />
                            立即生成
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}
