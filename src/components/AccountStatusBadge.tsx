import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { AlertCircle, CheckCircle, RefreshCw, XCircle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AccountStatus {
    id: number;
    nickname: string;
    avatar: string;
    status: 'ACTIVE' | 'EXPIRED' | 'UNKNOWN';
    last_checked: string;
}

export default function AccountStatusBadge() {
    const [account, setAccount] = useState<AccountStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [checking, setChecking] = useState(false);

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            // Simplified API call to get primary account status
            const res = await axios.get('/api/accounts/primary-status'); 
            setAccount(res.data);
        } catch (e) {
            console.error('Failed to fetch account status', e);
        } finally {
            setLoading(false);
        }
    };

    const handleRecheck = async () => {
        setChecking(true);
        try {
            await axios.post('/api/accounts/check-health');
            await fetchStatus();
        } catch (e) {
            console.error('Health check failed', e);
        } finally {
            setChecking(false);
        }
    };

    if (loading) return null;

    if (!account) {
        return (
            <Link to="/accounts" className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium hover:bg-gray-200 transition-colors">
                <AlertCircle size={14} />
                <span>未绑定账号</span>
            </Link>
        );
    }

    const statusConfig = {
        'ACTIVE': { color: 'bg-green-100 text-green-700', icon: CheckCircle, text: '账号状态正常' },
        'EXPIRED': { color: 'bg-red-100 text-red-700', icon: XCircle, text: 'Cookie 已过期' },
        'UNKNOWN': { color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle, text: '状态未知' }
    };

    const config = statusConfig[account.status] || statusConfig['UNKNOWN'];
    const Icon = config.icon;

    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${config.color} border border-transparent`}>
            <Icon size={14} />
            <span className="truncate max-w-[100px]">{account.nickname}</span>
            <span className="w-px h-3 bg-current opacity-30 mx-1"></span>
            <span>{config.text}</span>
            
            <button 
                onClick={(e) => { e.preventDefault(); handleRecheck(); }} 
                disabled={checking}
                className="ml-1 p-0.5 rounded-full hover:bg-black/5 transition-colors"
                title="重新检查状态"
            >
                <RefreshCw size={12} className={checking ? 'animate-spin' : ''} />
            </button>
            
            {account.status === 'EXPIRED' && (
                <Link to="/accounts" className="ml-1 underline hover:no-underline">
                    去修复
                </Link>
            )}
        </div>
    );
}
