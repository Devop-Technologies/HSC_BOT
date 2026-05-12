"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search,
  Phone,
  MapPin,
  Clock,
  X,
  CalendarDays,
  CheckCircle2,
  XCircle,
  Star,
  UserRound,
  ChevronRight,
  MessageCircle,
  Mail,
  Trash2,
} from "lucide-react";
import { Table, TableRow, Td } from "@/components/ui/Table";
import Pagination from "@/components/ui/Pagination";
import Overlay from "@/components/modals/Overlay";
import ConfirmModal from "@/components/modals/ConfirmModal";
import type { Customer, CustomerLocation, BookingHistory, ClientHistory, ChatMessage } from "@/types/clients";
import { formatTime, formatDate, timeAgo, initials } from '@/lib/helpers';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setClients, setLoading, setError, setSearch } from '@/store/clientsSlice';

// ─── Constants ────────────────────────────────────────────────

const PAGE_SIZE = 15;
const TABLE_HEADERS = ["Client", "Phone", "Locations", "Last Active", "Actions"];

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  confirmed: {
    color: "var(--color-status-confirmed-text)",
    bg: "var(--color-status-confirmed-bg)",
  },
  pending: {
    color: "var(--color-status-pending-text)",
    bg: "var(--color-status-pending-bg)",
  },
  cancelled: {
    color: "var(--color-status-cancelled-text)",
    bg: "var(--color-status-cancelled-bg)",
  },
  completed: {
    color: "var(--color-status-completed-text)",
    bg: "var(--color-status-completed-bg)",
  },
  no_show: {
    color: "var(--color-status-noshow-text)",
    bg: "var(--color-status-noshow-bg)",
  },
};


// ─── Star display ─────────────────────────────────────────────

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={11}
          fill={rating >= n ? "#f59e0b" : "none"}
          stroke={rating >= n ? "#f59e0b" : "#94a3b8"}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

// ─── Client Profile Panel (slide-over) ────────────────────────

