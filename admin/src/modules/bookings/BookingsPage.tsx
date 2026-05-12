'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search, MapPin, List, CalendarDays,
  MoreHorizontal, CheckCircle, XCircle,
  UserX, RefreshCw, ChevronLeft, ChevronRight, Link,
} from 'lucide-react';
import { Table, TableRow, Td } from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import ConfirmModal from '@/components/modals/ConfirmModal';
import RescheduleModal from '@/components/modals/RescheduleModal';
import type { Booking, RescheduleForm } from '@/types/bookings';
import { formatTime, formatDate } from '@/lib/helpers';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  setBookings, setLoading, setError,
  setSearch, setStatusFilter, setPaymentFilter, setDateFilter, clearFilters,
} from '@/store/bookingsSlice';

// ─── Constants ────────────────────────────────────────────────

const PAGE_SIZE = 15;
const LIST_HEADERS = ['Date & Time', 'Customer', 'Therapist', 'Service', 'Location', 'Status', 'Payment', ''];
const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
const PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded'];

// ─── Status styles ────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  pending:   { bg: 'var(--color-status-pending-bg)',   text: 'var(--color-status-pending-text)'   },
  confirmed: { bg: 'var(--color-status-confirmed-bg)', text: 'var(--color-status-confirmed-text)' },
  completed: { bg: 'var(--color-status-completed-bg)', text: 'var(--color-status-completed-text)' },
  cancelled: { bg: 'var(--color-status-cancelled-bg)', text: 'var(--color-status-cancelled-text)' },
  no_show:   { bg: 'var(--color-status-noshow-bg)',    text: 'var(--color-status-noshow-text)'    },
};

const PAYMENT_STYLE: Record<string, { bg: string; text: string }> = {
  paid:     { bg: 'var(--color-status-confirmed-bg)', text: 'var(--color-status-confirmed-text)' },
  unpaid:   { bg: 'var(--color-status-pending-bg)',   text: 'var(--color-status-pending-text)'   },
  refunded: { bg: 'var(--color-status-completed-bg)', text: 'var(--color-status-completed-text)' },
};

// Hardcoded hex — CSS vars don't resolve reliably inside tiny inline-style elements
const STATUS_DOT_HEX: Record<string, string> = {
  pending:   '#f59e0b',
  confirmed: '#22c55e',
  completed: '#3b82f6',
  cancelled: '#ef4444',
  no_show:   '#94a3b8',
};

function StatusBadge({ value, map }: { value: string | null; map: Record<string, { bg: string; text: string }> }) {
  if (!value) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
  const s = map[value] ?? { bg: 'var(--color-status-noshow-bg)', text: 'var(--color-status-noshow-text)' };
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize whitespace-nowrap"
      style={{ background: s.bg, color: s.text }}>
      {value.replace('_', ' ')}
    </span>
  );
}

// ─── Action Menu (dropdown) ───────────────────────────────────

const STATUS_ACTIONS = [
  { key: 'confirm',  label: 'Confirmed',     status: 'confirmed', icon: <CheckCircle size={13} /> },
  { key: 'complete', label: 'Completed',      status: 'completed', icon: <CheckCircle size={13} /> },
  { key: 'no_show',  label: 'No-show',        status: 'no_show',   icon: <UserX size={13} /> },
  { key: 'cancel',   label: 'Cancelled',      status: 'cancelled', icon: <XCircle size={13} /> },
];

const PAYMENT_ACTIONS = [
  { key: 'pay_paid',     label: 'Paid',     value: 'paid'     },
  { key: 'pay_unpaid',   label: 'Unpaid',   value: 'unpaid'   },
  { key: 'pay_refunded', label: 'Refunded', value: 'refunded' },
];

