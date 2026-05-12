
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageCircle, Save, Trash2, Plus } from 'lucide-react';
import Button from '@/components/ui/Button';
import ConfirmModal from '@/components/modals/ConfirmModal';

type BotMessage = {
  key: string;
  message_en: string;
  message_ar: string;
  updated_at?: string | null;
};

type FlowCard = {
  key: string;
  title: string;
  description: string;
  default_en: string;
  default_ar: string;
};

const FLOW_CARDS: FlowCard[] = [
  {
    key: 'welcome_new',
    title: 'Welcome — New Customer',
    description: 'First message sent to a customer with no prior booking history.',
    default_en: 'Welcome to Healing Space. I can help you book your session, explore services, or answer questions.',
    default_ar: 'مرحباً بك في Healing Space. أستطيع مساعدتك في حجز جلستك أو استعراض الخدمات أو الإجابة على أسئلتك.',
  },
  {
    key: 'welcome_back',
    title: 'Welcome — Returning Customer',
    description: 'Greeting shown to a returning customer. You can use {name} as a placeholder.',
    default_en: 'Welcome back{name}. I am ready to help you with your next booking.',
    default_ar: 'أهلاً بعودتك{name}. أنا جاهز لمساعدتك في حجزك القادم.',
  },
  {
    key: 'welcome_recurring',
    title: 'Welcome — Recurring Flow',
    description: 'Optional greeting for recurring or repeat engagement flows.',
    default_en: 'Nice to see you again. Would you like to continue with a new booking?',
    default_ar: 'يسعدني تواصلك مرة أخرى. هل ترغبين في متابعة حجز جديد؟',
  },
  {
    key: 'main_menu',
    title: 'Main Menu',
    description: 'Primary menu text shown before the customer chooses a path.',
    default_en: 'Please choose one of the available options to continue.',
    default_ar: 'يرجى اختيار أحد الخيارات المتاحة للمتابعة.',
  },
  {
    key: 'did_not_understand',
    title: 'Fallback — Did Not Understand',
    description: 'Shown when the bot cannot match the customer reply.',
    default_en: "I'm sorry, I didn't quite catch that. Could you please try again?",
    default_ar: 'عذراً، لم أفهم رسالتك بشكل واضح. هل يمكنك المحاولة مرة أخرى؟',
  },
  {
    key: 'booking_confirmed',
    title: 'Booking Confirmed',
    description: 'Confirmation after a booking is created. You can use {name}.',
    default_en: 'Your booking has been confirmed{name}. We look forward to seeing you.',
    default_ar: 'تم تأكيد حجزك{name}. نتطلع لخدمتك.',
  },
  {
    key: 'booking_cancelled',
    title: 'Booking Cancelled',
    description: 'Sent after a cancellation is completed.',
    default_en: 'Your booking has been cancelled. If you would like, I can help you make a new one.',
    default_ar: 'تم إلغاء حجزك. وإذا رغبتِ، أستطيع مساعدتك في إنشاء حجز جديد.',
  },
  {
    key: 'no_availability',
    title: 'No Availability',
    description: 'Shown when no matching time slots are available.',
    default_en: 'There is no availability for the selected time right now. Would you like to try another option?',
    default_ar: 'لا توجد مواعيد متاحة في الوقت المحدد حالياً. هل ترغبين في تجربة خيار آخر؟',
  },
];

