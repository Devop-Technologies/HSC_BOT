'use client';

import { useState } from 'react';
import Overlay from './Overlay';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import type { Driver, DriverForm } from '@/types/drivers';

export type { Driver, DriverForm };

interface DriverModalProps {
  mode: 'create' | 'edit';
  initial?: Driver;
  onClose: () => void;
  onSave: (form: DriverForm) => Promise<void>;
}

export default function DriverModal({ mode, initial, onClose, onSave }: DriverModalProps) {
  const [form, setForm] = useState<DriverForm>(
    initial
      ? { name: initial.name, phone_number: initial.phone_number ?? '' }
      : { name: '', phone_number: '' }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof DriverForm>(key: K, value: DriverForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handle = async () => {
    if (!form.name.trim()) {
      setError('Driver name is required');
      return;
    }
    if (!form.phone_number.trim()) {
      setError('Phone number is required');
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
        className="w-full max-w-lg rounded-xl p-8 space-y-5"
        style={{
          background: 'var(--color-card-bg)',
          border: '1px solid var(--color-card-border)',
        }}
      >
        <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {mode === 'create' ? 'Add Driver' : 'Edit Driver'}
        </h3>

        {error && (
          <p className="text-xs" style={{ color: 'var(--color-danger)' }}>
            {error}
          </p>
        )}

        <Input
          label="Driver Name"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Full name"
        />

        <Input
          label="Phone Number"
          type="tel"
          value={form.phone_number}
          onChange={(e) => {
            const filtered = e.target.value.replace(/[^0-9+\-\s()]/g, '');
            set('phone_number', filtered);
          }}
          placeholder="+966…"
        />

        <div className="flex gap-2 justify-end pt-1">
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
