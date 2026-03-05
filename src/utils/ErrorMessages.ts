/**
 * 前端错误消息映射工具
 * 
 * 功能：将后端错误信息转换为用户友好的提示
 * 与后端 api/utils/ErrorMessages.ts 保持同步
 */

export interface FriendlyError {
    code: string;
    title: string;
    message: string;
    suggestion: string;
    severity: 'error' | 'warning' | 'info';
}

// 错误码映射表（简化版，与后端保持一致）
const ErrorMap: Record<string, FriendlyError> = {
    'ALL_STRATEGIES_FAILED': {
        code: 'ALL_STRATEGIES_FAILED',
        title: '数据获取失败',
        message: '无法获取该页面的数据',
        suggestion: '可能原因：1) 页面结构变更 2) 网络问题 3) 对方账号设置了隐私。请稍后重试或换一个链接',
        severity: 'error'
    },
    'COOKIE_EXPIRED': {
        code: 'COOKIE_EXPIRED',
        title: '登录状态已过期',
        message: '您的登录信息已失效，需要重新授权',
        suggestion: '请前往"账号矩阵"页面，重新绑定对应的权限',
        severity: 'warning'
    },
    'PAGE_NOT_FOUND': {
        code: 'PAGE_NOT_FOUND',
        title: '页面不存在',
        message: '找不到该链接对应的页面',
        suggestion: '请检查链接是否正确，或该内容已被删除',
        severity: 'warning'
    },
    'RATE_LIMITED': {
        code: 'RATE_LIMITED',
        title: '操作太频繁',
        message: '系统检测到操作频率过高，请稍后再试',
        suggestion: '建议等待 5-10 分钟后重试，或降低操作频率',
        severity: 'warning'
    },
    'NETWORK_ERROR': {
        code: 'NETWORK_ERROR',
        title: '网络连接异常',
        message: '无法连接到服务器或外部服务',
        suggestion: '请检查网络连接，或稍后重试',
        severity: 'error'
    },
    'TASK_NOT_FOUND': {
        code: 'TASK_NOT_FOUND',
        title: '任务不存在',
        message: '该任务可能已被删除或已完成',
        suggestion: '请刷新页面查看最新任务列表',
        severity: 'warning'
    },
    'TASK_TIMEOUT': {
        code: 'TASK_TIMEOUT',
        title: '任务执行超时',
        message: '操作耗时过长，系统自动终止',
        suggestion: '请检查网络连接后重试，或稍后再次尝试',
        severity: 'warning'
    },
    'AI_GENERATION_FAILED': {
        code: 'AI_GENERATION_FAILED',
        title: '内容生成失败',
        message: 'AI 服务暂时无法响应',
        suggestion: '可能原因：1) API 密钥失效 2) 服务提供商故障。请检查设置中的 API 配置，或稍后重试',
        severity: 'error'
    },
    'UNKNOWN_ERROR': {
        code: 'UNKNOWN_ERROR',
        title: '操作失败',
        message: '系统遇到未知错误',
        suggestion: '请稍后重试，如问题持续请查看日志或联系管理员',
        severity: 'error'
    }
};

/**
 * 根据错误信息获取友好的错误提示
 * @param errorMessage 原始错误信息
 * @returns 友好的错误提示
 */
export function getFriendlyError(errorMessage: string): FriendlyError {
    // 尝试匹配已知错误码
    for (const [code, error] of Object.entries(ErrorMap)) {
        if (errorMessage.includes(code) || errorMessage.includes(error.title)) {
            return error;
        }
    }
    
    // 尝试匹配常见错误模式
    if (errorMessage.includes('Cookie') || errorMessage.includes('cookie') || errorMessage.includes('登录')) {
        return ErrorMap['COOKIE_EXPIRED'];
    }
    if (errorMessage.includes('All scraping strategies failed') || errorMessage.includes('scraping')) {
        return ErrorMap['ALL_STRATEGIES_FAILED'];
    }
    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout') || errorMessage.includes('超时')) {
        return ErrorMap['TASK_TIMEOUT'];
    }
    if (errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('连接')) {
        return ErrorMap['NETWORK_ERROR'];
    }
    if (errorMessage.includes('AI') || errorMessage.includes('generation') || errorMessage.includes('生成')) {
        return ErrorMap['AI_GENERATION_FAILED'];
    }
    if (errorMessage.includes('not found') || errorMessage.includes('不存在')) {
        return ErrorMap['TASK_NOT_FOUND'];
    }
    
    // 兜底返回未知错误
    return ErrorMap['UNKNOWN_ERROR'];
}

/**
 * 包装错误对象
 * @param error 原始错误
 * @returns 包含友好信息的错误对象
 */
export function wrapError(error: any): { 
    original: string; 
    friendly: FriendlyError;
    timestamp: string;
} {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    return {
        original: errorMessage,
        friendly: getFriendlyError(errorMessage),
        timestamp: new Date().toISOString()
    };
}

export default ErrorMap;
