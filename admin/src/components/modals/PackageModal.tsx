'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Overlay from './Overlay';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import type { Package, PackageForm } from '@/types/packages';
import type { Service } from '@/types/services';

export type { Package, PackageForm };

interface PackageModalProps {
  mode: 'create' | 'edit';
  initial?: Package;
  services: Service[];
  onClose: () => void;
  onSave: (form: PackageForm) => Promise<void>;
}

function firstCommercialOption(service?: Service) {
  if (!service) return { price: null as number | null, duration: null as number | null, delivery: null as number | null };
  const sorted = [...(service.price_options || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const option = sorted.find((po) => po.price !== null || po.duration_minutes !== null);
  return {
    price: option?.price ?? service.price ?? null,
    duration: option?.duration_minutes ?? service.duration_minutes ?? null,
    delivery: option?.delivery_fee ?? service.delivery_fee ?? null,
  };
}

export default function PackageModal({
  mode,
  initial,
  services,
  onClose,
  onSave,
}: PackageModalProps) {
  const [form, setForm] = useState<PackageForm>(
    initial
      ? {
          name: initial.name,
          description: initial.description ?? '',
          total_sessions: initial.total_sessions !== null ? String(initial.total_sessions) : '',
          total_price: initial.total_price !== null ? String(initial.total_price) : '',
          validity_days: initial.validity_days !== null ? String(initial.validity_days) : '',
          service_links: (initial.service_links || []).map((link) => ({
            service_id: link.service_id,
            sessions_allowed: link.sessions_allowed !== null && link.sessions_allowed !== undefined ? String(link.sessions_allowed) : '',
          })),
        }
      : {
          name: '',
          description: '',
          total_sessions: '',
          total_price: '',
          validity_days: '',
          service_links: [],
        }
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof PackageForm>(key: K, value: PackageForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const addService = () => {
    setForm((f) => ({
      ...f,
      service_links: [...f.service_links, { service_id: '', sessions_allowed: f.total_sessions || '' }],
    }));
  };

  const updateServiceLink = (index: number, field: 'service_id' | 'sessions_allowed', value: string) => {
    setForm((f) => ({
      ...f,
      service_links: f.service_links.map((link, i) => (i === index ? { ...link, [field]: value } : link)),
    }));
  };

  const removeServiceLink = (index: number) => {
    setForm((f) => ({ ...f, service_links: f.service_links.filter((_, i) => i !== index) }));
  };

  const pricingPreview = useMemo(() => {
    const primaryLink = form.service_links.find((link) => link.service_id);
    const primaryService = services.find((s) => s.id === primaryLink?.service_id);
    const option = firstCommercialOption(primaryService);
    const sessions = Number(form.total_sessions || primaryLink?.sessions_allowed || 0);
    const finalTotal = Number(form.total_price || 0);
    const serviceTotal = option.price !== null && sessions > 0 ? option.price * sessions : null;
    const deliveryTotal = option.delivery !== null && sessions > 0 ? option.delivery * sessions : null;
    const gross = serviceTotal !== null && deliveryTotal !== null ? serviceTotal + deliveryTotal : serviceTotal;
    const discount = gross && finalTotal > 0 ? Math.max(0, ((gross - finalTotal) / gross) * 100) : null;
    return { primaryService, duration: option.duration, serviceTotal, deliveryTotal, finalTotal, discount };
  }, [form.service_links, form.total_price, form.total_sessions, services]);

  const handle = async () => {
    if (!form.name.trim()) {
      setError('Package name is required');
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
        className="w-full max-w-2xl rounded-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{
          background: 'var(--color-card-bg)',
          border: '1px solid var(--color-card-border)',
        }}
      >
        <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {mode === 'create' ? 'Add Package' : 'Edit Package'}
        </h3>

        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Packages are separate from the service tree. Pick eligible service leaves here; package redemption will later match by locked price and duration.
        </p>

        {error && <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>}

        <Input label="Package Name" value={form.name} onChange={(e) => set('name', e.target.value)} />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Description</label>
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

        <div className="grid grid-cols-3 gap-3">
          <Input label="Final Total (SAR)" type="number" min="0" value={form.total_price} onChange={(e) => set('total_price', e.target.value)} />
          <Input label="Total Sessions" type="number" min="1" value={form.total_sessions} onChange={(e) => set('total_sessions', e.target.value)} />
          <Input label="Validity (days)" type="number" min="1" value={form.validity_days} onChange={(e) => set('validity_days', e.target.value)} />
        </div>

        <div className="space-y-2 rounded-lg p-3" style={{ background: 'var(--color-page-bg)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Eligible service leaves</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Use bookable service leaves only; folders stay in Service Catalog.</p>
            </div>
            <button
              type="button"
              onClick={addService}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg cursor-pointer"
              style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}
            >
              <Plus size={12} /> Add service
            </button>
          </div>

          {form.service_links.length === 0 && (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No eligible services selected yet.</p>
          )}

          <div className="space-y-2">
            {form.service_links.map((link, index) => (
              <div key={index} className="grid grid-cols-[1fr_120px_32px] gap-2 items-end">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>Service leaf</label>
                  <select
                    value={link.service_id}
                    onChange={(e) => updateServiceLink(index, 'service_id', e.target.value)}
                    className="w-full rounded-lg text-sm outline-none px-3 py-2.5"
                    style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-primary)' }}
                  >
                    <option value="">— Select service —</option>
                    {services.map((svc) => {
                      const opt = firstCommercialOption(svc);
                      const detail = opt.price !== null || opt.duration !== null ? ` — ${opt.duration ?? '—'} min / SAR ${opt.price ?? '—'}` : '';
                      return <option key={svc.id} value={svc.id}>{svc.name}{detail}</option>;
                    })}
                  </select>
                </div>
                <Input
                  label="Sessions"
                  type="number"
                  min="1"
                  value={link.sessions_allowed}
                  onChange={(e) => updateServiceLink(index, 'sessions_allowed', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeServiceLink(index)}
                  className="w-8 h-8 rounded-md flex items-center justify-center"
                  style={{ color: 'var(--color-text-muted)' }}
                  title="Remove service"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg p-3 space-y-1.5" style={{ background: 'var(--color-page-bg)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Customer pricing display preview</p>
          <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <span>Service total</span><strong>SAR {pricingPreview.serviceTotal !== null ? pricingPreview.serviceTotal.toLocaleString() : '—'}</strong>
            <span>Delivery total</span><strong>{pricingPreview.deliveryTotal !== null ? `SAR ${pricingPreview.deliveryTotal.toLocaleString()}` : 'TBD / placeholder'}</strong>
            <span>Discount percentage</span><strong>{pricingPreview.discount !== null ? `${pricingPreview.discount.toFixed(1)}%` : '—'}</strong>
            <span>Final total</span><strong>SAR {pricingPreview.finalTotal ? pricingPreview.finalTotal.toLocaleString() : '—'}</strong>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            Preview uses the first eligible service/default option. Runtime will lock original price + duration when the customer buys.
          </p>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handle} loading={loading}>Save</Button>
        </div>
      </div>
    </Overlay>
  );
}
