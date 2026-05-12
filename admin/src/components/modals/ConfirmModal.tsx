'use client';

import { useState } from 'react';
import Overlay from './Overlay';
import Button from '@/components/ui/Button';

interface ConfirmModalProps {
  message: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  title?: string;
  confirmLabel?: string;
  variant?: 'danger' | 'primary';
}

export default function ConfirmModal({
  message,
  onConfirm,
  onClose,
  title = 'Confirm Delete',
  confirmLabel = 'Delete',
  variant = 'danger',
}: ConfirmModalProps) {
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
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
          {title}
        </h3>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {message}
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={variant} onClick={handle} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
