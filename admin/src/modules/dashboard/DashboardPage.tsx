'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  CalendarDays, Users, Clock, Star,
  ArrowUpRight, ArrowDownRight, CheckCircle2,
  XCircle, AlertCircle, Loader2, RefreshCw,
} from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import type { DashboardData } from '@/types/dashboard';
import { formatTime, formatDate, greet } from '@/lib/helpers';
import { useAppDispatch } from '@/store/hooks';
import { setData, setLoading, setError } from '@/store/dashboardSlice';

// ─── Status styles ────────────────────────────────────────────

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  confirmed: { color: 'var(--color-status-confirmed-text)', bg: 'var(--color-status-confirmed-bg)' },
  pending:   { color: 'var(--color-status-pending-text)',   bg: 'var(--color-status-pending-bg)'   },
  cancelled: { color: 'var(--color-status-cancelled-text)', bg: 'var(--color-status-cancelled-bg)' },
  completed: { color: 'var(--color-status-completed-text)', bg: 'var(--color-status-completed-bg)' },
  no_show:   { color: 'var(--color-status-noshow-text)',    bg: 'var(--color-status-noshow-bg)'    },
};

const BREAKDOWN_ORDER = ['confirmed', 'pending', 'completed', 'cancelled', 'no_show'];
const BREAKDOWN_LABELS: Record<string, string> = {
  confirmed: 'Confirmed', pending: 'Pending', completed: 'Completed',
  cancelled: 'Cancelled', no_show: 'No-show',
};

// ─── Sub-components ───────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl ${className}`}
      style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}>
      {children}
    </div>
  );
}

