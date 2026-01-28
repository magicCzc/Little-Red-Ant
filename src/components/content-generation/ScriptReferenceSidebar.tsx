import React from 'react';
import { Sparkles, Video, Eye, X, Film } from 'lucide-react';
import toast from 'react-hot-toast';

interface ScriptReferenceSidebarProps {
    remixStructure: any;
    setRemixStructure: (val: any) => void;
    remixSourceTitle: string;
    setRemixSourceTitle: (val: string) => void;
    setTopic: (val: string) => void;
    setShowStructureModal: (val: boolean) => void;
}

export default function ScriptReferenceSidebar({
    remixStructure, setRemixStructure, remixSourceTitle, setRemixSourceTitle,
    setTopic, setShowStructureModal
}: ScriptReferenceSidebarProps) {
    if (remixStructure) {
        return (
            <div className="bg-white p-5 rounded-lg shadow-sm border-2 border-indigo-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-indigo-100 text-indigo-600 text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                    REMIX MODE
                </div>
                <h3 className="text-sm font-bold text-indigo-800 flex items-center mb-4">
                    <Sparkles size={16} className="mr-2 text-indigo-600" />
                    仿写源
                </h3>
                
                <div className="space-y-4">
                    <div className="bg-indigo-50/50 p-3 rounded-md border border-indigo-50">
                        <span className="text-xs font-semibold text-indigo-400 block mb-1">原视频主题</span>
                        <p className="text-sm font-medium text-indigo-900 line-clamp-2">
                            {remixSourceTitle}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-gray-50 p-2 rounded border border-gray-100">
                            <span className="text-[10px] text-gray-400 block">开头钩子</span>
                            <span className="text-xs font-medium text-gray-700">{remixStructure.hook_type || '通用'}</span>
                        </div>
                        <div className="bg-gray-50 p-2 rounded border border-gray-100">
                            <span className="text-[10px] text-gray-400 block">情感基调</span>
                            <span className="text-xs font-medium text-gray-700">{remixStructure.tone || '默认'}</span>
                        </div>
                    </div>

                    {remixStructure.visual_analysis && (
                        <div className="bg-purple-50 p-3 rounded-md border border-purple-100">
                            <div className="flex items-center text-purple-800 mb-1">
                                <Video size={12} className="mr-1" />
                                <span className="text-xs font-bold">视觉风格提取</span>
                            </div>
                            <p className="text-xs text-purple-700 line-clamp-3 leading-relaxed">
                                {remixStructure.visual_analysis}
                            </p>
                        </div>
                    )}

                    <button 
                        onClick={() => setShowStructureModal(true)}
                        className="w-full py-2 text-xs text-indigo-600 bg-white border border-indigo-200 rounded hover:bg-indigo-50 transition-colors flex items-center justify-center"
                    >
                        <Eye size={12} className="mr-1" /> 查看完整结构数据
                    </button>
                    
                    <button 
                        onClick={() => {
                            setRemixStructure(null);
                            setRemixSourceTitle('');
                            setTopic(''); // Clear topic on cancel
                            toast('已退出仿写模式');
                        }}
                        className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 flex items-center justify-center"
                    >
                        <X size={12} className="mr-1" /> 取消仿写，新建脚本
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-5 rounded-lg shadow-sm border border-indigo-100">
            <h3 className="text-sm font-bold text-indigo-800 flex items-center mb-3">
                <Film size={16} className="mr-2" />
                短视频黄金法则
            </h3>
            <div className="space-y-3">
                <div className="flex items-start">
                    <span className="bg-indigo-100 text-indigo-600 text-xs font-bold px-1.5 py-0.5 rounded mr-2 mt-0.5">3s</span>
                    <p className="text-xs text-indigo-700 leading-relaxed">
                        <strong>黄金前3秒：</strong> 开头必须有视觉冲击或悬念钩子，完播率的关键。
                    </p>
                </div>
                <div className="flex items-start">
                    <span className="bg-indigo-100 text-indigo-600 text-xs font-bold px-1.5 py-0.5 rounded mr-2 mt-0.5">视听</span>
                    <p className="text-xs text-indigo-700 leading-relaxed">
                        <strong>视听结合：</strong> 画面要配合口播节奏，避免"念稿式"枯燥画面。
                    </p>
                </div>
                <div className="flex items-start">
                    <span className="bg-indigo-100 text-indigo-600 text-xs font-bold px-1.5 py-0.5 rounded mr-2 mt-0.5">结构</span>
                    <p className="text-xs text-indigo-700 leading-relaxed">
                        <strong>情绪曲线：</strong> 引入 → 痛点 → 解决方案 → 升华/反转 → 互动。
                    </p>
                </div>
            </div>
        </div>
    );
}
