import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { TrendingUp, Loader2, ExternalLink, PenTool, Flame, RefreshCw, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Trend {
  id: number;
  title: string;
  hot_value: number;
  url?: string;
}

type TrendSource = 'weibo' | 'baidu' | 'zhihu' | 'douyin';

export default function HotTrends() {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [currentSource, setCurrentSource] = useState<TrendSource>('weibo');
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();
    fetchTrends(currentSource, false, controller.signal);
    return () => controller.abort();
  }, [currentSource]);

  const fetchTrends = async (source: TrendSource, forceRefresh = false, signal?: AbortSignal) => {
    setLoading(true);
    try {
      let res = await axios.get(`/api/trends?source=${source}${forceRefresh ? '&refresh=true' : ''}`, { signal });
      let data = Array.isArray(res.data) ? { data: res.data, source: 'mock', updatedAt: Date.now(), status: 'FRESH' } : res.data;

      // Poll if updating
      if (data.status === 'UPDATING') {
          let attempts = 0;
          // Show stale data immediately if available? 
          // Current logic: wait until fresh. 
          // Maybe better: setTrends(data.data) first, but keep loading=true? 
          // Or just wait. Let's wait to ensure "auto update" feeling.
          
          while (attempts < 30 && !signal?.aborted) { // Poll for 90s max
              await new Promise(r => setTimeout(r, 3000));
              if (signal?.aborted) break;

              try {
                const pollRes = await axios.get(`/api/trends?source=${source}`, { signal });
                const pollData = Array.isArray(pollRes.data) ? { status: 'FRESH', data: pollRes.data } : pollRes.data;
                
                // Check if status became FRESH or timestamp updated
                if (pollData.status === 'FRESH' || (pollData.updatedAt && pollData.updatedAt > (data.updatedAt || 0))) {
                    data = pollData;
                    break;
                }
              } catch (e) {
                 // Ignore poll errors
              }
              attempts++;
          }
      }

      if (!signal?.aborted) {
         setTrends(data.data || []);
         setDataSource(data.source);
         setUpdatedAt(data.updatedAt);
      }
    } catch (error) {
      if (!axios.isCancel(error)) {
        console.error('Failed to fetch trends', error);
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  const handleUseTrend = (trend: Trend) => {
    navigate('/generate', { state: { draft: { title: trend.title, content: '', tags: [] } } });
  };

  const getSourceLabel = () => {
    if (!dataSource) return { text: '加载中...', color: 'text-gray-400' };
    
    if (dataSource.includes('mock')) return { text: '演示数据 (Demo)', color: 'text-gray-600 bg-gray-100' };
    if (dataSource.includes('stale')) return { text: '缓存数据 (Cached)', color: 'text-orange-600 bg-orange-50' };
    
    const map: Record<string, string> = { 'weibo': '微博', 'baidu': '百度', 'zhihu': '知乎', 'douyin': '抖音' };
    const platform = map[currentSource] || currentSource;
    return { text: `${platform}实时数据 (Live)`, color: 'text-green-600 bg-green-50' };
  };

  const filteredTrends = trends.filter(t => t.title.toLowerCase().includes(searchTerm.toLowerCase()));
  const sourceInfo = getSourceLabel();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <TrendingUp className="mr-2 text-red-600" />
              热点趋势 (Trends)
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-3">
               <p className="text-gray-500 text-sm">
                全网热点聚合，一站式发现流量密码。
               </p>
               {dataSource && (
                 <span className={`px-2 py-0.5 rounded text-xs font-medium ${sourceInfo.color}`}>
                   ● {sourceInfo.text}
                 </span>
               )}
               {updatedAt && (
                 <span className="text-xs text-gray-400">
                   更新: {new Date(updatedAt).toLocaleTimeString()}
                 </span>
               )}
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text" 
                  placeholder="搜索关键词..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 w-full sm:w-48"
                />
             </div>
             <div className="flex bg-gray-200 rounded-lg p-1 overflow-x-auto">
                {[
                  { id: 'weibo', label: '微博' }, 
                  { id: 'baidu', label: '百度' },
                  // { id: 'zhihu', label: '知乎' }, 
                  // { id: 'douyin', label: '抖音' } 
                ].map((src) => (
                  <button
                    key={src.id}
                    onClick={() => setCurrentSource(src.id as TrendSource)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${currentSource === src.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    {src.label}
                  </button>
                ))}
             </div>
             
             <button 
                onClick={() => fetchTrends(currentSource, true)}
                disabled={loading}
                className="p-2 text-gray-500 hover:text-indigo-600 rounded-full hover:bg-gray-100 transition-colors self-center"
                title="强制刷新"
              >
                <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
              </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="animate-spin h-10 w-10 mx-auto mb-4 text-indigo-600" />
            <p className="text-gray-500">正在抓取{currentSource === 'douyin' ? '抖音' : ''}最新热点...</p>
            {currentSource === 'douyin' && <p className="text-xs text-gray-400 mt-2">抖音数据抓取可能需要较长时间，请耐心等待</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                    排名
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    话题
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    热度
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTrends.length > 0 ? filteredTrends.map((trend, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`
                        inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                        ${index < 3 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}
                      `}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-900 mr-2 line-clamp-1 max-w-md" title={trend.title}>
                          {trend.title}
                        </span>
                        {trend.url && (
                          <a 
                            href={trend.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-blue-500 flex-shrink-0"
                            title="查看原贴"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                        {index < 3 && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-xs bg-red-50 text-red-600 font-medium flex-shrink-0">
                            爆
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-500">
                        <Flame size={14} className={`mr-1 ${trend.hot_value > 1000000 ? 'text-red-500' : 'text-orange-500'}`} />
                        {trend.hot_value > 10000 ? `${(trend.hot_value / 10000).toFixed(1)}w` : trend.hot_value}
                      </div>
                      {/* Heat Bar */}
                      <div className="w-full bg-gray-100 rounded-full h-1 mt-1 max-w-[80px]">
                        <div 
                          className={`h-1 rounded-full ${trend.hot_value > 1000000 ? 'bg-red-500' : 'bg-orange-400'}`} 
                          style={{ width: `${Math.min(100, (trend.hot_value / (filteredTrends[0]?.hot_value || 1)) * 100)}%` }}
                        ></div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleUseTrend(trend)}
                        className="text-indigo-600 hover:text-indigo-900 flex items-center justify-end ml-auto"
                      >
                        <PenTool size={16} className="mr-1" />
                        去创作
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-gray-500">
                      未找到匹配的热点
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}
