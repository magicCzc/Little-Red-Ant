import React from 'react';
import { Film, Send, Loader2, Edit3, Sparkles, MessageSquarePlus } from 'lucide-react';

interface VideoScriptGeneratorFormProps {
    topic: string;
    setTopic: (val: string) => void;
    keywords: string;
    setKeywords: (val: string) => void;
    style: string;
    setStyle: (val: string) => void;
    promptTemplates: {id: number, name: string, template: string}[];
    activeAccount: any;
    loading: boolean;
    onGenerate: (e: React.FormEvent) => void;
    errorMsg: string | null;
    remixStructure: any;
    // New props
    customInstructions?: string;
    setCustomInstructions?: (val: string) => void;
}

export default function VideoScriptGeneratorForm({
    topic, setTopic, keywords, setKeywords, style, setStyle,
    promptTemplates, activeAccount,
    loading, onGenerate, errorMsg, remixStructure,
    customInstructions, setCustomInstructions
}: VideoScriptGeneratorFormProps) {
    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <div className="mb-4 pb-2 border-b border-gray-100 flex items-center text-indigo-600">
                <Film size={18} className="mr-2" />
                <h3 className="text-sm font-bold">脚本参数配置</h3>
            </div>
            
            <form onSubmit={onGenerate} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        新脚本主题 <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder={remixStructure ? "请输入你想创作的新主题（AI将把结构迁移到此主题）" : "例如：沉浸式护肤流程 (生成分镜脚本)"}
                        required
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    />
                    {remixStructure && (
                        <div className="mt-2 p-2 bg-indigo-50 rounded text-xs text-indigo-600 flex items-start">
                            <Sparkles size={12} className="mr-1 mt-0.5 shrink-0" />
                            <span>AI 将保留原视频的结构（{remixStructure.hook_type || '通用'} + {remixStructure.tone || '默认'}），但内容将替换为您输入的新主题。</span>
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        补充关键词/视觉元素
                    </label>
                    <input
                        type="text"
                        value={keywords}
                        onChange={(e) => setKeywords(e.target.value)}
                        placeholder="例如：快节奏, 赛博朋克, 特写镜头"
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    />
                </div>

                {!remixStructure && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            本次风格 
                            <span className="text-gray-400 text-xs font-normal ml-2">- 可选，默认使用人设配置</span>
                        </label>
                        <select
                            value={style}
                            onChange={(e) => setStyle(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        >
                            <option value="">
                                {activeAccount?.persona?.tone ? `默认风格 (人设: ${activeAccount.persona.tone})` : '默认风格'}
                            </option>
                            {promptTemplates.map(opt => (
                                <option key={opt.id} value={opt.name}>{opt.name}</option>
                            ))}
                        </select>
                    </div>
                )}

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
                            placeholder="例如：'加强镜头间的衔接'，'第一人称视角'，'结尾要留悬念'..."
                            className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm min-h-[60px]"
                        />
                    </div>
                )}

                {/* Script Mode UI Overrides */}
                {!remixStructure && (
                    <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-md text-xs text-indigo-700">
                        <h4 className="font-bold flex items-center mb-1">
                            <Edit3 size={12} className="mr-1" />
                            脚本创作模式
                        </h4>
                        <ul className="list-disc list-inside space-y-0.5 ml-1">
                            <li>生成分镜表格：包含画面、口播、时长。</li>
                            <li>支持一键提取画面：直接生成视频素材。</li>
                            <li>自动优化结构：符合短视频黄金前3秒法则。</li>
                        </ul>
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
