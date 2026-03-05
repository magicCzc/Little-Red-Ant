import React from 'react';
import { FileText, BookOpen, Send, Loader2, Sparkles, MessageSquarePlus } from 'lucide-react';

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
    // New props
    remixStructure?: any;
    remixSourceTitle?: string;
    customInstructions?: string;
    setCustomInstructions?: (val: string) => void;
}

export default function NoteGeneratorForm({
    topic, setTopic, keywords, setKeywords, style, setStyle,
    contentType, setContentType, promptTemplates, activeAccount,
    loading, onGenerate, errorMsg,
    remixStructure, remixSourceTitle, customInstructions, setCustomInstructions
}: NoteGeneratorFormProps) {
    
    // Auto-fill style and instructions from Remix Structure
    React.useEffect(() => {
        if (remixStructure) {
            // 1. Auto-fill Style
            if (!style && setStyle) {
                const tone = remixStructure.tone || '';
                const hook = remixStructure.hook_type || '';
                if (tone || hook) {
                    setStyle(`[爆款风格] ${tone} ${hook ? `(钩子:${hook})` : ''}`);
                }
            }

            // 2. Auto-fill Custom Instructions
            if ((!customInstructions || customInstructions.trim() === '') && setCustomInstructions) {
                const parts = [];
                if (remixStructure.remix_template) {
                    // Only include the detailed advice, excluding redundant CTA which is already in structure
                    parts.push(`【请参考以下爆款仿写建议】\n${remixStructure.remix_template}`);
                }
                
                // Note: cta_strategy is skipped here as it is already handled by the system prompt logic in ContentService
                
                if (parts.length > 0) {
                    setCustomInstructions(parts.join('\n\n'));
                }
            }
        }
    }, [remixStructure]);

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
                    
                    {/* Remix Status Hint */}
                    {remixStructure && (
                        <div className="mt-2 p-3 bg-indigo-50 border border-indigo-100 rounded-md text-xs text-indigo-700 flex items-start animate-in fade-in slide-in-from-top-2">
                            <Sparkles size={14} className="mr-2 mt-0.5 shrink-0 text-indigo-500" />
                            <div>
                                <span className="font-bold block mb-1">正在仿写爆款结构</span>
                                <span className="opacity-80 block mb-1">
                                    原标题：{remixSourceTitle || '未命名结构'} 
                                </span>
                                <span className="opacity-70 text-[10px] block mb-1">
                                    AI 将保留原笔记的逻辑框架（{remixStructure.hook_type || '通用'}），并填充您的新内容。
                                </span>
                                <span className="text-green-600 font-medium flex items-center mt-1">
                                    <MessageSquarePlus size={10} className="mr-1"/> 已自动填充「爆款风格」与「仿写策略」
                                </span>
                            </div>
                        </div>
                    )}
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

                {/* Custom Instructions Input */}
                {setCustomInstructions && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                            <MessageSquarePlus size={14} className="mr-1 text-gray-500" />
                            补充指令 (可选)
                        </label>
                        <textarea
                            value={customInstructions || ''}
                            onChange={(e) => setCustomInstructions(e.target.value)}
                            placeholder="补充更多给 AI 的指令，例如：'语气要更夸张一点'，'多引用一些数据'，'针对大学生群体'..."
                            className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm min-h-[60px]"
                        />
                    </div>
                )}

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
