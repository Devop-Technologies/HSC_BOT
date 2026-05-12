'use client';

import { useState } from 'react';
import { ToggleLeft, ToggleRight, Plus, Trash2, GripVertical } from 'lucide-react';
import Overlay from './Overlay';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import type { Service, ServiceForm, ServicePriceOption } from '@/types/services';

export type { Service, ServiceForm };

// ─── ToggleRow (local helper) ─────────────────────────────────

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        style={{ color: checked ? 'var(--color-success)' : 'var(--color-text-muted)' }}
      >
        {checked ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
      </button>
    </div>
  );
}

// ─── Price Option Row ─────────────────────────────────────────

function PriceOptionRow({
  option,
  index,
  onChange,
  onRemove,
}: {
  option: Omit<ServicePriceOption, 'id'>;
  index: number;
  onChange: (index: number, field: string, value: string | number | null) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div
      className="flex items-center gap-2 p-2 rounded-lg"
      style={{ background: 'var(--color-page-bg)' }}
    >
      <GripVertical size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />

      <input
        type="text"
        placeholder="Label (e.g. 60 min)"
        value={option.label || ''}
        onChange={(e) => onChange(index, 'label', e.target.value)}
        className="flex-1 min-w-0 rounded-md text-sm outline-none px-2.5 py-1.5"
        style={{
          background: 'var(--color-input-bg)',
          border: '1px solid var(--color-input-border)',
          color: 'var(--color-text-primary)',
        }}
      />

      <input
        type="number"
        min="0"
        placeholder="Duration"
        value={option.duration_minutes !== null ? option.duration_minutes : ''}
        onChange={(e) =>
          onChange(index, 'duration_minutes', e.target.value !== '' ? Number(e.target.value) : null)
        }
        className="w-20 rounded-md text-sm outline-none px-2.5 py-1.5"
        style={{
          background: 'var(--color-input-bg)',
          border: '1px solid var(--color-input-border)',
          color: 'var(--color-text-primary)',
        }}
        title="Duration in minutes"
      />

      <input
        type="number"
        min="0"
        placeholder="Price"
        value={option.price !== null ? option.price : ''}
        onChange={(e) =>
          onChange(index, 'price', e.target.value !== '' ? Number(e.target.value) : null)
        }
        className="w-24 rounded-md text-sm outline-none px-2.5 py-1.5"
        style={{
          background: 'var(--color-input-bg)',
          border: '1px solid var(--color-input-border)',
          color: 'var(--color-text-primary)',
        }}
        title="Price in SAR"
      />

      <button
        type="button"
        onClick={() => onRemove(index)}
        className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 cursor-pointer"
        style={{ color: 'var(--color-text-muted)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-danger)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
        title="Remove price option"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

// ─── ServiceTreeModal ─────────────────────────────────────────

interface ServiceTreeModalProps {
  mode: 'create' | 'edit';
  initial?: Service;
  parentOptions: { id: string; name: string; name_ar: string | null }[];
  onClose: () => void;
  onSave: (form: ServiceForm) => Promise<void>;
}

export default function ServiceTreeModal({
  mode,
  initial,
  parentOptions,
  onClose,
  onSave,
}: ServiceTreeModalProps) {
  const [form, setForm] = useState<ServiceForm>(() => {
    if (initial) {
      return {
        name: initial.name,
        name_ar: initial.name_ar ?? '',
        description: initial.description ?? '',
        icon: initial.icon ?? '',
        parent_id: initial.parent_id ?? '',
        sort_order: String(initial.sort_order ?? 0),
        oil_based: initial.oil_based ?? false,
        available_for_home: initial.available_for_home ?? false,
        available_in_center: initial.available_in_center ?? false,
        service_category: initial.service_category ?? 'service',
        price: initial.price !== null ? String(initial.price) : '',
        duration_minutes: initial.duration_minutes !== null ? String(initial.duration_minutes) : '',
        delivery_fee: initial.delivery_fee !== null ? String(initial.delivery_fee) : '',
        price_options:
          initial.price_options && initial.price_options.length > 0
            ? initial.price_options.map((po) => ({
                duration_minutes: po.duration_minutes,
                price: po.price,
                delivery_fee: po.delivery_fee,
                label: po.label,
                sort_order: po.sort_order,
              }))
            : [],
      };
    }
    return {
      name: '',
      name_ar: '',
      description: '',
      icon: '',
      parent_id: '',
      sort_order: '0',
      oil_based: false,
      available_for_home: false,
      available_in_center: false,
      service_category: 'service',
      price: '',
      duration_minutes: '',
      delivery_fee: '',
      price_options: [],
    };
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof ServiceForm>(key: K, value: ServiceForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const updatePriceOption = (index: number, field: string, value: string | number | null) => {
    setForm((f) => {
      const opts = [...f.price_options];
      opts[index] = { ...opts[index], [field]: value };
      return { ...f, price_options: opts };
    });
  };

  const addPriceOption = () => {
    setForm((f) => ({
      ...f,
      price_options: [
        ...f.price_options,
        {
          duration_minutes: null,
          price: null,
          delivery_fee: null,
          label: '',
          sort_order: f.price_options.length,
        },
      ],
    }));
  };

  const removePriceOption = (index: number) => {
    setForm((f) => ({
      ...f,
      price_options: f.price_options.filter((_, i) => i !== index),
    }));
  };

  const handle = async () => {
    if (!form.name.trim()) {
      setError('Service name (English) is required');
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

  const showPriceOptions = form.service_category === 'service';

  return (
    <Overlay onClose={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{
          background: 'var(--color-card-bg)',
          border: '1px solid var(--color-card-border)',
        }}
      >
        <h3
          className="text-base font-semibold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {mode === 'create' ? 'Add to Catalog' : 'Edit Service'}
        </h3>

        {error && (
          <p className="text-xs" style={{ color: 'var(--color-danger)' }}>
            {error}
          </p>
        )}

        {/* Names */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Name (English)"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
          <Input
            label="Name (Arabic)"
            value={form.name_ar}
            dir="rtl"
            onChange={(e) => set('name_ar', e.target.value)}
          />
        </div>

        {/* Icon + Sort Order */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Icon (emoji)"
            value={form.icon}
            onChange={(e) => set('icon', e.target.value)}
            placeholder="e.g. 💆‍♀️ 🧖‍♀️ 🔥"
            hint="Display emoji shown next to name"
          />
          <Input
            label="Sort Order"
            type="number"
            min="0"
            value={form.sort_order}
            onChange={(e) => set('sort_order', e.target.value)}
            placeholder="0"
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-sm font-medium"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Description
          </label>
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            className="w-full rounded-lg text-sm outline-none px-4 py-2.5 resize-none"
            style={{
              background: 'var(--color-input-bg)',
              border: '1px solid var(--color-input-border)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>

        {/* Category + Parent */}
        <div className="grid grid-cols-2 gap-3">
          {/* Service Category */}
          <div className="flex flex-col gap-1.5">
            <label
              className="text-sm font-medium"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Type
            </label>
            <select
              value={form.service_category}
              onChange={(e) =>
                set('service_category', e.target.value as 'category' | 'service')
              }
              className="w-full rounded-lg text-sm outline-none px-4 py-2.5"
              style={{
                background: 'var(--color-input-bg)',
                border: '1px solid var(--color-input-border)',
                color: 'var(--color-text-primary)',
              }}
            >
              <option value="category">Category (folder/group)</option>
              <option value="service">Service (bookable)</option>
            </select>
          </div>

          {/* Parent */}
          <div className="flex flex-col gap-1.5">
            <label
              className="text-sm font-medium"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Parent
            </label>
            <select
              value={form.parent_id}
              onChange={(e) => set('parent_id', e.target.value)}
              className="w-full rounded-lg text-sm outline-none px-4 py-2.5"
              style={{
                background: 'var(--color-input-bg)',
                border: '1px solid var(--color-input-border)',
                color: 'var(--color-text-primary)',
              }}
            >
              <option value="">— Root Level —</option>
              {parentOptions.filter((p) => p.id !== initial?.id).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.name_ar ? `(${p.name_ar})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Default Price + Duration (for bookable service leaves only) */}
        {showPriceOptions && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Default Price (SAR)"
                type="number"
                min="0"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
              />
              <Input
                label="Default Duration (minutes)"
                type="number"
                min="0"
                value={form.duration_minutes}
                onChange={(e) => set('duration_minutes', e.target.value)}
              />
            </div>

            <Input
              label="Delivery Fee (SAR - 0 means free, empty means contact us)"
              type="number"
              min="0"
              step="0.5"
              value={form.delivery_fee}
              onChange={(e) => set('delivery_fee', e.target.value)}
              placeholder="Leave empty if unknown"
            />

            {/* Multiple Price Options */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  className="text-sm font-medium"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Price Options (different durations/prices)
                </label>
                <button
                  type="button"
                  onClick={addPriceOption}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg cursor-pointer"
                  style={{
                    background: 'var(--color-accent-subtle)',
                    color: 'var(--color-accent)',
                  }}
                >
                  <Plus size={12} />
                  Add Option
                </button>
              </div>

              {form.price_options.length === 0 && (
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  No additional price options. Add leaf duration/price options (e.g. 60min/200 SAR, 90min/300 SAR).
                </p>
              )}

              <div className="space-y-1.5">
                {form.price_options.map((po, i) => (
                  <PriceOptionRow
                    key={i}
                    option={po}
                    index={i}
                    onChange={updatePriceOption}
                    onRemove={removePriceOption}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Toggles */}
        <div
          className="rounded-lg px-4 py-2 space-y-1"
          style={{ background: 'var(--color-page-bg)' }}
        >
          <ToggleRow
            label="Oil-based"
            checked={form.oil_based}
            onChange={(v) => set('oil_based', v)}
          />
          <ToggleRow
            label="Available for Home"
            checked={form.available_for_home}
            onChange={(v) => set('available_for_home', v)}
          />
          <ToggleRow
            label="Available in Center"
            checked={form.available_in_center}
            onChange={(v) => set('available_in_center', v)}
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