function MenuRow({ label, icon, active, danger, onClick }: {
  label: string; icon?: React.ReactNode; active?: boolean; danger?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left cursor-pointer"
      style={{ color: active ? 'var(--color-accent)' : danger ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-input-bg)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {icon}
      {label}
      {active && <CheckCircle size={11} style={{ marginLeft: 'auto' }} />}
    </button>
  );
}

function MenuDivider({ label }: { label: string }) {
  return (
    <div className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-widest"
      style={{ color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-card-border)' }}>
      {label}
    </div>
  );
}

function ActionMenu({
  booking,
  openId,
  setOpenId,
  onAction,
}: {
  booking: Booking;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  onAction: (type: string, b: Booking) => void;
}) {
  const isOpen = openId === booking.id;
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number }>({ right: 0 });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const right = window.innerWidth - r.right;
      const spaceBelow = window.innerHeight - r.bottom;
      const spaceAbove = r.top;
      if (spaceBelow >= 200 || spaceBelow >= spaceAbove) {
        setPos({ top: r.bottom + 4, bottom: undefined, right });
      } else {
        setPos({ top: undefined, bottom: window.innerHeight - r.top + 4, right });
      }
    }
    setOpenId(isOpen ? null : booking.id);
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleClick}
        className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer"
        style={{
          color: 'var(--color-text-muted)',
          background: isOpen ? 'var(--color-input-bg)' : 'transparent',
          border: '1px solid ' + (isOpen ? 'var(--color-input-border)' : 'transparent'),
        }}
      >
        <MoreHorizontal size={15} />
      </button>

      {isOpen && (
        <>
        {/* Backdrop — catches outside clicks */}
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
          onClick={() => setOpenId(null)}
        />
        <div
          style={{
            position: 'fixed',
            top: pos.top,
            bottom: pos.bottom,
            right: pos.right,
            zIndex: 9999,
            background: 'var(--color-card-bg)',
            border: '1px solid var(--color-card-border)',
            borderRadius: '0.5rem',
            minWidth: 170,
            maxHeight: 200,
            overflowY: 'auto',
            paddingTop: 4,
            paddingBottom: 4,
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          }}
        >
          {/* Status */}
          <div className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--color-text-muted)' }}>
            Status
          </div>
          {STATUS_ACTIONS.map((a) => (
            <MenuRow
              key={a.key}
              label={a.label}
              icon={a.icon}
              active={booking.status === a.status}
              onClick={() => { setOpenId(null); onAction(a.key, booking); }}
            />
          ))}

          {/* Reschedule + Rating Link */}
          <MenuDivider label="Actions" />
          <MenuRow
            label="Reschedule"
            icon={<RefreshCw size={13} />}
            onClick={() => { setOpenId(null); onAction('reschedule', booking); }}
          />
          {booking.rating_token && (
            <MenuRow
              label={booking.rating_submitted ? 'Rating Link (submitted)' : 'Copy Rating Link'}
              icon={<Link size={13} />}
              active={booking.rating_submitted}
              onClick={() => { setOpenId(null); onAction('copy_rating_link', booking); }}
            />
          )}

          {/* Payment */}
          <MenuDivider label="Payment" />
          {PAYMENT_ACTIONS.map((a) => (
            <MenuRow
              key={a.key}
              label={a.label}
              active={booking.payment_status === a.value}
              onClick={() => { setOpenId(null); onAction(a.key, booking); }}
            />
          ))}
        </div>
        </>
      )}
    </div>
  );
}

// ─── Calendar View ────────────────────────────────────────────

