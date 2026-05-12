'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ClipboardList, ChevronRight, RefreshCw,
  Package, UserRound, Car, Wrench, CalendarDays, User, Settings,
} from 'lucide-react';
import { Table, TableRow, Td } from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setLogs, setLoading, setError } from '@/store/logsSlice';
import type { AuditLog } from '@/types/audit';

// ─── Config ───────────────────────────────────────────────────

const MODULE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType; route: string }> = {
  booking:  { label: 'Booking',  color: 'var(--color-status-confirmed-text)',  bg: 'var(--color-status-confirmed-bg)',  icon: CalendarDays, route: '/bookings'  },
  client:   { label: 'Client',   color: 'var(--color-status-completed-text)',  bg: 'var(--color-status-completed-bg)',  icon: User,         route: '/clients'   },
  provider: { label: 'Provider', color: '#7c3aed',                             bg: '#ede9fe',                           icon: UserRound,    route: '/providers' },
  driver:   { label: 'Driver',   color: '#c2410c',                             bg: '#ffedd5',                           icon: Car,          route: '/drivers'   },
  service:  { label: 'Service',  color: '#0f766e',                             bg: '#ccfbf1',                           icon: Wrench,       route: '/services'  },
  package:  { label: 'Package',  color: '#4338ca',                             bg: '#e0e7ff',                           icon: Package,      route: '/packages'  },
  payment:  { label: 'Payment',  color: '#b45309',                             bg: '#fef3c7',                           icon: CalendarDays, route: '/bookings'  },
  settings: { label: 'Settings', color: 'var(--color-text-muted)',             bg: 'var(--color-input-bg)',             icon: Settings,     route: '/settings'  },
};

const ACTION_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  created:          { label: 'Created',          color: 'var(--color-status-completed-text)', bg: 'var(--color-status-completed-bg)'  },
  updated:          { label: 'Updated',          color: 'var(--color-status-confirmed-text)', bg: 'var(--color-status-confirmed-bg)'  },
  activated:        { label: 'Activated',        color: 'var(--color-status-completed-text)', bg: 'var(--color-status-completed-bg)'  },
  deactivated:      { label: 'Deactivated',      color: 'var(--color-status-noshow-text)',    bg: 'var(--color-status-noshow-bg)'     },
  status_changed:   { label: 'Status Changed',   color: '#7c3aed',                            bg: '#ede9fe'                           },
  services_updated: { label: 'Services Updated', color: 'var(--color-status-confirmed-text)', bg: 'var(--color-status-confirmed-bg)'  },
  rescheduled:      { label: 'Rescheduled',      color: '#0369a1',                            bg: '#e0f2fe'                           },
  'payment.paid':   { label: 'Paid',             color: 'var(--color-status-completed-text)', bg: 'var(--color-status-completed-bg)'  },
  'payment.refunded':{ label: 'Refunded',        color: '#b45309',                            bg: '#fef3c7'                           },
  'payment.pending':{ label: 'Pending Payment',  color: 'var(--color-status-pending-text)',   bg: 'var(--color-status-pending-bg)'    },
};

const PAGE_SIZE = 25;

// ─── Helpers ──────────────────────────────────────────────────

function formatDetails(log: AuditLog): string {
  const d = log.details;
  if (!d) return '—';

  if (log.action === 'status_changed' && d.from && d.to) {
    return `${d.from} → ${d.to}`;
  }
  if (log.action === 'services_updated') {
    return `${d.service_count ?? '?'} service(s) assigned`;
  }
  if (log.action === 'created') {
    return Object.entries(d)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
      .slice(0, 3)
      .join(' · ');
  }
  if (log.action === 'updated' && Array.isArray(d.changes)) {
    return `Fields: ${(d.changes as string[]).map((c) => c.replace(/_/g, ' ')).join(', ')}`;
  }
  return JSON.stringify(d).slice(0, 80);
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  };
}

// ─── Module Badge ─────────────────────────────────────────────

