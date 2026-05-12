'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  Star, BadgeCheck, Phone, Mail, X, ChevronRight,
  MapPin, User, Briefcase, Home, StickyNote,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { Table, TableRow, Td } from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import ConfirmModal from '@/components/modals/ConfirmModal';
import TherapistModal from '@/components/modals/TherapistModal';
import type { Therapist, TherapistForm } from '@/types/providers';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setProviders, setLoading, setError } from '@/store/providersSlice';

// ─── Constants ────────────────────────────────────────────────

const PAGE_SIZE = 10;
const TABLE_HEADERS = ['Provider', 'Rating', 'Bookings', 'Status', ''];

// ─── Helpers ──────────────────────────────────────────────────

function providerInitials(name: string | null, phone: string | null) {
  if (name) return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  if (phone) return phone.slice(-2);
  return '??';
}

// ─── Provider Profile Panel ───────────────────────────────────

function ProviderProfilePanel({
  therapist,
  onClose,
  onEdit,
}: {
  therapist: Therapist;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [tab, setTab] = useState<'info' | 'services'>('info');
  const t = therapist as Therapist & { avg_rating?: number; ratings_count?: number; total_bookings?: number };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 flex flex-col w-full max-w-md"
        style={{
          background: 'var(--color-card-bg)',
          borderLeft: '1px solid var(--color-card-border)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-4 px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--color-card-border)' }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
          >
            {providerInitials(t.full_name, t.whatsapp_number)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                {t.full_name ?? 'Unknown'}
              </p>
              {t.is_licensed && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                  style={{ background: 'var(--color-status-confirmed-bg)', color: 'var(--color-status-confirmed-text)' }}
                >
                  <BadgeCheck size={10} /> Licensed
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {t.whatsapp_number ?? 'No phone'}
              {t.gender ? ` · ${t.gender.charAt(0).toUpperCase() + t.gender.slice(1)}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onEdit}
              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
              style={{ color: 'var(--color-text-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-input-bg)'; e.currentTarget.style.color = 'var(--color-accent)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
              style={{ color: 'var(--color-text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-input-bg)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div
          className="grid grid-cols-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--color-card-border)' }}
        >
          {[
            { label: 'Bookings', value: t.total_bookings ?? 0 },
            { label: 'Avg Rating', value: t.avg_rating != null ? `★ ${Number(t.avg_rating).toFixed(1)}` : '—' },
            { label: 'Reviews', value: (t as any).ratings_count ?? 0 },
            { label: 'Slots/Day', value: t.max_slots_per_day ?? '—' },
          ].map((s, idx) => (
            <div
              key={s.label}
              className="flex flex-col items-center py-3 px-2 text-center"
              style={{ borderRight: idx < 3 ? '1px solid var(--color-card-border)' : 'none' }}
            >
              <span className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
                {s.value}
              </span>
              <span className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex flex-shrink-0 px-4 pt-3 gap-1">
          {(['info', 'services'] as const).map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className="px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer capitalize transition-colors"
              style={{
                background: tab === tabKey ? 'var(--color-accent)' : 'transparent',
                color: tab === tabKey ? '#fff' : 'var(--color-text-muted)',
              }}
            >
              {tabKey === 'info' ? 'Info & Details' : `Services (${t.services.length})`}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">

          {/* ── Info Tab ── */}
          {tab === 'info' && (
            <div className="space-y-3">

              {/* Status badge */}
              <div
                className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)' }}
              >
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Status</span>
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{
                    background: t.is_active ? 'var(--color-status-confirmed-bg)' : 'var(--color-status-noshow-bg)',
                    color: t.is_active ? 'var(--color-status-confirmed-text)' : 'var(--color-status-noshow-text)',
                  }}
                >
                  {t.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Info rows */}
              {[
                { icon: <User size={14} />, label: 'Gender', value: t.gender ? t.gender.charAt(0).toUpperCase() + t.gender.slice(1) : null },
                { icon: <BadgeCheck size={14} />, label: 'Licensed', value: t.is_licensed ? 'Yes' : 'No' },
                { icon: <Phone size={14} />, label: 'WhatsApp', value: t.whatsapp_number },
                { icon: <Mail size={14} />, label: 'Email', value: t.email },
                { icon: <MapPin size={14} />, label: 'District', value: t.home_district },
                { icon: <Home size={14} />, label: 'Home Address', value: t.home_address },
              ].map(({ icon, label, value }) => value ? (
                <div
                  key={label}
                  className="flex items-start gap-3 rounded-xl px-4 py-3"
                  style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)' }}
                >
                  <span className="mt-0.5 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>{icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] uppercase tracking-wide font-medium" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
                    <p className="text-sm mt-0.5 break-words" style={{ color: 'var(--color-text-secondary)' }}>{value}</p>
                  </div>
                </div>
              ) : null)}

              {/* Notes */}
              {t.notes && (
                <div
                  className="flex items-start gap-3 rounded-xl px-4 py-3"
                  style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)' }}
                >
                  <span className="mt-0.5 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}><StickyNote size={14} /></span>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide font-medium" style={{ color: 'var(--color-text-muted)' }}>Notes</p>
                    <p className="text-sm mt-0.5 whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>{t.notes}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Services Tab ── */}
          {tab === 'services' && (
            t.services.length === 0 ? (
              <div className="text-center py-16">
                <Briefcase size={32} style={{ color: 'var(--color-text-muted)', margin: '0 auto 8px' }} />
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No services assigned</p>
              </div>
            ) : (
              <div className="space-y-2">
                {t.services.map((s) => (
                  <div
                    key={s.service_id}
                    className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
                    style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)' }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{s.name}</p>
                      {s.name_ar && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }} dir="rtl">{s.name_ar}</p>
                      )}
                    </div>
                    {s.is_active === false && (
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: 'var(--color-status-noshow-bg)', color: 'var(--color-status-noshow-text)' }}
                      >
                        Inactive
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function ProvidersPage() {
  const dispatch     = useAppDispatch();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const { items: therapists, loading } = useAppSelector((s) => s.providers);
  const [page, setPage] = useState(1);

  const [modal, setModal] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    data?: Therapist;
  } | null>(null);

  const [deleteModal, setDeleteModal] = useState<{
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const [profileTherapist, setProfile] = useState<Therapist | null>(null);

  // ── Load ──────────────────────────────────────────────────

  const load = useCallback(async () => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const res = await fetch('/api/therapists');
      if (res.ok) {
        dispatch(setProviders(await res.json()));
        setPage(1);
      }
    } catch {
      dispatch(setError('Failed to load providers'));
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  useEffect(() => { load(); }, [load]);

  // Auto-open profile from ?open=UUID (e.g. navigated from Logs)
  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId || !therapists.length) return;
    const found = therapists.find((t) => t.id === openId);
    if (found) {
      setProfile(found);
      router.replace('/providers', { scroll: false });
    }
  }, [searchParams, therapists, router]);

  // ── CRUD ──────────────────────────────────────────────────

  const saveTherapist = async (form: TherapistForm, id?: string) => {
    const payload = {
      full_name: form.full_name,
      gender: form.gender || null,
      whatsapp_number: form.whatsapp_number || null,
      email: form.email || null,
      is_licensed: form.is_licensed,
      is_active: form.is_active,
      max_slots_per_day: form.max_slots_per_day !== '' ? Number(form.max_slots_per_day) : 6,
      home_district: form.home_district || null,
      home_address: form.home_address || null,
      notes: form.notes || null,
      service_ids: form.service_ids,
    };

    const res = id
      ? await fetch(`/api/therapists/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      : await fetch('/api/therapists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

    if (!res.ok) throw new Error((await res.json()).error);
    await load();
  };

  const toggleActive = async (t: Therapist) => {
    await fetch(`/api/therapists/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !t.is_active }),
    });
    await load();
  };

  const deleteTherapist = async (id: string) => {
    const res = await fetch(`/api/therapists/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete');
    await load();
  };

  // ── Pagination ────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(therapists.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = therapists.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const from = therapists.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE, therapists.length);

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Providers</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {therapists.length} providers
          </p>
        </div>
        <Button
          leftIcon={<Plus size={15} />}
          onClick={() => setModal({ open: true, mode: 'create' })}
          className="self-start sm:self-auto"
        >
          Add Provider
        </Button>
      </div>

      {/* Table */}
      <Table
        headers={TABLE_HEADERS}
        loading={loading}
        isEmpty={therapists.length === 0}
        emptyText="No providers yet. Add your first provider to get started."
        footer={
          <Pagination
            page={safePage} totalPages={totalPages} total={therapists.length}
            from={from} to={to} onPageChange={setPage} itemLabel="provider"
          />
        }
      >
        {paginated.map((t, i) => (
          <TableRow key={t.id} isLast={i === paginated.length - 1}>

            {/* Provider */}
            <Td>
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'var(--color-accent)', color: '#fff' }}
                >
                  {providerInitials(t.full_name, t.whatsapp_number)}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {t.full_name ?? '—'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {t.whatsapp_number ?? (t.gender ? t.gender.charAt(0).toUpperCase() + t.gender.slice(1) : 'No phone')}
                  </p>
                </div>
              </div>
            </Td>

            {/* Rating */}
            <Td className="whitespace-nowrap">
              {(t as any).avg_rating != null ? (
                <div className="flex items-center gap-1">
                  <Star size={13} fill="#f59e0b" stroke="#f59e0b" />
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    {Number((t as any).avg_rating).toFixed(1)}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    ({(t as any).ratings_count})
                  </span>
                </div>
              ) : (
                <span style={{ color: 'var(--color-text-muted)' }}>—</span>
              )}
            </Td>

            {/* Bookings */}
            <Td>
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                {(t as any).total_bookings ?? 0}
              </span>
            </Td>

            {/* Status */}
            <Td>
              <button
                onClick={() => toggleActive(t)}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium cursor-pointer transition-opacity"
                style={{
                  background: t.is_active ? 'var(--color-status-confirmed-bg)' : 'var(--color-status-noshow-bg)',
                  color: t.is_active ? 'var(--color-status-confirmed-text)' : 'var(--color-status-noshow-text)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                title={t.is_active ? 'Click to deactivate' : 'Click to activate'}
              >
                {t.is_active ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                {t.is_active ? 'Active' : 'Inactive'}
              </button>
            </Td>

            {/* Actions */}
            <Td>
              <div className="flex items-center gap-1 justify-end">
                <button
                  onClick={() => setProfile(t)}
                  className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg cursor-pointer whitespace-nowrap transition-opacity"
                  style={{ color: 'var(--color-accent)', background: 'var(--color-accent-subtle)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                >
                  View Profile <ChevronRight size={12} />
                </button>

                <button
                  onClick={() => setModal({ open: true, mode: 'edit', data: t })}
                  title="Edit"
                  className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer"
                  style={{ color: 'var(--color-text-muted)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-accent)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
                >
                  <Pencil size={14} />
                </button>

                <button
                  onClick={() => setDeleteModal({
                    message: `Delete "${t.full_name}"? This action cannot be undone.`,
                    onConfirm: () => deleteTherapist(t.id),
                  })}
                  title="Delete"
                  className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer"
                  style={{ color: 'var(--color-text-muted)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-danger)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </Td>

          </TableRow>
        ))}
      </Table>

      {/* Provider Profile Drawer */}
      {profileTherapist && (
        <ProviderProfilePanel
          therapist={profileTherapist}
          onClose={() => setProfile(null)}
          onEdit={() => {
            setModal({ open: true, mode: 'edit', data: profileTherapist });
            setProfile(null);
          }}
        />
      )}

      {/* Therapist Modal */}
      {modal?.open && (
        <TherapistModal
          mode={modal.mode}
          initial={modal.data}
          onClose={() => setModal(null)}
          onSave={(form) => saveTherapist(form, modal.data?.id)}
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
