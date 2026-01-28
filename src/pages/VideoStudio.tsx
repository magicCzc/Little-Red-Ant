import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    Loader2, AlertCircle, Settings, Sparkles
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import AssetSelector from '../components/AssetSelector';
import Timeline from '../components/video/Timeline';
import VideoProjectHeader from '../components/video/VideoProjectHeader';
import VideoPreviewSidebar from '../components/video/VideoPreviewSidebar';
import VideoSceneList from '../components/video/VideoSceneList';
import { useAccount } from '../context/AccountContext';
import { VideoProject, VideoScene } from '../components/video/types';
import { Skeleton } from '../components/ui/Skeleton';

const STOCK_MUSIC = [
    { title: 'Happy Day', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
    { title: 'Cinematic Ambient', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
    { title: 'Upbeat Corporate', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3' },
    { title: 'No Music', url: '' }
];

const VideoStudio: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [project, setProject] = useState<VideoProject | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
    const [generatingSceneIds, setGeneratingSceneIds] = useState<Set<string>>(new Set());
    const [characterDesc, setCharacterDesc] = useState<string>('');
    const [showCharacterModal, setShowCharacterModal] = useState(false);
    const { activeAccount } = useAccount(); // Use Global Context
    
    // Assets State
    const [activeTab, setActiveTab] = useState<'stock' | 'uploads'>('stock');
    const [uploadedAssets, setUploadedAssets] = useState<any[]>([]);
    const [isAssetSelectorOpen, setIsAssetSelectorOpen] = useState(false);
    const [assetSelectorType, setAssetSelectorType] = useState<'audio' | 'video'>('audio');
    const [targetSceneId, setTargetSceneId] = useState<string | null>(null); // For replacing scene video
    
    // Model Settings
    const [selectedModel, setSelectedModel] = useState<string>('');

    // Polling interval ref
    const pollRef = useRef<NodeJS.Timeout | null>(null);

    const [previewIndex, setPreviewIndex] = useState<number | null>(null);
    const previewVideoRef = useRef<HTMLVideoElement>(null);

    const handlePlayAll = () => {
        if (!project || project.scenes.length === 0) return;
        
        // Find first completed video
        const firstVideoIndex = project.scenes.findIndex(s => s.status === 'COMPLETED' && s.video_url);
        if (firstVideoIndex === -1) {
            toast.error('暂无已生成的分镜视频');
            return;
        }
        
        setPreviewIndex(firstVideoIndex);
    };

    const handlePreviewEnded = () => {
        if (previewIndex === null || !project) return;
        
        // Find next completed video
        let nextIndex = -1;
        for (let i = previewIndex + 1; i < project.scenes.length; i++) {
            if (project.scenes[i].status === 'COMPLETED' && project.scenes[i].video_url) {
                nextIndex = i;
                break;
            }
        }
        
        if (nextIndex !== -1) {
            setPreviewIndex(nextIndex);
            // Auto play next
            setTimeout(() => {
                if (previewVideoRef.current) {
                    previewVideoRef.current.play();
                }
            }, 100);
        } else {
            setPreviewIndex(null); // Stop
        }
    };
    
    // Publish State
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [publishData, setPublishData] = useState({
        title: '',
        content: '',
        autoPublish: false,
        scheduledTime: ''
    });

    const handlePublish = async () => {
        if (!project?.final_video_url) return;
        
        setIsPublishing(true);
        const toastId = toast.loading('正在检查账号状态...');
        
        try {
            // 1. Check Account Status (From Context or Re-fetch if needed)
            // Ideally we trust Context, but for critical actions like publish, double check is fine.
            // But since we use useAccount(), we can just check activeAccount
            
            if (!activeAccount) {
                toast.error('未检测到活跃账号，请先在"账号矩阵"中登录', { id: toastId });
                setIsPublishing(false);
                return;
            }
            
            toast.loading(`正在使用账号 [${activeAccount?.nickname || '当前账号'}] 提交任务...`, { id: toastId });

            // 2. Submit Task
            const payload = {
                projectId: project.id,
                title: publishData.title,
                content: publishData.content,
                tags: project.tags || [],
                videoPath: project.final_video_url, // Backend will resolve this
                autoPublish: publishData.autoPublish,
                scheduledAt: publishData.scheduledTime ? new Date(publishData.scheduledTime).toISOString() : undefined
            };

            const res = await axios.post('/api/publish/publish', payload);
            const { taskId } = res.data;
            
            // Update local state immediately
            setProject(prev => prev ? { ...prev, publish_status: 'PUBLISHING', publish_task_id: taskId } : null);

            if (publishData.scheduledTime) {
                toast.success(`定时任务已设置，将于 ${new Date(publishData.scheduledTime).toLocaleString()} 发布`, { id: toastId });
                setShowPublishModal(false);
                return;
            }

            toast.success('发布任务已提交，请在全局任务监控中查看进度', { id: toastId });
            setShowPublishModal(false);
        } catch (error: any) {
            console.error(error);
            const errorMsg = error.response?.data?.error || error.message || '发布失败';
            toast.error(`发布失败: ${errorMsg}`, { id: toastId });
        } finally {
            setIsPublishing(false);
        }
    };

    useEffect(() => {
        fetchProject();
        fetchAssets();
        fetchSettings();
        return () => stopPolling();
    }, [id]);

    const fetchSettings = async () => {
        try {
            const res = await axios.get('/api/settings');
            if (res.data.aliyun_video_model) {
                setSelectedModel(res.data.aliyun_video_model);
            } else {
                setSelectedModel('wan2.1-t2v-plus'); // Default fallback
            }
        } catch (e) {
            console.warn('Failed to fetch settings');
        }
    };

    const fetchAssets = async () => {
        try {
            const res = await axios.get('/api/assets?type=audio');
            if (res.data.success) {
                setUploadedAssets(res.data.data);
            }
        } catch (error) {
            console.error('Failed to load assets');
        }
    };
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleUploadAsset = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const formData = new FormData();
        formData.append('file', file);
        
        const toastId = toast.loading('Uploading...');
        try {
            const res = await axios.post('/api/assets/upload/audio', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.success) {
                toast.success('Upload successful', { id: toastId });
                fetchAssets();
                setActiveTab('uploads');
            }
        } catch (error) {
            toast.error('Upload failed', { id: toastId });
        }
    };

    // Start polling if there are generating scenes OR publishing
    useEffect(() => {
        const isPublishing = project?.publish_status === 'PUBLISHING';
        const isGenerating = generatingSceneIds.size > 0;

        if ((isGenerating || isPublishing) && !pollRef.current) {
            pollRef.current = setInterval(fetchProject, 5000);
        } else if (!isGenerating && !isPublishing && pollRef.current) {
            stopPolling();
        }
    }, [generatingSceneIds, project?.publish_status]);

    const stopPolling = () => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    };

    const fetchProject = async () => {
        try {
            const res = await axios.get(`/api/video-projects/${id}`);
            if (res.data.success) {
                const proj = res.data.data;
                setProject(proj);
                if (proj.character_desc && !characterDesc) {
                    setCharacterDesc(proj.character_desc);
                }
                
                // Update generating set
                const newGenerating = new Set<string>();
                proj.scenes.forEach((s: VideoScene) => {
                    if (s.status === 'GENERATING' || s.status === 'PENDING') {
                        // Note: PENDING might imply queue, so we poll for those too
                        if (s.task_id) newGenerating.add(s.id); 
                    }
                });
                setGeneratingSceneIds(newGenerating);
            }
        } catch (error) {
            toast.error('Failed to load project');
            navigate('/generate');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateAudio = async (scene: VideoScene) => {
        const toastId = toast.loading('Generating audio...');
        try {
            const res = await axios.post(`/api/video-projects/scenes/${scene.id}/audio`, {
                text: scene.script_audio,
                voice: 'zh-CN-XiaoxiaoNeural' // We can make this selectable later
            });
            
            if (res.data.success) {
                toast.success('Audio generated!', { id: toastId });
                fetchProject();
            }
        } catch (error) {
            toast.error('Failed to generate audio', { id: toastId });
        }
    };

    const handleGenerateScene = async (scene: VideoScene) => {
        if (!scene.duration && !window.confirm('该分镜尚未生成配音，视频时长将默认为 5 秒。是否继续？')) {
            return;
        }

        try {
            // Optimistic update
            setGeneratingSceneIds(prev => new Set(prev).add(scene.id));
            
            // Update UI to generating
            await axios.patch(`/api/video-projects/scenes/${scene.id}`, {
                status: 'GENERATING'
            });
            
            // Trigger background task (Async)
            // Prepend Character Description to ensure consistency
            const finalPrompt = characterDesc 
                ? `(Character Reference: ${characterDesc}) ${scene.script_visual}`
                : scene.script_visual;

            const res = await axios.post('/api/generate/video', {
                prompt: finalPrompt,
                model: 'wan2.1-t2v-turbo', 
                duration: scene.duration || 5,
                sceneId: scene.id // Pass sceneId so worker can update DB directly
            });

            const { taskId } = res.data;
            toast.success('视频生成任务已加入后台队列');

            // Update local scene status to reflect it's being handled by a task
            setProject(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    scenes: prev.scenes.map(s => s.id === scene.id ? { ...s, status: 'GENERATING', task_id: taskId } : s)
                };
            });

        } catch (error) {
            toast.error('无法开始生成任务');
            setGeneratingSceneIds(prev => {
                const next = new Set(prev);
                next.delete(scene.id);
                return next;
            });
            await axios.patch(`/api/video-projects/scenes/${scene.id}`, { status: 'FAILED' });
            fetchProject();
        }
    };

    const [showBatchConfirmModal, setShowBatchConfirmModal] = useState(false);
    const [missingVideoCount, setMissingVideoCount] = useState(0);

    const handleBatchGenerate = async () => {
        if (!project) return;
        
        // 1. Check for missing audio
        const missingAudio = project.scenes.filter(s => !s.audio_url);
        if (missingAudio.length > 0) {
            const confirmAudio = window.confirm(`检测到 ${missingAudio.length} 个分镜缺少配音。是否先批量生成配音？(推荐，以确保声画同步)`);
            if (confirmAudio) {
                const toastId = toast.loading(`正在为 ${missingAudio.length} 个分镜生成配音...`);
                // Process in sequence to avoid rate limits
                for (const scene of missingAudio) {
                    try {
                        await axios.post(`/api/video-projects/scenes/${scene.id}/audio`, {
                            text: scene.script_audio,
                            voice: 'zh-CN-XiaoxiaoNeural'
                        });
                    } catch (e) {
                        console.error(e);
                    }
                }
                toast.success('批量配音生成完成', { id: toastId });
                await fetchProject();
                return; 
            }
        }

        // 2. Identify Missing Videos
        const missingVideo = project.scenes.filter(s => (s.status === 'PENDING' || s.status === 'FAILED') && s.duration);
        if (missingVideo.length === 0) {
            if (project.scenes.some(s => s.status === 'PENDING' && !s.duration)) {
                 toast.error('仍有分镜缺少配音，请先生成配音。');
            } else {
                 toast.success('所有视频已生成或正在生成中！');
            }
            return;
        }

        setMissingVideoCount(missingVideo.length);
        setShowBatchConfirmModal(true);
    };

    const confirmBatchGenerate = () => {
        setShowBatchConfirmModal(false);
        const missingVideo = project?.scenes.filter(s => (s.status === 'PENDING' || s.status === 'FAILED') && s.duration) || [];
        
        missingVideo.forEach(scene => {
            handleGenerateScene(scene);
        });
        toast.success(`已开始批量生成 ${missingVideo.length} 个分镜视频`);
    };

    const handleExport = async () => {
        if (completedCount < 2) return;
        
        const toastId = toast.loading('正在提交视频合成任务...');
        try {
            const res = await axios.post(`/api/video-projects/${id}/stitch`);
            if (res.data.success) {
                toast.success('合成任务已提交！请留意全局任务监控。', { id: toastId });
                // We assume the backend now returns a taskId or at least we treat it as async
                // For now, if the API is sync, it will return the URL. 
                // If we want "Real Feedback", we should rely on polling `fetchProject` which we already do.
                // Let's assume `fetchProject` will pick up the new `final_video_url` when it's ready.
                
                // If the API returns a URL immediately (legacy mode), we update state.
                if (res.data.url) {
                    setProject(prev => prev ? { ...prev, final_video_url: res.data.url } : null);
                }
            }
        } catch (error) {
            toast.error('合成请求失败', { id: toastId });
        }
    };

    const handleSelectBgm = async (url: string) => {
        if (!project) return;
        try {
            await axios.patch(`/api/video-projects/${id}/bgm`, { bgmUrl: url });
            setProject(prev => prev ? { ...prev, bgm_url: url } : null);
            toast.success('Background music updated');
        } catch (error) {
            toast.error('Failed to update music');
        }
    };

    const handleReplaceSceneVideo = async (sceneId: string, videoUrl: string) => {
        const toastId = toast.loading('Updating scene video...');
        try {
            await axios.patch(`/api/video-projects/scenes/${sceneId}`, {
                status: 'COMPLETED',
                videoUrl: videoUrl
            });
            
            setProject(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    scenes: prev.scenes.map(s => s.id === sceneId ? { ...s, status: 'COMPLETED', video_url: videoUrl } : s)
                };
            });
            
            toast.success('Scene updated', { id: toastId });
        } catch (error) {
            toast.error('Failed to update scene', { id: toastId });
        }
    };

    const openAssetSelector = (type: 'audio' | 'video', sceneId?: string) => {
        setAssetSelectorType(type);
        setTargetSceneId(sceneId || null);
        setIsAssetSelectorOpen(true);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col">
                <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
                    <div className="flex items-center gap-4">
                        <Skeleton className="w-8 h-8 rounded-full" />
                        <div className="space-y-2">
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-3 w-32" />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Skeleton className="h-10 w-32 rounded-lg" />
                        <Skeleton className="h-10 w-32 rounded-lg" />
                    </div>
                </header>
                <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8 mb-48">
                    <div className="lg:col-span-1 flex flex-col gap-6">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-[400px] p-4 flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <Skeleton className="h-6 w-24" />
                                <Skeleton className="h-4 w-12" />
                            </div>
                            <Skeleton className="flex-1 w-full rounded-lg bg-gray-100" />
                            <div className="flex gap-2 mt-4">
                                <Skeleton className="h-10 flex-1" />
                                <Skeleton className="h-10 w-12" />
                            </div>
                        </div>
                        <Skeleton className="h-32 w-full rounded-xl" />
                        <Skeleton className="h-64 w-full rounded-xl" />
                    </div>
                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex justify-between items-center mb-2">
                            <Skeleton className="h-6 w-24" />
                            <Skeleton className="h-4 w-16" />
                        </div>
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 h-48 flex gap-4">
                                <Skeleton className="w-1/3 h-full rounded-md" />
                                <div className="flex-1 flex flex-col gap-3">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-16 w-full rounded-md mt-auto" />
                                </div>
                            </div>
                        ))}
                    </div>
                </main>
            </div>
        );
    }

    if (!project) return <div>Project not found</div>;

    const completedCount = project.scenes.filter(s => s.status === 'COMPLETED').length;
    const progress = Math.round((completedCount / project.scenes.length) * 100);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <VideoProjectHeader 
                project={project}
                progress={progress}
                navigate={navigate}
                handleExport={handleExport}
                setShowPublishModal={setShowPublishModal}
                setPublishData={setPublishData}
            />

            <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8 mb-48">
                
                <VideoPreviewSidebar 
                    project={project}
                    previewIndex={previewIndex}
                    previewVideoRef={previewVideoRef}
                    handlePlayAll={handlePlayAll}
                    handlePreviewEnded={handlePreviewEnded}
                    completedCount={completedCount}
                    handleBatchGenerate={handleBatchGenerate}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    stockMusic={STOCK_MUSIC}
                    handleSelectBgm={handleSelectBgm}
                    openAssetSelector={openAssetSelector}
                    uploadedAssets={uploadedAssets}
                    setShowCharacterModal={setShowCharacterModal}
                />

                <AssetSelector
                    isOpen={isAssetSelectorOpen}
                    onClose={() => setIsAssetSelectorOpen(false)}
                    type={assetSelectorType}
                    onSelect={(asset) => {
                        if (assetSelectorType === 'audio') {
                            handleSelectBgm(asset.url);
                            // Add to local uploaded list if not exists
                            if (!uploadedAssets.find(a => a.id === asset.id)) {
                                setUploadedAssets(prev => [asset, ...prev]);
                            }
                        } else if (assetSelectorType === 'video' && targetSceneId) {
                            handleReplaceSceneVideo(targetSceneId, asset.url);
                        }
                        setIsAssetSelectorOpen(false);
                    }}
                />

                <VideoSceneList 
                    project={project}
                    activeSceneId={activeSceneId}
                    setActiveSceneId={setActiveSceneId}
                    handleGenerateScene={handleGenerateScene}
                    handleGenerateAudio={handleGenerateAudio}
                    openAssetSelector={openAssetSelector}
                    completedCount={completedCount}
                />
            </main>

            {/* Bottom Timeline */}
            <div className="fixed bottom-0 left-0 right-0 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                <Timeline 
                    scenes={project.scenes}
                    activeSceneId={activeSceneId}
                    onSceneClick={setActiveSceneId}
                />
            </div>

            {/* Publish Modal - Kept local for now or can be extracted too */}
            {showPublishModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
                        <div className="p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                                <Sparkles className="mr-2 text-red-600" size={20} />
                                发布视频到小红书
                            </h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
                                    <input 
                                        type="text" 
                                        value={publishData.title}
                                        onChange={(e) => setPublishData({...publishData, title: e.target.value})}
                                        className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-red-500 focus:border-red-500"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">正文描述</label>
                                    <textarea 
                                        rows={4}
                                        value={publishData.content}
                                        onChange={(e) => setPublishData({...publishData, content: e.target.value})}
                                        className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-red-500 focus:border-red-500"
                                    />
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <label className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={publishData.autoPublish}
                                            onChange={(e) => setPublishData({...publishData, autoPublish: e.target.checked})}
                                            className="rounded text-red-600 focus:ring-red-500" 
                                        />
                                        <span>自动点击发布按钮</span>
                                    </label>
                                    
                                    <div className="flex items-center space-x-2">
                                        <span className="text-xs text-gray-500">定时发布:</span>
                                        <input 
                                            type="datetime-local"
                                            value={publishData.scheduledTime}
                                            onChange={(e) => setPublishData({...publishData, scheduledTime: e.target.value})}
                                            className="text-xs border border-gray-300 rounded p-1"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-100">
                                <button 
                                    onClick={() => setShowPublishModal(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm font-medium"
                                >
                                    取消
                                </button>
                                <button 
                                    onClick={handlePublish}
                                    disabled={isPublishing}
                                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium flex items-center"
                                >
                                    {isPublishing ? (
                                        <>
                                            <Loader2 size={16} className="mr-2 animate-spin" />
                                            处理中...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles size={16} className="mr-2" />
                                            确认发布
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Batch Confirm Modal */}
            {showBatchConfirmModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-lg shadow-xl max-w-sm w-full">
                        <div className="p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-2">批量生成确认</h3>
                            <p className="text-sm text-gray-600 mb-4">
                                即将为 {missingVideoCount} 个分镜生成视频。
                            </p>
                            <div className="mb-4 bg-gray-50 p-3 rounded text-xs text-gray-600">
                                <span className="font-bold">当前模型:</span> {selectedModel}
                                <br/>
                                <span className="text-gray-400">可以在"系统设置"中修改默认模型</span>
                            </div>
                            {!characterDesc && (
                                <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 text-xs rounded border border-yellow-100 flex items-start">
                                    <AlertCircle size={14} className="mr-1 mt-0.5 shrink-0" />
                                    <span>
                                        检测到未配置全局人设。为保证人物一致性，建议先在"设置"中配置人设。
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-end space-x-3">
                                <button 
                                    onClick={() => setShowBatchConfirmModal(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm font-medium"
                                >
                                    取消
                                </button>
                                <button 
                                    onClick={confirmBatchGenerate}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium"
                                >
                                    确认生成
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Character Settings Modal */}
            {showCharacterModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                        <div className="p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                                <Settings className="mr-2" size={20} />
                                全局人设配置 (Character Settings)
                            </h3>
                            <div className="space-y-4">
                                <div className="bg-indigo-50 p-3 rounded-md border border-indigo-100 text-xs text-indigo-700">
                                    <p className="font-bold mb-1">💡 为什么需要配置人设？</p>
                                    配置全局人设后，AI 将在生成每个分镜时强制应用此描述，从而确保不同分镜中的人物长相、穿着、风格保持一致，避免"换脸"现象。
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        人物/风格描述 (Character Prompt)
                                    </label>
                                    
                                    {activeAccount?.persona?.desc && (
                                        <button
                                            onClick={() => setCharacterDesc(activeAccount.persona.desc)}
                                            className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center mb-2 p-1.5 bg-indigo-50 rounded border border-indigo-100 transition-colors"
                                        >
                                            <Sparkles size={12} className="mr-1" />
                                            从当前账号 ({activeAccount.nickname}) 加载人设
                                        </button>
                                    )}

                                    <textarea
                                        value={characterDesc}
                                        onChange={(e) => setCharacterDesc(e.target.value)}
                                        placeholder="例如：25岁亚洲女性，黑色短发，穿着白色职业衬衫，淡妆，知性风格。 (建议使用英文描述以获得最佳效果)"
                                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm h-32"
                                    />
                                </div>
                                
                                <div className="flex justify-end space-x-3 pt-2">
                                    <button 
                                        onClick={() => setShowCharacterModal(false)}
                                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm font-medium"
                                    >
                                        取消
                                    </button>
                                    <button 
                                        onClick={async () => {
                                            if (!characterDesc.trim()) return;
                                            try {
                                                await axios.patch(`/api/video-projects/${id}/character`, { character_desc: characterDesc });
                                                toast.success('人设已保存，将应用于后续生成的视频');
                                                setShowCharacterModal(false);
                                            } catch (error) {
                                                toast.error('保存失败');
                                            }
                                        }}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium"
                                    >
                                        保存配置
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VideoStudio;