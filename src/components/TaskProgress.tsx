/**
 * 任务进度组件 - 显示任务执行进度和步骤
 *
 * 功能：
 * 1. 进度条显示整体进度
 * 2. 步骤列表显示当前执行步骤
 * 3. 状态图标和文字说明
 *
 * 使用示例：
 * <TaskProgress
 *   status="PROCESSING"
 *   progress={60}
 *   currentStep="正在提取数据..."
 *   steps={['准备', '访问页面', '提取数据', '分析']}
 *   currentStepIndex={2}
 * />
 */

import React from 'react';
import { CheckCircle2, Circle, Loader2, Clock, AlertCircle } from 'lucide-react';

interface TaskProgressProps {
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    progress?: number;
    currentStep?: string;
    steps?: string[];
    currentStepIndex?: number;
    error?: string;
    className?: string;
}

const statusConfig = {
    PENDING: {
        color: 'text-gray-500',
        bgColor: 'bg-gray-100',
        barColor: 'bg-gray-300',
        icon: Clock,
        label: '等待中'
    },
    PROCESSING: {
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        barColor: 'bg-blue-500',
        icon: Loader2,
        label: '执行中'
    },
    COMPLETED: {
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        barColor: 'bg-green-500',
        icon: CheckCircle2,
        label: '已完成'
    },
    FAILED: {
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        barColor: 'bg-red-500',
        icon: AlertCircle,
        label: '失败'
    },
    CANCELLED: {
        color: 'text-gray-500',
        bgColor: 'bg-gray-50',
        barColor: 'bg-gray-400',
        icon: AlertCircle,
        label: '已取消'
    }
};

export default function TaskProgress({
    status,
    progress = 0,
    currentStep,
    steps = [],
    currentStepIndex = -1,
    error,
    className = ''
}: TaskProgressProps) {
    const config = statusConfig[status] || statusConfig.PENDING;
    const StatusIcon = config.icon;
    const isRunning = status === 'PENDING' || status === 'PROCESSING';

    // 计算实际进度
    const displayProgress = status === 'COMPLETED' ? 100 : Math.min(Math.max(progress, 0), 100);

    return (
        <div className={`space-y-3 ${className}`}>
            {/* 进度条 */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                        <StatusIcon 
                            size={14} 
                            className={`${config.color} ${status === 'PROCESSING' ? 'animate-spin' : ''}`} 
                        />
                        <span className={`font-medium ${config.color}`}>
                            {config.label}
                        </span>
                        {currentStep && status === 'PROCESSING' && (
                            <span className="text-gray-500 ml-1">· {currentStep}</span>
                        )}
                    </div>
                    <span className="text-gray-500">{Math.round(displayProgress)}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${config.barColor}`}
                        style={{ width: `${displayProgress}%` }}
                    />
                </div>
            </div>

            {/* 步骤列表 */}
            {steps.length > 0 && (
                <div className="flex items-center gap-1 text-xs">
                    {steps.map((step, index) => {
                        const isCompleted = index < currentStepIndex;
                        const isCurrent = index === currentStepIndex && status === 'PROCESSING';
                        const isPending = index > currentStepIndex;

                        return (
                            <React.Fragment key={index}>
                                <div className="flex items-center">
                                    {isCompleted ? (
                                        <CheckCircle2 size={12} className="text-green-500" />
                                    ) : isCurrent ? (
                                        <Loader2 size={12} className="text-blue-500 animate-spin" />
                                    ) : (
                                        <Circle size={12} className="text-gray-300" />
                                    )}
                                    <span
                                        className={`ml-1 ${
                                            isCompleted
                                                ? 'text-green-600'
                                                : isCurrent
                                                    ? 'text-blue-600 font-medium'
                                                    : 'text-gray-400'
                                        }`}
                                    >
                                        {step}
                                    </span>
                                </div>
                                {index < steps.length - 1 && (
                                    <div
                                        className={`w-4 h-px mx-1 ${
                                            isCompleted ? 'bg-green-300' : 'bg-gray-200'
                                        }`}
                                    />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            )}

            {/* 错误信息 */}
            {error && status === 'FAILED' && (
                <div className="text-xs text-red-600 bg-red-50 rounded px-2 py-1.5">
                    {error}
                </div>
            )}
        </div>
    );
}

/**
 * 简洁版任务状态（用于列表项）
 */
export function TaskStatusBadge({
    status,
    progress = 0
}: {
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    progress?: number;
}) {
    const config = statusConfig[status] || statusConfig.PENDING;
    const StatusIcon = config.icon;

    return (
        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${config.bgColor}`}>
            <StatusIcon 
                size={12} 
                className={`${config.color} ${status === 'PROCESSING' ? 'animate-spin' : ''}`} 
            />
            <span className={config.color}>{config.label}</span>
            {status === 'PROCESSING' && progress > 0 && (
                <span className="text-gray-500">{Math.round(progress)}%</span>
            )}
        </div>
    );
}

/**
 * 任务类型标签
 */
export function TaskTypeLabel({ type }: { type: string }) {
    const typeNames: Record<string, string> = {
        'PUBLISH': '发布笔记',
        'SCRAPE_STATS': '同步数据',
        'SCRAPE_COMMENTS': '抓取评论',
        'SCRAPE_TRENDS': '抓取热点',
        'SCRAPE_COMPETITOR': '更新对标账号',
        'GENERATE_CONTENT': 'AI生成文案',
        'GENERATE_IMAGE': 'AI生成配图',
        'GENERATE_VIDEO': 'AI生成视频'
    };

    const typeColors: Record<string, string> = {
        'PUBLISH': 'bg-purple-100 text-purple-700',
        'SCRAPE_STATS': 'bg-blue-100 text-blue-700',
        'SCRAPE_COMMENTS': 'bg-cyan-100 text-cyan-700',
        'SCRAPE_TRENDS': 'bg-orange-100 text-orange-700',
        'SCRAPE_COMPETITOR': 'bg-pink-100 text-pink-700',
        'GENERATE_CONTENT': 'bg-green-100 text-green-700',
        'GENERATE_IMAGE': 'bg-indigo-100 text-indigo-700',
        'GENERATE_VIDEO': 'bg-rose-100 text-rose-700'
    };

    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${typeColors[type] || 'bg-gray-100 text-gray-700'}`}>
            {typeNames[type] || type}
        </span>
    );
}
