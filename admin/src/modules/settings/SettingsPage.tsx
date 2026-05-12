'use client';

import { useState, useEffect, useCallback } from 'react';
import { Save, RefreshCw, Plus, Pencil, Trash2, Phone, User, Clock, MapPin, AlertTriangle, CreditCard, Map } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Table, TableRow, Td } from '@/components/ui/Table';
import ConfirmModal from '@/components/modals/ConfirmModal';
import BusinessHoursModal from '@/components/modals/BusinessHoursModal';
import type { BusinessHours, BusinessHoursForm } from '@/types/settings';
import { formatTime, calcDuration } from '@/lib/helpers';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setBusinessHours, setLoading, setError } from '@/store/settingsSlice';

// ─── Tab config ───────────────────────────────────────────────

const TABS = [
  { key: 'business-hours', label: 'Business Hours', icon: Clock },
  { key: 'business-rules', label: 'Business Rules', icon: AlertTriangle },
  { key: 'faq',             label: 'FAQ',             icon: MapPin },
  { key: 'health-recs',     label: 'Health Recs',     icon: User },
  { key: 'delivery-zones',  label: 'Delivery Zones',  icon: Map },
];

// ─── Business Hours Tab ───────────────────────────────────────

const BH_HEADERS = ['Service Type', 'Mode', 'Open', 'Close', 'Duration', ''];