function MessageCard({
  item,
  saving,
  onChange,
  onSave,
  onReset,
  onDelete,
}: {
  item: FlowCard & BotMessage;
  saving: boolean;
  onChange: (key: string, field: 'message_en' | 'message_ar', value: string) => void;
  onSave: (key: string) => Promise<void>;
  onReset: (key: string) => void;
  onDelete: (key: string) => void;
}) {
  return (
    <div
      className="rounded-xl p-5 space-y-4"
      style={{
        background: 'var(--color-card-bg)',
        border: '1px solid var(--color-card-border)',
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {item.title}
          </h3>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {item.description}
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
            Key: <span className="font-mono">{item.key}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            English
          </label>
          <textarea
            rows={5}
            value={item.message_en}
            onChange={(e) => onChange(item.key, 'message_en', e.target.value)}
            className="w-full rounded-lg text-sm outline-none px-4 py-3 resize-y"
            style={{
              background: 'var(--color-input-bg)',
              border: '1px solid var(--color-input-border)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Arabic
          </label>
          <textarea
            rows={5}
            dir="rtl"
            value={item.message_ar}
            onChange={(e) => onChange(item.key, 'message_ar', e.target.value)}
            className="w-full rounded-lg text-sm outline-none px-4 py-3 resize-y"
            style={{
              background: 'var(--color-input-bg)',
              border: '1px solid var(--color-input-border)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={() => onReset(item.key)}>
          Reset to default
        </Button>
        <Button variant="danger" size="sm" leftIcon={<Trash2 size={14} />} onClick={() => onDelete(item.key)}>
          Delete custom copy
        </Button>
        <Button size="sm" leftIcon={<Save size={14} />} loading={saving} onClick={() => onSave(item.key)}>
          Save
        </Button>
      </div>
    </div>
  );
}

export default function GreetingsPage() {
  const [messages, setMessages] = useState<Record<string, BotMessage>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/bot-messages');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load bot messages');
      const byKey: Record<string, BotMessage> = {};
      for (const row of data || []) byKey[row.key] = row;
      setMessages(byKey);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load bot messages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const items = useMemo(() => {
    return FLOW_CARDS.map((flow) => ({
      ...flow,
      message_en: messages[flow.key]?.message_en ?? flow.default_en,
      message_ar: messages[flow.key]?.message_ar ?? flow.default_ar,
      updated_at: messages[flow.key]?.updated_at ?? null,
    }));
  }, [messages]);

  const handleChange = (key: string, field: 'message_en' | 'message_ar', value: string) => {
    setMessages((prev) => ({
      ...prev,
      [key]: {
        key,
        message_en: field === 'message_en' ? value : prev[key]?.message_en ?? '',
        message_ar: field === 'message_ar' ? value : prev[key]?.message_ar ?? '',
        updated_at: prev[key]?.updated_at ?? null,
      },
    }));
  };

  const handleReset = (key: string) => {
    const flow = FLOW_CARDS.find((f) => f.key === key);
    if (!flow) return;
    setMessages((prev) => ({
      ...prev,
      [key]: {
        key,
        message_en: flow.default_en,
        message_ar: flow.default_ar,
        updated_at: prev[key]?.updated_at ?? null,
      },
    }));
  };

  const handleSave = async (key: string) => {
    const item = items.find((x) => x.key === key);
    if (!item) return;
    setSavingKey(key);
    setError(null);
    try {
      const res = await fetch(`/api/bot-messages/${key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_en: item.message_en,
          message_ar: item.message_ar,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save message');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save message');
    } finally {
      setSavingKey(null);
    }
  };

  const handleDelete = async (key: string) => {
    setSavingKey(key);
    setError(null);
    try {
      const res = await fetch(`/api/bot-messages/${key}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to delete custom message');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete custom message');
    } finally {
      setSavingKey(null);
      setDeleteKey(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
            <MessageCircle size={20} />
            Bot Message Flows
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Manage greeting and reusable customer-facing bot messages.
          </p>
        </div>
        <Button variant="outline" leftIcon={<Plus size={14} />} onClick={load}>
          Refresh
        </Button>
      </div>

      {error && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{
            background: 'var(--color-danger-bg)',
            color: 'var(--color-danger)',
            border: '1px solid var(--color-danger)',
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div
          className="rounded-xl p-10 text-center text-sm"
          style={{
            background: 'var(--color-card-bg)',
            border: '1px solid var(--color-card-border)',
            color: 'var(--color-text-muted)',
          }}
        >
          Loading bot messages…
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <MessageCard
              key={item.key}
              item={item}
              saving={savingKey === item.key}
              onChange={handleChange}
              onSave={handleSave}
              onReset={handleReset}
              onDelete={(key) => setDeleteKey(key)}
            />
          ))}
        </div>
      )}

      {deleteKey && (
        <ConfirmModal
          title="Delete custom message"
          message="This will remove the database override and fall back to the default template text."
          confirmLabel="Delete override"
          onConfirm={() => handleDelete(deleteKey)}
          onClose={() => setDeleteKey(null)}
        />
      )}
    </div>
  );
}