function ProfilePanel({
  customer,
  onClose,
}: {
  customer: Customer;
  onClose: () => void;
}) {
  const [data, setData] = useState<ClientHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"timeline" | "locations" | "chat">("timeline");
  const [chatMessages, setChatMessages] = useState<ChatMessage[] | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/customers/${customer.id}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [customer.id]);

  useEffect(() => {
    if (tab !== 'chat' || chatMessages !== null) return;
    setChatLoading(true);
    fetch(`/api/customers/${customer.id}/chat`)
      .then((r) => r.json())
      .then(setChatMessages)
      .finally(() => setChatLoading(false));
  }, [tab, customer.id, chatMessages]);

  useEffect(() => {
    if (tab === 'chat' && chatMessages?.length) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [tab, chatMessages]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 h-[100vh]"
        style={{ background: "rgba(0,0,0,0.4)" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 flex flex-col w-full max-w-md"
        style={{
          background: "var(--color-card-bg)",
          borderLeft: "1px solid var(--color-card-border)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.12)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-4 px-5 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--color-card-border)" }}
        >
          {/* Avatar */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: "var(--color-accent)", color: "#fff" }}
          >
            {initials(customer.full_name, customer.phone)}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="font-semibold truncate"
              style={{ color: "var(--color-text-primary)" }}
            >
              {customer.full_name ?? "Unknown"}
            </p>
            <p
              className="text-xs mt-0.5 flex items-center gap-1"
              style={{ color: "var(--color-text-muted)" }}
            >
              <Phone size={10} />
              {customer.phone} · Joined{" "}
              {new Date(customer.created_at).toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
              })}
            </p>
            {customer.email && (
              <p
                className="text-xs mt-0.5 flex items-center gap-1 truncate"
                style={{ color: "var(--color-text-muted)" }}
              >
                <Mail size={10} />
                {customer.email}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer"
            style={{ color: "var(--color-text-muted)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--color-input-bg)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <X size={16} />
          </button>
        </div>

        {/* Stats row */}
        {data && (
          <div
            className="grid grid-cols-4 flex-shrink-0"
            style={{ borderBottom: "1px solid var(--color-card-border)" }}
          >
            {[
              { label: "Total", value: data.stats.total },
              { label: "Completed", value: data.stats.completed },
              { label: "Cancelled", value: data.stats.cancelled },
              {
                label: "Avg Rating",
                value:
                  data.stats.avg_rating != null
                    ? `★ ${data.stats.avg_rating}`
                    : "—",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="flex flex-col items-center py-3 px-2 text-center"
                style={{ borderRight: "1px solid var(--color-card-border)" }}
              >
                <span
                  className="text-base font-bold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {s.value}
                </span>
                <span
                  className="text-[10px] mt-0.5"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-shrink-0 px-4 pt-3 gap-1">
          {(["timeline", "chat", "locations"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-5 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors"
              style={{
                background: tab === t ? "var(--color-accent)" : "transparent",
                color: tab === t ? "#fff" : "var(--color-text-muted)",
              }}
            >
              {t === "timeline" ? "Bookings" : t === "chat" ? "Chat History" : "Locations"}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {/* ── Timeline ── */}
          {tab === "timeline" &&
            (loading ? (
              <div className="flex items-center justify-center py-16">
                <div
                  className="w-5 h-5 rounded-full border-2 animate-spin"
                  style={{
                    borderColor: "var(--color-accent)",
                    borderTopColor: "transparent",
                  }}
                />
              </div>
            ) : !data?.history.length ? (
              <div className="text-center py-16">
                <CalendarDays
                  size={32}
                  style={{
                    color: "var(--color-text-muted)",
                    margin: "0 auto 8px",
                  }}
                />
                <p
                  className="text-sm"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  No bookings yet
                </p>
              </div>
            ) : (
              <div className="relative">
                {/* Vertical line */}
                <div
                  className="absolute left-[7px] top-2 bottom-2 w-px"
                  style={{ background: "var(--color-card-border)" }}
                />

                <div className="space-y-4 pl-6">
                  {data.history.map((b) => {
                    const st = b.status
                      ? (STATUS_STYLE[b.status] ?? STATUS_STYLE.pending)
                      : null;
                    return (
                      <div key={b.id} className="relative">
                        {/* Dot */}
                        <div
                          className="absolute -left-6 top-3 w-3.5 h-3.5 rounded-full border-2 flex-shrink-0"
                          style={{
                            background: st?.color ?? "var(--color-text-muted)",
                            borderColor: "var(--color-card-bg)",
                          }}
                        />

                        {/* Card */}
                        <div
                          className="rounded-xl px-4 py-3 space-y-2"
                          style={{
                            background: "var(--color-input-bg)",
                            border: "1px solid var(--color-input-border)",
                          }}
                        >
                          {/* Top row */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p
                                className="text-sm font-medium"
                                style={{ color: "var(--color-text-primary)" }}
                              >
                                {b.service_name ?? "Service"}
                              </p>
                              <p
                                className="text-xs mt-0.5"
                                style={{ color: "var(--color-text-muted)" }}
                              >
                                {formatDate(b.booking_date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                {b.start_time &&
                                  ` · ${formatTime(b.start_time, '')}`}
                                {b.end_time && ` – ${formatTime(b.end_time, '')}`}
                              </p>
                            </div>
                            {st && (
                              <span
                                className="text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap capitalize flex-shrink-0"
                                style={{ background: st.bg, color: st.color }}
                              >
                                {b.status?.replace("_", " ")}
                              </span>
                            )}
                          </div>

                          {/* Provider + payment */}
                          <div className="flex items-center justify-between text-xs">
                            {b.therapist_name ? (
                              <span
                                className="flex items-center gap-1"
                                style={{ color: "var(--color-text-secondary)" }}
                              >
                                <UserRound
                                  size={11}
                                  style={{ color: "var(--color-text-muted)" }}
                                />
                                {b.therapist_name}
                              </span>
                            ) : (
                              <span />
                            )}
                            {b.payment_status && (
                              <span
                                className="capitalize"
                                style={{
                                  color:
                                    b.payment_status === "paid"
                                      ? "var(--color-status-confirmed-text)"
                                      : b.payment_status === "refunded"
                                        ? "var(--color-status-completed-text)"
                                        : "var(--color-status-pending-text)",
                                }}
                              >
                                {b.payment_status}
                              </span>
                            )}
                          </div>

                          {/* Rating */}
                          {b.rating_submitted && b.rating && (
                            <div
                              className="pt-1.5 mt-1.5 flex items-start gap-2"
                              style={{
                                borderTop: "1px solid var(--color-card-border)",
                              }}
                            >
                              <StarDisplay rating={b.rating} />
                              {b.rating_comment && (
                                <p
                                  className="text-xs italic flex-1"
                                  style={{ color: "var(--color-text-muted)" }}
                                >
                                  "{b.rating_comment}"
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

          {/* ── Chat History ── */}
          {tab === "chat" && (
            chatLoading ? (
              <div className="flex items-center justify-center py-16">
                <div
                  className="w-5 h-5 rounded-full border-2 animate-spin"
                  style={{ borderColor: "var(--color-accent)", borderTopColor: "transparent" }}
                />
              </div>
            ) : !chatMessages?.length ? (
              <div className="text-center py-16">
                <MessageCircle size={32} style={{ color: "var(--color-text-muted)", margin: "0 auto 8px" }} />
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  No chat history found
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 py-1">
                {chatMessages.map((msg) => {

                  const isOutbound = msg.direction === 'outgoing';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col gap-0.5 ${isOutbound ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className="max-w-[80%] rounded-2xl px-3.5 py-2 text-sm"
                        style={{
                          background: isOutbound ? 'var(--color-accent)' : 'var(--color-input-bg)',
                          color: isOutbound ? '#fff' : 'var(--color-text-primary)',
                          border: isOutbound ? 'none' : '1px solid var(--color-input-border)',
                          borderBottomRightRadius: isOutbound ? 4 : undefined,
                          borderBottomLeftRadius: isOutbound ? undefined : 4,
                        }}
                      >
                        {msg.message ?? '—'}
                      </div>
                      <span className="text-[10px] px-1" style={{ color: "var(--color-text-muted)" }}>
                        {new Date(msg.created_at).toLocaleString('en-GB', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                  );
                })}
                <div ref={chatBottomRef} />
              </div>
            )
          )}

          {/* ── Locations ── */}
          {tab === "locations" &&
            (customer.customer_locations.length === 0 ? (
              <div className="text-center py-16">
                <MapPin size={32} style={{ color: "var(--color-text-muted)", margin: "0 auto 8px" }} />
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No saved locations</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(() => {
                  // Group duplicate locations by coordinates (3 decimal places ≈ 100m)
                  const groups: { representative: typeof customer.customer_locations[0]; ids: string[] }[] = [];
                  const seen = new Map<string, number>();

                  for (const loc of customer.customer_locations) {
                    const lat = loc.latitude  != null ? Number(loc.latitude).toFixed(3)  : 'x';
                    const lng = loc.longitude != null ? Number(loc.longitude).toFixed(3) : 'y';
                    const key = `${lat},${lng}`;

                    if (seen.has(key)) {
                      const idx = seen.get(key)!;
                      groups[idx].ids.push(loc.id as string);
                      // Prefer the default one as the representative
                      if (loc.is_default) groups[idx].representative = loc;
                    } else {
                      seen.set(key, groups.length);
                      groups.push({ representative: loc, ids: [loc.id as string] });
                    }
                  }

                  return groups.map((group, i) => {
                  const loc = group.representative;
                  // Collect bookings from ALL location IDs in this group
                  const locBookings = (data?.history ?? []).filter(
                    (b) => b.location_id != null && group.ids.includes(b.location_id)
                  );

                  const district = loc.district as string | null;
                  const city     = loc.city     as string | null;
                  const address  = loc.address  as string | null;
                  const mapsUrl  = loc.maps_url as string | null;
                  const lat      = loc.latitude  as number | null;
                  const lng      = loc.longitude as number | null;
                  const isDef    = loc.is_default as boolean | null;

                  return (
                    <div
                      key={loc.id}
                      className="rounded-xl overflow-hidden"
                      style={{ border: "1px solid var(--color-input-border)" }}
                    >
                      {/* Location header */}
                      <div
                        className="px-4 py-3 flex items-start justify-between gap-2"
                        style={{ background: "var(--color-input-bg)" }}
                      >
                        <div className="flex items-start gap-2.5">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ background: "var(--color-accent-subtle)" }}
                          >
                            <MapPin size={13} style={{ color: "var(--color-accent)" }} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                                {district ?? city ?? address ?? `Location ${i + 1}`}
                              </span>
                              {isDef && (
                                <span
                                  className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                  style={{ background: "var(--color-accent-subtle)", color: "var(--color-accent)" }}
                                >
                                  Default
                                </span>
                              )}
                            </div>
                            {city && district && (
                              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                                {city}
                              </p>
                            )}
                            {address && (
                              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                                {address}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              {lat != null && lng != null && (
                                <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                                  {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
                                </span>
                              )}
                              {mapsUrl && (
                                <a
                                  href={mapsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] underline"
                                  style={{ color: "var(--color-accent)" }}
                                >
                                  Open in Maps
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                        <span
                          className="text-[11px] flex-shrink-0 mt-0.5"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          {locBookings.length} booking{locBookings.length !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {/* Bookings at this location */}
                      {locBookings.length > 0 && (
                        <div style={{ borderTop: "1px solid var(--color-card-border)" }}>
                          {locBookings.map((b, bi) => {
                            const st = b.status ? (STATUS_STYLE[b.status] ?? STATUS_STYLE.pending) : null;
                            return (
                              <div
                                key={b.id}
                                className="px-4 py-2.5 flex items-center justify-between gap-3"
                                style={{
                                  borderTop: bi > 0 ? "1px solid var(--color-card-border)" : undefined,
                                  background: "var(--color-card-bg)",
                                }}
                              >
                                <div className="flex items-start gap-2 min-w-0">
                                  <CalendarDays size={12} style={{ color: "var(--color-text-muted)", flexShrink: 0, marginTop: 2 }} />
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                                      {b.service_name ?? "Service"}
                                    </p>
                                    {b.therapist_name && (
                                      <p className="text-[11px] mt-0.5 flex items-center gap-1 truncate" style={{ color: "var(--color-text-secondary)" }}>
                                        <UserRound size={10} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
                                        {b.therapist_name}
                                      </p>
                                    )}
                                    <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                                      {b.booking_date
                                        ? formatDate(b.booking_date, { day: "numeric", month: "short", year: "numeric" })
                                        : "—"}
                                      {b.start_time ? ` · ${formatTime(b.start_time, "")}` : ""}
                                    </p>
                                  </div>
                                </div>
                                {st && (
                                  <span
                                    className="text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap capitalize flex-shrink-0"
                                    style={{ background: st.bg, color: st.color }}
                                  >
                                    {b.status?.replace("_", " ")}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* No bookings yet for this location */}
                      {locBookings.length === 0 && (
                        <div
                          className="px-4 py-2.5"
                          style={{ borderTop: "1px solid var(--color-card-border)", background: "var(--color-card-bg)" }}
                        >
                          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                            No bookings from this location yet
                          </p>
                        </div>
                      )}
                    </div>
                  );
                  });
                })()}
              </div>
            ))}
        </div>
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function ClientsPage() {
  const dispatch     = useAppDispatch();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const { items: customers, loading, search } = useAppSelector((s) => s.clients);
  const [page, setPage] = useState(1);
  const [profileCustomer, setProfile] = useState<Customer | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ message: string; onConfirm: () => Promise<void> } | null>(null);

  const load = useCallback(async () => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const res = await fetch("/api/customers");
      if (res.ok) dispatch(setClients(await res.json()));
    } catch {
      dispatch(setError('Failed to load clients'));
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  useEffect(() => { load(); }, [load]);

  const deleteClient = async (id: string) => {
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete client');
    await load();
  };

  // Auto-open profile from ?open=UUID (e.g. navigated from Logs)
  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId || !customers.length) return;
    const found = customers.find((c) => c.id === openId);
    if (found) {
      setProfile(found);
      router.replace('/clients', { scroll: false });
    }
  }, [searchParams, customers, router]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.full_name?.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q),
    );
  }, [customers, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );
  const from = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE, filtered.length);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            className="text-xl font-bold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Clients
          </h2>
          <p
            className="text-sm mt-0.5"
            style={{ color: "var(--color-text-muted)" }}
          >
            {customers.length} registered clients
          </p>
        </div>
        <div className="relative sm:w-64">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "var(--color-text-muted)" }}
          />
          <input
            type="text"
            placeholder="Search by name or phone…"
            value={search}
            onChange={(e) => dispatch(setSearch(e.target.value))}
            className="w-full rounded-lg text-sm outline-none pl-9 pr-4 py-2.5"
            style={{
              background: "var(--color-input-bg)",
              border: "1px solid var(--color-input-border)",
              color: "var(--color-text-primary)",
            }}
          />
        </div>
      </div>

      {/* Table */}
      <Table
        headers={TABLE_HEADERS}
        loading={loading}
        isEmpty={filtered.length === 0}
        emptyText={search ? "No clients match your search." : "No clients yet."}
        footer={
          <Pagination
            page={safePage}
            totalPages={totalPages}
            total={filtered.length}
            from={from}
            to={to}
            onPageChange={setPage}
            itemLabel="client"
          />
        }
      >
        {paginated.map((c, i) => (
          <TableRow key={c.id} isLast={i === paginated.length - 1}>
            <Td>
              <p
                className="font-medium"
                style={{ color: "var(--color-text-primary)" }}
              >
                {c.full_name ?? (
                  <span style={{ color: "var(--color-text-muted)" }}>
                    Unknown
                  </span>
                )}
              </p>
              <p
                className="text-xs mt-0.5"
                style={{ color: "var(--color-text-muted)" }}
              >
                Joined {new Date(c.created_at).toLocaleDateString()}
              </p>
            </Td>

            <Td className="whitespace-nowrap">
              <span
                className="inline-flex items-center gap-1.5 text-sm"
                style={{ color: "var(--color-text-secondary)" }}
              >
                <Phone size={12} style={{ color: "var(--color-text-muted)" }} />
                {c.phone}
              </span>
            </Td>

            <Td>
              {c.customer_locations.length === 0 ? (
                <span style={{ color: "var(--color-text-muted)" }}>—</span>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 text-sm"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  <MapPin
                    size={12}
                    style={{ color: "var(--color-text-muted)" }}
                  />
                  {c.customer_locations.length}{" "}
                  {c.customer_locations.length === 1 ? "location" : "locations"}
                </span>
              )}
            </Td>

            <Td className="whitespace-nowrap">
              <span
                className="inline-flex items-center gap-1.5 text-sm"
                style={{ color: "var(--color-text-muted)" }}
              >
                <Clock size={12} />
                {timeAgo(c.last_active_at)}
              </span>
            </Td>

            <Td>
              <div className="flex items-center gap-1 justify-end">
                <button
                  onClick={() => setProfile(c)}
                  className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                  style={{
                    color: "var(--color-accent)",
                    background: "var(--color-accent-subtle)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  View Profile
                  <ChevronRight size={12} />
                </button>
                <button
                  onClick={() => setDeleteModal({
                    message: `Delete "${c.full_name ?? c.phone}"? This will permanently remove the client and all their data.`,
                    onConfirm: () => deleteClient(c.id),
                  })}
                  title="Delete"
                  className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer"
                  style={{ color: "var(--color-text-muted)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-danger)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-muted)")}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </Td>
          </TableRow>
        ))}
      </Table>

      {/* Profile Panel */}
      {profileCustomer && (
        <ProfilePanel
          customer={profileCustomer}
          onClose={() => setProfile(null)}
        />
      )}

      {/* Delete Confirm */}
      {deleteModal && (
        <ConfirmModal
          message={deleteModal.message}
          onConfirm={deleteModal.onConfirm}
          onClose={() => setDeleteModal(null)}
        />
      )}
    </div>
  );
}
