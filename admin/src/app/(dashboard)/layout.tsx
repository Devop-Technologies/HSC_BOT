'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setChecked } from '@/store/authSlice';
import AppLayout from '@/components/layout/AppLayout';

// ─── Loading Screen ───────────────────────────────────────────
function LoadingScreen() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--color-page-bg)' }}
    >
      <div className="flex flex-col items-center gap-3">
        <svg
          className="animate-spin"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          style={{ color: 'var(--color-accent)' }}
        >
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
          <path
            fill="currentColor"
            className="opacity-75"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Loading...
        </p>
      </div>
    </div>
  );
}

// ─── Auth Guard + Layout ──────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { isAuthenticated, hasChecked } = useAppSelector((s) => s.auth);

  // Middleware handles server-side protection.
  // This is a client-side fallback for edge cases.
  useEffect(() => {
    if (hasChecked && !isAuthenticated) {
      router.replace('/login');
    }
  }, [hasChecked, isAuthenticated, router]);

  if (!hasChecked) return <LoadingScreen />;
  if (!isAuthenticated) return null;

  return <AppLayout>{children}</AppLayout>;
}
