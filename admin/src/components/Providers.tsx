'use client';

import { useEffect, useRef } from 'react';
import { Provider } from 'react-redux';
import { store } from '@/store';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setTheme, setResolvedTheme } from '@/store/themeSlice';
import { loginSuccess, logout, setChecked } from '@/store/authSlice';

// ─── Theme Sync ───────────────────────────────────────────────
function ThemeSync() {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((s) => s.theme.theme);
  const hasInitialized = useRef(false);

  useEffect(() => {
    const stored = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (stored === 'light' || stored === 'dark') {
      dispatch(setTheme(stored));
    } else {
      hasInitialized.current = true;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hasInitialized.current && theme === 'system') return;
    hasInitialized.current = true;

    const apply = () => {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = theme === 'dark' || (theme === 'system' && systemDark);
      document.documentElement.classList.toggle('dark', isDark);
      dispatch(setResolvedTheme(isDark ? 'dark' : 'light'));
    };

    apply();

    if (theme === 'system') {
      localStorage.removeItem('theme');
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    } else {
      localStorage.setItem('theme', theme);
    }
  }, [theme, dispatch]);

  return null;
}

// ─── Auth Sync ────────────────────────────────────────────────
// Reads JWT cookie via /api/auth/me on page load to restore Redux state.
function AuthSync() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          dispatch(loginSuccess(data.user));
        } else {
          dispatch(setChecked());
        }
      })
      .catch(() => {
        dispatch(setChecked());
      });
  }, [dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// ─── Providers ────────────────────────────────────────────────
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <ThemeSync />
      <AuthSync />
      {children}
    </Provider>
  );
}
