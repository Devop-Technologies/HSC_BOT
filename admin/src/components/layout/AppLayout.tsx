'use client';

import Sidebar from './Sidebar';
import Header from './Header';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { closeMobileSidebar } from '@/store/uiSlice';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const sidebarMobileOpen = useAppSelector((s) => s.ui.sidebarMobileOpen);

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: 'var(--color-page-bg)' }}
    >
      {/* Sidebar (handles its own desktop/mobile rendering) */}
      <Sidebar />

      {/* Main area */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header />
        <main className="flex-1 overflow-auto p-5 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
