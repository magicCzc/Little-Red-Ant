import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Menu, X, LogOut, Home, Users, Sparkles, PenTool, Layout as LayoutIcon, 
  MessageSquare, Target, FileText, BarChart, PlayCircle, Settings, ShieldCheck, Bell, ChevronLeft, ChevronRight, Flame, Database, Library, TrendingUp
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import axios from 'axios';
import TaskMonitor from './TaskMonitor';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);

  // Fetch unread notifications
  useEffect(() => {
    const fetchUnread = async () => {
        try {
            const res = await axios.get('/api/notifications');
            if (res.data && Array.isArray(res.data)) {
                const count = res.data.filter((n: any) => !n.is_read).length;
                setUnreadCount(count);
            }
        } catch (e) {
            // Silent error
        }
    };
    
    fetchUnread();
    // Poll every 60s
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, [location.pathname]); // Re-check on navigation

  // Define Menu Items with Role Based Access
  const menuGroups = [
    {
      title: '创作中心',
      items: [
        { title: '首页', icon: Home, path: '/' },
        // { title: '热点追踪', icon: Sparkles, path: '/trends' }, // Removed: integrated into Gallery
        { title: '智能创作', icon: PenTool, path: '/generate' },
        { title: '视频工程', icon: PlayCircle, path: '/video-projects' },
        { title: '素材库', icon: Library, path: '/assets' },
        { title: '草稿箱', icon: FileText, path: '/drafts' },
      ]
    },
    {
      title: '爆款库',
      items: [
        { title: '发现爆款', icon: Flame, path: '/gallery' },
        { title: '我的爆款', icon: Database, path: '/knowledge' },
      ]
    },
    {
      title: '运营分析',
      items: [
        { title: '笔记管理', icon: FileText, path: '/notes' },
        { title: '竞品监控', icon: Target, path: '/competitor' },
        { title: '数据看板', icon: BarChart, path: '/analytics' },
        { title: '互动中心', icon: MessageSquare, path: '/engagement' },
      ]
    },
    {
      title: '系统管理',
      items: [
        { title: '账号矩阵', icon: LayoutIcon, path: '/accounts' },
        // { title: '人设打造', icon: Users, path: '/persona' }, // Merged into Accounts
        { title: '任务中心', icon: PlayCircle, path: '/tasks' },
        { title: '权限管理', icon: ShieldCheck, path: '/users', requiredRole: 'admin' },
        { title: '系统设置', icon: Settings, path: '/settings', requiredRole: 'admin' },
      ]
    }
  ];

  const handleLogoutClick = () => {
      setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
      logout();
      navigate('/login');
      setShowLogoutConfirm(false);
  };

  const isActive = (path: string) => location.pathname === path;

  // Filter menu items based on user role and permissions
  const getFilteredMenuGroups = () => {
      if (!user) return [];
      const userRole = user.role || 'editor';
      
      return menuGroups.map(group => ({
          ...group,
          items: group.items.filter((item: any) => {
              // 1. Role Check
              if (item.requiredRole === 'admin' && userRole !== 'admin') {
                  return false;
              }
              // 2. Permission Check
              return true;
          })
      })).filter(group => group.items.length > 0);
  };

  const filteredGroups = getFilteredMenuGroups();

  return (
    <div className="h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
                    <LogOut className="text-red-600" size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 text-center mb-2">确认退出？</h3>
                <p className="text-sm text-gray-500 text-center mb-6">
                    退出后您需要重新登录才能管理账号。
                </p>
                <div className="flex space-x-3">
                    <button 
                        onClick={() => setShowLogoutConfirm(false)}
                        className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                    >
                        取消
                    </button>
                    <button 
                        onClick={confirmLogout}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                    >
                        确认退出
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Mobile Header */}
      <div className="md:hidden bg-gradient-to-r from-indigo-600 to-purple-600 p-4 flex justify-between items-center sticky top-0 z-20 shadow-lg">
        <div className="flex items-center font-bold text-white">
           <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center mr-2 text-lg">
              🐜
           </div>
           小红蚁
        </div>
        <div className="flex items-center gap-3">
            <button className="p-2 text-white/80 hover:bg-white/20 rounded-full relative transition-colors">
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-400 rounded-full border-2 border-indigo-600"></span>
                )}
            </button>
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-white p-1">
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
        </div>
      </div>

      {/* Sidebar (Desktop & Mobile Drawer) */}
      <div className={`
        fixed inset-y-0 left-0 z-30 bg-white border-r border-gray-200 transform transition-all duration-200 ease-in-out
        md:relative md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isSidebarCollapsed ? 'w-20' : 'w-64'}
      `}>
        <div className="h-full flex flex-col relative">
          
          {/* Collapse Toggle (Desktop Only) */}
          <button 
             onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
             className="hidden md:flex absolute -right-3 top-10 bg-white border border-gray-200 rounded-full p-1 text-gray-400 hover:text-gray-600 shadow-sm z-50"
          >
             {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          {/* Logo Area */}
          <div className="p-6 border-b border-gray-100 hidden md:flex items-center justify-between h-20 bg-gradient-to-r from-indigo-50 to-purple-50">
             <div className="flex items-center justify-center w-full">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0 shadow-lg text-lg">
                  🐜
                </div>
                {!isSidebarCollapsed && <span className="text-xl font-bold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent ml-3 whitespace-nowrap overflow-hidden">小红蚁</span>}
             </div>
          </div>

          {/* User Profile Summary */}
          <div className={`bg-gradient-to-r from-indigo-50/50 to-purple-50/50 border-b border-gray-100 flex items-center ${isSidebarCollapsed ? 'justify-center p-2' : 'justify-between p-4'}`}>
             <div className="flex items-center min-w-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold flex-shrink-0 shadow-sm">
                    {user?.username?.charAt(0).toUpperCase() || 'A'}
                </div>
                {!isSidebarCollapsed && (
                    <div className="min-w-0 ml-3">
                        <p className="text-sm font-medium text-gray-900 truncate max-w-[100px]">{user?.username || 'Admin'}</p>
                        <p className="text-xs text-gray-500 truncate capitalize">{user?.role === 'admin' ? '管理员' : '编辑'}</p>
                    </div>
                )}
             </div>
             {/* Notification Bell (Desktop) */}
             {!isSidebarCollapsed && (
                <Link to="/notifications" className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full relative transition-colors">
                    <Bell size={18} />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
                    )}
                </Link>
             )}
          </div>

          {/* Nav Items */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-6">
            {filteredGroups.map((group, groupIdx) => (
                <div key={groupIdx}>
                    {!isSidebarCollapsed && (
                        <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                            {group.title}
                        </h3>
                    )}
                    <div className="space-y-1">
                        {group.items.map((item) => (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setIsMobileMenuOpen(false)}
                            title={isSidebarCollapsed ? item.title : ''}
                            className={`
                              flex items-center px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200
                              ${isActive(item.path) 
                                ? 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 shadow-sm' 
                                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}
                              ${isSidebarCollapsed ? 'justify-center' : ''}
                            `}
                          >
                            <item.icon className={`h-5 w-5 flex-shrink-0 ${isActive(item.path) ? 'text-indigo-600' : 'text-gray-400'} ${!isSidebarCollapsed ? 'mr-3' : ''}`} />
                            {!isSidebarCollapsed && item.title}
                          </Link>
                        ))}
                    </div>
                </div>
            ))}
          </nav>

          {/* Footer Actions */}
          <div className="p-4 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
            <button 
              onClick={handleLogoutClick}
              className={`flex items-center w-full px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title={isSidebarCollapsed ? '退出登录' : ''}
            >
              <LogOut className={`h-5 w-5 flex-shrink-0 ${!isSidebarCollapsed ? 'mr-3' : ''}`} />
              {!isSidebarCollapsed && '退出登录'}
            </button>
          </div>
        </div>
      </div>

      {/* Overlay for Mobile */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-20 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto md:p-8 p-4 w-full">
        <div className="max-w-7xl mx-auto">
           {children}
        </div>
      </main>

      {/* Global Task Monitor */}
      <TaskMonitor />
    </div>
  );
}
