import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Library, Music, Image as ImageIcon, Video, Upload, 
    Trash2, Search, Filter, Loader2, Play, Pause, AlertCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Modal from '../components/Modal';

interface Asset {
    id: string;
    type: 'audio' | 'image' | 'video';
    filename: string;
    url: string;
    size: number;
    created_at: string;
}

const AssetsLibrary: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'audio' | 'image' | 'video'>('audio');
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    useEffect(() => {
        fetchAssets();
    }, [activeTab]);

    const fetchAssets = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/assets?type=${activeTab}`);
            if (res.data.success) {
                setAssets(res.data.data);
            }
        } catch (error) {
            toast.error('Failed to load assets');
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
            // Determine endpoint based on tab
            const endpoint = `/api/assets/upload/${activeTab}`;
            
            const res = await axios.post(endpoint, formData, {
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

    const handleDeleteClick = (id: string) => {
        setDeleteId(id);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!deleteId) return;
        
        const toastId = toast.loading('删除中...');
        try {
            const res = await axios.delete(`/api/assets/${deleteId}`);
            if (res.data.success) {
                toast.success('素材已删除', { id: toastId });
                setAssets(prev => prev.filter(a => a.id !== deleteId));
                setIsDeleteModalOpen(false);
                setDeleteId(null);
            }
        } catch (error) {
            toast.error('删除失败', { id: toastId });
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                            <Library className="mr-2 text-indigo-600" />
                            素材库
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">管理您的创作素材 (音乐, 图片, 视频)</p>
                    </div>
                    
                    <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center transition-colors shadow-sm cursor-pointer">
                        <Upload size={16} className="mr-2" />
                        上传 {activeTab === 'audio' ? '音乐' : activeTab === 'image' ? '图片' : '视频'}
                        <input type="file" className="hidden" accept={`${activeTab}/*`} onChange={handleUpload} />
                    </label>
                </div>

                {/* Tabs */}
                <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-sm border border-gray-200 mb-6 w-fit">
                    <button 
                        onClick={() => setActiveTab('audio')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center transition-all
                            ${activeTab === 'audio' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <Music size={16} className="mr-2" /> 音乐
                    </button>
                    <button 
                        onClick={() => setActiveTab('image')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center transition-all
                            ${activeTab === 'image' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <ImageIcon size={16} className="mr-2" /> 图片
                    </button>
                    <button 
                        onClick={() => setActiveTab('video')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center transition-all
                            ${activeTab === 'video' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <Video size={16} className="mr-2" /> 视频
                    </button>
                </div>

                {/* Content */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[400px]">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <Loader2 className="animate-spin text-indigo-600" size={32} />
                        </div>
                    ) : assets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                <Upload size={24} className="opacity-50" />
                            </div>
                            <p>暂无{activeTab === 'audio' ? '音乐' : activeTab === 'image' ? '图片' : '视频'}素材</p>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">预览</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">文件名</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">大小</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">上传日期</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {assets.map((asset) => (
                                    <tr key={asset.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {asset.type === 'audio' && (
                                                <button 
                                                    onClick={() => {
                                                        const audio = document.getElementById(`audio-${asset.id}`) as HTMLAudioElement;
                                                        if (playingId === asset.id) {
                                                            audio.pause();
                                                            setPlayingId(null);
                                                        } else {
                                                            // Stop others
                                                            document.querySelectorAll('audio').forEach(a => a.pause());
                                                            audio.play();
                                                            setPlayingId(asset.id);
                                                        }
                                                    }}
                                                    className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center hover:bg-indigo-200 transition-colors"
                                                >
                                                    {playingId === asset.id ? <Pause size={18} /> : <Play size={18} />}
                                                    <audio id={`audio-${asset.id}`} src={asset.url} onEnded={() => setPlayingId(null)} className="hidden" />
                                                </button>
                                            )}
                                            {asset.type === 'image' && (
                                                <img src={asset.url} alt={asset.filename} className="w-10 h-10 rounded object-cover border border-gray-200" />
                                            )}
                                            {asset.type === 'video' && (
                                                <div className="w-16 h-10 bg-black rounded overflow-hidden">
                                                    <video src={asset.url} className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {asset.filename}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                            {formatSize(asset.size)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(asset.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button 
                                                onClick={() => handleDeleteClick(asset.id)}
                                                className="text-red-400 hover:text-red-600 transition-colors p-2 rounded-full hover:bg-red-50"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Delete Modal */}
                <Modal
                    isOpen={isDeleteModalOpen}
                    onClose={() => setIsDeleteModalOpen(false)}
                    title="确认删除素材"
                    footer={
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium"
                            >
                                取消
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-md text-sm font-medium"
                            >
                                确认删除
                            </button>
                        </div>
                    }
                >
                    <div className="flex items-start p-2">
                        <AlertCircle className="text-red-500 mr-3 flex-shrink-0" size={24} />
                        <div>
                            <p className="text-gray-700 font-medium mb-1">您确定要删除这个素材吗？</p>
                            <p className="text-gray-500 text-sm">
                                删除后将无法恢复。如果该素材已被用于视频工程，相关工程可能会损坏。
                            </p>
                        </div>
                    </div>
                </Modal>
            </div>
        </div>
    );
};

export default AssetsLibrary;