function ModuleBadge({ module }: { module: string }) {
  const cfg = MODULE_CONFIG[module];
  if (!cfg) return <span style={{ color: 'var(--color-text-muted)' }}>{module}</span>;
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

// ─── Action Badge ─────────────────────────────────────────────

function ActionBadge({ action }: { action: string }) {
  const cfg = ACTION_CONFIG[action];
  if (!cfg) return (
    <span
      className="text-[11px] font-medium px-2 py-0.5 rounded-full capitalize"
      style={{ background: 'var(--color-input-bg)', color: 'var(--color-text-muted)' }}
    >
      {action.replace(/_/g, ' ')}
    </span>
  );
  return (
    <span
      className="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function LogsPage() {
  const router   = useRouter();
  const dispatch = useAppDispatch();
  const { items, total, totalPages, loading } = useAppSelector((s) => s.logs);

  const [page,         setPage]         = useState(1);
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const load = useCallback(async () => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (moduleFilter) params.set('module', moduleFilter);
      if (actionFilter) params.set('action', actionFilter);
      const res = await fetch(`/api/audit-logs?${params}`);
      if (res.ok) {
        const json = await res.json();
        dispatch(setLogs(json));
      }
    } catch {
      dispatch(setError('Failed to load logs'));
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch, page, moduleFilter, actionFilter]);

  useEffect(() => { load(); }, [load]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [moduleFilter, actionFilter]);

  const handleEntityClick = (log: AuditLog) => {
    const cfg = MODULE_CONFIG[log.module];
    if (!cfg) return;
    const url = log.entity_id
      ? `${cfg.route}?open=${log.entity_id}`
      : cfg.route;
    router.push(url);
  };

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to   = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Audit Logs
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {total.toLocaleString()} total log entries
          </p>
        </div>

        {/* Filters + Refresh */}
        <div className="flex items-center gap-2 flex-wrap">

          {/* Module filter */}
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="text-sm rounded-lg px-3 py-2 outline-none"
            style={{
              background: 'var(--color-input-bg)',
              border: '1px solid var(--color-input-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            <option value="">All Modules</option>
            {Object.entries(MODULE_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>

          {/* Action filter */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="text-sm rounded-lg px-3 py-2 outline-none"
            style={{
              background: 'var(--color-input-bg)',
              border: '1px solid var(--color-input-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            <option value="">All Actions</option>
            {Object.entries(ACTION_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>

          {/* Refresh */}
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg cursor-pointer transition-opacity"
            style={{
              background: 'var(--color-input-bg)',
              border: '1px solid var(--color-input-border)',
              color: 'var(--color-text-secondary)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <Table
        headers={['Time', 'Module', 'Action', 'Entity', 'Details', 'By']}
        loading={loading}
        isEmpty={items.length === 0}
        emptyText="No log entries found."
        footer={
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            from={from}
            to={to}
            onPageChange={setPage}
            itemLabel="log"
          />
        }
      >
        {items.map((log, i) => {
          const { date, time } = formatTime(log.created_at);
          const hasEntity = !!log.entity_label;
          return (
            <TableRow key={log.id} isLast={i === items.length - 1}>

              {/* Time */}
              <Td>
                <p className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{date}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{time}</p>
              </Td>

              {/* Module */}
              <Td><ModuleBadge module={log.module} /></Td>

              {/* Action */}
              <Td><ActionBadge action={log.action} /></Td>

              {/* Entity */}
              <Td>
                {hasEntity ? (
                  <button
                    onClick={() => handleEntityClick(log)}
                    className="inline-flex items-center gap-1 text-sm font-medium cursor-pointer group"
                    style={{ color: 'var(--color-accent)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.75')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                  >
                    {log.entity_label}
                    <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ) : (
                  <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                )}
              </Td>

              {/* Details */}
              <Td>
                <span
                  className="text-xs max-w-xs block truncate"
                  title={formatDetails(log)}
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {formatDetails(log)}
                </span>
              </Td>

              {/* By */}
              <Td>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {log.performed_by ?? 'System'}
                </span>
              </Td>

            </TableRow>
          );
        })}
      </Table>

    </div>
  );
}
