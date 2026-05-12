'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Sun, Moon, AlertCircle } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setTheme } from '@/store/themeSlice';
import { loginSuccess } from '@/store/authSlice';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

const FEATURES = [
  'Full booking management',
  'Provider & service control',
  'Live conversation handoff',
  'Heat map & analytics',
];

function WAIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  );
}

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const resolvedTheme = useAppSelector((s) => s.theme.resolvedTheme);
  const isDark = resolvedTheme === 'dark';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Middleware handles the redirect if already logged in,
  // but this is a fast client-side fallback.

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong');
      setLoading(false);
      return;
    }

    dispatch(loginSuccess(data.user));
    router.push('/dashboard');
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'var(--color-page-bg)',
        backgroundImage: 'radial-gradient(var(--color-divider) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* Theme Toggle */}
      <button
        onClick={() => dispatch(setTheme(isDark ? 'light' : 'dark'))}
        className="fixed top-4 right-4 z-50 p-2.5 rounded-xl transition-colors cursor-pointer"
        style={{
          background: 'var(--color-card-bg)',
          border: '1px solid var(--color-card-border)',
          color: 'var(--color-text-secondary)',
        }}
        aria-label="Toggle theme"
      >
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* Card */}
      <div
        className="w-full max-w-4xl flex rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 25px 60px rgb(0 0 0 / 0.18)' }}
      >
        {/* Left: Brand Panel */}
        <div
          className="hidden md:flex md:w-5/12 flex-col justify-between p-10 relative overflow-hidden select-none"
          style={{ background: 'linear-gradient(150deg, #052e16 0%, #14532d 45%, #166534 100%)' }}
        >
          <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }} />
          <div className="absolute top-1/2 -translate-y-1/2 -left-24 w-64 h-64 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }} />
          <div className="absolute -bottom-16 right-8 w-56 h-56 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }} />

          <div className="relative z-10">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-8" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <WAIcon />
            </div>
            <h1 className="text-[1.6rem] font-bold text-white leading-snug tracking-tight">
              WhatsApp Booking<br />System
            </h1>
            <p className="mt-2 text-sm font-medium" style={{ color: '#86efac' }}>
              Admin Control Panel
            </p>
          </div>

          <div className="relative z-10 space-y-4">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.18)' }}>
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-sm" style={{ color: '#dcfce7' }}>{f}</span>
              </div>
            ))}
          </div>

          <p className="relative z-10 text-xs" style={{ color: '#4ade80' }}>
            © 2025 WA Booking System
          </p>
        </div>

        {/* Right: Form Panel */}
        <div
          className="flex-1 flex flex-col justify-center px-8 py-12 md:px-12"
          style={{ background: 'var(--color-card-bg)' }}
        >
          {/* Mobile logo */}
          <div className="flex md:hidden items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#16a34a' }}>
              <WAIcon />
            </div>
            <span className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>
              WA Booking Admin
            </span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
            Welcome back
          </h2>
          <p className="mt-1.5 text-sm mb-8" style={{ color: 'var(--color-text-secondary)' }}>
            Sign in to your admin account to continue
          </p>

          {/* Error Banner */}
          {error && (
            <div
              className="mb-5 px-4 py-3 rounded-lg text-sm flex items-center gap-2.5"
              style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}
            >
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              autoComplete="email"
            />

            <Input
              label="Password"
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
              rightAction={
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  tabIndex={-1}
                  className="cursor-pointer transition-colors"
                  style={{ color: 'var(--color-text-muted)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />

            <div className="flex items-center gap-2.5">
              <input
                id="remember"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded cursor-pointer"
                style={{ accentColor: 'var(--color-accent)' }}
              />
              <label
                htmlFor="remember"
                className="text-sm select-none cursor-pointer"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Remember me
              </label>
            </div>

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={loading}
            >
              Sign In
            </Button>
          </form>

          <p className="mt-10 text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
            WhatsApp Booking System &nbsp;·&nbsp; v1.0
          </p>
        </div>
      </div>
    </div>
  );
}
