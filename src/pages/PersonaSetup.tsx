
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Save, Plus, X, User, Trash2, CheckCircle, Edit2, Layout } from 'lucide-react';
import toast from 'react-hot-toast';

interface UserProfile {
  id?: number;
  name: string;
  niche: string;
  identity_tags: string[];
  style: string;
  benchmark_accounts: string[];
  writing_samples: string[];
  is_active?: number; // 0 or 1
}

const NICHE_OPTIONS = [
  { value: '美妆', label: '美妆 (Makeup)' },
  { value: '护肤', label: '护肤 (Skincare)' },
  { value: '母婴', label: '母婴 (Mom & Baby)' },
  { value: '家居', label: '家居 (Home)' },
  { value: '美食', label: '美食 (Food)' },
  { value: '穿搭', label: '穿搭 (Fashion)' },
  { value: '职场', label: '职场 (Career)' },
  { value: '学习', label: '学习 (Study)' },
  { value: '数码', label: '数码 (Tech)' },
  { value: '宠物', label: '宠物 (Pets)' },
];

const STYLE_OPTIONS = [
  { value: '干货实用', label: '干货实用 (Practical Tips)' },
  { value: '温馨治愈', label: '温馨治愈 (Warm & Healing)' },
  { value: '幽默搞笑', label: '幽默搞笑 (Humorous)' },
  { value: '犀利毒舌', label: '犀利毒舌 (Sharp/Critical)' },
  { value: '文艺清新', label: '文艺清新 (Artsy/Fresh)' },
  { value: '闺蜜唠嗑', label: '闺蜜唠嗑 (Bestie Chat)' },
  { value: '疯狂安利', label: '疯狂安利 (Hyper Hype)' },
  { value: '清冷高级', label: '清冷高级 (High-end)' },
];

