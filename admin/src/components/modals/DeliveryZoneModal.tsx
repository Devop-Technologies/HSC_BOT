'use client';

import { useState } from 'react';
import Overlay from './Overlay';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import type { DeliveryZone, DeliveryZoneForm } from '@/types/deliveryZones';

interface Props {
  mode: 'create' | 'edit';
  initial?: DeliveryZone;
  onClose: () => void;
  onSave: (form: DeliveryZoneForm) => Promise<void>;
}

export default function DeliveryZoneModal({ mode, initial, onClose, onSave }: Props) {
  const [form, setForm] = useState<DeliveryZoneForm>({
    label: initial?.label ?? initial?.district ?? '',
    min_km: initial?.min_km !== null && initial?.min_km !== undefined ? String(initial.min_km) : '0',
    base_fee: initial ? String(initial.base_fee ?? 0) : '0',
    fee_per_km: initial ? String(initial.fee_per_km ?? 0) : '0',
    max_km: initial?.max_km !== null && initial?.max_km !== undefined ? String(initial.max_km) : '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof DeliveryZoneForm>(key: K, value: DeliveryZoneForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const handle = async () => {
    if (!form.label.trim()) {
      setError('Band label is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onSave(form);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save delivery tariff band');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-lg rounded-xl p-6 space-y-4" style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}>
        <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {mode === 'create' ? 'Add Delivery Tariff Band' : 'Edit Delivery Tariff Band'}
        </h3>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          These are the live tariff bands used by the bot delivery quote engine after calculating customer distance.
        </p>
        {error && <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>}
        <Input label="Band label" value={form.label} onChange={(e) => set('label', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Min km" type="number" min="0" value={form.min_km} onChange={(e) => set('min_km', e.target.value)} />
          <Input label="Max km" type="number" min="0" value={form.max_km} onChange={(e) => set('max_km', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Base fee (SAR)" type="number" min="0" value={form.base_fee} onChange={(e) => set('base_fee', e.target.value)} />
          <Input label="Fee / km (SAR)" type="number" min="0" value={form.fee_per_km} onChange={(e) => set('fee_per_km', e.target.value)} />
        </div>
        <div className="rounded-lg p-3 text-xs space-y-1" style={{ background: 'var(--color-page-bg)', color: 'var(--color-text-secondary)' }}>
          <p>Formula: base fee + calculated distance × fee/km.</p>
          <p>Leave max km empty for the final open-ended band.</p>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handle} loading={loading}>Save</Button>
        </div>
      </div>
    </Overlay>
  );
}
