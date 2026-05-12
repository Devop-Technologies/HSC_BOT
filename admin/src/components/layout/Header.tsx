'use client';

import { usePathname } from 'next/navigation';
import { Menu, Sun, Moon } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { toggleMobileSidebar } from '@/store/uiSlice';
import { setTheme } from '@/store/themeSlice';

// Map hrefs → page titles
const PAGE_TITLES: Record<string, string> = {
  '/dashboard':       'Dashboard',
  '/bookings':        'Bookings',
  '/providers':       'Providers',
  '/services':        'Services',
  '/packages':        'Packages',
  '/clients':         'Clients',
  '/drivers':         'Drivers',
  '/logs':            'Audit Logs',
  '/settings':        'Settings',
};

function getPageTitle(pathname: string): string {
  for (const [key, title] of Object.entries(PAGE_TITLES)) {
    if (pathname === key || pathname.startsWith(key + '/')) return title;
  }
  return 'Admin Panel';
}

export default function Header() {
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const resolvedTheme = useAppSelector((s) => s.theme.resolvedTheme);
  const user = useAppSelector((s) => s.auth.user);
  const isDark = resolvedTheme === 'dark';

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'A';

  return (
    <header
      className="h-16 flex items-center px-4 gap-4 flex-shrink-0"
      style={{
        background: 'var(--color-header-bg)',
        borderBottom: '1px solid var(--color-header-border)',
      }}
    >
      {/* Mobile menu toggle */}
      <button
        onClick={() => dispatch(toggleMobileSidebar())}
        className="lg:hidden p-2 rounded-lg transition-colors cursor-pointer"
        style={{ color: 'var(--color-header-icon)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-header-icon-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-header-icon)')}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Page title */}
      <h1
        className="text-base font-semibold flex-1 truncate"
        style={{ color: 'var(--color-header-text)' }}
      >
        {getPageTitle(pathname)}
      </h1>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Theme toggle */}
        <button
          onClick={() => dispatch(setTheme(isDark ? 'light' : 'dark'))}
          className="p-2 rounded-lg transition-colors cursor-pointer"
          style={{ color: 'var(--color-header-icon)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-header-icon-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-header-icon)')}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Avatar */}
        <div
          className="ml-1 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer select-none flex-shrink-0"
          style={{
            background: 'var(--color-accent)',
            color: '#fff',
          }}
          title={user?.name ?? 'Admin'}
        >
          {initials}
        </div>
      </div>
    </header>
  );
}
