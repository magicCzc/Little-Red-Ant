import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Music, Image as ImageIcon, Video, Search, 
    Loader2, Play, Pause, CheckCircle, Upload
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Modal from './Modal';

interface Asset {
    id: string;
    type: 'audio' | 'image' | 'video';
    filename: string;
    url: string;
    size: number;
    created_at: string;
}

interface AssetSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (asset: Asset) => void;
    type: 'audio' | 'image' | 'video';
    title?: string;
}

export default function AssetSelector({ isOpen, onClose, onSelect, type, title }: AssetSelectorProps) {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [searchKeyword, setSearchKeyword] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchAssets();
        } else {
            setPlayingId(null);
            setSearchKeyword('');
        }
    }, [isOpen, type]);

    const fetchAssets = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/assets?type=${type}`);
            if (res.data.success) {
                setAssets(res.data.data);
            }
        } catch (error) {
            console.error('Failed to load assets');
            toast.error('加载素材失败');
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        
        const toastId = toast.loading('上传中...');
        try {
            const res = await axios.post(`/api/assets/upload/${type}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            if (res.data.success) {
                toast.success('上传成功', { id: toastId });
                fetchAssets();
            }
        } catch (error) {
            toast.error('上传失败', { id: toastId });
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const filteredAssets = assets.filter(a => 
        a.filename.toLowerCase().includes(searchKeyword.toLowerCase())
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title || `选择${type === 'audio' ? '音乐' : type === 'image' ? '图片' : '视频'}`}
            footer={
                <div className="flex justify-between items-center w-full">
                    <label className="cursor-pointer text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center">
                        <Upload size={16} className="mr-1" />
                        上传新文件
                        <input type="file" className="hidden" accept={`${type}/*`} onChange={handleUpload} />
                    </label>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium"
                    >
                        取消
                    </button>
                </div>
            }
        >
            <div className="flex flex-col h-[400px]">
                {/* Search */}
                <div className="mb-4 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                        type="text"
                        placeholder="搜索素材..."
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto border border-gray-100 rounded-lg bg-gray-50 p-2">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="animate-spin text-indigo-600" size={24} />
                        </div>
                    ) : filteredAssets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <p>暂无素材</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredAssets.map(asset => (
                                <div 
                                    key={asset.id}
                                    className="bg-white p-3 rounded-lg border border-gray-200 hover:border-indigo-300 cursor-pointer transition-all group flex items-center justify-between"
                                    onClick={() => onSelect(asset)}
                                >
                                    <div className="flex items-center overflow-hidden">
                                        {/* Preview Icon/Image */}
                                        <div className="w-10 h-10 flex-shrink-0 bg-gray-100 rounded flex items-center justify-center mr-3 text-gray-500 relative overflow-hidden">
                                            {asset.type === 'audio' ? (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const audio = document.getElementById(`modal-audio-${asset.id}`) as HTMLAudioElement;
                                                        if (playingId === asset.id) {
                                                            audio.pause();
                                                            setPlayingId(null);
                                                        } else {
                                                            document.querySelectorAll('audio').forEach(a => a.pause());
                                                            audio.play();
                                                            setPlayingId(asset.id);
                                                        }
                                                    }}
                                                    className="w-full h-full flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-600"
                                                >
                                                    {playingId === asset.id ? <Pause size={16} /> : <Play size={16} />}
                                                    <audio id={`modal-audio-${asset.id}`} src={asset.url} onEnded={() => setPlayingId(null)} className="hidden" />
                                                </button>
                                            ) : asset.type === 'image' ? (
                                                <img src={asset.url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <Video size={20} />
                                            )}
                                        </div>
                                        
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate group-hover:text-indigo-600">
                                                {asset.filename}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {formatSize(asset.size)} • {new Date(asset.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="px-3 py-1 bg-indigo-600 text-white text-xs rounded-full">
                                            选择
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}