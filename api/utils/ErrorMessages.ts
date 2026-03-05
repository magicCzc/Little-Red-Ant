/**
 * 错误码映射表 - 将技术错误转换为用户友好的提示
 * 
 * 设计原则：
 * 1. 保留原始错误日志（后端），前端显示友好版本
 * 2. 每个错误包含：标题、用户提示、解决建议
 * 3. 未知错误兜底显示通用提示
 */

export interface FriendlyError {
    code: string;
    title: string;           // 错误标题（简短）
    message: string;         // 给用户看的提示
    suggestion: string;      // 解决建议
    severity: 'error' | 'warning' | 'info';
}

// 任务相关错误
const TaskErrors: Record<string, FriendlyError> = {
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
    }
};

// RPA/抓取相关错误
const RPAErrors: Record<string, FriendlyError> = {
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
    'BROWSER_ERROR': {
        code: 'BROWSER_ERROR',
        title: '浏览器启动失败',
        message: '自动化浏览器无法正常启动',
        suggestion: '请检查系统资源是否充足，或重启应用后重试',
        severity: 'error'
    }
};

// 发布相关错误
const PublishErrors: Record<string, FriendlyError> = {
    'PUBLISH_SELECTOR_NOT_FOUND': {
        code: 'PUBLISH_SELECTOR_NOT_FOUND',
        title: '页面元素定位失败',
        message: '无法找到发布页面的关键元素',
        suggestion: '可能原因：1) 小红书页面改版 2) 登录状态失效。请检查账号状态或联系管理员更新选择器',
        severity: 'error'
    },
    'PUBLISH_UPLOAD_FAILED': {
        code: 'PUBLISH_UPLOAD_FAILED',
        title: '文件上传失败',
        message: '图片或视频上传过程中出错',
        suggestion: '请检查文件是否存在且格式正确，或稍后重试',
        severity: 'error'
    },
    'PUBLISH_DAILY_LIMIT': {
        code: 'PUBLISH_DAILY_LIMIT',
        title: '今日发布次数已达上限',
        message: '该账号今日发布次数已用完',
        suggestion: '请明天再试，或切换其他账号发布',
        severity: 'warning'
    }
};

// AI 生成相关错误
const AIEerrors: Record<string, FriendlyError> = {
    'AI_GENERATION_FAILED': {
        code: 'AI_GENERATION_FAILED',
        title: '内容生成失败',
        message: 'AI 服务暂时无法响应',
        suggestion: '可能原因：1) API 密钥失效 2) 服务提供商故障。请检查设置中的 API 配置，或稍后重试',
        severity: 'error'
    },
    'AI_RATE_LIMIT': {
        code: 'AI_RATE_LIMIT',
        title: 'AI 服务调用频繁',
        message: 'AI 服务请求过于频繁',
        suggestion: '请等待 1-2 分钟后重试',
        severity: 'warning'
    },
    'AI_CONTENT_FILTERED': {
        code: 'AI_CONTENT_FILTERED',
        title: '内容被过滤',
        message: '生成的内容触发了安全过滤',
        suggestion: '请修改输入的关键词或描述，避免敏感内容',
        severity: 'warning'
    }
};

// 网络/系统错误
const SystemErrors: Record<string, FriendlyError> = {
    'NETWORK_ERROR': {
        code: 'NETWORK_ERROR',
        title: '网络连接异常',
        message: '无法连接到服务器或外部服务',
        suggestion: '请检查网络连接，或稍后重试',
        severity: 'error'
    },
    'DATABASE_ERROR': {
        code: 'DATABASE_ERROR',
        title: '数据保存失败',
        message: '操作无法保存到数据库',
        suggestion: '请稍后重试，如问题持续请联系管理员',
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

// 合并所有错误码
const AllErrors: Record<string, FriendlyError> = {
    ...TaskErrors,
    ...RPAErrors,
    ...PublishErrors,
    ...AIEerrors,
    ...SystemErrors
};

/**
 * 根据错误信息获取友好的错误提示
 * @param errorMessage 原始错误信息
 * @returns 友好的错误提示
 */
export function getFriendlyError(errorMessage: string): FriendlyError {
    // 尝试匹配已知错误码
    for (const [code, error] of Object.entries(AllErrors)) {
        if (errorMessage.includes(code) || errorMessage.includes(error.title)) {
            return error;
        }
    }
    
    // 尝试匹配常见错误模式
    if (errorMessage.includes('Cookie') || errorMessage.includes('cookie')) {
        return RPAErrors['COOKIE_EXPIRED'];
    }
    if (errorMessage.includes('All scraping strategies failed')) {
        return RPAErrors['ALL_STRATEGIES_FAILED'];
    }
    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        return TaskErrors['TASK_TIMEOUT'];
    }
    if (errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED')) {
        return SystemErrors['NETWORK_ERROR'];
    }
    if (errorMessage.includes('AI') || errorMessage.includes('generation')) {
        return AIEerrors['AI_GENERATION_FAILED'];
    }
    
    // 兜底返回未知错误
    return SystemErrors['UNKNOWN_ERROR'];
}

/**
 * 为 API 响应添加友好错误信息
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

export default AllErrors;
