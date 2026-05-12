'use client';

import { useState, useEffect } from 'react';
import Overlay from './Overlay';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import type { RescheduleBooking, RescheduleForm } from '@/types/bookings';

export type { RescheduleBooking, RescheduleForm };

interface Therapist {
  id: string;
  full_name: string | null;
  is_active: boolean | null;
}

interface RescheduleModalProps {
  booking: RescheduleBooking;
  onClose: () => void;
  onSave: (form: RescheduleForm) => Promise<void>;
}

// ─── RescheduleModal ──────────────────────────────────────────

export default function RescheduleModal({ booking, onClose, onSave }: RescheduleModalProps) {
  const [form, setForm] = useState<RescheduleForm>({
    booking_date: booking.booking_date ?? '',
    start_time: booking.start_time?.slice(0, 5) ?? '',
    end_time: booking.end_time?.slice(0, 5) ?? '',
    therapist_id: booking.therapist_id ?? '',
  });

  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/therapists')
      .then((r) => r.json())
      .then((data: Therapist[]) =>
        setTherapists(data.filter((t) => t.is_active !== false))
      )
      .catch(() => {});
  }, []);

  const set = <K extends keyof RescheduleForm>(key: K, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handle = async () => {
    if (!form.booking_date) { setError('Date is required'); return; }
    if (!form.start_time)   { setError('Start time is required'); return; }
    setLoading(true);
    setError('');
    try {
      await onSave(form);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to reschedule');
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
        <div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Reschedule Booking
          </h3>
          {booking.customer?.full_name && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {booking.customer.full_name}
            </p>
          )}
        </div>

        {error && (
          <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>
        )}

        <Input
          label="New Date"
          type="date"
          value={form.booking_date}
          onChange={(e) => set('booking_date', e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Start Time"
            type="time"
            value={form.start_time}
            onChange={(e) => set('start_time', e.target.value)}
          />
          <Input
            label="End Time"
            type="time"
            value={form.end_time}
            onChange={(e) => set('end_time', e.target.value)}
          />
        </div>

        {/* Therapist */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Therapist
          </label>
          <select
            value={form.therapist_id}
            onChange={(e) => set('therapist_id', e.target.value)}
            className="w-full rounded-lg text-sm outline-none px-4 py-2.5"
            style={{
              background: 'var(--color-input-bg)',
              border: '1px solid var(--color-input-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            <option value="">— Keep current —</option>
            {therapists.map((t) => (
              <option key={t.id} value={t.id}>{t.full_name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handle} loading={loading}>Save</Button>
        </div>
      </div>
    </Overlay>
  );
}
