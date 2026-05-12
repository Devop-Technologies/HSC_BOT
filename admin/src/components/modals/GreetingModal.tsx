'use client';

import { useState } from 'react';
import Overlay from './Overlay';
import Button from '@/components/ui/Button';

export interface GreetingForm {
  message_en: string;
  message_ar: string;
}

interface GreetingModalProps {
  mode: 'create' | 'edit';
  initial?: Partial<GreetingForm>;
  onClose: () => void;
  onSave: (form: GreetingForm) => Promise<void>;
}

export default function GreetingModal({ mode, initial, onClose, onSave }: GreetingModalProps) {
  const [form, setForm] = useState<GreetingForm>(
    initial
      ? { message_en: initial.message_en ?? '', message_ar: initial.message_ar ?? '' }
      : { message_en: '', message_ar: '' }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handle = async () => {
    if (!form.message_en.trim() || !form.message_ar.trim()) {
      setError('Both English and Arabic messages are required.');
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
          {mode === 'create' ? 'Add Greeting' : 'Edit Greeting'}
        </h3>

        {error && (
          <p className="text-xs" style={{ color: 'var(--color-danger)' }}>
            {error}
          </p>
        )}

        <div className="space-y-4 text-sm">
          <div>
            <label className="block mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>English Message</label>
            <textarea
              className="w-full rounded-lg p-3 text-sm focus:outline-none transition-shadow"
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-card-border)',
                color: 'var(--color-text-primary)'
              }}
              rows={4}
              value={form.message_en}
              onChange={(e) => setForm({ ...form, message_en: e.target.value })}
              placeholder="e.g. Welcome to our center..."
            />
          </div>

          <div>
            <label className="block mb-1.5 text-right font-arabic" style={{ color: 'var(--color-text-secondary)' }}>الرسالة بالعربية</label>
            <textarea
              dir="rtl"
              className="w-full rounded-lg p-3 text-sm focus:outline-none transition-shadow font-arabic"
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-card-border)',
                color: 'var(--color-text-primary)'
              }}
              rows={4}
              value={form.message_ar}
              onChange={(e) => setForm({ ...form, message_ar: e.target.value })}
              placeholder="مثال: مرحبا بك..."
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handle} loading={loading}>
            Save Greeting
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
