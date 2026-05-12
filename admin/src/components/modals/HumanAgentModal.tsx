'use client';

import { useState } from 'react';
import Overlay from './Overlay';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import type { HumanAgent, HumanAgentForm } from '@/types/humanAgents';

interface HumanAgentModalProps {
  mode: 'create' | 'edit';
  initial?: HumanAgent;
  onClose: () => void;
  onSave: (form: HumanAgentForm) => Promise<void>;
}

export default function HumanAgentModal({ mode, initial, onClose, onSave }: HumanAgentModalProps) {
  const [form, setForm] = useState<HumanAgentForm>(
    initial
      ? { name: initial.name, phone_number: initial.phone_number }
      : { name: '', phone_number: '' }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof HumanAgentForm>(key: K, value: HumanAgentForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handle = async () => {
    if (!form.name.trim()) {
      setError('Name is required');
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
        <div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {mode === 'create' ? 'Add Human Agent' : 'Edit Human Agent'}
          </h3>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            When a customer requests a real person, all active agents will be notified on WhatsApp.
          </p>
        </div>

        {error && (
          <p className="text-xs" style={{ color: 'var(--color-danger)' }}>
            {error}
          </p>
        )}

        <Input
          label="Name"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Sara (Support)"
        />

        <div className="space-y-1">
          <Input
            label="WhatsApp Phone Number"
            type="tel"
            value={form.phone_number}
            onChange={(e) => {
              const filtered = e.target.value.replace(/[^0-9]/g, '');
              set('phone_number', filtered);
            }}
            placeholder="e.g. 923001234567"
          />
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            International format, digits only — no + or spaces.<br />
            Saudi: <strong>966</strong>5XXXXXXXX &nbsp;·&nbsp; Pakistan: <strong>92</strong>3XXXXXXXXX
          </p>
        </div>

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
