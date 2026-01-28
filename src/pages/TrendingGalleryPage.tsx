import React, { useState, useEffect } from 'react';
import TrendingNotesGallery from '../components/TrendingNotesGallery';
import HotTrends from '../components/HotTrends';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LayoutGrid, TrendingUp } from 'lucide-react';

export default function TrendingGalleryPage({ defaultTab = 'gallery' }: { defaultTab?: string }) {
    const navigate = useNavigate();
    const location = useLocation();
    
    // Parse query param 'tab' if exists, otherwise use defaultTab or internal state
    const queryParams = new URLSearchParams(location.search);
    const queryTab = queryParams.get('tab');
    
    const [activeTab, setActiveTab] = useState(queryTab || defaultTab);

    // Sync state with query param if it changes
    useEffect(() => {
        if (queryTab) {
            setActiveTab(queryTab);
        } else if (defaultTab) {
            // If no query param, respect defaultTab prop (mapped from route)
            if (defaultTab === 'recommend') setActiveTab('gallery');
            else setActiveTab(defaultTab);
        }
    }, [queryTab, defaultTab]);

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        // Update URL without reload to make it shareable
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('tab', tab);
        window.history.pushState({}, '', newUrl.toString());
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold text-gray-900">爆款内容库</h1>
                <p className="text-gray-500">
                    一站式发现全网热点与爆款，智能拆解结构助力创作。
                </p>
            </div>

            {/* Top Level Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                        onClick={() => handleTabChange('gallery')}
                        className={`
                            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center
                            ${activeTab === 'gallery'
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                        `}
                    >
                        <LayoutGrid className="mr-2 h-5 w-5" />
                        爆款笔记库
                    </button>
                    <button
                        onClick={() => handleTabChange('trends')}
                        className={`
                            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center
                            ${activeTab === 'trends'
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                        `}
                    >
                        <TrendingUp className="mr-2 h-5 w-5" />
                        全网热点
                    </button>
                </nav>
            </div>

            {/* Tab Content */}
            <div className="min-h-[500px]">
                {activeTab === 'gallery' && (
                    <TrendingNotesGallery 
                        initialTab="recommend"
                        onSelect={(note) => {
                            if (note.analysis_result) {
                                navigate('/generate', { 
                                    state: { 
                                        remixNote: {
                                            title: note.title,
                                            structure: note.analysis_result,
                                            type: note.type 
                                        }
                                    } 
                                });
                                toast.success(`已引用结构：${note.title}，即将跳转到创作页面`);
                            } else {
                                toast('提示：该笔记尚未深度分析。建议先点击"深度分析"获取结构。', { icon: 'ℹ️' });
                            }
                        }} 
                    />
                )}

                {activeTab === 'trends' && (
                    <HotTrends />
                )}
            </div>
        </div>
    );
}
