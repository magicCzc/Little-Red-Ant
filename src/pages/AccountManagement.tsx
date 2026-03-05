
import React, { useState, useEffect, useRef } from 'react';
  import axios from 'axios';
  import { Users, Plus, UserCheck, Trash2, Loader2, ArrowLeft, AlertCircle, Edit3, Eye, Check, Link as LinkIcon, RefreshCw, X, UserCog, Save } from 'lucide-react';
  import { Link } from 'react-router-dom';
  import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { useSafeAsync } from '../hooks/useSafeAsync';
import PageHeader from '../components/PageHeader';
import PageLoading from '../components/PageLoading';
import EmptyState from '../components/EmptyState';

interface Account {
    id: number;
    nickname: string;
    alias?: string;
    avatar: string;
    is_active: boolean;
    last_used_at: string;
    created_at: string;
    has_creator_cookie: boolean;
    has_main_cookie: boolean;
    status: 'ACTIVE' | 'EXPIRED' | 'UNKNOWN';
    persona?: {
        niche: string;
        desc: string;
        tone: string;
        sample: string;
        image_url?: string; // New field
    };
  }

  export default function AccountManagement() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Alias Editing State
    const [editingAliasId, setEditingAliasId] = useState<number | null>(null);
    const [aliasValue, setAliasValue] = useState('');

    // Scanning State
    const [scanning, setScanning] = useState(false);
    const [scanStatus, setScanStatus] = useState<string | null>(null);
    const [scanType, setScanType] = useState<'ADD' | 'BIND_CREATOR' | 'BIND_MAIN' | null>(null);
    const [scanAccountId, setScanAccountId] = useState<number | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);
  
  const { isMounted, safeRequest, abortControllerRef } = useSafeAsync();
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  // Delete Confirmation State
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Persona Modal State
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [editingPersonaAccount, setEditingPersonaAccount] = useState<Account | null>(null);
  const [personaForm, setPersonaForm] = useState({
      niche: '',
      desc: '',
      tone: '',
      sample: '',
      image_url: '' // New field
  });
  const personaImageInputRef = useRef<HTMLInputElement>(null);

  // Templates State
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplateSelect, setShowTemplateSelect] = useState(false);

  useEffect(() => {
    fetchAccounts();
    // Pre-fetch templates
    axios.get('/api/user/list').then(res => setTemplates(res.data)).catch(() => {});
    return () => {
      stopPolling();
    };
  }, []);

  const stopPolling = () => {
      if (pollInterval.current) {
          clearInterval(pollInterval.current);
          pollInterval.current = null;
      }
  };

  const fetchAccounts = async () => {
    try {
      const res = await axios.get('/api/accounts');
      if (isMounted.current) {
        setAccounts(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch accounts', error);
      if (isMounted.current) {
        toast.error('获取账号列表失败');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  const handleUpdateAlias = async (id: number) => {
      try {
          await axios.put(`/api/accounts/${id}/alias`, { alias: aliasValue });
          if (isMounted.current) {
            setAccounts(accounts.map(acc => acc.id === id ? { ...acc, alias: aliasValue } : acc));
            setEditingAliasId(null);
            toast.success('别名已更新');
          }
      } catch (e) {
          if (isMounted.current) toast.error('更新失败');
      }
  };

  const handleCheckHealth = async () => {
      setCheckingHealth(true);
      try {
          const res = await axios.post('/api/accounts/check-health');
          const { taskId } = res.data;
          
          if (taskId) {
              if (isMounted.current) {
                  toast.success('全量体检任务已提交，请留意右下角任务监控');
                  setCheckingHealth(false);
              }
          } else {
              if (isMounted.current) {
                  toast.success('健康检查已启动');
                  setCheckingHealth(false);
              }
          }
      } catch (e) {
          if (isMounted.current) {
              setCheckingHealth(false);
              toast.error('启动检查失败');
          }
      }
  };

  const startLoginProcess = async (type: 'ADD' | 'BIND_CREATOR' | 'BIND_MAIN', accountId?: number) => {
      if (scanning) return; 
      
      // Cancel previous
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      setScanning(true);
      setScanType(type);
      setScanAccountId(accountId || null);
      setScanStatus('正在启动浏览器...');
      const toastId = toast.loading('正在启动浏览器...', { id: 'scan-toast' });
      
      try {
          if (type === 'ADD' || type === 'BIND_CREATOR') {
              await axios.post('/api/accounts/login', { accountId }, { signal: abortControllerRef.current.signal });
          } else {
              await axios.post('/api/accounts/login-main', { accountId }, { signal: abortControllerRef.current.signal });
          }
          
          if (!isMounted.current) return;

          setScanStatus('浏览器已打开，请扫码登录...');
          toast.loading('请在弹出的浏览器中扫码登录...', { id: 'scan-toast' });
          
          // Poll
          let attempts = 0;
          stopPolling(); 
          
          pollInterval.current = setInterval(async () => {
              if (!isMounted.current) {
                  stopPolling();
                  return;
              }

              attempts++;
              try {
                  const res = await axios.get('/api/accounts/status');
                  const { loginState, loginType } = res.data;
                  
                  if (loginState === 'SUCCESS') {
                      stopPolling();
                      if (isMounted.current) {
                          setScanning(false);
                          setScanStatus(null);
                          setScanType(null);
                          setScanAccountId(null);
                          fetchAccounts();
                          toast.success('登录成功！', { id: 'scan-toast' });
                      }
                  } else if (loginState === 'FAILED' || attempts > 150) {
                      stopPolling();
                      if (isMounted.current) {
                          setScanning(false);
                          setScanStatus('登录超时或失败');
                          toast.error('登录超时或失败', { id: 'scan-toast' });
                          setTimeout(() => {
                              if (isMounted.current) {
                                  setScanStatus(null);
                                  setScanType(null);
                                  setScanAccountId(null);
                              }
                          }, 3000);
                      }
                  }
              } catch(e) {}
          }, 2000);
          
      } catch (error: any) {
          if (axios.isCancel(error)) return;
          
          if (isMounted.current) {
              setScanning(false);
              setScanStatus(`启动失败: ${error.response?.data?.error || error.message}`);
              toast.error(`启动失败: ${error.response?.data?.error || error.message}`, { id: 'scan-toast' });
              setTimeout(() => {
                  if (isMounted.current) setScanStatus(null);
              }, 3000);
          }
      }
  };

  const handleAddAccount = () => startLoginProcess('ADD');
  const handleCreatorLogin = (id: number) => startLoginProcess('BIND_CREATOR', id);
  const handleMainSiteLogin = (id: number) => startLoginProcess('BIND_MAIN', id);

  const handleSwitchAccount = async (id: number) => {
    try {
      await axios.post(`/api/accounts/${id}/active`);
      setAccounts(accounts.map(acc => ({
        ...acc,
        is_active: acc.id === id
      })));
      toast.success('账号切换成功');
    } catch (error) {
      toast.error('切换失败');
    }
  };

  const confirmDelete = (id: number) => {
    setDeleteId(id);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteAccount = async () => {
    if (!deleteId) return;
    try {
      await axios.delete(`/api/accounts/${deleteId}`);
      setAccounts(accounts.filter(a => a.id !== deleteId));
      setIsDeleteModalOpen(false);
      setDeleteId(null);
      toast.success('账号已删除');
    } catch (error) {
      toast.error('删除失败');
    }
  };

  const handleOpenPersonaModal = (account: Account) => {
    setEditingPersonaAccount(account);
    setPersonaForm({
        niche: account.persona?.niche || '',
        desc: account.persona?.desc || '',
        tone: account.persona?.tone || '',
        sample: account.persona?.sample || '',
        image_url: account.persona?.image_url || ''
    });
    setIsPersonaModalOpen(true);
  };

  const handleSavePersona = async () => {
    if (!editingPersonaAccount) return;
    try {
        await axios.put(`/api/accounts/${editingPersonaAccount.id}/persona`, {
            niche: personaForm.niche,
            persona_desc: personaForm.desc,
            tone: personaForm.tone,
            writing_sample: personaForm.sample,
            persona_image_url: personaForm.image_url // Save image url
        });
        toast.success('人设配置已保存');
        setIsPersonaModalOpen(false);
        fetchAccounts();
    } catch (e) {
        toast.error('保存失败');
    }
  };

  const handlePersonaImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('file', file);
      
      try {
          const toastId = toast.loading('正在上传定妆照...');
          // Using the same endpoint as before (assuming generic asset upload)
          const res = await fetch('/api/assets/upload', {
              method: 'POST',
              body: formData
          });
          
          if (!res.ok) throw new Error('Upload failed');
          
          const data = await res.json();
          setPersonaForm(prev => ({ ...prev, image_url: data.url }));
          toast.success('定妆照上传成功', { id: toastId });
      } catch (error) {
          toast.error('上传失败');
      } finally {
          if (personaImageInputRef.current) personaImageInputRef.current.value = '';
      }
  };

  const handleApplyTemplate = (templateId: string) => {
      const tmpl = templates.find(t => t.id.toString() === templateId);
      if (tmpl) {
          setPersonaForm({
              niche: tmpl.niche || '',
              desc: `身份标签：${(tmpl.identity_tags || []).join(', ')}`, // Convert tags to desc
              tone: tmpl.style || '',
              sample: (tmpl.writing_samples || [])[0] || '',
              image_url: '' // Template doesn't have image yet
          });
          toast.success('已应用模板内容');
          setShowTemplateSelect(false);
      }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <PageHeader 
            title="账号矩阵" 
            icon={Users}
            action={
                <div className="flex gap-2">
                    <button
                        onClick={handleCheckHealth}
                        disabled={checkingHealth || scanning}
                        className="flex items-center px-4 py-2 rounded-md text-indigo-600 bg-indigo-50 border border-indigo-100 text-sm font-medium hover:bg-indigo-100 transition-colors"
                    >
                        {checkingHealth ? <Loader2 className="animate-spin mr-2" size={16} /> : <UserCheck className="mr-2" size={16} />}
                        全量体检
                    </button>
                    <button
                        onClick={handleAddAccount}
                        disabled={scanning}
                        className={`flex items-center px-4 py-2 rounded-md text-white text-sm font-medium transition-colors
                        ${scanning && scanType === 'ADD' ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}
                        `}
                    >
                        {scanning && scanType === 'ADD' ? (
                        <>
                            <Loader2 className="animate-spin mr-2" size={16} />
                            {scanStatus}
                        </>
                        ) : (
                        <>
                            <Plus className="mr-2" size={16} />
                            添加新账号
                        </>
                        )}
                    </button>
                </div>
            }
        />

        {loading ? (
          <PageLoading message="正在加载账号列表..." />
        ) : accounts.length === 0 ? (
          <EmptyState 
            title="暂无已登录账号" 
            description="点击右上角添加账号，扫码登录即可保存 Cookie" 
            icon={Users}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map(account => {
              const isExpired = account.status === 'EXPIRED';
              const isActive = account.is_active;
              
              return (
                <div 
                  key={account.id}
                  className={`
                    relative p-4 rounded-xl border transition-all duration-200
                    ${isActive 
                      ? 'border-indigo-500 bg-white shadow-md ring-1 ring-indigo-500/20' 
                      : isExpired
                        ? 'border-red-200 bg-red-50/30 hover:border-red-300'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'}
                  `}
                >
                  {/* Active Badge */}
                  {isActive && (
                    <div className="absolute -top-2 -right-2 bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full shadow-sm flex items-center">
                      <UserCheck size={10} className="mr-1" />
                      当前使用
                    </div>
                  )}
                  
                  {/* Header: Avatar + Name */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`
                      w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold overflow-hidden
                      ${isExpired ? 'bg-red-100 text-red-500' : 'bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-600'}
                    `}>
                      {account.avatar ? (
                        <img src={account.avatar} alt="avatar" className="w-full h-full object-cover"/>
                      ) : (
                        account.nickname[0]
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {editingAliasId === account.id ? (
                          <div className="flex items-center gap-1">
                            <input 
                              className="border rounded px-1.5 py-0.5 text-sm w-24"
                              value={aliasValue}
                              onChange={e => setAliasValue(e.target.value)}
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleUpdateAlias(account.id);
                                if (e.key === 'Escape') setEditingAliasId(null);
                              }}
                            />
                            <button onClick={() => handleUpdateAlias(account.id)} className="text-green-600 p-0.5 hover:bg-green-50 rounded">
                              <Check size={14}/>
                            </button>
                            <button onClick={() => setEditingAliasId(null)} className="text-gray-400 p-0.5 hover:bg-gray-100 rounded">
                              <X size={14}/>
                            </button>
                          </div>
                        ) : (
                          <h3 className="font-bold text-gray-900 truncate group flex items-center gap-1">
                            <span className="truncate">{account.alias || account.nickname}</span>
                            <button 
                              onClick={() => {
                                setEditingAliasId(account.id);
                                setAliasValue(account.alias || '');
                              }}
                              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600 transition-opacity p-0.5"
                            >
                              <Edit3 size={12} />
                            </button>
                          </h3>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {account.alias ? account.nickname : `上次使用: ${new Date(account.last_used_at).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>

                  {/* Status Badges */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {isExpired ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                        <AlertCircle size={10} className="mr-1" />
                        Cookie已失效
                      </span>
                    ) : (
                      <>
                        <span className={`
                          inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border
                          ${account.has_creator_cookie 
                            ? 'bg-green-50 text-green-700 border-green-200' 
                            : 'bg-gray-50 text-gray-500 border-gray-200'}
                        `}>
                          {account.has_creator_cookie ? (
                            <><Check size={10} className="mr-1" /> 可发布</>
                          ) : (
                            '未绑定发布'
                          )}
                        </span>
                        <span className={`
                          inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border
                          ${account.has_main_cookie 
                            ? 'bg-green-50 text-green-700 border-green-200' 
                            : 'bg-gray-50 text-gray-500 border-gray-200'}
                        `}>
                          {account.has_main_cookie ? (
                            <><Check size={10} className="mr-1" /> 可浏览</>
                          ) : (
                            '未绑定浏览'
                          )}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {!isActive && !isExpired && (
                      <button
                        onClick={() => handleSwitchAccount(account.id)}
                        className="flex-1 py-1.5 text-xs font-medium text-center border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                      >
                        切换使用
                      </button>
                    )}
                    {isExpired && (
                      <button
                        onClick={() => handleCreatorLogin(account.id)}
                        className="flex-1 py-1.5 text-xs font-medium text-center bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        重新登录
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenPersonaModal(account)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      人设
                    </button>
                    <button
                      onClick={() => confirmDelete(account.id)}
                      className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      删除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          title="确认删除账号"
          footer={
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium"
              >
                取消
              </button>
              <button
                onClick={handleDeleteAccount}
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
              <p className="text-gray-700 font-medium mb-1">您确定要删除这个账号吗？</p>
              <p className="text-gray-500 text-sm">
                删除后，您将无法使用该账号进行一键发布，需要重新扫码登录。
              </p>
            </div>
          </div>
        </Modal>

        {/* Persona Settings Modal */}
        <Modal
            isOpen={isPersonaModalOpen}
            onClose={() => setIsPersonaModalOpen(false)}
            title={`人设配置 - ${editingPersonaAccount?.alias || editingPersonaAccount?.nickname}`}
            footer={
                <div className="flex justify-between w-full">
                    <div className="relative">
                        <button
                            onClick={() => setShowTemplateSelect(!showTemplateSelect)}
                            className="px-3 py-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md text-sm font-medium flex items-center"
                        >
                            <Users size={16} className="mr-1" />
                            从模板库导入
                        </button>
                        {showTemplateSelect && (
                            <div className="absolute bottom-full left-0 mb-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                                {templates.length > 0 ? (
                                    templates.map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => handleApplyTemplate(t.id.toString())}
                                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                        >
                                            {t.name || t.niche}
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-4 py-2 text-xs text-gray-400">暂无模板</div>
                                )}
                                <Link to="/persona" className="block w-full text-left px-4 py-2 text-xs text-indigo-600 border-t border-gray-100 hover:bg-gray-50">
                                    管理模板库 &rarr;
                                </Link>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsPersonaModalOpen(false)}
                            className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleSavePersona}
                            className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-md text-sm font-medium flex items-center"
                        >
                            <Save size={16} className="mr-2" />
                            保存配置
                        </button>
                    </div>
                </div>
            }
        >
            <div className="space-y-4 p-2">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        专注领域 (Niche)
                    </label>
                    <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        placeholder="例如：美妆护肤、科技数码、职场干货"
                        value={personaForm.niche}
                        onChange={e => setPersonaForm({...personaForm, niche: e.target.value})}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        人设描述 (Character)
                    </label>
                    <textarea
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm h-20"
                        placeholder="例如：25岁大厂程序员，喜欢各种黑科技，说话幽默风趣..."
                        value={personaForm.desc}
                        onChange={e => setPersonaForm({...personaForm, desc: e.target.value})}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        语气风格 (Tone)
                    </label>
                    <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        placeholder="例如：专业严谨、亲切邻家、犀利吐槽"
                        value={personaForm.tone}
                        onChange={e => setPersonaForm({...personaForm, tone: e.target.value})}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        视觉定妆照 (Visual Persona)
                    </label>
                    <div className="flex items-start gap-4">
                        <div className="w-24 h-24 bg-gray-100 rounded-lg border border-gray-300 flex items-center justify-center overflow-hidden relative group">
                            {personaForm.image_url ? (
                                <>
                                    <img src={personaForm.image_url} alt="Persona" className="w-full h-full object-cover" />
                                    <button 
                                        onClick={() => setPersonaForm(prev => ({...prev, image_url: ''}))}
                                        className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={12} />
                                    </button>
                                </>
                            ) : (
                                <Users size={32} className="text-gray-300" />
                            )}
                        </div>
                        <div className="flex-1">
                             <p className="text-xs text-gray-500 mb-2">
                                上传一张该账号的固定人物形象（定妆照）。AI 生成配图时将优先参考此图，保持人物一致性。
                             </p>
                             <div className="flex gap-2">
                                 <button
                                    onClick={() => personaImageInputRef.current?.click()}
                                    className="px-3 py-1.5 border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center"
                                 >
                                     <LinkIcon size={12} className="mr-1" /> 上传照片
                                 </button>
                                 <input 
                                    type="file" 
                                    ref={personaImageInputRef} 
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={handlePersonaImageUpload}
                                 />
                                 {/* Future: Add "Generate by AI" button here */}
                             </div>
                        </div>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        文风样例 (Writing Sample)
                    </label>
                    <textarea
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm h-24 font-mono bg-gray-50"
                        placeholder="在此粘贴一段符合该人设的典型文案，AI将模仿其用词习惯..."
                        value={personaForm.sample}
                        onChange={e => setPersonaForm({...personaForm, sample: e.target.value})}
                    />
                </div>
                <div className="bg-blue-50 p-3 rounded-md border border-blue-100 flex items-start">
                    <AlertCircle size={16} className="text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
                    <p className="text-xs text-blue-700">
                        提示：配置好人设后，在“智能创作”和“视频工程”中选择该账号，AI将自动调用这些信息来生成内容，无需重复输入。
                    </p>
                </div>
            </div>
        </Modal>

      </div>
    </div>
  );
}
