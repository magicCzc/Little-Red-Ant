/**
 * 友好错误提示组件
 * 
 * 功能：将技术错误转换为用户友好的提示界面
 * 
 * 使用示例：
 * <FriendlyError 
 *   error={{
 *     title: '数据获取失败',
 *     message: '无法获取该页面的数据',
 *     suggestion: '可能原因：1) 页面结构变更 2) 网络问题...',
 *     severity: 'error'
 *   }}
 * />
 */

import React from 'react';
import { AlertCircle, AlertTriangle, Info, XCircle } from 'lucide-react';

interface FriendlyErrorData {
    code?: string;
    title: string;
    message: string;
    suggestion: string;
    severity: 'error' | 'warning' | 'info';
}

interface FriendlyErrorProps {
    error: FriendlyErrorData | null;
    onRetry?: () => void;
    className?: string;
}

const severityConfig = {
    error: {
        icon: XCircle,
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        iconColor: 'text-red-500',
        titleColor: 'text-red-800',
        textColor: 'text-red-700'
    },
    warning: {
        icon: AlertTriangle,
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        iconColor: 'text-yellow-500',
        titleColor: 'text-yellow-800',
        textColor: 'text-yellow-700'
    },
    info: {
        icon: Info,
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        iconColor: 'text-blue-500',
        titleColor: 'text-blue-800',
        textColor: 'text-blue-700'
    }
};

export default function FriendlyError({ error, onRetry, className = '' }: FriendlyErrorProps) {
    if (!error) return null;

    const config = severityConfig[error.severity] || severityConfig.error;
    const Icon = config.icon;

    return (
        <div className={`rounded-lg border p-4 ${config.bgColor} ${config.borderColor} ${className}`}>
            <div className="flex items-start gap-3">
                <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${config.iconColor}`} />
                <div className="flex-1 min-w-0">
                    <h4 className={`font-medium text-sm ${config.titleColor}`}>
                        {error.title}
                    </h4>
                    <p className={`text-sm mt-1 ${config.textColor}`}>
                        {error.message}
                    </p>
                    {error.suggestion && (
                        <div className={`mt-3 text-sm ${config.textColor} opacity-90`}>
                            <span className="font-medium">建议：</span>
                            <p className="mt-1">{error.suggestion}</p>
                        </div>
                    )}
                    {onRetry && (
                        <button
                            onClick={onRetry}
                            className={`mt-3 px-3 py-1.5 text-sm rounded-md transition-colors
                                ${error.severity === 'error' 
                                    ? 'bg-red-100 hover:bg-red-200 text-red-700' 
                                    : error.severity === 'warning'
                                        ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700'
                                        : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                                }`}
                        >
                            重试
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * 简洁版错误提示（用于列表项等紧凑场景）
 */
export function FriendlyErrorBadge({ error }: { error: FriendlyErrorData | null }) {
    if (!error) return null;

    const config = severityConfig[error.severity];
    const Icon = config.icon;

    return (
        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${config.bgColor} ${config.textColor}`}>
            <Icon className={`w-3.5 h-3.5 ${config.iconColor}`} />
            <span className="truncate max-w-[200px]">{error.title}</span>
        </div>
    );
}
