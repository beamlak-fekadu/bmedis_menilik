'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_SECTIONS, APP_NAME } from '@/constants';
import { ChevronLeft, ChevronRight, Activity, LayoutDashboard, Bell, Monitor, FileText, PackageCheck, Wrench, CalendarCheck, Gauge, Package, GraduationCap, Trash2, ShieldAlert, CheckCircle, BarChart3, ArrowUpDown, FileBarChart, Users, Settings } from 'lucide-react';

const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard, Bell, Monitor, FileText, PackageCheck, Wrench, CalendarCheck, Gauge,
  Package, GraduationCap, Trash2, Activity, ShieldAlert, CheckCircle, BarChart3,
  ArrowUpDown, FileBarChart, Users, Settings,
};

interface SidebarProps {
  userRoles?: string[];
}

export default function Sidebar({ userRoles = ['admin'] }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <aside className={`flex h-screen flex-col border-r border-gray-200 bg-white transition-all duration-200 dark:border-gray-800 dark:bg-gray-950 ${collapsed ? 'w-16' : 'w-64'}`}>
      <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-800">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-600" />
            <span className="text-lg font-bold text-gray-900 dark:text-white">{APP_NAME}</span>
          </Link>
        )}
        {collapsed && <Activity className="mx-auto h-6 w-6 text-blue-600" />}
        <button onClick={() => setCollapsed(!collapsed)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) =>
            item.roles.some((r) => userRoles.includes(r))
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className="mb-4">
              {!collapsed && (
                <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-600">
                  {section.title}
                </p>
              )}
              {visibleItems.map((item) => {
                const Icon = iconMap[item.icon] || Monitor;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
