'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Save, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Table, TableRow, Td } from '@/components/ui/Table';
import ConfirmModal from '@/components/modals/ConfirmModal';

// ─── Types ───────────────────────────────────────────────────

interface BotMessage {
  id: string;
  key: string;
  message_en: string;
  message_ar: string;
  updated_at: string;
}

// ─── Page ─────────────────────────────────────────────────────

export default function BotMessagesPage() {
  const [messages, setMessages] = useState<BotMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editing, setEditing] = useState<{ key: string; message_en: string; message_ar: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ key: string } | null>(null);

  // ── Load ────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bot-messages');
      if (res.ok) setMessages(await res.json());
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── CRUD ────────────────────────────────────────────────────

  const saveMessage = async (key: string, message_en: string, message_ar: string) => {
    setSaving(true);
    setMessage(null);
    try {
      const isNew = creating;
      const res = await fetch(isNew ? '/api/bot-messages' : `/api/bot-messages/${encodeURIComponent(key)}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, message_en, message_ar }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Message saved!' });
        setEditing(null);
        setCreating(false);
        setNewKey('');
        await load();
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.error || 'Failed to save' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally { setSaving(false); }
  };

  const deleteMessage = async () => {
    if (!deleteModal) return;
    try {
      const res = await fetch(`/api/bot-messages/${encodeURIComponent(deleteModal.key)}`, { method: 'DELETE' });
      if (res.ok) { setDeleteModal(null); await load(); }
    } catch {}
  };

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Bot Messages
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Every static message the bot sends to customers. Changes take effect immediately.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" leftIcon={<RefreshCw size={15} />} onClick={load} loading={loading}>
            Refresh
          </Button>
          <Button leftIcon={<Plus size={15} />} onClick={() => setCreating(true)}>
            Add Message
          </Button>
        </div>
      </div>

      {message && (
        <div className="px-4 py-3 rounded-lg text-sm"
          style={{ background: message.type === 'success' ? 'var(--color-status-confirmed-bg)' : 'var(--color-status-cancelled-bg)',
            color: message.type === 'success' ? 'var(--color-status-confirmed-text)' : 'var(--color-status-cancelled-text)' }}>
          {message.text}
        </div>
      )}

      {/* New message form */}
      {creating && (
        <div className="rounded-xl p-4 space-y-3"
          style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-accent)' }}>
          <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>New Message</h4>
          <input value={newKey} onChange={e => setNewKey(e.target.value)}
            placeholder="Message key (e.g. welcome_new, booking_confirmed)"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-primary)' }} />
          <textarea value={editing?.message_en || ''} onChange={e => setEditing(p => p ? { ...p, message_en: e.target.value } : { key: newKey, message_en: e.target.value, message_ar: '' })}
            placeholder="English message"
            rows={3}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
            style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-primary)' }} />
          <textarea value={editing?.message_ar || ''} onChange={e => setEditing(p => p ? { ...p, message_ar: e.target.value } : { key: newKey, message_en: '', message_ar: e.target.value })}
            placeholder="Arabic message (optional)"
            rows={2} dir="rtl"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
            style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-primary)' }} />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setCreating(false); setEditing(null); }} className="px-4 py-2 text-sm rounded-lg" style={{ color: 'var(--color-text-muted)' }}>Cancel</button>
            <Button onClick={() => saveMessage(newKey, editing?.message_en || '', editing?.message_ar || '')} loading={saving}>
              Save
            </Button>
          </div>
        </div>
      )}

      {/* Existing messages table */}
      <Table
        headers={['Key', 'English', 'Arabic', 'Updated', '']}
        loading={loading}
        isEmpty={messages.length === 0}
        emptyText="No bot messages yet. Messages will fall back to built-in defaults."
      >
        {messages.map((msg, i) => (
          <TableRow key={msg.id || msg.key} isLast={i === messages.length - 1}>
            <Td>
              <code className="text-xs px-2 py-0.5 rounded font-mono"
                style={{ background: 'var(--color-input-bg)', color: 'var(--color-accent)' }}>
                {msg.key}
              </code>
            </Td>
            <Td className="max-w-[250px]">
              {editing?.key === msg.key ? (
                <textarea value={editing.message_en} onChange={e => setEditing({ ...editing, message_en: e.target.value })}
                  rows={2} className="w-full px-2 py-1 rounded text-sm outline-none resize-y"
                  style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-accent)', color: 'var(--color-text-primary)' }} />
              ) : (
                <p className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }} title={msg.message_en}>{msg.message_en}</p>
              )}
            </Td>
            <Td className="max-w-[250px]">
              {editing?.key === msg.key ? (
                <textarea value={editing.message_ar} onChange={e => setEditing({ ...editing, message_ar: e.target.value })}
                  rows={2} dir="rtl" className="w-full px-2 py-1 rounded text-sm outline-none resize-y"
                  style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-accent)', color: 'var(--color-text-primary)' }} />
              ) : (
                <p className="text-sm truncate font-arabic" dir="rtl" style={{ color: 'var(--color-text-primary)' }} title={msg.message_ar}>{msg.message_ar}</p>
              )}
            </Td>
            <Td>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {msg.updated_at ? new Date(msg.updated_at).toLocaleDateString() : '—'}
              </span>
            </Td>
            <Td>
              {editing?.key === msg.key ? (
                <div className="flex items-center gap-1 justify-end">
                  <button onClick={() => saveMessage(msg.key, editing.message_en, editing.message_ar)}
                    className="w-7 h-7 flex items-center justify-center" style={{ color: 'var(--color-success)' }}>
                    <Save size={14} />
                  </button>
                  <button onClick={() => setEditing(null)}
                    className="w-7 h-7 flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}>
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 justify-end">
                  <button onClick={() => setEditing({ key: msg.key, message_en: msg.message_en, message_ar: msg.message_ar })}
                    className="w-7 h-7 flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}>
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => setDeleteModal({ key: msg.key })}
                    className="w-7 h-7 flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </Td>
          </TableRow>
        ))}
      </Table>

      {deleteModal && (
        <ConfirmModal
          message={`Delete message "${deleteModal.key}"? The bot will fall back to the built-in default.`}
          onConfirm={deleteMessage}
          onClose={() => setDeleteModal(null)}
        />
      )}
    </div>
  );
}
