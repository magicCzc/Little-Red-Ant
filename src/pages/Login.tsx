import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Lock, User, ArrowRight, ShieldCheck } from 'lucide-react';

import { toast } from 'react-hot-toast';

export default function Login() {
    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
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
                setIsLogin(false); // Force register if no users
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
                // Login Success
                login(res.data.token, res.data.user);
                toast.success('登录成功');
                navigate('/');
            } else {
                // Register Success
                if (hasUsers) {
                    toast.success('注册成功，请登录');
                    setIsLogin(true);
                } else {
                    // If it was the first user, auto login? Or just go to login
                    toast.success('管理员账号创建成功！请登录');
                    setIsLogin(true);
                    setHasUsers(true);
                }
            }
        } catch (err: any) {
            const msg = err.response?.data?.error || 'Operation failed';
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
                        <ShieldCheck className="w-8 h-8 text-red-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {isLogin ? '欢迎回来 (Welcome Back)' : '初始化管理员 (Init Admin)'}
                    </h1>
                    <p className="text-gray-500 text-sm mt-2">
                        Little Red Ant - 小红书矩阵运营系统
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            用户名 (Username)
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
                                className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm p-3 border"
                                placeholder="Enter username"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            密码 (Password)
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm p-3 border"
                                placeholder="Enter password"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="text-red-500 text-sm bg-red-50 p-3 rounded-md">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {loading ? 'Processing...' : (
                            <>
                                {isLogin ? '登录 (Login)' : '注册 (Register)'}
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setError('');
                        }}
                        className="text-sm text-red-600 hover:text-red-500"
                    >
                        {isLogin ? '没有账号？注册 (Register)' : '已有账号？登录 (Login)'}
                    </button>
                </div>
            </div>
        </div>
    );
}
