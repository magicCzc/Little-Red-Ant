
import React from 'react';
import { Loader2 } from 'lucide-react';

interface PageLoadingProps {
  message?: string;
}

export default function PageLoading({ message = '加载中...' }: PageLoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full bg-white rounded-lg border border-gray-100 p-8">
      <Loader2 className="animate-spin text-indigo-600 mb-4" size={32} />
      <p className="text-gray-500 text-sm font-medium animate-pulse">{message}</p>
    </div>
  );
}
