import React from 'react';
import { Loader2, AlertCircle, Film, Music, RefreshCw, Mic, PlusCircle } from 'lucide-react';
import { VideoProject, VideoScene } from './types';

interface VideoSceneListProps {
    project: VideoProject;
    activeSceneId: string | null;
    setActiveSceneId: (id: string) => void;
    handleGenerateScene: (scene: VideoScene) => void;
    handleGenerateAudio: (scene: VideoScene) => void;
    openAssetSelector: (type: 'audio' | 'video', sceneId?: string) => void;
    completedCount: number;
}

const VideoSceneList: React.FC<VideoSceneListProps> = ({
    project,
    activeSceneId,
    setActiveSceneId,
    handleGenerateScene,
    handleGenerateAudio,
    openAssetSelector,
    completedCount
}) => {
    return (
        <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-bold text-gray-800">分镜脚本</h2>
                <div className="text-sm text-gray-500">
                    已完成 {completedCount} / {project.scenes.length}
                </div>
            </div>

            <div className="space-y-4 pb-12">
                {project.scenes.map((scene) => (
                    <div 
                        key={scene.id} 
                        className={`bg-white rounded-lg border transition-all duration-200 overflow-hidden
                            ${activeSceneId === scene.id ? 'ring-2 ring-indigo-500 shadow-md' : 'border-gray-200 shadow-sm hover:shadow-md'}
                        `}
                        onClick={() => setActiveSceneId(scene.id)}
                    >
                        <div className="flex flex-col md:flex-row h-full">
                            {/* Visual / Video Area */}
                            <div className="md:w-1/3 bg-gray-100 relative min-h-[160px]">
                                {scene.status === 'COMPLETED' && scene.video_url ? (
                                    <video 
                                        src={scene.video_url} 
                                        className="w-full h-full object-cover" 
                                        controls 
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                                        {scene.status === 'GENERATING' ? (
                                            <>
                                                <Loader2 className="animate-spin text-indigo-600 mb-2" size={24} />
                                                <span className="text-xs text-indigo-600 font-medium">生成中...</span>
                                            </>
                                        ) : scene.status === 'FAILED' ? (
                                            <>
                                                <AlertCircle className="text-red-500 mb-2" size={24} />
                                                <span className="text-xs text-red-500">生成失败</span>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleGenerateScene(scene); }}
                                                    className="mt-2 text-xs underline text-red-600"
                                                >
                                                    重试
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <Film className="text-gray-300 mb-2" size={32} />
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleGenerateScene(scene); }}
                                                    className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition-colors shadow-sm"
                                                >
                                                    生成视频
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                                <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                                    分镜 {scene.scene_index + 1}
                                </div>
                            </div>

                            {/* Script Details */}
                            <div className="flex-1 p-4 flex flex-col justify-between">
                                <div className="space-y-3">
                                    <div>
                                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1 block">画面提示词 (Prompt)</span>
                                        <p className="text-sm text-gray-800 leading-relaxed">{scene.script_visual}</p>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-1 block flex items-center">
                                            <Music size={10} className="mr-1" /> 口播文案
                                        </span>
                                        <p className="text-sm text-gray-600 italic bg-gray-50 p-2 rounded border border-gray-100 mb-2">
                                            "{scene.script_audio}"
                                        </p>
                                        
                                        {/* Audio Controls */}
                                        <div className="flex items-center gap-2 mt-2">
                                            {scene.audio_url ? (
                                                <div className="flex items-center gap-2 bg-green-50 px-2 py-1 rounded-full border border-green-100 w-full">
                                                    <audio 
                                                        controls 
                                                        src={scene.audio_url} 
                                                        className="h-6 w-full max-w-[150px]" 
                                                        style={{ height: '24px' }}
                                                    />
                                                    <span className="text-[10px] text-green-700 font-mono whitespace-nowrap">
                                                        {scene.duration?.toFixed(1)}s
                                                    </span>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleGenerateAudio(scene); }}
                                                        className="p-1 hover:bg-green-100 rounded-full text-green-600"
                                                        title="重新生成配音"
                                                    >
                                                        <RefreshCw size={12} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleGenerateAudio(scene); }}
                                                    className="flex items-center px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-200 hover:bg-green-100 transition-colors"
                                                >
                                                    <Mic size={12} className="mr-1" />
                                                    生成配音
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex justify-end mt-4 pt-3 border-t border-gray-50">
                                    <div className="flex gap-2">
                                            {/* Actions */}
                                            <button 
                                            onClick={(e) => { e.stopPropagation(); openAssetSelector('video', scene.id); }}
                                            className="text-gray-400 hover:text-indigo-600 p-1" 
                                            title="从素材库替换视频"
                                            >
                                                <PlusCircle size={14} />
                                            </button>
                                            {scene.status === 'COMPLETED' && (
                                                <button 
                                                onClick={(e) => { e.stopPropagation(); handleGenerateScene(scene); }}
                                                className="text-gray-400 hover:text-indigo-600 p-1" 
                                                title="重新生成视频"
                                                >
                                                    <RefreshCw size={14} />
                                                </button>
                                            )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default VideoSceneList;