function CalendarView({
  bookings,
  onAction,
  openMenuId,
  setOpenMenuId,
}: {
  bookings: Booking[];
  onAction: (type: string, b: Booking) => void;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
}) {
  const [calDate, setCalDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(
    () => new Date().toISOString().split('T')[0]
  );

  const year  = calDate.getFullYear();
  const month = calDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow    = new Date(year, month, 1).getDay();

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const toDateStr = (d: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const today = new Date().toISOString().split('T')[0];

  const byDate = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    for (const b of bookings) {
      if (b.booking_date) {
        if (!map[b.booking_date]) map[b.booking_date] = [];
        map[b.booking_date].push(b);
      }
    }
    return map;
  }, [bookings]);

  const selectedBookings = selectedDay ? (byDate[selectedDay] ?? []) : [];

  const monthLabel = calDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const navigate = (dir: number) => {
    const next = new Date(year, month + dir);
    setCalDate(next);
    // Keep today selected if navigating to today's month, else clear
    const todayInNext = next.getFullYear() === new Date().getFullYear() && next.getMonth() === new Date().getMonth();
    setSelectedDay(todayInNext ? today : null);
  };

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl p-5"
        style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}
      >
        {/* Month nav */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-input-bg)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {monthLabel}
          </span>
          <button
            onClick={() => navigate(1)}
            className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-input-bg)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-center text-xs font-medium py-1.5"
              style={{ color: 'var(--color-text-muted)' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, i) => {
            if (!day) return <div key={`e-${i}`} />;
            const dateStr   = toDateStr(day);
            const dayBks    = byDate[dateStr] ?? [];
            const isToday   = dateStr === today;
            const isSelected = dateStr === selectedDay;

            // unique status dots (max 4)
            const dots: string[] = [];
            const seen = new Set<string>();
            for (const b of dayBks) {
              const s = b.status ?? '';
              if (!seen.has(s) && STATUS_DOT_HEX[s]) {
                seen.add(s); dots.push(STATUS_DOT_HEX[s]);
                if (dots.length === 4) break;
              }
            }

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                className="flex flex-col items-center justify-center rounded-lg py-2 px-1 transition-colors cursor-pointer min-h-[52px]"
                style={{
                  background: isSelected
                    ? 'var(--color-accent)'
                    : isToday
                    ? 'var(--color-accent-subtle)'
                    : 'transparent',
                  border: isToday && !isSelected
                    ? '1px solid var(--color-accent)'
                    : '1px solid transparent',
                }}
              >
                <span className="text-sm font-medium leading-none" style={{
                  color: isSelected ? '#fff' : isToday ? 'var(--color-accent)' : 'var(--color-text-primary)',
                }}>
                  {day}
                </span>
                {dots.length > 0 && (
                  <div style={{ display: 'flex', gap: '3px', marginTop: '5px' }}>
                    {dots.map((c, di) => (
                      <div
                        key={di}
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          flexShrink: 0,
                          backgroundColor: isSelected ? 'rgba(255,255,255,0.8)' : c,
                        }}
                      />
                    ))}
                  </div>
                )}
                {dayBks.length > 0 && (
                  <span
                    style={{
                      fontSize: 10,
                      marginTop: 2,
                      lineHeight: 1,
                      color: isSelected ? 'rgba(255,255,255,0.8)' : isToday ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    }}
                  >
                    {dayBks.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="space-y-3">
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
            {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric',
            })}
            <span className="ml-2 font-normal" style={{ color: 'var(--color-text-muted)' }}>
              — {selectedBookings.length} booking{selectedBookings.length !== 1 ? 's' : ''}
            </span>
          </p>

          {selectedBookings.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No bookings on this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedBookings.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {b.customer?.full_name ?? 'Unknown'}
                      </span>
                      <StatusBadge value={b.status} map={STATUS_STYLE} />
                      <StatusBadge value={b.payment_status} map={PAYMENT_STYLE} />
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {formatTime(b.start_time)}{b.end_time ? ` – ${formatTime(b.end_time)}` : ''}
                      </span>
                      {b.therapist?.full_name && (
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          · {b.therapist.full_name}
                        </span>
                      )}
                      {b.service?.name && (
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          · {b.service.name}
                        </span>
                      )}
                      {b.location_type && (
                        <span className="text-xs capitalize" style={{ color: 'var(--color-text-muted)' }}>
                          · {b.location_type}
                        </span>
                      )}
                    </div>
                  </div>
                  <ActionMenu
                    booking={b}
                    openId={openMenuId}
                    setOpenId={setOpenMenuId}
                    onAction={onAction}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function BookingsPage() {
  const dispatch = useAppDispatch();
  const { items: bookings, loading, search, statusFilter, paymentFilter, dateFilter } = useAppSelector((s) => s.bookings);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [page, setPage] = useState(1);

  // Modals
  const [confirmAction, setConfirmAction] = useState<{
    title: string; message: string; label: string; variant: 'danger' | 'primary';
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);

  // Action menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // ── Load ──────────────────────────────────────────────────

  const load = useCallback(async () => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const res = await fetch('/api/bookings');
      if (res.ok) dispatch(setBookings(await res.json()));
    } catch {
      dispatch(setError('Failed to load bookings'));
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, statusFilter, paymentFilter, dateFilter]);

  // ── Filter ────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = bookings;
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((b) =>
      b.customer?.full_name?.toLowerCase().includes(q) ||
      b.customer?.phone?.toLowerCase().includes(q) ||
      b.therapist?.full_name?.toLowerCase().includes(q) ||
      b.service?.name?.toLowerCase().includes(q)
    );
    if (statusFilter)  list = list.filter((b) => b.status === statusFilter);
    if (paymentFilter) list = list.filter((b) => b.payment_status === paymentFilter);
    if (dateFilter)    list = list.filter((b) => b.booking_date === dateFilter);
    return list;
  }, [bookings, search, statusFilter, paymentFilter, dateFilter]);

  // ── Action handler ────────────────────────────────────────

  const handleAction = useCallback((type: string, booking: Booking) => {
    if (type === 'reschedule') {
      setRescheduleBooking(booking);
      return;
    }

    if (type === 'copy_rating_link' && booking.rating_token) {
      const url = `${window.location.origin}/rate/${booking.rating_token}`;
      navigator.clipboard.writeText(url).catch(() => {});
      return;
    }

    const name = booking.customer?.full_name ?? 'this customer';

    const configs: Record<string, { title: string; message: string; label: string; variant: 'danger' | 'primary'; status?: string; payment?: string }> = {
      confirm:     { title: 'Confirm Booking',    message: `Confirm the booking for ${name}?`,                                           label: 'Confirm',   variant: 'primary', status: 'confirmed' },
      complete:    { title: 'Mark as Completed',  message: `Mark booking for ${name} as completed? This will trigger the rating timer.`, label: 'Complete',  variant: 'primary', status: 'completed' },
      no_show:     { title: 'Mark No-show',       message: `Mark ${name} as no-show for this booking?`,                                  label: 'No-show',   variant: 'danger',  status: 'no_show'   },
      cancel:      { title: 'Cancel Booking',     message: `Cancel the booking for ${name}? This cannot be undone.`,                     label: 'Cancel',    variant: 'danger',  status: 'cancelled' },
      pay_paid:    { title: 'Mark as Paid',       message: `Mark payment as paid for ${name}?`,                                          label: 'Mark Paid', variant: 'primary', payment: 'paid'     },
      pay_unpaid:  { title: 'Mark as Unpaid',     message: `Mark payment as unpaid for ${name}?`,                                        label: 'Unpaid',    variant: 'danger',  payment: 'unpaid'   },
      pay_refunded:{ title: 'Refund Payment',     message: `Refund the payment for ${name}?`,                                            label: 'Refund',    variant: 'danger',  payment: 'refunded' },
    };

    const cfg = configs[type];
    if (!cfg) return;

    setConfirmAction({
      title:   cfg.title,
      message: cfg.message,
      label:   cfg.label,
      variant: cfg.variant,
      onConfirm: async () => {
        const payload: Record<string, string> = {};
        if (cfg.status)  payload.status         = cfg.status;
        if (cfg.payment) payload.payment_status = cfg.payment;
        const res = await fetch(`/api/bookings/${booking.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
        await load();
      },
    });
  }, [load]);

  const handleReschedule = async (form: RescheduleForm) => {
    const payload: Record<string, string | null> = {
      booking_date: form.booking_date || null,
      start_time:   form.start_time   || null,
      end_time:     form.end_time     || null,
    };
    if (form.therapist_id) payload.therapist_id = form.therapist_id;
    const res = await fetch(`/api/bookings/${rescheduleBooking!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to reschedule');
    await load();
  };

  // ── Pagination ────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to   = Math.min(safePage * PAGE_SIZE, filtered.length);
  const hasFilters = search || statusFilter || paymentFilter || dateFilter;

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Bookings
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {bookings.length} total bookings
          </p>
        </div>

        {/* View toggle */}
        <div
          className="flex items-center rounded-lg p-1 self-start sm:self-auto"
          style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)' }}
        >
          {([['list', <List size={15} />, 'List'], ['calendar', <CalendarDays size={15} />, 'Calendar']] as const).map(([v, icon, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer"
              style={{
                background: view === v ? 'var(--color-card-bg)' : 'transparent',
                color: view === v ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {icon}{label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div
        className="rounded-xl px-4 py-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap"
        style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}
      >
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--color-text-muted)' }} />
          <input type="text" placeholder="Search customer, therapist, service…"
            value={search} onChange={(e) => dispatch(setSearch(e.target.value))}
            className="w-full rounded-lg text-sm outline-none pl-9 pr-4 py-2"
            style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-primary)' }}
          />
        </div>

        <select value={statusFilter} onChange={(e) => dispatch(setStatusFilter(e.target.value))}
          className="rounded-lg text-sm outline-none px-3 py-2 min-w-[130px]"
          style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: statusFilter ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase())}</option>)}
        </select>

        <select value={paymentFilter} onChange={(e) => dispatch(setPaymentFilter(e.target.value))}
          className="rounded-lg text-sm outline-none px-3 py-2 min-w-[130px]"
          style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: paymentFilter ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
          <option value="">All Payments</option>
          {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>

        <input type="date" value={dateFilter} onChange={(e) => dispatch(setDateFilter(e.target.value))}
          className="rounded-lg text-sm outline-none px-3 py-2"
          style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: dateFilter ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}
        />

        {hasFilters && (
          <button onClick={() => dispatch(clearFilters())}
            className="text-xs px-3 py-2 rounded-lg cursor-pointer whitespace-nowrap"
            style={{ color: 'var(--color-danger)', background: 'var(--color-status-cancelled-bg)' }}>
            Clear filters
          </button>
        )}
      </div>

      {/* Views */}
      {view === 'list' ? (
        <Table headers={LIST_HEADERS} loading={loading}
          isEmpty={filtered.length === 0}
          emptyText={hasFilters ? 'No bookings match your filters.' : 'No bookings yet.'}
          footer={
            <Pagination page={safePage} totalPages={totalPages} total={filtered.length}
              from={from} to={to} onPageChange={setPage} itemLabel="booking" />
          }
        >
          {paginated.map((b, i) => (
            <TableRow key={b.id} isLast={i === paginated.length - 1}>

              <Td className="whitespace-nowrap">
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {formatDate(b.booking_date)}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  {formatTime(b.start_time)}{b.end_time ? ` – ${formatTime(b.end_time)}` : ''}
                </p>
              </Td>

              <Td>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {b.customer?.full_name ?? <span style={{ color: 'var(--color-text-muted)' }}>Unknown</span>}
                </p>
                {b.customer?.phone && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{b.customer.phone}</p>
                )}
              </Td>

              <Td style={{ color: 'var(--color-text-secondary)' }}>
                <span className="text-sm">{b.therapist?.full_name ?? <span style={{ color: 'var(--color-text-muted)' }}>—</span>}</span>
              </Td>

              <Td>
                {b.service ? (
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{b.service.name}</p>
                ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                {b.package && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>📦 {b.package.name}</p>
                )}
              </Td>

              <Td>
                {b.location_type ? (
                  <span className="inline-flex items-center gap-1 text-xs capitalize" style={{ color: 'var(--color-text-secondary)' }}>
                    <MapPin size={11} style={{ color: 'var(--color-text-muted)' }} />
                    {b.location_type}
                  </span>
                ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                {b.address && (
                  <p className="text-xs mt-0.5 truncate max-w-[140px]" style={{ color: 'var(--color-text-muted)' }} title={b.address}>
                    {b.address}
                  </p>
                )}
              </Td>

              <Td><StatusBadge value={b.status} map={STATUS_STYLE} /></Td>
              <Td><StatusBadge value={b.payment_status} map={PAYMENT_STYLE} /></Td>

              <Td>
                <div className="flex justify-end">
                  <ActionMenu
                    booking={b}
                    openId={openMenuId}
                    setOpenId={setOpenMenuId}
                    onAction={handleAction}
                  />
                </div>
              </Td>

            </TableRow>
          ))}
        </Table>
      ) : (
        <CalendarView
          bookings={filtered}
          onAction={handleAction}
          openMenuId={openMenuId}
          setOpenMenuId={setOpenMenuId}
        />
      )}

      {/* Confirm Modal */}
      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          message={confirmAction.message}
          confirmLabel={confirmAction.label}
          variant={confirmAction.variant}
          onConfirm={confirmAction.onConfirm}
          onClose={() => setConfirmAction(null)}
        />
      )}

      {/* Reschedule Modal */}
      {rescheduleBooking && (
        <RescheduleModal
          booking={rescheduleBooking}
          onClose={() => setRescheduleBooking(null)}
          onSave={handleReschedule}
        />
      )}
    </div>
  );
}
