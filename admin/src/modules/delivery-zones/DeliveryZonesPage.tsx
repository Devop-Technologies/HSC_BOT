'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Route, MapPin, Save } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Table, TableRow, Td } from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import ConfirmModal from '@/components/modals/ConfirmModal';
import DeliveryZoneModal from '@/components/modals/DeliveryZoneModal';
import type { DeliveryZone, DeliveryZoneForm } from '@/types/deliveryZones';

const PAGE_SIZE = 15;
const TABLE_HEADERS = ['Band', 'Distance', 'Base Fee', 'Fee / km', 'Runtime Role', 'Status', ''];

type DeliveryOrigin = {
  name: string;
  address: string;
  lat: string;
  lng: string;
};

export default function DeliveryZonesPage() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [zoneModal, setZoneModal] = useState<{ open: boolean; mode: 'create' | 'edit'; data?: DeliveryZone } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ message: string; onConfirm: () => Promise<void> } | null>(null);
  const [origin, setOrigin] = useState<DeliveryOrigin>({ name: '', address: '', lat: '', lng: '' });
  const [originSaving, setOriginSaving] = useState(false);
  const [originMessage, setOriginMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [zonesRes, settingsRes] = await Promise.all([
        fetch('/api/delivery-zones'),
        fetch('/api/business-settings'),
      ]);
      if (!zonesRes.ok) throw new Error('Failed to load delivery zones');
      setZones(await zonesRes.json());
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        const map = settings.map || {};
        setOrigin({
          name: map.delivery_origin_name?.value || '',
          address: map.delivery_origin_address?.value || '',
          lat: map.delivery_origin_lat?.value || '',
          lng: map.delivery_origin_lng?.value || '',
        });
      }
      setPage(1);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveZone = async (form: DeliveryZoneForm, id?: string) => {
    const payload = {
      label: form.label,
      min_km: Number(form.min_km || 0),
      base_fee: Number(form.base_fee || 0),
      fee_per_km: Number(form.fee_per_km || 0),
      max_km: form.max_km !== '' ? Number(form.max_km) : null,
    };
    const res = id
      ? await fetch(`/api/delivery-zones/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      : await fetch('/api/delivery-zones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to save');
    await load();
  };

  const toggleActive = async (zone: DeliveryZone) => {
    await fetch(`/api/delivery-zones/${zone.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !zone.is_active }) });
    await load();
  };

  const deleteZone = async (id: string) => {
    const res = await fetch(`/api/delivery-zones/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete');
    await load();
  };

  const saveOrigin = async () => {
    setOriginMessage(null);
    const lat = Number(origin.lat);
    const lng = Number(origin.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setOriginMessage('Latitude and longitude are required for the starting point.');
      return;
    }
    setOriginSaving(true);
    try {
      const updates = [
        ['delivery_origin_name', origin.name, 'Delivery starting point name used for quote origin.'],
        ['delivery_origin_address', origin.address, 'Delivery starting point address/label for admin reference.'],
        ['delivery_origin_lat', String(lat), 'Delivery quote origin latitude.'],
        ['delivery_origin_lng', String(lng), 'Delivery quote origin longitude.'],
      ];
      for (const [key, value, description] of updates) {
        const res = await fetch(`/api/business-settings/${key}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value, description }),
        });
        if (!res.ok) throw new Error((await res.json()).error || `Failed to save ${key}`);
      }
      setOriginMessage('Starting point saved. Delivery quotes will use these coordinates.');
      await load();
    } catch (err) {
      setOriginMessage(err instanceof Error ? err.message : 'Failed to save starting point');
    } finally {
      setOriginSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(zones.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = zones.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const from = zones.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE, zones.length);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Delivery Fees</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Manage the live distance tariff bands used by home-service delivery quotes.
          </p>
        </div>
        <Button leftIcon={<Plus size={15} />} onClick={() => setZoneModal({ open: true, mode: 'create' })} className="self-start sm:self-auto">
          Add Band
        </Button>
      </div>

      <div className="rounded-xl p-4" style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}>
        <div className="flex items-start gap-3">
          <MapPin size={18} style={{ color: 'var(--color-accent)' }} />
          <div className="flex-1 space-y-3">
            <div>
              <p className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>Delivery starting point</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Origin coordinates for distance quotes now, and real route calculation later.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input value={origin.name} onChange={(e) => setOrigin((v) => ({ ...v, name: e.target.value }))} placeholder="Starting point name" className="px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-primary)' }} />
              <input value={origin.address} onChange={(e) => setOrigin((v) => ({ ...v, address: e.target.value }))} placeholder="Address / note" className="px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-primary)' }} />
              <input type="number" step="any" value={origin.lat} onChange={(e) => setOrigin((v) => ({ ...v, lat: e.target.value }))} placeholder="Latitude" className="px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-primary)' }} />
              <input type="number" step="any" value={origin.lng} onChange={(e) => setOrigin((v) => ({ ...v, lng: e.target.value }))} placeholder="Longitude" className="px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-primary)' }} />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs" style={{ color: originMessage?.includes('Failed') || originMessage?.includes('required') ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>{originMessage || 'Tip: use exact map coordinates for the center/dispatch origin.'}</p>
              <Button leftIcon={<Save size={14} />} onClick={saveOrigin} loading={originSaving}>Save Starting Point</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl p-4 flex gap-3" style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}>
        <Route size={18} style={{ color: 'var(--color-accent)' }} />
        <div className="text-sm space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
          <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>Runtime delivery logic status</p>
          <p>The bot calculates customer distance from the service center and applies these tariff bands first. This screen now points to the same table used by runtime quotes.</p>
        </div>
      </div>

      <Table headers={TABLE_HEADERS} loading={loading} isEmpty={zones.length === 0} emptyText="No delivery tariff bands yet." footer={<Pagination page={safePage} totalPages={totalPages} total={zones.length} from={from} to={to} onPageChange={setPage} itemLabel="band" />}>
        {paginated.map((zone, i) => (
          <TableRow key={zone.id} isLast={i === paginated.length - 1}>
            <Td><p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{zone.label ?? zone.district}</p></Td>
            <Td>{Number(zone.min_km ?? 0).toLocaleString()}–{zone.max_km !== null ? Number(zone.max_km).toLocaleString() : '∞'} km</Td>
            <Td>SAR {Number(zone.base_fee).toLocaleString()}</Td>
            <Td>SAR {Number(zone.fee_per_km).toLocaleString()}</Td>
            <Td><span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Live quote band</span></Td>
            <Td>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: zone.is_active ? 'var(--color-status-confirmed-bg)' : 'var(--color-status-noshow-bg)', color: zone.is_active ? 'var(--color-status-confirmed-text)' : 'var(--color-status-noshow-text)' }}>
                {zone.is_active ? 'Active' : 'Inactive'}
              </span>
            </Td>
            <Td>
              <div className="flex items-center gap-1 justify-end">
                <button onClick={() => toggleActive(zone)} className="w-7 h-7 rounded-md flex items-center justify-center" style={{ color: zone.is_active ? 'var(--color-success)' : 'var(--color-text-muted)' }} title={zone.is_active ? 'Deactivate' : 'Activate'}>
                  {zone.is_active ? <ToggleRight size={17} /> : <ToggleLeft size={17} />}
                </button>
                <button onClick={() => setZoneModal({ open: true, mode: 'edit', data: zone })} title="Edit" className="w-7 h-7 rounded-md flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}><Pencil size={14} /></button>
                <button onClick={() => setDeleteModal({ message: `Delete ${zone.label ?? zone.district}?`, onConfirm: () => deleteZone(zone.id) })} title="Delete" className="w-7 h-7 rounded-md flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}><Trash2 size={14} /></button>
              </div>
            </Td>
          </TableRow>
        ))}
      </Table>

      {zoneModal?.open && <DeliveryZoneModal mode={zoneModal.mode} initial={zoneModal.data} onClose={() => setZoneModal(null)} onSave={(form) => saveZone(form, zoneModal.data?.id)} />}
      {deleteModal && <ConfirmModal message={deleteModal.message} onConfirm={deleteModal.onConfirm} onClose={() => setDeleteModal(null)} />}
    </div>
  );
}