function StatCard({
  label, value, sub, positive, icon: Icon, accent, bg,
}: {
  label: string; value: string | number; sub: string;
  positive?: boolean; icon: React.ElementType; accent: string; bg: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: bg, color: accent }}>
          <Icon size={19} />
        </div>
        {positive !== undefined && (
          <span className="flex items-center gap-0.5 text-xs font-semibold"
            style={{ color: positive ? 'var(--color-success)' : 'var(--color-warning)' }}>
            {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>
        {value}
      </p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
        <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
        {sub ? ` · ${sub}` : ''}
      </p>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function DashboardPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const { data, loading, lastUpdated } = useAppSelector((s) => s.dashboard);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const load = useCallback(async () => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) dispatch(setData(await res.json()));
    } catch {
      dispatch(setError('Failed to load dashboard'));
    } finally {
      dispatch(setLoading(false));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Loading skeleton ─────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={26} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
      </div>
    );
  }

  const s   = data?.stats;
  const att = data?.attention;

  // ── Attention alerts ─────────────────────────────────────────
  const alerts: { text: string; color: string; bg: string }[] = [];
  if (att?.pending_count)
    alerts.push({ text: `${att.pending_count} booking${att.pending_count !== 1 ? 's' : ''} awaiting confirmation`, color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' });
  if (att?.no_show_count)
    alerts.push({ text: `${att.no_show_count} no-show booking${att.no_show_count !== 1 ? 's' : ''} to review`, color: 'var(--color-danger)', bg: 'var(--color-danger-bg)' });
  if (att?.unpaid_completed)
    alerts.push({ text: `${att.unpaid_completed} completed booking${att.unpaid_completed !== 1 ? 's' : ''} with unpaid payment`, color: 'var(--color-info)', bg: 'var(--color-info-bg)' });

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {greet()}, {user?.name ?? 'Admin'}
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{today}</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium cursor-pointer transition-opacity"
          style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)', opacity: loading ? 0.6 : 1 }}
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          {lastUpdated ? `Updated ${new Date(lastUpdated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : 'Live'}
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Today's Bookings"
          value={s?.today_bookings ?? 0}
          sub={s?.today_change !== undefined
            ? s.today_change >= 0
              ? `+${s.today_change} from yesterday`
              : `${s.today_change} from yesterday`
            : ''}
          positive={s?.today_change !== undefined ? s.today_change >= 0 : undefined}
          icon={CalendarDays}
          accent="var(--color-accent)"
          bg="var(--color-accent-subtle)"
        />
        <StatCard
          label="Active Providers"
          value={s?.active_providers ?? 0}
          sub={`${s?.total_providers ?? 0} total`}
          icon={Users}
          accent="var(--color-info)"
          bg="var(--color-info-bg)"
        />
        <StatCard
          label="Pending Bookings"
          value={s?.pending_count ?? 0}
          sub="awaiting confirmation"
          positive={s?.pending_count === 0 ? true : undefined}
          icon={Clock}
          accent="var(--color-warning)"
          bg="var(--color-warning-bg)"
        />
        <StatCard
          label="Total Clients"
          value={s?.total_clients ?? 0}
          sub={s?.new_ratings ? `${s.new_ratings} new rating${s.new_ratings !== 1 ? 's' : ''} this month` : 'registered'}
          icon={Star}
          accent="var(--color-success)"
          bg="var(--color-success-bg)"
        />
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Recent Bookings */}
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--color-card-border)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Recent Bookings
            </h3>
            <a href="/bookings" className="text-xs font-medium hover:opacity-70 transition-opacity"
              style={{ color: 'var(--color-accent)' }}>
              View all →
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--color-table-header-bg)' }}>
                <tr>
                  {['Customer', 'Service', 'Date', 'Time', 'Status'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--color-table-header-text)', borderBottom: '1px solid var(--color-table-border)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.recent ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm"
                      style={{ color: 'var(--color-text-muted)' }}>
                      No bookings yet
                    </td>
                  </tr>
                ) : (data?.recent ?? []).map((b, i) => {
                  const st = b.status ? (STATUS_STYLE[b.status] ?? STATUS_STYLE.pending) : null;
                  return (
                    <tr key={b.id}
                      style={{ borderBottom: i < (data?.recent.length ?? 0) - 1 ? '1px solid var(--color-table-border)' : 'none' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-table-row-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="px-5 py-3.5 font-medium whitespace-nowrap"
                        style={{ color: 'var(--color-text-primary)' }}>
                        {b.customer_name}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap"
                        style={{ color: 'var(--color-text-secondary)' }}>
                        {b.service_name}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap"
                        style={{ color: 'var(--color-text-secondary)' }}>
                        {formatDate(b.booking_date, { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap"
                        style={{ color: 'var(--color-text-secondary)' }}>
                        {formatTime(b.start_time)}
                      </td>
                      <td className="px-5 py-3.5">
                        {st ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                            style={{ background: st.bg, color: st.color }}>
                            {b.status?.replace('_', ' ')}
                          </span>
                        ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Right column */}
        <div className="space-y-4">

          {/* This Month Breakdown */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              This Month
            </h3>
            <div className="space-y-2.5">
              {BREAKDOWN_ORDER.map((key) => {
                const count = data?.breakdown[key] ?? 0;
                if (count === 0) return null;
                const st = STATUS_STYLE[key];
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: st.color }} />
                    <span className="text-sm flex-1" style={{ color: 'var(--color-text-secondary)' }}>
                      {BREAKDOWN_LABELS[key]}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: st.bg, color: st.color }}>
                      {count}
                    </span>
                  </div>
                );
              })}
              {Object.keys(data?.breakdown ?? {}).length === 0 && (
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No bookings this month</p>
              )}
            </div>
          </Card>

          {/* Needs Attention */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              Needs Attention
            </h3>
            <div className="space-y-2.5">
              {alerts.length === 0 ? (
                <div className="flex items-center gap-2.5 p-3 rounded-lg text-xs"
                  style={{ background: 'var(--color-status-confirmed-bg)', color: 'var(--color-status-confirmed-text)' }}>
                  <CheckCircle2 size={13} className="flex-shrink-0" />
                  All clear — nothing needs attention
                </div>
              ) : alerts.map((a) => (
                <div key={a.text} className="flex items-start gap-2.5 p-3 rounded-lg text-xs"
                  style={{ background: a.bg, color: a.color }}>
                  <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
                  {a.text}
                </div>
              ))}
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}
