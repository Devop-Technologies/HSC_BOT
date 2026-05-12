'use client';

import { useState, useEffect } from 'react';
import { ToggleLeft, ToggleRight } from 'lucide-react';
import Overlay from './Overlay';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import type { Therapist, TherapistService, TherapistForm } from '@/types/providers';

export type { Therapist, TherapistService, TherapistForm };

interface AllService {
  id: string;
  name: string;
  name_ar: string | null;
  is_active: boolean | null;
}

interface TherapistModalProps {
  mode: 'create' | 'edit';
  initial?: Therapist;
  onClose: () => void;
  onSave: (form: TherapistForm) => Promise<void>;
}

// ─── ToggleRow ────────────────────────────────────────────────

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
        {label}
      </span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className="cursor-pointer"
        style={{ color: value ? 'var(--color-success)' : 'var(--color-text-muted)' }}
      >
        {value ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
      </button>
    </div>
  );
}

// ─── TherapistModal ───────────────────────────────────────────

export default function TherapistModal({
  mode,
  initial,
  onClose,
  onSave,
}: TherapistModalProps) {
  const initialServiceIds = initial?.services.map((s) => s.service_id) ?? [];

  const [form, setForm] = useState<TherapistForm>(
    initial
      ? {
          full_name: initial.full_name ?? '',
          gender: initial.gender ?? '',
          whatsapp_number: initial.whatsapp_number ?? '',
          email: initial.email ?? '',
          is_licensed: initial.is_licensed ?? false,
          is_active: initial.is_active ?? true,
          max_slots_per_day:
            initial.max_slots_per_day !== null ? String(initial.max_slots_per_day) : '6',
          home_district: initial.home_district ?? '',
          home_address: initial.home_address ?? '',
          notes: initial.notes ?? '',
          service_ids: initialServiceIds,
        }
      : {
          full_name: '',
          gender: '',
          whatsapp_number: '',
          email: '',
          is_licensed: false,
          is_active: true,
          max_slots_per_day: '6',
          home_district: '',
          home_address: '',
          notes: '',
          service_ids: [],
        }
  );

  const [allServices, setAllServices] = useState<AllService[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/services')
      .then((r) => r.json())
      .then((data: AllService[]) => setAllServices(data))
      .catch(() => {});
  }, []);

  const set = <K extends keyof TherapistForm>(key: K, value: TherapistForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleService = (id: string) => {
    setForm((f) => ({
      ...f,
      service_ids: f.service_ids.includes(id)
        ? f.service_ids.filter((s) => s !== id)
        : [...f.service_ids, id],
    }));
  };

  const handle = async () => {
    if (!form.full_name.trim()) {
      setError('Full name is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onSave(form);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <div
        className="w-full max-w-lg rounded-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{
          background: 'var(--color-card-bg)',
          border: '1px solid var(--color-card-border)',
        }}
      >
        <h3
          className="text-base font-semibold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {mode === 'create' ? 'Add Provider' : 'Edit Provider'}
        </h3>

        {error && (
          <p className="text-xs" style={{ color: 'var(--color-danger)' }}>
            {error}
          </p>
        )}

        {/* Name */}
        <Input
          label="Full Name"
          value={form.full_name}
          onChange={(e) => set('full_name', e.target.value)}
        />

        {/* Gender + WhatsApp */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label
              className="text-sm font-medium"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Gender
            </label>
            <select
              value={form.gender}
              onChange={(e) => set('gender', e.target.value)}
              className="w-full rounded-lg text-sm outline-none px-4 py-2.5"
              style={{
                background: 'var(--color-input-bg)',
                border: '1px solid var(--color-input-border)',
                color: 'var(--color-text-primary)',
              }}
            >
              <option value="">Select…</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          <Input
            label="WhatsApp Number"
            value={form.whatsapp_number}
            onChange={(e) => set('whatsapp_number', e.target.value)}
            placeholder="+966…"
          />
        </div>

        {/* Email */}
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          placeholder="provider@example.com"
        />

        {/* Slots/Day + District */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Max Slots / Day"
            type="number"
            min="1"
            value={form.max_slots_per_day}
            onChange={(e) => set('max_slots_per_day', e.target.value)}
          />
          <Input
            label="Home District"
            value={form.home_district}
            onChange={(e) => set('home_district', e.target.value)}
          />
        </div>

        {/* Home Address */}
        <Input
          label="Home Address"
          value={form.home_address}
          onChange={(e) => set('home_address', e.target.value)}
        />

        {/* Toggles */}
        <div
          className="rounded-lg px-4 py-3 space-y-3"
          style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)' }}
        >
          <ToggleRow
            label="Licensed"
            value={form.is_licensed}
            onChange={(v) => set('is_licensed', v)}
          />
          <ToggleRow
            label="Active"
            value={form.is_active}
            onChange={(v) => set('is_active', v)}
          />
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-sm font-medium"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Notes
          </label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            className="w-full rounded-lg text-sm outline-none px-4 py-2.5 resize-none"
            style={{
              background: 'var(--color-input-bg)',
              border: '1px solid var(--color-input-border)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>

        {/* Service Capability Mapping */}
        {allServices.length > 0 && (
          <div className="flex flex-col gap-2">
            <label
              className="text-sm font-medium"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Service Capabilities
            </label>
            <div
              className="rounded-lg px-4 py-3 space-y-2.5 max-h-44 overflow-y-auto"
              style={{
                background: 'var(--color-input-bg)',
                border: '1px solid var(--color-input-border)',
              }}
            >
              {allServices.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2.5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={form.service_ids.includes(s.id)}
                    onChange={() => toggleService(s.id)}
                    style={{ accentColor: 'var(--color-accent)', width: 14, height: 14 }}
                  />
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {s.name}
                    {s.name_ar && (
                      <span
                        className="ml-2 text-xs"
                        style={{ color: 'var(--color-text-muted)' }}
                        dir="rtl"
                      >
                        {s.name_ar}
                      </span>
                    )}
                  </span>
                  {s.is_active === false && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{
                        background: 'var(--color-status-noshow-bg)',
                        color: 'var(--color-status-noshow-text)',
                      }}
                    >
                      Inactive
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handle} loading={loading}>
            Save
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
