
import React from 'react';
import { X, Sparkles, Video, MessageCircle, GitMerge, Layout } from 'lucide-react';

interface StructureModalProps {
    remixStructure: any;
    onClose: () => void;
}

export default function StructureModal({ remixStructure, onClose }: StructureModalProps) {
    if (!remixStructure) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto flex flex-col">
                
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-white sticky top-0 z-10">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 flex items-center">
                            <Sparkles className="mr-2 text-indigo-600 fill-indigo-100" size={24} />
                            爆款结构深度拆解
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">AI 已提取该笔记的底层逻辑，将用于指导新内容的生成</p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>
                
                {/* Content */}
                <div className="p-6 space-y-6">
                    
                    {/* System Prompt Status */}
                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 flex items-start">
                        <div className="bg-indigo-100 p-2 rounded-full mr-3 shrink-0">
                            <GitMerge size={18} className="text-indigo-600" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-indigo-900 mb-1">结构注入状态：已激活</h4>
                            <p className="text-sm text-indigo-700 leading-relaxed">
                                系统已锁定该结构框架。生成的脚本将严格遵循此逻辑脉络，仅替换具体内容（Topic）和人设（Persona），确保"形似神不似"。
                            </p>
                        </div>
                    </div>

                    {/* Visual Analysis (If Video) */}
                    {remixStructure.visual_analysis && (
                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                            <h4 className="text-sm font-bold text-purple-900 mb-2 flex items-center uppercase tracking-wider">
                                <Video size={16} className="mr-2"/> 视觉语言分析
                            </h4>
                            <div className="text-sm text-purple-800 whitespace-pre-wrap leading-relaxed bg-white/50 p-3 rounded border border-purple-100/50">
                                {remixStructure.visual_analysis}
                            </div>
                        </div>
                    )}

                    {/* Core Structure Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                            <h4 className="text-xs font-bold text-gray-500 mb-2 uppercase flex items-center">
                                <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                                开头钩子 (Hook)
                            </h4>
                            <div className="text-gray-900 font-medium mb-1">{remixStructure.hook_type || '通用悬念'}</div>
                            <div className="text-xs text-gray-500">{remixStructure.hook_analysis || '暂无详细分析'}</div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                            <h4 className="text-xs font-bold text-gray-500 mb-2 uppercase flex items-center">
                                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                                情感基调 (Tone)
                            </h4>
                            <div className="text-gray-900 font-medium mb-1">{remixStructure.tone || '默认风格'}</div>
                            <div className="text-xs text-gray-500">建议在配音和画面色调中体现此情绪</div>
                        </div>
                    </div>

                    {/* Structure Breakdown */}
                    <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                        <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                            <Layout size={18} className="mr-2 text-gray-500" />
                            逻辑脉络拆解
                        </h4>
                        <div className="space-y-3 relative">
                            {/* Vertical Line */}
                            <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-200"></div>

                            {remixStructure.structure_breakdown?.map((step: string, i: number) => (
                                <div key={i} className="relative flex items-start group">
                                    <div className="w-8 h-8 rounded-full bg-white border-2 border-indigo-100 text-indigo-600 font-bold text-sm flex items-center justify-center mr-3 z-10 shrink-0 shadow-sm group-hover:border-indigo-500 group-hover:text-indigo-700 transition-colors">
                                        {i + 1}
                                    </div>
                                    <div className="bg-white p-3 rounded border border-gray-200 text-sm text-gray-700 flex-1 shadow-sm group-hover:shadow-md transition-shadow">
                                        {step}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CTA Strategy */}
                    <div className="bg-green-50 p-4 rounded-lg border border-green-100 flex items-start">
                         <MessageCircle size={18} className="text-green-600 mr-3 mt-0.5" />
                         <div>
                             <h4 className="text-sm font-bold text-green-900 mb-1">互动诱饵 (CTA)</h4>
                             <p className="text-sm text-green-800">{remixStructure.cta_strategy || '引导评论区讨论'}</p>
                         </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end rounded-b-xl">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors shadow-sm"
                    >
                        关闭
                    </button>
                </div>
            </div>
        </div>
    );
}
