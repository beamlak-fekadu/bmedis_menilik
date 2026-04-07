import { Activity } from 'lucide-react';
import { APP_NAME } from '@/constants';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <Activity className="mb-3 h-10 w-10 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Medical Equipment Management System</p>
        </div>
        {children}
      </div>
    </div>
  );
}
