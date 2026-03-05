
import React from 'react';
import { LucideIcon, Box, Lightbulb, ArrowRight } from 'lucide-react';

interface Step {
    text: string;
    icon?: LucideIcon;
}

interface EmptyStateProps {
    title?: string;
    description?: string;
    icon?: LucideIcon;
    action?: React.ReactNode;
    steps?: Step[];
    tip?: string;
}

/**
 * 空状态组件 - 引导用户开始使用
 *
 * 使用示例：
 * <EmptyState
 *   title="暂无对标账号"
 *   description="添加对标账号，系统将自动监控其更新并拆解爆款。"
 *   icon={Target}
 *   action={<Button>添加第一个账号</Button>}
 *   steps={[
 *     { text: '复制小红书主页链接' },
 *     { text: '粘贴到输入框' },
 *     { text: '系统自动抓取数据' }
 *   ]}
 *   tip="支持批量添加，一次最多 10 个链接"
 * />
 */
export default function EmptyState({
    title = '暂无数据',
    description = '这里空空如也，快去添加一些内容吧',
    icon: Icon = Box,
    action,
    steps,
    tip
}: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-lg border border-dashed border-gray-300 text-center">
            <div className="bg-gray-50 p-4 rounded-full mb-4">
                <Icon className="text-gray-400" size={32} />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
            <p className="text-sm text-gray-500 max-w-sm mb-6">{description}</p>

            {/* 操作按钮 */}
            {action && <div className="mb-6">{action}</div>}

            {/* 步骤引导 */}
            {steps && steps.length > 0 && (
                <div className="w-full max-w-md mb-6">
                    <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                        操作步骤
                    </div>
                    <div className="space-y-2">
                        {steps.map((step, index) => (
                            <div
                                key={index}
                                className="flex items-center text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3"
                            >
                                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-medium flex items-center justify-center mr-3 flex-shrink-0">
                                    {index + 1}
                                </span>
                                <span className="flex-1 text-left">{step.text}</span>
                                {step.icon && <step.icon size={16} className="text-gray-400 ml-2" />}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 小贴士 */}
            {tip && (
                <div className="flex items-start max-w-md text-left bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
                    <Lightbulb size={16} className="text-amber-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-amber-800">{tip}</span>
                </div>
            )}
        </div>
    );
}

/**
 * 简洁版空状态（用于小空间）
 */
export function EmptyStateCompact({
    title = '暂无数据',
    description,
    action
}: {
    title?: string;
    description?: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <div className="bg-gray-100 p-3 rounded-full mb-3">
                <Box className="text-gray-400" size={24} />
            </div>
            <h3 className="text-sm font-medium text-gray-900 mb-1">{title}</h3>
            {description && (
                <p className="text-xs text-gray-500 mb-3">{description}</p>
            )}
            {action}
        </div>
    );
}

/**
 * 引导卡片（用于页面内嵌引导）
 */
export function GuideCard({
    title,
    description,
    action,
    icon: Icon = Lightbulb
}: {
    title: string;
    description: string;
    action?: React.ReactNode;
    icon?: LucideIcon;
}) {
    return (
        <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-xl p-6">
            <div className="flex items-start gap-4">
                <div className="bg-indigo-100 p-2 rounded-lg">
                    <Icon size={24} className="text-indigo-600" />
                </div>
                <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">{title}</h4>
                    <p className="text-sm text-gray-600 mb-3">{description}</p>
                    {action}
                </div>
            </div>
        </div>
    );
}