function BusinessHoursTab() {
  const dispatch = useAppDispatch();
  const { businessHours: hours, loading } = useAppSelector((s) => s.settings);
  const [modal, setModal]   = useState<{ open: boolean; mode: 'create' | 'edit'; data?: BusinessHours } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ message: string; onConfirm: () => Promise<void> } | null>(null);

  const load = useCallback(async () => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const res = await fetch('/api/business-hours');
      if (res.ok) dispatch(setBusinessHours(await res.json()));
    } catch {
      dispatch(setError('Failed to load business hours'));
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  useEffect(() => { load(); }, [load]);

  const save = async (form: BusinessHoursForm, id?: string) => {
    const payload = {
      service_type: form.service_type.trim().toLowerCase(),
      is_ramadan:   form.is_ramadan,
      open_time:    form.open_time  || null,
      close_time:   form.close_time || null,
    };
    const res = id
      ? await fetch(`/api/business-hours/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      : await fetch('/api/business-hours',        { method: 'POST',  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error((await res.json()).error);
    await load();
  };

  const deleteEntry = async (id: string) => {
    const res = await fetch(`/api/business-hours/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete');
    await load();
  };

  const grouped = hours.reduce<Record<string, BusinessHours[]>>((acc, h) => {
    const key = h.service_type ?? 'unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(h);
    return acc;
  }, {});

  const groupKeys = Object.keys(grouped);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Business Hours
          </h3>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Configure working hours per service type and season
          </p>
        </div>
        <Button leftIcon={<Plus size={15} />} onClick={() => setModal({ open: true, mode: 'create' })}
          className="self-start sm:self-auto">
          Add Hours
        </Button>
      </div>

      <Table headers={BH_HEADERS} loading={loading} isEmpty={hours.length === 0}
        emptyText="No business hours configured yet.">
        {groupKeys.map((serviceType) =>
          grouped[serviceType].map((h, i) => (
            <TableRow key={h.id} isLast={i === grouped[serviceType].length - 1 && serviceType === groupKeys.at(-1)}>
              <Td>
                {i === 0 ? (
                  <span className="text-sm font-semibold capitalize" style={{ color: 'var(--color-text-primary)' }}>
                    {serviceType}
                  </span>
                ) : (
                  <span style={{ color: 'var(--color-text-muted)' }}>↳</span>
                )}
              </Td>
              <Td>
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
                  style={h.is_ramadan
                    ? { background: 'var(--color-status-pending-bg)',   color: 'var(--color-status-pending-text)'   }
                    : { background: 'var(--color-status-confirmed-bg)', color: 'var(--color-status-confirmed-text)' }}>
                  {h.is_ramadan ? 'Ramadan' : 'Regular'}
                </span>
              </Td>
              <Td className="text-sm font-mono whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
                {formatTime(h.open_time)}
              </Td>
              <Td className="text-sm font-mono whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
                {formatTime(h.close_time)}
              </Td>
              <Td className="text-sm whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>
                {calcDuration(h.open_time, h.close_time)}
              </Td>
              <Td>
                <div className="flex items-center gap-1 justify-end">
                  <button onClick={() => setModal({ open: true, mode: 'edit', data: h })} title="Edit"
                    className="w-7 h-7 rounded-md flex items-center justify-center"
                    style={{ color: 'var(--color-text-muted)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-accent)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}>
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => setDeleteModal({ message: `Delete "${serviceType}" ${h.is_ramadan ? 'Ramadan' : 'Regular'} hours?`, onConfirm: () => deleteEntry(h.id) })}
                    title="Delete"
                    className="w-7 h-7 rounded-md flex items-center justify-center"
                    style={{ color: 'var(--color-text-muted)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-danger)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </Td>
            </TableRow>
          ))
        )}
      </Table>

      {modal?.open && (
        <BusinessHoursModal mode={modal.mode} initial={modal.data}
          onClose={() => setModal(null)}
          onSave={(form) => save(form, modal.data?.id)} />
      )}
      {deleteModal && (
        <ConfirmModal message={deleteModal.message}
          onConfirm={deleteModal.onConfirm}
          onClose={() => setDeleteModal(null)} />
      )}
    </div>
  );
}

// ─── Business Rules Tab ───────────────────────────────────────

interface SettingRow {
  key: string;
  value: string;
  value_ar: string | null;
  description: string | null;
}

const SETTING_GROUPS = [
  {
    label: 'Bot Identity',
    icon: User,
    keys: ['bot_name', 'business_name', 'business_tagline'],
  },
  {
    label: 'Contact & Location',
    icon: Phone,
    keys: ['contact_phone', 'center_location', 'center_coords_lat', 'center_coords_lng'],
  },
  {
    label: 'Booking Policy',
    icon: Clock,
    keys: ['booking_window_days', 'cancellation_hours', 'late_cancellation_minutes', 'travel_buffer_minutes', 'slot_hold_minutes'],
  },
  {
    label: 'Other',
    icon: CreditCard,
    keys: ['payment_method', 'women_only', 'pre_booking_required'],
  },
];

function BusinessRulesTab() {
  const [settings, setSettings] = useState<Record<string, SettingRow>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/business-settings');
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, SettingRow> = {};
        (data.rows || []).forEach((s: SettingRow) => { map[s.key] = s; });
        setSettings(map);
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveSetting = async (key: string, value: string, value_ar?: string) => {
    setSaving(key);
    setMessage(null);
    try {
      const res = await fetch(`/api/business-settings/${key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value, value_ar }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: `"${key}" saved!` });
        await load();
      } else {
        setMessage({ type: 'error', text: 'Failed to save' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Business Rules</h3>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          Configure bot behavior, policies, and business constants
        </p>
      </div>

      {message && (
        <div className="px-4 py-3 rounded-lg text-sm"
          style={{ background: message.type === 'success' ? 'var(--color-status-confirmed-bg)' : 'var(--color-status-cancelled-bg)', color: message.type === 'success' ? 'var(--color-status-confirmed-text)' : 'var(--color-status-cancelled-text)' }}>
          {message.text}
        </div>
      )}

      {SETTING_GROUPS.map((group) => {
        const GroupIcon = group.icon;
        return (
          <div key={group.label}
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--color-card-border)', background: 'var(--color-card-bg)' }}>
            <div className="px-4 py-3 flex items-center gap-2.5"
              style={{ borderBottom: '1px solid var(--color-card-border)', background: 'var(--color-input-bg)' }}>
              <GroupIcon size={15} style={{ color: 'var(--color-accent)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{group.label}</span>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--color-card-border)' }}>
              {group.keys.map((key) => {
                const setting = settings[key];
                if (!setting) return null;
                return (
                  <SettingRow
                    key={key}
                    setting={setting}
                    saving={saving === key}
                    onSave={(value, value_ar) => saveSetting(key, value, value_ar)}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SettingRow({ setting, saving, onSave }: { setting: SettingRow; saving: boolean; onSave: (value: string, value_ar?: string) => void }) {
  const [editValue, setEditValue] = useState(setting.value);
  const [editValueAr, setEditValueAr] = useState(setting.value_ar || '');
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    onSave(editValue, editValueAr || undefined);
    setIsEditing(false);
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            {setting.key.replace(/_/g, ' ')}
          </p>
          {setting.description && (
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}>
              {setting.description}
            </p>
          )}
        </div>
        <button
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          disabled={saving}
          className="text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap cursor-pointer transition-colors"
          style={{
            background: isEditing ? 'var(--color-accent)' : 'var(--color-accent-subtle)',
            color: isEditing ? '#fff' : 'var(--color-accent)',
          }}>
          {saving ? 'Saving...' : isEditing ? 'Save' : 'Edit'}
        </button>
      </div>

      {isEditing ? (
        <div className="mt-2 space-y-2">
          <div>
            <label className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--color-text-muted)' }}>English</label>
            <input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full mt-0.5 px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-primary)' }}
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--color-text-muted)' }}>Arabic</label>
            <input
              value={editValueAr}
              onChange={(e) => setEditValueAr(e.target.value)}
              className="w-full mt-0.5 px-3 py-2 rounded-lg text-sm outline-none"
              dir="rtl"
              style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-primary)' }}
              placeholder="Arabic value (optional)"
            />
          </div>
        </div>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-x-6 gap-y-1">
          <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
            {setting.value}
          </span>
          {setting.value_ar && (
            <span className="text-sm" dir="rtl" style={{ color: 'var(--color-text-secondary)' }}>
              {setting.value_ar}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── FAQ Tab ──────────────────────────────────────────────────

interface FaqItem {
  id: string;
  question_en: string;
  question_ar: string | null;
  answer_en: string;
  answer_ar: string | null;
  sort_order: number;
  is_active: boolean;
}

const FAQ_HEADERS = ['Question (EN)', 'Question (AR)', 'Sort', 'Status', ''];

function FaqTab() {
  const [items, setItems] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editForm, setEditForm] = useState<{ open: boolean; data?: FaqItem }>({ open: false });
  const [form, setForm] = useState({ question_en: '', question_ar: '', answer_en: '', answer_ar: '', sort_order: 0 });
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ id: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/faq');
      if (res.ok) setItems(await res.json());
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openForm = (data?: FaqItem) => {
    setForm(data ? { question_en: data.question_en, question_ar: data.question_ar || '', answer_en: data.answer_en, answer_ar: data.answer_ar || '', sort_order: data.sort_order } : { question_en: '', question_ar: '', answer_en: '', answer_ar: '', sort_order: 0 });
    setEditForm({ open: true, data });
  };

  const save = async () => {
    if (!form.question_en || !form.answer_en) return;
    setSaving(true);
    try {
      const isEdit = !!editForm.data;
      const url = isEdit ? `/api/faq/${editForm.data!.id}` : '/api/faq';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (res.ok) { setEditForm({ open: false }); await load(); }
    } catch {} finally { setSaving(false); }
  };

  const toggleActive = async (item: FaqItem) => {
    await fetch(`/api/faq/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !item.is_active }) });
    await load();
  };

  const deleteItem = async () => {
    if (!deleteModal) return;
    await fetch(`/api/faq/${deleteModal.id}`, { method: 'DELETE' });
    setDeleteModal(null);
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>FAQ</h3>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Manage frequently asked questions the bot uses</p>
        </div>
        <Button leftIcon={<Plus size={15} />} onClick={() => openForm()} className="self-start sm:self-auto">Add FAQ</Button>
      </div>

      <Table headers={FAQ_HEADERS} loading={loading} isEmpty={items.length === 0} emptyText="No FAQ items yet.">
        {items.map((item, i) => (
          <TableRow key={item.id} isLast={i === items.length - 1}>
            <Td><p className="text-sm truncate max-w-[200px]" style={{ color: 'var(--color-text-primary)' }}>{item.question_en}</p></Td>
            <Td><p className="text-sm truncate max-w-[200px] font-arabic" dir="rtl" style={{ color: 'var(--color-text-primary)' }}>{item.question_ar}</p></Td>
            <Td><span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{item.sort_order}</span></Td>
            <Td>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: item.is_active ? 'var(--color-status-confirmed-bg)' : 'var(--color-status-noshow-bg)', color: item.is_active ? 'var(--color-status-confirmed-text)' : 'var(--color-status-noshow-text)' }}>
                {item.is_active ? 'Active' : 'Inactive'}
              </span>
            </Td>
            <Td>
              <div className="flex items-center gap-1 justify-end">
                <button onClick={() => toggleActive(item)} className="w-7 h-7 flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}>
                  {item.is_active ? '✓' : '○'}
                </button>
                <button onClick={() => openForm(item)} className="w-7 h-7 flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}>
                  <Pencil size={14} />
                </button>
                <button onClick={() => setDeleteModal({ id: item.id })} className="w-7 h-7 flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </Td>
          </TableRow>
        ))}
      </Table>

      {/* Edit/Create Modal */}
      {editForm.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-xl w-full max-w-lg p-5 space-y-4"
            style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}>
            <h4 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {editForm.data ? 'Edit FAQ' : 'Add FAQ'}
            </h4>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Question (EN) *</label>
                <input value={form.question_en} onChange={e => setForm(f => ({ ...f, question_en: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-primary)' }} />
              </div>
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Question (AR)</label>
                <input value={form.question_ar} onChange={e => setForm(f => ({ ...f, question_ar: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none" dir="rtl"
                  style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-primary)' }} />
              </div>
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Answer (EN) *</label>
                <textarea value={form.answer_en} onChange={e => setForm(f => ({ ...f, answer_en: e.target.value }))} rows={3}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
                  style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-primary)' }} />
              </div>
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Answer (AR)</label>
                <textarea value={form.answer_ar} onChange={e => setForm(f => ({ ...f, answer_ar: e.target.value }))} rows={3}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y" dir="rtl"
                  style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-primary)' }} />
              </div>
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Sort Order</label>
                <input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                  className="w-24 px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-primary)' }} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditForm({ open: false })} className="px-4 py-2 text-sm rounded-lg"
                style={{ color: 'var(--color-text-muted)' }}>Cancel</button>
              <Button onClick={save} loading={saving}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {deleteModal && (
        <ConfirmModal message="Delete this FAQ item?" onConfirm={deleteItem} onClose={() => setDeleteModal(null)} />
      )}
    </div>
  );
}

// ─── Health Recommendations Tab ───────────────────────────────

interface HealthRecItem {
  id: string;
  keywords: string[];
  keywords_ar: string[];
  service_ids: string[];
  services: Array<{ id: string; name: string; name_ar: string; price: number }>;
  why_en: string;
  why_ar: string | null;
  warning_en: string | null;
  warning_ar: string | null;
  sort_order: number;
  is_active: boolean;
}

const REC_HEADERS = ['Condition (EN)', 'Condition (AR)', 'Services', 'Status', ''];

function HealthRecsTab() {
  const [items, setItems] = useState<HealthRecItem[]>([]);
  const [services, setServices] = useState<Array<{ id: string; name: string; name_ar: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [editForm, setEditForm] = useState<{ open: boolean; data?: HealthRecItem }>({ open: false });
  const [form, setForm] = useState({ keywords: '', keywords_ar: '', service_ids: [] as string[], why_en: '', why_ar: '', warning_en: '', warning_ar: '', sort_order: 0 });
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ id: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [recRes, svcRes] = await Promise.all([
        fetch('/api/health-recommendations'),
        fetch('/api/services'),
      ]);
      if (recRes.ok) setItems(await recRes.json());
      if (svcRes.ok) setServices(await svcRes.json());
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openForm = (data?: HealthRecItem) => {
    setForm(data ? {
      keywords: (data.keywords || []).join(', '),
      keywords_ar: (data.keywords_ar || []).join(', '),
      service_ids: data.service_ids || [],
      why_en: data.why_en,
      why_ar: data.why_ar || '',
      warning_en: data.warning_en || '',
      warning_ar: data.warning_ar || '',
      sort_order: data.sort_order,
    } : { keywords: '', keywords_ar: '', service_ids: [], why_en: '', why_ar: '', warning_en: '', warning_ar: '', sort_order: 0 });
    setEditForm({ open: true, data });
  };

  const toggleService = (id: string) => {
    setForm(f => ({
      ...f,
      service_ids: f.service_ids.includes(id) ? f.service_ids.filter(s => s !== id) : [...f.service_ids, id],
    }));
  };

  const save = async () => {
    if (!form.keywords || !form.why_en || !form.service_ids.length) return;
    setSaving(true);
    try {
      const payload = {
        keywords: form.keywords.split(',').map(k => k.trim()).filter(Boolean),
        keywords_ar: form.keywords_ar.split(',').map(k => k.trim()).filter(Boolean),
        service_ids: form.service_ids,
        why_en: form.why_en,
        why_ar: form.why_ar || undefined,
        warning_en: form.warning_en || undefined,
        warning_ar: form.warning_ar || undefined,
        sort_order: form.sort_order,
      };
      const isEdit = !!editForm.data;
      const url = isEdit ? `/api/health-recommendations/${editForm.data!.id}` : '/api/health-recommendations';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) { setEditForm({ open: false }); await load(); }
    } catch {} finally { setSaving(false); }
  };

  const toggleActive = async (item: HealthRecItem) => {
    await fetch(`/api/health-recommendations/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !item.is_active }),
    });
    await load();
  };

  const deleteItem = async () => {
    if (!deleteModal) return;
    await fetch(`/api/health-recommendations/${deleteModal.id}`, { method: 'DELETE' });
    setDeleteModal(null);
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Health Recommendations</h3>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Map health conditions to recommended services</p>
        </div>
        <Button leftIcon={<Plus size={15} />} onClick={() => openForm()} className="self-start sm:self-auto">Add Recommendation</Button>
      </div>

      <Table headers={REC_HEADERS} loading={loading} isEmpty={items.length === 0} emptyText="No recommendations yet.">
        {items.map((item, i) => (
          <TableRow key={item.id} isLast={i === items.length - 1}>
            <Td><p className="text-sm truncate max-w-[180px]" style={{ color: 'var(--color-text-primary)' }}>{item.keywords?.slice(0, 3).join(', ')}{item.keywords?.length > 3 ? '...' : ''}</p></Td>
            <Td><p className="text-sm truncate max-w-[180px] font-arabic" dir="rtl" style={{ color: 'var(--color-text-primary)' }}>{item.keywords_ar?.slice(0, 3).join(', ')}{item.keywords_ar?.length > 3 ? '...' : ''}</p></Td>
            <Td><span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{(item.services || []).map(s => s.name).join(', ')}</span></Td>
            <Td>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: item.is_active ? 'var(--color-status-confirmed-bg)' : 'var(--color-status-noshow-bg)', color: item.is_active ? 'var(--color-status-confirmed-text)' : 'var(--color-status-noshow-text)' }}>
                {item.is_active ? 'Active' : 'Inactive'}
              </span>
            </Td>
            <Td>
              <div className="flex items-center gap-1 justify-end">
                <button onClick={() => openForm(item)} className="w-7 h-7 flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}>
                  <Pencil size={14} />
                </button>
                <button onClick={() => setDeleteModal({ id: item.id })} className="w-7 h-7 flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </Td>
          </TableRow>
        ))}
      </Table>

      {editForm.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-xl w-full max-w-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}>
            <h4 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {editForm.data ? 'Edit Recommendation' : 'Add Recommendation'}
            </h4>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Keywords (EN) * <span className="text-[10px]">(comma-separated)</span></label>
                  <textarea value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} rows={2}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
                    style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Keywords (AR) <span className="text-[10px]">(comma-separated)</span></label>
                  <textarea value={form.keywords_ar} onChange={e => setForm(f => ({ ...f, keywords_ar: e.target.value }))} rows={2}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y" dir="rtl"
                    style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-primary)' }} />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Linked Services *</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {services.map(s => (
                    <button key={s.id}
                      onClick={() => toggleService(s.id)}
                      className="text-xs px-3 py-1.5 rounded-full cursor-pointer transition-colors"
                      style={{
                        background: form.service_ids.includes(s.id) ? 'var(--color-accent)' : 'var(--color-input-bg)',
                        color: form.service_ids.includes(s.id) ? '#fff' : 'var(--color-text-secondary)',
                        border: '1px solid var(--color-input-border)',
                      }}>
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Why (EN) *</label>
                  <textarea value={form.why_en} onChange={e => setForm(f => ({ ...f, why_en: e.target.value }))} rows={2}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
                    style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Why (AR)</label>
                  <textarea value={form.why_ar} onChange={e => setForm(f => ({ ...f, why_ar: e.target.value }))} rows={2}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y" dir="rtl"
                    style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-primary)' }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Warning (EN)</label>
                  <textarea value={form.warning_en} onChange={e => setForm(f => ({ ...f, warning_en: e.target.value }))} rows={2}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
                    style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Warning (AR)</label>
                  <textarea value={form.warning_ar} onChange={e => setForm(f => ({ ...f, warning_ar: e.target.value }))} rows={2}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y" dir="rtl"
                    style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-primary)' }} />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Sort Order</label>
                <input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                  className="w-24 px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-primary)' }} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditForm({ open: false })} className="px-4 py-2 text-sm rounded-lg" style={{ color: 'var(--color-text-muted)' }}>Cancel</button>
              <Button onClick={save} loading={saving}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {deleteModal && (
        <ConfirmModal message="Delete this health recommendation?" onConfirm={deleteItem} onClose={() => setDeleteModal(null)} />
      )}
    </div>
  );
}

// ─── Delivery Tariff Bands Tab ───────────────────────────────

interface DeliveryZone {
  id: string;
  label?: string;
  district: string;
  min_km: number;
  base_fee: number;
  fee_per_km: number;
  max_km: number | null;
  is_active: boolean;
}

const ZONE_HEADERS = ['Band', 'Distance', 'Base Fee', 'Fee/km', 'Status', ''];

function DeliveryZonesTab() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [editForm, setEditForm] = useState<{ open: boolean; data?: DeliveryZone }>({ open: false });
  const [form, setForm] = useState({ label: '', min_km: '0', base_fee: 0, fee_per_km: 0, max_km: '' });
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ id: string; label: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery-zones');
      if (res.ok) setZones(await res.json());
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openForm = (data?: DeliveryZone) => {
    setForm(data ? {
      label: data.label ?? data.district,
      min_km: data.min_km !== null && data.min_km !== undefined ? String(data.min_km) : '0',
      base_fee: data.base_fee,
      fee_per_km: data.fee_per_km,
      max_km: data.max_km !== null && data.max_km !== undefined ? String(data.max_km) : '',
    } : { label: '', min_km: '0', base_fee: 0, fee_per_km: 0, max_km: '' });
    setEditForm({ open: true, data });
  };

  const save = async () => {
    if (!form.label.trim()) return;
    setSaving(true);
    try {
      const payload = {
        label: form.label,
        min_km: Number(form.min_km || 0),
        base_fee: form.base_fee,
        fee_per_km: form.fee_per_km,
        max_km: form.max_km !== '' ? Number(form.max_km) : null,
      };
      const isEdit = !!editForm.data;
      const url = isEdit ? `/api/delivery-zones/${editForm.data!.id}` : '/api/delivery-zones';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) { setEditForm({ open: false }); await load(); }
    } catch {} finally { setSaving(false); }
  };

  const toggleActive = async (z: DeliveryZone) => {
    await fetch(`/api/delivery-zones/${z.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !z.is_active }) });
    await load();
  };

  const deleteZone = async () => {
    if (!deleteModal) return;
    await fetch(`/api/delivery-zones/${deleteModal.id}`, { method: 'DELETE' });
    setDeleteModal(null);
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Delivery Tariff Bands</h3>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Configure the live distance bands used by bot delivery quotes.</p>
        </div>
        <Button leftIcon={<Plus size={15} />} onClick={() => openForm()} className="self-start sm:self-auto">Add Band</Button>
      </div>

      <Table headers={ZONE_HEADERS} loading={loading} isEmpty={zones.length === 0} emptyText="No delivery tariff bands configured.">
        {zones.map((z, i) => (
          <TableRow key={z.id} isLast={i === zones.length - 1}>
            <Td><span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{z.label ?? z.district}</span></Td>
            <Td><span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{Number(z.min_km ?? 0).toLocaleString()}–{z.max_km !== null ? Number(z.max_km).toLocaleString() : '∞'} km</span></Td>
            <Td><span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>SAR {Number(z.base_fee).toLocaleString()}</span></Td>
            <Td><span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{Number(z.fee_per_km).toLocaleString()} SAR</span></Td>
            <Td>
              <button onClick={() => toggleActive(z)} className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: z.is_active ? 'var(--color-status-confirmed-bg)' : 'var(--color-status-noshow-bg)', color: z.is_active ? 'var(--color-status-confirmed-text)' : 'var(--color-status-noshow-text)' }}>
                {z.is_active ? 'Active' : 'Inactive'}
              </button>
            </Td>
            <Td>
              <div className="flex items-center gap-1 justify-end">
                <button onClick={() => openForm(z)} className="w-7 h-7 flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}>
                  <Pencil size={14} />
                </button>
                <button onClick={() => setDeleteModal({ id: z.id, label: z.label ?? z.district })} className="w-7 h-7 flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </Td>
          </TableRow>
        ))}
      </Table>

      {editForm.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-xl w-full max-w-md p-5 space-y-4"
            style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}>
            <h4 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {editForm.data ? 'Edit Delivery Tariff Band' : 'Add Delivery Tariff Band'}
            </h4>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>This writes to the same tariff-band destination used by the runtime quote engine.</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Band label *</label>
                <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-primary)' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Min km</label>
                  <input type="number" value={form.min_km} onChange={e => setForm(f => ({ ...f, min_km: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Max km</label>
                  <input type="number" value={form.max_km} onChange={e => setForm(f => ({ ...f, max_km: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-primary)' }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Base Fee (SAR)</label>
                  <input type="number" value={form.base_fee} onChange={e => setForm(f => ({ ...f, base_fee: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Fee/km</label>
                  <input type="number" value={form.fee_per_km} onChange={e => setForm(f => ({ ...f, fee_per_km: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-primary)' }} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditForm({ open: false })} className="px-4 py-2 text-sm rounded-lg" style={{ color: 'var(--color-text-muted)' }}>Cancel</button>
              <Button onClick={save} loading={saving}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {deleteModal && (
        <ConfirmModal message={`Delete ${deleteModal.label}?`} onConfirm={deleteZone} onClose={() => setDeleteModal(null)} />
      )}
    </div>
  );
}

// ─── Settings Page (Main) ─────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('business-hours');

  const activeTabConfig = TABS.find(t => t.key === activeTab) || TABS[0];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Settings</h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          Manage your system configuration
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start">
        {/* Sidebar tabs */}
        <div className="w-full sm:w-52 flex-shrink-0 rounded-xl overflow-hidden"
          style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}>
          <div className="p-1.5 space-y-0.5">
            {TABS.map((tab) => {
              const active = activeTab === tab.key;
              const Icon = tab.icon;
              return (
                <button key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors cursor-pointer"
                  style={{
                    background: active ? 'var(--color-accent)' : 'transparent',
                    color: active ? '#fff' : 'var(--color-text-secondary)',
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--color-input-bg)'; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                  <Icon size={15} className="flex-shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          {activeTab === 'business-hours' && <BusinessHoursTab />}
          {activeTab === 'business-rules' && <BusinessRulesTab />}
          {activeTab === 'faq' && <FaqTab />}
          {activeTab === 'health-recs' && <HealthRecsTab />}
          {activeTab === 'delivery-zones' && <DeliveryZonesTab />}
        </div>
      </div>
    </div>
  );
}
