
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Shield, Plus, Edit3, Trash2, X, Check, Lock, AlertTriangle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/useAuthStore';
import Modal from '../components/Modal';

interface User {
    id: number;
    username: string;
    alias?: string;
    role: 'admin' | 'editor' | 'viewer';
    created_at: string;
}

export default function UserManagement() {
    const { user: currentUser } = useAuthStore();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        alias: '',
        role: 'editor' as User['role']
    });

    // Available Permissions Definition
    const AVAILABLE_PERMISSIONS = [
        { key: 'manage_users', label: '用户管理' },
        { key: 'system_settings', label: '系统设置' },
        { key: 'publish_content', label: '发布内容' },
        { key: 'view_analytics', label: '查看数据' },
        { key: 'manage_accounts', label: '账号管理' },
    ];

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await axios.get('/api/users');
            setUsers(res.data);
        } catch (error) {
            toast.error('获取用户列表失败');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await axios.post('/api/users', formData);
            toast.success('用户创建成功');
            setIsCreating(false);
            setFormData({ username: '', password: '', alias: '', role: 'editor' });
            fetchUsers();
        } catch (error: any) {
            toast.error(error.response?.data?.error || '创建失败');
        }
    };

    const handleUpdate = async (id: number) => {
        try {
            await axios.put(`/api/users/${id}`, {
                role: formData.role,
                alias: formData.alias,
                permissions: editingPermissions // Send as array, backend handles stringify if needed
            });
            toast.success('更新成功');
            setEditingId(null);
            fetchUsers();
        } catch (error: any) {
            toast.error('更新失败');
        }
    };

    const confirmDelete = (id: number) => {
        setDeleteId(id);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await axios.delete(`/api/users/${deleteId}`);
            toast.success('用户已删除');
            setIsDeleteModalOpen(false);
            setDeleteId(null);
            fetchUsers();
        } catch (error: any) {
            toast.error(error.response?.data?.error || '删除失败');
        }
    };

    // State for granular permissions editing
    const [editingPermissions, setEditingPermissions] = useState<string[]>([]);

    const startEdit = (user: User) => {
        setEditingId(user.id);
        setFormData({
            ...formData,
            alias: user.alias || user.username,
            role: user.role
        });
        // Parse permissions safely
        try {
            const perms = typeof (user as any).permissions === 'string' 
                ? JSON.parse((user as any).permissions) 
                : ((user as any).permissions || []);
            setEditingPermissions(perms);
        } catch (e) {
            setEditingPermissions([]);
        }
    };

    if (currentUser?.role !== 'admin') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center p-8 bg-white rounded-lg shadow-sm border border-gray-100 max-w-md">
                    <Shield size={48} className="mx-auto text-gray-300 mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 mb-2">访问受限</h2>
                    <p className="text-gray-500">您没有权限访问此页面，请联系管理员。</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                            <Users className="mr-2 text-indigo-600" />
                            权限管理
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">管理团队成员、角色分配及系统访问权限</p>
                    </div>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        <Plus size={18} className="mr-1" /> 添加成员
                    </button>
                </div>

                {/* Create Modal */}
                {isCreating && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <h3 className="font-bold text-gray-800">添加新成员</h3>
                                <button onClick={() => setIsCreating(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                            </div>
                            <form onSubmit={handleCreate} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                                    <input 
                                        type="text" required
                                        value={formData.username}
                                        onChange={e => setFormData({...formData, username: e.target.value})}
                                        className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="用于登录"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">初始密码</label>
                                    <input 
                                        type="password" required
                                        value={formData.password}
                                        onChange={e => setFormData({...formData, password: e.target.value})}
                                        className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="不少于6位"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">别名/昵称</label>
                                    <input 
                                        type="text"
                                        value={formData.alias}
                                        onChange={e => setFormData({...formData, alias: e.target.value})}
                                        className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="例如：运营小王"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">角色权限</label>
                                    <select 
                                        value={formData.role}
                                        onChange={e => setFormData({...formData, role: e.target.value as any})}
                                        className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                    >
                                        <option value="editor">运营 - 内容创作与发布</option>
                                        <option value="admin">管理员 - 系统全权</option>
                                        <option value="viewer">访客 - 仅查看数据</option>
                                    </select>
                                </div>
                                <div className="pt-4 flex justify-end gap-3">
                                    <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">取消</button>
                                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">创建用户</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* User List */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">角色</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">加入时间</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {users.map(u => (
                                <tr key={u.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {editingId === u.id ? (
                                            <div className="space-y-2">
                                                <input 
                                                    value={formData.alias}
                                                    onChange={e => setFormData({...formData, alias: e.target.value})}
                                                    className="block w-full text-sm border rounded px-2 py-1"
                                                    placeholder="别名"
                                                />
                                                <div className="text-xs text-gray-400">@{u.username}</div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center">
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold mr-3">
                                                    {(u.alias || u.username)[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">{u.alias || u.username}</div>
                                                    <div className="text-xs text-gray-500">@{u.username}</div>
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {editingId === u.id ? (
                                            <div className="space-y-2">
                                                <select 
                                                    value={formData.role}
                                                    onChange={e => setFormData({...formData, role: e.target.value as any})}
                                                    className="text-sm border rounded px-2 py-1 bg-white w-full mb-2"
                                                >
                                                    <option value="admin">管理员</option>
                                                    <option value="editor">运营</option>
                                                    <option value="viewer">访客</option>
                                                </select>
                                                
                                                <div className="text-xs space-y-1 bg-gray-50 p-2 rounded border border-gray-100">
                                                    <p className="font-medium text-gray-500 mb-1">细粒度权限:</p>
                                                    {AVAILABLE_PERMISSIONS.map(p => (
                                                        <label key={p.key} className="flex items-center space-x-2 cursor-pointer">
                                                            <input 
                                                                type="checkbox"
                                                                checked={editingPermissions.includes(p.key)}
                                                                onChange={e => {
                                                                    if (e.target.checked) {
                                                                        setEditingPermissions([...editingPermissions, p.key]);
                                                                    } else {
                                                                        setEditingPermissions(editingPermissions.filter(k => k !== p.key));
                                                                    }
                                                                }}
                                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3 w-3"
                                                            />
                                                            <span>{p.label}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-1">
                                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full w-fit
                                                    ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 
                                                      u.role === 'editor' ? 'bg-green-100 text-green-800' : 
                                                      'bg-gray-100 text-gray-800'}`}>
                                                    {u.role === 'admin' && '管理员'}
                                                    {u.role === 'editor' && '运营人员'}
                                                    {u.role === 'viewer' && '访客'}
                                                </span>
                                                {/* Show Permissions Tags */}
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {(() => {
                                                        const perms = typeof (u as any).permissions === 'string' 
                                                            ? JSON.parse((u as any).permissions) 
                                                            : ((u as any).permissions || []);
                                                        return perms.map((p: string) => (
                                                            <span key={p} className="text-[10px] text-gray-500 bg-gray-100 px-1 rounded border border-gray-200">
                                                                {AVAILABLE_PERMISSIONS.find(ap => ap.key === p)?.label || p}
                                                            </span>
                                                        ));
                                                    })()}
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(u.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        {editingId === u.id ? (
                                            <div className="flex justify-end space-x-2">
                                                <button onClick={() => handleUpdate(u.id)} className="text-green-600 hover:text-green-900 bg-green-50 p-1 rounded"><Check size={16}/></button>
                                                <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600 bg-gray-50 p-1 rounded"><X size={16}/></button>
                                            </div>
                                        ) : (
                                            <div className="flex justify-end space-x-3">
                                                <button onClick={() => startEdit(u)} className="text-indigo-600 hover:text-indigo-900 flex items-center">
                                                    <Edit3 size={14} className="mr-1"/> 编辑
                                                </button>
                                                {u.id !== 1 && u.id !== currentUser?.id && (
                                                    <button onClick={() => confirmDelete(u.id)} className="text-red-600 hover:text-red-900 flex items-center">
                                                        <Trash2 size={14} className="mr-1"/> 删除
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Role Description */}
                <div className="mt-8 bg-blue-50 border border-blue-100 rounded-lg p-4">
                    <h3 className="text-sm font-bold text-blue-900 flex items-center mb-2">
                        <Shield size={16} className="mr-2"/>
                        权限说明
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-blue-800">
                        <div>
                            <span className="font-bold block mb-1">管理员 (Admin)</span>
                            拥有系统最高权限，可管理用户、账号矩阵、系统设置及所有功能。
                        </div>
                        <div>
                            <span className="font-bold block mb-1">运营人员 (Editor)</span>
                            可进行内容创作、发布、评论互动及查看数据，但不可管理团队成员。
                        </div>
                        <div>
                            <span className="font-bold block mb-1">访客 (Viewer)</span>
                            仅可查看数据看板、热点趋势及公开信息，不可进行发布或编辑操作。
                        </div>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="确认删除用户"
                footer={
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setIsDeleteModalOpen(false)}
                            className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleDelete}
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
                        <p className="text-gray-700 font-medium mb-1">您确定要删除该用户吗？</p>
                        <p className="text-gray-500 text-sm">
                            此操作不可恢复。该用户将无法再登录系统。
                        </p>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
