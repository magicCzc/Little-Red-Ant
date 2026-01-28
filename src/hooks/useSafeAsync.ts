import { useRef, useEffect, useCallback } from 'react';
import axios, { AxiosRequestConfig } from 'axios';

/**
 * A hook to handle async requests safely.
 * - Automatically cancels pending requests when component unmounts.
 * - Prevents state updates on unmounted components.
 * - Provides an `isMounted` ref.
 */
export function useSafeAsync() {
    const isMounted = useRef(true);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const safeRequest = useCallback(async <T>(
        requestFn: (signal: AbortSignal) => Promise<T>,
        onSuccess?: (data: T) => void,
        onError?: (error: any) => void
    ) => {
        // Cancel previous request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        try {
            const result = await requestFn(abortControllerRef.current.signal);
            if (isMounted.current && onSuccess) {
                onSuccess(result);
            }
            return result;
        } catch (error: any) {
            if (axios.isCancel(error)) {
                console.log('Request cancelled');
                return;
            }
            if (isMounted.current && onError) {
                onError(error);
            }
            throw error;
        } finally {
            if (isMounted.current) {
                abortControllerRef.current = null;
            }
        }
    }, []);

    return { isMounted, safeRequest, abortControllerRef };
}
