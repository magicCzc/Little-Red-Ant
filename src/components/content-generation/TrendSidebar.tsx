import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { TrendingUp } from 'lucide-react';

interface Trend {
  id: number;
  title: string;
  hot_value?: number;
}

interface TrendSidebarProps {
  onSelectTopic: (topic: string) => void;
}

export default function TrendSidebar({ onSelectTopic }: TrendSidebarProps) {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [trendSource, setTrendSource] = useState('weibo');

  useEffect(() => {
    axios.get(`/api/trends?source=${trendSource}`)
      .then(res => setTrends(res.data.data || []))
      .catch(err => console.error('Failed to fetch trends:', err));
  }, [trendSource]);

  return (
    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center">
                <TrendingUp size={16} className="mr-2 text-red-500" />
                今日热点灵感
            </h3>
            <select 
                value={trendSource}
                onChange={(e) => setTrendSource(e.target.value)}
                className="text-xs border border-gray-300 rounded p-1 text-gray-600 focus:ring-red-500 focus:border-red-500 bg-gray-50"
            >
                <option value="weibo">微博热搜</option>
                <option value="baidu">百度热搜</option>
                <option value="douyin">抖音热榜</option>
                <option value="zhihu">知乎热榜</option>
            </select>
        </div>
        
        {trends.length > 0 ? (
            <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
            {trends.map(trend => (
                <div key={trend.id} className="group relative">
                    <button
                        type="button"
                        onClick={() => onSelectTopic(trend.title)}
                        className="w-full text-left text-sm p-2 hover:bg-red-50 rounded-md text-gray-600 hover:text-red-600 transition-colors flex items-center justify-between"
                    >
                        <span className="truncate flex-1 mr-2">{trend.title}</span>
                        {trend.hot_value && (
                            <span className="text-xs text-gray-400 font-mono">
                                {trend.hot_value > 10000 ? `${(trend.hot_value / 10000).toFixed(1)}w` : trend.hot_value}
                            </span>
                        )}
                    </button>
                </div>
            ))}
            </div>
        ) : (
            <div className="py-8 text-center text-gray-400 text-xs">
                <p>暂无该平台热点数据</p>
                <p className="mt-1">请尝试切换其他平台</p>
            </div>
        )}
    </div>
  );
}
