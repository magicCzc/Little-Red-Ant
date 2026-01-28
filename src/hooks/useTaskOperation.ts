import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface UseTaskOperationOptions {
    taskType?: string; // e.g., 'SCRAPE_TRENDS'
    successMessage?: string;
    loadingMessage?: string;
    onSuccess?: (data?: any) => void;
    onError?: (error: Error) => void;
    pollInterval?: number; // ms, default 2000
    timeout?: number; // ms, default 120000 (2 mins)
}

export function useTaskOperation({
    successMessage = '任务已完成',
    loadingMessage = '任务执行中...',
    onSuccess,
    onError,
    pollInterval = 2000,
    timeout = 120000
}: UseTaskOperationOptions = {}) {
    const [loading, setLoading] = useState(false);
    const [taskId, setTaskId] = useState<string | null>(null);
    const pollTimer = useRef<NodeJS.Timeout | null>(null);
    const startTime = useRef<number>(0);

    const cleanup = () => {
        if (pollTimer.current) clearTimeout(pollTimer.current);
        setTaskId(null);
        setLoading(false);
    };

    // Cleanup on unmount
    useEffect(() => cleanup, []);

    const startPolling = async (id: string, toastId?: string) => {
        setTaskId(id);
        startTime.current = Date.now();

        const checkStatus = async () => {
            try {
                // Check timeout
                if (Date.now() - startTime.current > timeout) {
                    throw new Error('任务执行超时');
                }

                const res = await axios.get(`/api/tasks/${id}`);
                const status = res.data.status;

                if (status === 'COMPLETED') {
                    if (toastId) toast.success(successMessage, { id: toastId });
                    else toast.success(successMessage);
                    setLoading(false);
                    onSuccess?.(res.data);
                    return; // Stop polling
                } 
                
                if (status === 'FAILED') {
                    throw new Error(res.data.error || '任务执行失败');
                }

                // Continue polling
                pollTimer.current = setTimeout(checkStatus, pollInterval);

            } catch (error: any) {
                setLoading(false);
                const msg = error.message || '未知错误';
                if (toastId) toast.error(msg, { id: toastId });
                else toast.error(msg);
                onError?.(error);
            }
        };

        // Start first check
        pollTimer.current = setTimeout(checkStatus, pollInterval);
    };

    const trigger = async (
        apiCall: () => Promise<any>, 
        customLoadingMsg?: string
    ) => {
        if (loading) return;
        setLoading(true);
        const toastId = toast.loading(customLoadingMsg || loadingMessage);

        try {
            const res = await apiCall();
            // Expect { taskId: '...' } or standard task response
            const id = res.data?.taskId || res.data?.id;

            if (id) {
                await startPolling(id, toastId);
            } else {
                // Immediate success (no background task)
                toast.success(successMessage, { id: toastId });
                setLoading(false);
                onSuccess?.(res.data);
            }
        } catch (error: any) {
            setLoading(false);
            console.error('Task trigger failed:', error);
            toast.error(error.message || '请求失败', { id: toastId });
            onError?.(error);
        }
    };

    return {
        loading,
        trigger,
        taskId
    };
}