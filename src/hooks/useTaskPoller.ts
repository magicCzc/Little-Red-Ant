import { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface TaskResult {
    success: boolean;
    data?: any;
    error?: string;
}

interface UseTaskPollerOptions {
    onSuccess?: (data: any) => void;
    onError?: (error: string) => void;
    pollInterval?: number;
    timeout?: number; // Default 120s
}

export function useTaskPoller(options: UseTaskPollerOptions = {}) {
    const [taskId, setTaskId] = useState<string | null>(null);
    const [status, setStatus] = useState<'IDLE' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'>('IDLE');
    const [progress, setProgress] = useState<number>(0);
    const [result, setResult] = useState<any | null>(null);
    
    const pollRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(0);

    const stopPolling = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, []);

    const startTask = useCallback(async (apiCall: () => Promise<string>, loadingMessage = '任务启动中...') => {
        setStatus('PENDING');
        setProgress(0);
        setResult(null);
        startTimeRef.current = Date.now();
        
        let tid = '';
        const toastId = toast.loading(loadingMessage);

        try {
            tid = await apiCall();
            setTaskId(tid);
            setStatus('PROCESSING');
            
            // Start Polling
            pollRef.current = setInterval(async () => {
                try {
                    const res = await axios.get(`/api/tasks/${tid}`);
                    const task = res.data;
                    
                    if (task.status === 'COMPLETED') {
                        stopPolling();
                        setStatus('COMPLETED');
                        setResult(task.result);
                        toast.success('任务完成！', { id: toastId });
                        if (options.onSuccess) options.onSuccess(task.result);
                    } else if (task.status === 'FAILED') {
                        stopPolling();
                        setStatus('FAILED');
                        const errorMsg = task.error || '任务执行失败';
                        toast.error(errorMsg, { id: toastId });
                        if (options.onError) options.onError(errorMsg);
                    } else {
                        // Still running
                        // Check timeout
                        if (Date.now() - startTimeRef.current > (options.timeout || 120000)) {
                            stopPolling();
                            setStatus('FAILED');
                            toast.error('任务等待超时', { id: toastId });
                            if (options.onError) options.onError('Timeout');
                        }
                    }
                } catch (e) {
                    // Ignore transient network errors
                    console.warn('Poll error:', e);
                }
            }, options.pollInterval || 2000);

        } catch (e: any) {
            setStatus('FAILED');
            const msg = e.response?.data?.error || e.message || '启动失败';
            toast.error(msg, { id: toastId });
            if (options.onError) options.onError(msg);
        }
    }, [options, stopPolling]);

    // Cleanup on unmount
    useEffect(() => {
        return () => stopPolling();
    }, [stopPolling]);

    return {
        taskId,
        status,
        result,
        startTask,
        stopPolling
    };
}
