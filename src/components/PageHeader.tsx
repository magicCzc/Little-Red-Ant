
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  icon?: LucideIcon;
  description?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}

export default function PageHeader({ title, icon: Icon, description, action, children }: PageHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            {Icon && <Icon className="mr-3 text-indigo-600" size={28} />}
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-gray-500">
              {description}
            </p>
          )}
        </div>
        {action && (
          <div className="flex-shrink-0">
            {action}
          </div>
        )}
      </div>
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}