export default function PersonaSetup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [personaList, setPersonaList] = useState<UserProfile[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [formData, setFormData] = useState<UserProfile>({
    name: '',
    niche: '',
    identity_tags: [],
    style: '',
    benchmark_accounts: [],
    writing_samples: []
  });

  const [newTag, setNewTag] = useState('');
  const [newAccount, setNewAccount] = useState('');
  const [newSample, setNewSample] = useState('');

  useEffect(() => {
    fetchList();
  }, []);

  const fetchList = async () => {
    try {
      const res = await axios.get('/api/user/list');
      const list = res.data;
      setPersonaList(list);
      
      // Select active one by default, or the first one, or create new mode
      if (list.length > 0) {
          const active = list.find((u: any) => u.is_active);
          if (active) selectPersona(active);
          else selectPersona(list[0]);
      } else {
          // No personas, keep default form
      }
    } catch (error) {
      console.error('Failed to fetch list', error);
      toast.error('加载人设列表失败');
    } finally {
      setLoading(false);
    }
  };

  const selectPersona = (p: UserProfile) => {
      setSelectedId(p.id || null);
      setFormData({
          id: p.id,
          name: p.name || `${p.niche}博主`,
          niche: p.niche || '',
          identity_tags: p.identity_tags || [],
          style: p.style || '',
          benchmark_accounts: p.benchmark_accounts || [],
          writing_samples: p.writing_samples || [],
          is_active: p.is_active
      });
  };

  const handleCreateNew = () => {
      setSelectedId(null);
      setFormData({
          name: '',
          niche: '',
          identity_tags: [],
          style: '',
          benchmark_accounts: [],
          writing_samples: []
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (selectedId) {
          // Update
          await axios.put(`/api/user/${selectedId}`, formData);
          toast.success('人设更新成功！');
      } else {
          // Create
          const res = await axios.post('/api/user', formData);
          toast.success('新人设创建成功！');
          // Reload list and select new one
          await fetchList();
          // Ideally we select the new one, but fetchList logic handles selection
      }
      fetchList();
    } catch (error) {
      console.error('Failed to save profile', error);
      toast.error('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (e: React.MouseEvent, id: number) => {
      e.stopPropagation();
      try {
          await axios.post(`/api/user/${id}/activate`);
          toast.success('已切换当前人设');
          fetchList(); // Refresh list to update UI
      } catch (e) {
          toast.error('切换失败');
      }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
      e.stopPropagation();
      if (!confirm('确定删除这个人设吗？')) return;
      try {
          await axios.delete(`/api/user/${id}`);
          if (selectedId === id) handleCreateNew();
          fetchList();
          toast.success('人设已删除');
      } catch (e) {
          toast.error('删除失败');
      }
  };

  const addTag = () => {
    if (newTag.trim() && formData.identity_tags.length < 5) {
      setFormData(prev => ({
        ...prev,
        identity_tags: [...prev.identity_tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (index: number) => {
    setFormData(prev => ({
      ...prev,
      identity_tags: prev.identity_tags.filter((_, i) => i !== index)
    }));
  };

  const addAccount = () => {
    if (newAccount.trim() && formData.benchmark_accounts.length < 5) {
      setFormData(prev => ({
        ...prev,
        benchmark_accounts: [...prev.benchmark_accounts, newAccount.trim()]
      }));
      setNewAccount('');
    }
  };

  const removeAccount = (index: number) => {
    setFormData(prev => ({
      ...prev,
      benchmark_accounts: prev.benchmark_accounts.filter((_, i) => i !== index)
    }));
  };

  const addSample = () => {
    if (newSample.trim() && formData.writing_samples.length < 3) {
      setFormData(prev => ({
        ...prev,
        writing_samples: [...prev.writing_samples, newSample.trim()]
      }));
      setNewSample('');
    }
  };

  const removeSample = (index: number) => {
    setFormData(prev => ({
      ...prev,
      writing_samples: prev.writing_samples.filter((_, i) => i !== index)
    }));
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar: Persona List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0 z-10">
          <div className="p-6 border-b border-gray-100">
             <h2 className="text-lg font-bold text-gray-900 flex items-center">
                 <User className="mr-2 text-indigo-600" />
                 人设管理 (Personas)
             </h2>
             <button 
                onClick={handleCreateNew}
                className="mt-4 w-full flex items-center justify-center py-2 px-4 border border-indigo-600 text-indigo-600 rounded-md hover:bg-indigo-50 text-sm font-medium transition-colors"
             >
                <Plus size={16} className="mr-1" /> 新建人设
             </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
             {personaList.map(p => (
                 <div 
                    key={p.id}
                    onClick={() => selectPersona(p)}
                    className={`
                        group p-3 rounded-lg border cursor-pointer transition-all relative
                        ${selectedId === p.id 
                            ? 'border-indigo-600 bg-indigo-50 shadow-sm' 
                            : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'}
                    `}
                 >
                    <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                            <h3 className={`font-medium text-sm truncate ${selectedId === p.id ? 'text-indigo-900' : 'text-gray-900'}`}>
                                {p.name || '未命名人设'}
                            </h3>
                            <p className="text-xs text-gray-500 mt-1 truncate">
                                {p.niche} · {p.style || '默认风格'}
                            </p>
                        </div>
                        {p.is_active ? (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">
                                当前使用
                            </span>
                        ) : (
                            <button
                                onClick={(e) => handleActivate(e, p.id!)}
                                className="ml-2 p-1 text-gray-400 hover:text-green-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="设为当前使用"
                            >
                                <CheckCircle size={16} />
                            </button>
                        )}
                    </div>
                    
                    <button
                        onClick={(e) => handleDelete(e, p.id!)}
                        className="absolute bottom-2 right-2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="删除"
                    >
                        <Trash2 size={14} />
                    </button>
                 </div>
             ))}
             
             {personaList.length === 0 && (
                 <div className="text-center text-gray-400 text-sm py-8">
                     暂无人设，请新建
                 </div>
             )}
          </div>
      </div>

      {/* Main Content: Edit Form */}
      <div className="flex-1 h-screen overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                <div className="mb-8 pb-6 border-b border-gray-100">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        {selectedId ? '编辑人设 (Edit Persona)' : '新建人设 (New Persona)'}
                    </h1>
                    <p className="text-gray-600 text-sm">
                        {selectedId ? '修改当前人设的配置信息。' : '创建一个新的人设，您可以随时切换使用。'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    
                    {/* Name Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            人设名称 (Name) <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                            placeholder="例如：美妆大号、宠物号-旺财"
                            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                        />
                    </div>

                    {/* Niche Selection */}
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        专注领域 (Niche) <span className="text-red-500">*</span>
                    </label>
                    <select
                        required
                        value={formData.niche}
                        onChange={e => setFormData({...formData, niche: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                    >
                        <option value="">请选择领域 (Select Niche)</option>
                        {NICHE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    </div>

                    {/* Identity Tags */}
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        身份标签 (Identity Tags) - 如: 95后宝妈, 职场新人
                    </label>
                    <div className="flex gap-2 mb-2">
                        <input
                        type="text"
                        value={newTag}
                        onChange={e => setNewTag(e.target.value)}
                        placeholder="输入标签 (Enter tag)"
                        className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                        onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                        />
                        <button
                        type="button"
                        onClick={addTag}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                        >
                        <Plus size={20} />
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {formData.identity_tags.map((tag, idx) => (
                        <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-50 text-red-700">
                            {tag}
                            <button
                            type="button"
                            onClick={() => removeTag(idx)}
                            className="ml-2 text-red-500 hover:text-red-700"
                            >
                            <X size={14} />
                            </button>
                        </span>
                        ))}
                    </div>
                    </div>

                    {/* Style Selection */}
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        账号风格 (Account Style) <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {STYLE_OPTIONS.map(opt => (
                        <div
                            key={opt.value}
                            onClick={() => setFormData({...formData, style: opt.value})}
                            className={`
                            cursor-pointer p-3 text-sm border rounded-md text-center transition-colors
                            ${formData.style === opt.value 
                                ? 'border-red-500 bg-red-50 text-red-700 font-medium' 
                                : 'border-gray-200 hover:border-red-200'}
                            `}
                        >
                            {opt.label}
                        </div>
                        ))}
                    </div>
                    </div>

                    {/* Benchmark Accounts */}
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        对标账号链接 (Benchmark Account URLs)
                    </label>
                    <div className="flex gap-2 mb-2">
                        <input
                        type="text"
                        value={newAccount}
                        onChange={e => setNewAccount(e.target.value)}
                        placeholder="输入小红书主页链接 (Enter URL)"
                        className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                        onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addAccount())}
                        />
                        <button
                        type="button"
                        onClick={addAccount}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                        >
                        <Plus size={20} />
                        </button>
                    </div>
                    <ul className="space-y-2">
                        {formData.benchmark_accounts.map((acc, idx) => (
                        <li key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-md text-sm">
                            <span className="truncate flex-1 mr-2">{acc}</span>
                            <button
                            type="button"
                            onClick={() => removeAccount(idx)}
                            className="text-gray-400 hover:text-red-500"
                            >
                            <X size={16} />
                            </button>
                        </li>
                        ))}
                    </ul>
                    </div>

                    {/* Writing Samples */}
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        文风投喂 (Writing Style Samples) <span className="text-gray-400 text-xs">- 复制您喜欢的爆款笔记正文，AI 会模仿其语气</span>
                    </label>
                    <div className="mb-2">
                        <textarea
                        value={newSample}
                        onChange={e => setNewSample(e.target.value)}
                        placeholder="在此粘贴一篇范文... (Paste a sample note here)"
                        rows={4}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500 text-sm"
                        />
                        <button
                        type="button"
                        onClick={addSample}
                        disabled={!newSample.trim() || formData.writing_samples.length >= 3}
                        className="mt-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 text-sm font-medium disabled:opacity-50"
                        >
                        <Plus size={16} className="inline mr-1" />
                        添加范文 (Add Sample) {formData.writing_samples.length}/3
                        </button>
                    </div>
                    <div className="space-y-3 mt-4">
                        {formData.writing_samples.map((sample, idx) => (
                        <div key={idx} className="relative p-3 bg-gray-50 rounded-md border border-gray-200">
                            <p className="text-xs text-gray-600 line-clamp-3 italic">"{sample}"</p>
                            <button
                            type="button"
                            onClick={() => removeSample(idx)}
                            className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                            >
                            <X size={14} />
                            </button>
                        </div>
                        ))}
                    </div>
                    </div>

                    {/* Submit Button */}
                    <div className="pt-4 flex gap-4">
                    {selectedId && (
                        <button
                            type="button"
                            onClick={() => handleCreateNew()}
                            className="flex-1 py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                        >
                            取消编辑
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={saving}
                        className={`
                        flex-[2] flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                        ${saving ? 'bg-red-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'}
                        `}
                    >
                        {saving ? '保存中...' : (
                        <>
                            <Save className="mr-2" size={18} />
                            {selectedId ? '更新人设 (Update Persona)' : '创建人设 (Create Persona)'}
                        </>
                        )}
                    </button>
                    </div>

                </form>
            </div>
        </div>
      </div>
    </div>
  );
}
