'use client';

import { useState } from 'react';
import { ToggleLeft, ToggleRight } from 'lucide-react';
import Overlay from './Overlay';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import type { BusinessHours, BusinessHoursForm } from '@/types/settings';

export type { BusinessHours, BusinessHoursForm };

interface BusinessHoursModalProps {
  mode: 'create' | 'edit';
  initial?: BusinessHours;
  onClose: () => void;
  onSave: (form: BusinessHoursForm) => Promise<void>;
}

// ─── BusinessHoursModal ───────────────────────────────────────

export default function BusinessHoursModal({
  mode,
  initial,
  onClose,
  onSave,
}: BusinessHoursModalProps) {
  const [form, setForm] = useState<BusinessHoursForm>(
    initial
      ? {
          service_type: initial.service_type ?? '',
          is_ramadan: initial.is_ramadan ?? false,
          open_time: initial.open_time ?? '',
          close_time: initial.close_time ?? '',
        }
      : {
          service_type: '',
          is_ramadan: false,
          open_time: '',
          close_time: '',
        }
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof BusinessHoursForm>(key: K, value: BusinessHoursForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handle = async () => {
    if (!form.service_type.trim()) {
      setError('Service type is required');
      return;
    }
    if (!form.open_time || !form.close_time) {
      setError('Open and close times are required');
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
        className="w-full max-w-sm rounded-xl p-6 space-y-4"
        style={{
          background: 'var(--color-card-bg)',
          border: '1px solid var(--color-card-border)',
        }}
      >
        <h3
          className="text-base font-semibold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {mode === 'create' ? 'Add Business Hours' : 'Edit Business Hours'}
        </h3>

        {error && (
          <p className="text-xs" style={{ color: 'var(--color-danger)' }}>
            {error}
          </p>
        )}

        {/* Service Type */}
        <Input
          label="Service Type"
          value={form.service_type}
          onChange={(e) => set('service_type', e.target.value)}
          placeholder="e.g. home, center"
          hint="Must be unique per mode (Regular / Ramadan)"
        />

        {/* Ramadan Toggle */}
        <div
          className="flex items-center justify-between rounded-lg px-4 py-3"
          style={{
            background: 'var(--color-input-bg)',
            border: '1px solid var(--color-input-border)',
          }}
        >
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Ramadan Hours
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Toggle on for Ramadan schedule
            </p>
          </div>
          <button
            type="button"
            onClick={() => set('is_ramadan', !form.is_ramadan)}
            className="cursor-pointer"
            style={{
              color: form.is_ramadan ? 'var(--color-accent)' : 'var(--color-text-muted)',
            }}
          >
            {form.is_ramadan ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
          </button>
        </div>

        {/* Times */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Open Time"
            type="time"
            value={form.open_time}
            onChange={(e) => set('open_time', e.target.value)}
          />
          <Input
            label="Close Time"
            type="time"
            value={form.close_time}
            onChange={(e) => set('close_time', e.target.value)}
          />
        </div>

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
