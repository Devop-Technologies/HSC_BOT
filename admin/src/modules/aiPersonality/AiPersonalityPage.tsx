'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import { Save, RefreshCw } from 'lucide-react';

export default function AiPersonalityPage() {
  const [promptText, setPromptText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadPrompt = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin-webhook/system-prompt');
      if (res.ok) {
        const data = await res.json();
        setPromptText(data.prompt_text || '');
      } else {
        setMessage({ type: 'error', text: 'Failed to load current prompt' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to connect to server' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPrompt(); }, []);

  const savePrompt = async () => {
    if (!promptText.trim() || promptText.trim().length < 20) {
      setMessage({ type: 'error', text: 'Prompt must be at least 20 characters' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin-webhook/system-prompt', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt_text: promptText.trim() }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'AI personality saved successfully! The bot will use this on the next message.' });
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.error || 'Failed to save' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to connect to server' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            AI Personality — Sarah
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Edit Sarah&apos;s personality prompt. The bot reads this on every message.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            leftIcon={<RefreshCw size={15} />}
            onClick={loadPrompt}
            loading={loading}
          >
            Reset
          </Button>
          <Button
            leftIcon={<Save size={15} />}
            onClick={savePrompt}
            loading={saving}
          >
            Save
          </Button>
        </div>
      </div>

      {message && (
        <div
          className="px-4 py-3 rounded-lg text-sm"
          style={{
            background: message.type === 'success' ? 'var(--color-status-confirmed-bg)' : 'var(--color-status-cancelled-bg)',
            color: message.type === 'success' ? 'var(--color-status-confirmed-text)' : 'var(--color-status-cancelled-text)',
          }}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label
          className="text-sm font-medium"
          style={{ color: 'var(--color-text-primary)' }}
        >
          System Prompt
        </label>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          This is the core personality prompt for Sarah. It shapes how she responds to clients.
          Include rules, tone guidance, service info, and any business policies.
          The bot will dynamically append current service/package data on top of this.
        </p>
        <textarea
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          rows={30}
          className="w-full rounded-lg text-sm outline-none px-4 py-3 resize-y font-mono leading-relaxed"
          style={{
            background: 'var(--color-input-bg)',
            border: '1px solid var(--color-input-border)',
            color: 'var(--color-text-primary)',
          }}
          placeholder={loading ? 'Loading...' : 'Enter Sarah\'s personality prompt here...'}
          disabled={loading}
        />
      </div>
    </div>
  );
}
