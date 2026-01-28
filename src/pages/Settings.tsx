import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Settings, Save, ArrowLeft, Key, Image, Cpu, CheckCircle, AlertCircle, Clock, MessageSquare, Users, Trash2, Plus, UserPlus, Lock, Video, Edit2, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import PageLoading from '../components/PageLoading';

export default function SettingsPage() {
  const user = useAuthStore(state => state.user);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'system' | 'profile'>('profile');
  
  // Profile State
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [profileForm, setProfileForm] = useState({ username: '', alias: '' });
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  useEffect(() => {
    fetchSettings();
    if (user) {
        setProfileForm({ 
            username: user.username, 
            alias: user.alias || '' 
        });
    }
  }, [user]);

  const fetchSettings = async () => {
    try {
      const res = await axios.get('/api/settings');
      setSettings(res.data || {});
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      toast.error('无法加载配置信息');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          await axios.put('/api/users/me', { 
              username: profileForm.username,
              alias: profileForm.alias
          });
          toast.success('个人资料更新成功，请重新登录生效');
          setIsEditingProfile(false);
      } catch (e: any) {
          toast.error(e.response?.data?.error || '更新失败');
      }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
      e.preventDefault();
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
          toast.error('两次输入的新密码不一致');
          return;
      }
      try {
          await axios.put('/api/users/me/password', {
              currentPassword: passwordForm.currentPassword,
              newPassword: passwordForm.newPassword
          });
          toast.success('密码修改成功');
          setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } catch (e: any) {
          toast.error(e.response?.data?.error || '修改失败');
      }
  };

  const handleChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post('/api/settings', settings);
      toast.success('配置已保存成功');
    } catch (error: any) {
      console.error('Failed to save settings:', error);
      toast.error(error.response?.data?.error || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageLoading message="正在加载系统配置..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <PageHeader 
          title="系统设置" 
          icon={Settings}
        />

        {/* Tabs */}
        <div className="flex space-x-4 mb-6 border-b border-gray-200">
            <button
                onClick={() => setActiveTab('profile')}
                className={`pb-2 px-4 font-medium text-sm transition-colors ${activeTab === 'profile' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
                个人资料
            </button>
            <button
                onClick={() => setActiveTab('system')}
                className={`pb-2 px-4 font-medium text-sm transition-colors ${activeTab === 'system' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
                系统配置
            </button>
        </div>

        <div className="space-y-6">
          
          {/* Profile Tab */}
          {activeTab === 'profile' && (
              <>
                <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
                        <Users className="mr-2 text-gray-500" size={20}/> 基本信息
                    </h2>
                    
                    <div className="space-y-4 max-w-md">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={profileForm.username}
                                    disabled={!isEditingProfile}
                                    onChange={e => setProfileForm({...profileForm, username: e.target.value})}
                                    className={`w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 ${!isEditingProfile ? 'bg-gray-50 text-gray-500' : ''}`}
                                />
                                {!isEditingProfile ? (
                                    <button 
                                        onClick={() => setIsEditingProfile(true)}
                                        className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                ) : (
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={handleUpdateProfile}
                                            className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
                                        >
                                            保存
                                        </button>
                                        <button 
                                            onClick={() => {
                                                setIsEditingProfile(false);
                                                setProfileForm({ username: user?.username || '', alias: user?.alias || '' });
                                            }}
                                            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
                                        >
                                            取消
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">当前密码</label>
                            <input 
                                type="text" 
                                value="***********"
                                disabled
                                className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
                        <Lock className="mr-2 text-gray-500" size={20}/> 修改密码
                    </h2>
                    <form onSubmit={handlePasswordChange} className="max-w-md space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">当前密码</label>
                            <input 
                                type="password" 
                                required
                                value={passwordForm.currentPassword}
                                onChange={e => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                                className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">新密码</label>
                            <input 
                                type="password" 
                                required
                                minLength={6}
                                value={passwordForm.newPassword}
                                onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                                className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">确认新密码</label>
                            <input 
                                type="password" 
                                required
                                minLength={6}
                                value={passwordForm.confirmPassword}
                                onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                                className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700">
                            更新密码
                        </button>
                    </form>
                </div>
              </>
          )}

          {/* System Settings Tab */}
          {activeTab === 'system' && (
            <>
              {/* Engagement Settings */}
              <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center">
              <MessageSquare className="text-pink-500 mr-2" size={20} />
              <h2 className="text-lg font-medium text-gray-900">互动与同步</h2>
            </div>
            <div className="p-6 space-y-4">
              
              {/* Sync Schedule */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  数据同步频率 (Cron 表达式)
                </label>
                <div className="relative">
                    <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      value={settings.SYNC_SCHEDULE || '0 9,15,21,3 * * *'}
                      onChange={(e) => handleChange('SYNC_SCHEDULE', e.target.value)}
                      placeholder="0 9,15,21,3 * * *"
                      className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-10 border px-3"
                    />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                   Cron 表达式。默认: <code>0 9,15,21,3 * * *</code> (每天 3点, 9点, 15点, 21点 同步)
                </p>
              </div>

              {/* Auto Reply Analysis Toggle */}
              <div className="flex items-center justify-between py-2 border-b border-gray-100 mb-4 pb-4">
                 <div>
                    <label className="text-sm font-medium text-gray-700">启用 AI 自动意图分析</label>
                    <p className="text-xs text-gray-500">同步评论时，自动调用 AI 分析用户意图并生成回复建议</p>
                 </div>
                 <div className="flex items-center">
                    <button 
                        onClick={() => handleChange('AUTO_REPLY_ENABLED', settings.AUTO_REPLY_ENABLED === 'true' ? 'false' : 'true')}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${settings.AUTO_REPLY_ENABLED === 'true' ? 'bg-pink-600' : 'bg-gray-200'}`}
                    >
                        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.AUTO_REPLY_ENABLED === 'true' ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                 </div>
              </div>

              {/* AI Analysis Limit */}
              {settings.AUTO_REPLY_ENABLED === 'true' && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      单次同步 AI 分析条数限制
                    </label>
                    <div className="relative">
                        <MessageSquare className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={settings.AI_ANALYSIS_LIMIT || '20'}
                          onChange={(e) => handleChange('AI_ANALYSIS_LIMIT', e.target.value)}
                          placeholder="20"
                          className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-10 border px-3"
                        />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                       限制每次同步后调用 AI 分析的评论数量，防止 Token 消耗过大。默认: 20 条
                    </p>
                  </div>
              )}

            </div>
          </div>

          {/* Aliyun Configuration (Image & Video & Text) */}
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center">
              <Image className="text-indigo-600 mr-2" size={20} />
              <h2 className="text-lg font-medium text-gray-900">阿里云通义千问</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key (DASHSCOPE_API_KEY)
                </label>
                <div className="relative">
                    <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="password"
                      value={settings.aliyun_api_key || ''}
                      onChange={(e) => handleChange('aliyun_api_key', e.target.value)}
                      placeholder="sk-..."
                      className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-10 border px-3"
                    />
                </div>
                <p className="mt-1 text-xs text-gray-500">如果不填，默认读取环境变量 .env 中的配置</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Text Model */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      文本生成模型
                    </label>
                    <input
                      type="text"
                      value={settings.aliyun_text_model || ''}
                      onChange={(e) => handleChange('aliyun_text_model', e.target.value)}
                      placeholder="qwen-plus"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-10 border px-3"
                    />
                    <div className="mt-2 flex gap-2 flex-wrap">
                        {['qwen-turbo', 'qwen-plus', 'qwen-max'].map(m => (
                            <button
                                key={m}
                                onClick={() => handleChange('aliyun_text_model', m)}
                                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded"
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                  </div>

                  {/* VL Model (Visual Analysis) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      视觉理解模型
                    </label>
                    <input
                      type="text"
                      value={settings.aliyun_vl_model || ''}
                      onChange={(e) => handleChange('aliyun_vl_model', e.target.value)}
                      placeholder="qwen-vl-max"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-10 border px-3"
                    />
                    <div className="mt-2 flex gap-2 flex-wrap">
                        {['qwen-vl-plus', 'qwen-vl-max', 'qwen-vl-max-2025-08-13'].map(m => (
                            <button
                                key={m}
                                onClick={() => handleChange('aliyun_vl_model', m)}
                                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded"
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                  </div>

                  {/* Image Generation */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      图片生成模型
                    </label>
                    <input
                      type="text"
                      value={settings.aliyun_image_model || ''}
                      onChange={(e) => handleChange('aliyun_image_model', e.target.value)}
                      placeholder="wanx-v1"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-10 border px-3"
                    />
                    <div className="mt-2 flex gap-2 flex-wrap">
                        {['wanx-v1', 'wanx-v2'].map(m => (
                            <button
                                key={m}
                                onClick={() => handleChange('aliyun_image_model', m)}
                                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded"
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                  </div>

                  {/* Video Generation */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      视频生成模型
                    </label>
                    <input
                      type="text"
                      value={settings.aliyun_video_model || ''}
                      onChange={(e) => handleChange('aliyun_video_model', e.target.value)}
                      placeholder="wan2.1-t2v-plus"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-10 border px-3"
                    />
                    <div className="mt-2 flex gap-2 flex-wrap">
                        {['wan2.1-t2v-plus', 'wan2.1-t2v-turbo', 'wan2.0-t2v-turbo', 'wanx-v1'].map(m => (
                            <button
                                key={m}
                                onClick={() => handleChange('aliyun_video_model', m)}
                                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded"
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                  </div>

                  {/* Audio Transcription */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      语音转写模型 (ASR Model)
                    </label>
                    <input
                      type="text"
                      value={settings.aliyun_audio_model || ''}
                      onChange={(e) => handleChange('aliyun_audio_model', e.target.value)}
                      placeholder="paraformer-8k-v1"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-10 border px-3"
                    />
                    <div className="mt-2 flex gap-2 flex-wrap">
                        {['paraformer-8k-v1', 'paraformer-v1', 'sensevoice-v1'].map(m => (
                            <button
                                key={m}
                                onClick={() => handleChange('aliyun_audio_model', m)}
                                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded"
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                  </div>
              </div>
            </div>
          </div>

          {/* DeepSeek Configuration */}
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center">
              <Cpu className="text-blue-600 mr-2" size={20} />
              <h2 className="text-lg font-medium text-gray-900">DeepSeek (文案生成)</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key (DEEPSEEK_API_KEY)
                </label>
                <div className="relative">
                    <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="password"
                      value={settings.deepseek_api_key || ''}
                      onChange={(e) => handleChange('deepseek_api_key', e.target.value)}
                      placeholder="sk-..."
                      className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-10 border px-3"
                    />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Base URL
                </label>
                <input
                  type="text"
                  value={settings.deepseek_base_url || ''}
                  onChange={(e) => handleChange('deepseek_base_url', e.target.value)}
                  placeholder="https://api.deepseek.com"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-10 border px-3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  模型名称 (Model Name)
                </label>
                <input
                  type="text"
                  value={settings.deepseek_model || ''}
                  onChange={(e) => handleChange('deepseek_model', e.target.value)}
                  placeholder="deepseek-chat"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-10 border px-3"
                />
                 <div className="mt-2 flex gap-2">
                    {['deepseek-chat', 'deepseek-reasoner'].map(m => (
                        <button
                            key={m}
                            onClick={() => handleChange('deepseek_model', m)}
                            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded"
                        >
                            {m}
                        </button>
                    ))}
                </div>
              </div>
            </div>
          </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`flex items-center justify-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white transition-colors
                    ${saving ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}
                  `}
                >
                  <Save className="mr-2" size={20} />
                  {saving ? '保存中...' : '保存配置'}
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}