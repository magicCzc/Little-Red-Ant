import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Lock, User, ArrowRight, ShieldCheck, Eye, EyeOff, Sparkles } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function Login() {
    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [hasUsers, setHasUsers] = useState(true);

    useEffect(() => {
        if (isAuthenticated()) {
            navigate('/');
        }
        checkInit();
    }, []);

    const checkInit = async () => {
        try {
            const res = await axios.get('/api/auth/init-check');
            setHasUsers(res.data.hasUsers);
            if (!res.data.hasUsers) {
                setIsLogin(false);
            }
        } catch (e) {
            console.error('Failed to check init status');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
            const res = await axios.post(endpoint, { username, password });

            if (isLogin) {
                login(res.data.token, res.data.user);
                toast.success('欢迎回来！');
                navigate('/');
            } else {
                if (hasUsers) {
                    toast.success('注册成功，请登录');
                    setIsLogin(true);
                } else {
                    toast.success('管理员账号创建成功！请登录');
                    setIsLogin(true);
                    setHasUsers(true);
                }
            }
        } catch (err: any) {
            const msg = err.response?.data?.error || '操作失败';
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
            <div className="max-w-md w-full">
                {/* Logo Card */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    {/* Header with Gradient */}
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-6 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm mb-3">
                            <Sparkles className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-white">
                            小红蚁
                        </h1>
                        <p className="text-indigo-100 text-sm mt-1">
                            小红书矩阵运营系统
                        </p>
                    </div>

                    {/* Form Section */}
                    <div className="p-8">
                        {/* Tab Switcher */}
                        <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
                            <button
                                onClick={() => {
                                    setIsLogin(true);
                                    setError('');
                                }}
                                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                                    isLogin 
                                        ? 'bg-white text-indigo-600 shadow-sm' 
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                登录
                            </button>
                            <button
                                onClick={() => {
                                    setIsLogin(false);
                                    setError('');
                                }}
                                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                                    !isLogin 
                                        ? 'bg-white text-indigo-600 shadow-sm' 
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                {hasUsers ? '注册' : '创建管理员'}
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Username Field */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    用户名
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <User className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="pl-10 block w-full border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm p-3 border transition-colors"
                                        placeholder="请输入用户名"
                                    />
                                </div>
                            </div>

                            {/* Password Field */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    密码
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pl-10 pr-10 block w-full border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm p-3 border transition-colors"
                                        placeholder="请输入密码"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                                    >
                                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                                    <ShieldCheck className="h-4 w-4 flex-shrink-0" />
                                    {error}
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {loading ? (
                                    <div className="flex items-center">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                        处理中...
                                    </div>
                                ) : (
                                    <>
                                        {isLogin ? '登 录' : hasUsers ? '注 册' : '创建管理员账号'}
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Footer Info */}
                        <div className="mt-6 text-center">
                            <p className="text-xs text-gray-500">
                                {isLogin ? '还没有账号？' : '已有账号？'}
                                <button
                                    onClick={() => {
                                        setIsLogin(!isLogin);
                                        setError('');
                                    }}
                                    className="text-indigo-600 hover:text-indigo-800 font-medium ml-1"
                                >
                                    {isLogin ? '立即注册' : '立即登录'}
                                </button>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-gray-400 mt-6">
                    © 2024 小红蚁 - 小红书矩阵运营系统
                </p>
            </div>
        </div>
    );
}
