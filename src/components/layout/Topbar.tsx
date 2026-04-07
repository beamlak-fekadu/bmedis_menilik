'use client';

import { Bell, LogOut, Menu, User } from 'lucide-react';
import { HOSPITAL_NAME } from '@/constants';
import Button from '@/components/ui/Button';
import Dropdown from '@/components/ui/Dropdown';

interface TopbarProps {
  userName?: string;
  userRole?: string;
  alertCount?: number;
  onMenuToggle?: () => void;
  onLogout?: () => void;
}

export default function Topbar({ userName = 'User', userRole = '', alertCount = 0, onMenuToggle, onLogout }: TopbarProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-950 lg:px-6">
      <div className="flex items-center gap-3">
        {onMenuToggle && (
          <button onClick={onMenuToggle} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 lg:hidden dark:hover:bg-gray-800">
            <Menu className="h-5 w-5" />
          </button>
        )}
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">{HOSPITAL_NAME}</h2>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-gray-500" />
          {alertCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </Button>

        <Dropdown
          trigger={
            <button className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <User className="h-4 w-4" />
              </div>
              <div className="hidden text-left md:block">
                <p className="font-medium">{userName}</p>
                <p className="text-xs text-gray-500">{userRole}</p>
              </div>
            </button>
          }
          items={[
            { label: 'Sign Out', onClick: () => onLogout?.(), icon: <LogOut className="h-4 w-4" />, destructive: true },
          ]}
        />
      </div>
    </header>
  );
}
