import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { Loader2 } from 'lucide-react';

interface Account {
    id: number;
    nickname: string;
    avatar?: string;
    persona?: {
        desc?: string;
    };
    status: string;
}

interface AccountContextType {
    activeAccount: Account | null;
    isLoading: boolean;
    refreshAccount: () => Promise<void>;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export const AccountProvider = ({ children }: { children: ReactNode }) => {
    const [activeAccount, setActiveAccount] = useState<Account | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const isAuthenticated = useAuthStore(state => state.isAuthenticated);

    const fetchActiveAccount = async () => {
        // If not logged in, skip fetching but set loading to false
        if (!isAuthenticated()) {
            setActiveAccount(null);
            setIsLoading(false);
            return;
        }

        try {
            const res = await axios.get('/api/accounts/status');
            if (res.data.activeAccount) {
                setActiveAccount(res.data.activeAccount);
            } else {
                setActiveAccount(null);
            }
        } catch (error) {
            console.error('Failed to fetch global account status', error);
            // Don't crash, just set null
            setActiveAccount(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchActiveAccount();
    }, [isAuthenticated]); // Re-fetch when auth state changes

    const refreshAccount = async () => {
        setIsLoading(true);
        await fetchActiveAccount();
    };

    return (
        <AccountContext.Provider value={{ activeAccount, isLoading, refreshAccount }}>
            {children}
        </AccountContext.Provider>
    );
};

export const useAccount = () => {
    const context = useContext(AccountContext);
    if (context === undefined) {
        throw new Error('useAccount must be used within an AccountProvider');
    }
    return context;
};