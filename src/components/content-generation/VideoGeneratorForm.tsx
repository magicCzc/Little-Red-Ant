import React from 'react';
import { Film, Loader2, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

interface VideoGeneratorFormProps {
    videoMode: 't2v' | 'i2v';
    setVideoMode: (mode: 't2v' | 'i2v') => void;
    videoPrompt: string;
    setVideoPrompt: (val: string) => void;
    videoImageUrl: string;
    setVideoImageUrl: (val: string) => void;
    videoLoading: boolean;
    videoError: string | null;
    onGenerateVideo: (e: React.FormEvent) => void;
}

export default function VideoGeneratorForm({
    videoMode, setVideoMode, videoPrompt, setVideoPrompt,
    videoImageUrl, setVideoImageUrl, videoLoading, videoError,
    onGenerateVideo
}: VideoGeneratorFormProps) {
    return (
        <div className="space-y-6">
            {/* Mode Switcher */}
            <div className="bg-white p-1 rounded-lg border border-gray-200 flex">
                <button 
                    onClick={() => setVideoMode('t2v')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${videoMode === 't2v' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    文生视频
                </button>
                <button 
                    onClick={() => setVideoMode('i2v')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${videoMode === 'i2v' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    图生视频
                </button>
            </div>
    
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                <form onSubmit={onGenerateVideo} className="space-y-4">
                    {videoMode === 'i2v' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                参考图片 URL <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={videoImageUrl} 
                                    onChange={e => setVideoImageUrl(e.target.value)}
                                    placeholder="请输入图片 URL (例如从图文笔记生成的图片)"
                                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                    required
                                />
                                {videoImageUrl && (
                                    <div className="mt-2 w-20 h-20 rounded bg-gray-100 overflow-hidden border border-gray-200">
                                        <img src={videoImageUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                提示: 您可以从"图文笔记"中生成图片，然后点击图片上的"生成视频"按钮自动跳转到这里。
                            </p>
                        </div>
                    )}
    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            视频提示词 <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <textarea
                                rows={5}
                                value={videoPrompt}
                                onChange={(e) => setVideoPrompt(e.target.value)}
                                placeholder={videoMode === 't2v' ? "描述你想生成的视频内容... (支持中英文)" : "描述如何让图片动起来... (例如: 镜头缓慢推进，光影变化)"}
                                required
                                className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm pr-24"
                            />
                            <button
                                type="button"
                                onClick={async () => {
                                    if (!videoPrompt) return toast.error('请先输入提示词');
                                    const toastId = toast.loading('正在优化提示词...');
                                    try {
                                        const res = await axios.post('/api/generate/optimize-prompt', { prompt: videoPrompt, type: 'video' });
                                        setVideoPrompt(res.data.optimizedPrompt || '');
                                        toast.success('提示词已优化', { id: toastId });
                                    } catch (e) {
                                        toast.error('优化失败', { id: toastId });
                                    }
                                }}
                                className="absolute bottom-2 right-2 bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs hover:bg-purple-200 flex items-center gap-1 transition-colors"
                            >
                                <Sparkles size={12} /> AI 优化
                            </button>
                        </div>
                    </div>
                    
                    {videoError && (
                        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md">{videoError}</div>
                    )}
    
                    <button
                        type="submit"
                        disabled={videoLoading || !videoPrompt.trim()}
                        className={`
                            w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                            ${videoLoading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}
                        `}
                    >
                        {videoLoading ? (
                            <>
                                <Loader2 className="animate-spin mr-2" size={18} />
                                视频生成中 (需要2-5分钟)...
                            </>
                        ) : (
                            <>
                                <Film className="mr-2" size={18} />
                                开始生成视频
                            </>
                        )}
                    </button>
                    <p className="text-xs text-gray-500 text-center mt-2">
                        * 建议使用 "AI 帮我优化" 将提示词转换为英文，生成效果更好
                    </p>
                </form>
            </div>
        </div>
    );
}
