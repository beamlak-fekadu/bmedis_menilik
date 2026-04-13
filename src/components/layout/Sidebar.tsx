'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_SECTIONS, APP_NAME } from '@/constants';
import { ChevronLeft, ChevronRight, Activity, LayoutDashboard, Bell, Monitor, FileText, PackageCheck, Wrench, CalendarCheck, Gauge, Package, GraduationCap, Trash2, ShieldAlert, CheckCircle, BarChart3, ArrowUpDown, FileBarChart, Users, Settings, ClipboardList, Headphones, BrainCircuit, Shield } from 'lucide-react';

const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard, Bell, Monitor, FileText, PackageCheck, Wrench, CalendarCheck, Gauge,
  Package, GraduationCap, Trash2, Activity, ShieldAlert, CheckCircle, BarChart3,
  ArrowUpDown, FileBarChart, Users, Settings, ClipboardList, Headphones, BrainCircuit, Shield,
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
    <aside className={`panel-surface flex h-screen flex-col border-r-0 transition-all duration-200 ${collapsed ? 'w-16' : 'w-72'}`}>
      <div className="flex h-16 items-center justify-between border-b border-[var(--border-subtle)] px-4">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-[var(--brand)]" />
            <span className="text-lg font-bold text-[var(--foreground)]">{APP_NAME}</span>
          </Link>
        )}
        {collapsed && <Activity className="mx-auto h-6 w-6 text-[var(--brand)]" />}
        <button onClick={() => setCollapsed(!collapsed)} className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]">
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
                <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
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
                        ? 'bg-[var(--brand)]/20 text-[var(--foreground)]'
                        : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]'
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
