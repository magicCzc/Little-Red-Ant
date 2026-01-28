import React from 'react';
import { Layers, Film, Loader2, Play, Settings, Wand2, Video, Music, Volume2, CheckCircle, Library } from 'lucide-react';
import { VideoProject } from './types';

interface VideoPreviewSidebarProps {
    project: VideoProject;
    previewIndex: number | null;
    previewVideoRef: React.RefObject<HTMLVideoElement>;
    handlePlayAll: () => void;
    handlePreviewEnded: () => void;
    completedCount: number;
    handleBatchGenerate: () => void;
    activeTab: 'stock' | 'uploads';
    setActiveTab: (tab: 'stock' | 'uploads') => void;
    stockMusic: { title: string; url: string }[];
    handleSelectBgm: (url: string) => void;
    openAssetSelector: (type: 'audio') => void;
    uploadedAssets: any[];
    setShowCharacterModal: (show: boolean) => void;
}

const VideoPreviewSidebar: React.FC<VideoPreviewSidebarProps> = ({
    project,
    previewIndex,
    previewVideoRef,
    handlePlayAll,
    handlePreviewEnded,
    completedCount,
    handleBatchGenerate,
    activeTab,
    setActiveTab,
    stockMusic,
    handleSelectBgm,
    openAssetSelector,
    uploadedAssets,
    setShowCharacterModal
}) => {
    return (
        <div className="lg:col-span-1 flex flex-col gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 flex items-center">
                        <Layers size={18} className="mr-2 text-indigo-600" />
                        合成预览
                    </h3>
                    <button className="text-xs text-indigo-600 font-medium hover:text-indigo-800">刷新预览</button>
                </div>
                <div className="aspect-[9/16] bg-black relative group flex items-center justify-center overflow-hidden">
                    {/* Stitched video preview */}
                    {project.final_video_url ? (
                        <video 
                            src={project.final_video_url} 
                            controls 
                            className="w-full h-full object-contain"
                        />
                    ) : previewIndex !== null && project.scenes[previewIndex] ? (
                        <div className="w-full h-full relative">
                            <video 
                                ref={previewVideoRef}
                                src={project.scenes[previewIndex].video_url} 
                                controls 
                                autoPlay
                                onEnded={handlePreviewEnded}
                                className="w-full h-full object-contain"
                            />
                            <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                                预览中: 分镜 {project.scenes[previewIndex].scene_index + 1}
                            </div>
                        </div>
                    ) : (
                        completedCount > 0 ? (
                            <div className="text-center text-gray-400">
                                <Film size={48} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm">选择分镜进行预览</p>
                            </div>
                        ) : (
                            <div className="text-center text-gray-500">
                                <p className="text-sm">生成分镜后开始合成</p>
                            </div>
                        )
                    )}
                </div>
                <div className="p-4 bg-white">
                    <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
                        <span>预估时长</span>
                        <span className="font-mono font-bold">~{project.scenes.length * 4}s</span>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={handlePlayAll}
                            disabled={previewIndex !== null}
                            className={`flex-1 py-2 rounded text-sm font-medium flex justify-center items-center transition-colors
                                ${previewIndex !== null ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}
                            `}
                        >
                            {previewIndex !== null ? (
                                <>
                                    <Loader2 size={16} className="mr-2 animate-spin" /> 播放中...
                                </>
                            ) : (
                                <>
                                    <Play size={16} className="mr-2" /> 播放全部 (预览)
                                </>
                            )}
                        </button>
                        <button 
                            onClick={() => setShowCharacterModal(true)}
                            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded"
                            title="配置全局人设"
                        >
                            <Settings size={18} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-indigo-50 rounded-xl p-5 border border-indigo-100">
                 <h4 className="font-bold text-indigo-900 mb-2 flex items-center">
                    <Wand2 size={16} className="mr-2" />
                    生产助手
                 </h4>
                 <p className="text-xs text-indigo-700 mb-4 leading-relaxed">
                    已准备好生成视频。 
                    当前共有 <strong>{project.scenes.length} 个分镜</strong>。
                 </p>
                 <button 
                    onClick={handleBatchGenerate}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex justify-center items-center"
                 >
                    <Video size={16} className="mr-2" />
                    批量生成所有分镜
                 </button>
            </div>

            {/* Background Music Selector */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-gray-800 flex items-center text-sm">
                        <Music size={16} className="mr-2 text-pink-500" />
                        背景音乐 (BGM)
                    </h4>
                    <div className="flex bg-gray-100 rounded-lg p-0.5">
                        <button 
                            onClick={() => setActiveTab('stock')}
                            className={`px-2 py-1 text-[10px] font-medium rounded-md transition-all ${activeTab === 'stock' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                        >
                            推荐
                        </button>
                        <button 
                            onClick={() => setActiveTab('uploads')}
                            className={`px-2 py-1 text-[10px] font-medium rounded-md transition-all ${activeTab === 'uploads' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                        >
                            我的上传
                        </button>
                    </div>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {activeTab === 'stock' ? (
                        stockMusic.map((track) => (
                            <button
                                key={track.title}
                                onClick={() => handleSelectBgm(track.url)}
                                className={`w-full text-left px-3 py-2 rounded text-xs flex items-center justify-between transition-colors
                                    ${project.bgm_url === track.url 
                                        ? 'bg-pink-50 text-pink-700 border border-pink-200 font-medium' 
                                        : 'hover:bg-gray-50 text-gray-600 border border-transparent'
                                    }`}
                            >
                                <span className="flex items-center">
                                    {project.bgm_url === track.url && <Volume2 size={12} className="mr-2 animate-pulse" />}
                                    {track.title}
                                </span>
                                {project.bgm_url === track.url && <CheckCircle size={12} />}
                            </button>
                        ))
                    ) : (
                        <>
                            <button 
                                onClick={() => openAssetSelector('audio')}
                                className="flex items-center justify-center w-full px-4 py-2 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors mb-2 text-xs font-medium"
                            >
                                <Library size={14} className="mr-2" />
                                从素材库选择
                            </button>
                            
                            {uploadedAssets.length === 0 && (
                                <div className="text-center py-4 text-gray-400 text-xs">
                                    暂无上传音乐，请点击上方按钮选择
                                </div>
                            )}
                            
                            {uploadedAssets.map((asset) => (
                                    <button
                                        key={asset.id}
                                        onClick={() => handleSelectBgm(asset.url)}
                                        className={`w-full text-left px-3 py-2 rounded text-xs flex items-center justify-between transition-colors
                                            ${project.bgm_url === asset.url 
                                                ? 'bg-pink-50 text-pink-700 border border-pink-200 font-medium' 
                                                : 'hover:bg-gray-50 text-gray-600 border border-transparent'
                                            }`}
                                    >
                                        <span className="flex items-center truncate max-w-[150px]">
                                            {project.bgm_url === asset.url && <Volume2 size={12} className="mr-2 flex-shrink-0 animate-pulse" />}
                                            <span className="truncate">{asset.filename}</span>
                                        </span>
                                        {project.bgm_url === asset.url && <CheckCircle size={12} />}
                                    </button>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VideoPreviewSidebar;
