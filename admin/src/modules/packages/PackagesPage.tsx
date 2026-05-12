'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  CalendarDays,
  Layers,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { Table, TableRow, Td } from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import ConfirmModal from '@/components/modals/ConfirmModal';
import PackageModal from '@/components/modals/PackageModal';
import type { Package, PackageForm, CustomerPackageWallet } from '@/types/packages';
import type { Service } from '@/types/services';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setPackages, setLoading, setError } from '@/store/packagesSlice';

// ─── Constants ────────────────────────────────────────────────

const PAGE_SIZE = 10;
const TABLE_HEADERS = ['Package', 'Eligible Services', 'Pricing Preview', 'Sessions', 'Validity', 'Status', ''];
const WALLET_HEADERS = ['Customer', 'Package', 'Balance', 'Status', 'Last Ledger Event', ''];

// ─── Page ─────────────────────────────────────────────────────

export default function PackagesPage() {
  const dispatch = useAppDispatch();
  const { items: packages, loading } = useAppSelector((s) => s.packages);
  const [page, setPage] = useState(1);
  const [serviceLeaves, setServiceLeaves] = useState<Service[]>([]);
  const [wallets, setWallets] = useState<CustomerPackageWallet[]>([]);
  const [walletError, setWalletError] = useState<string | null>(null);

  const [pkgModal, setPkgModal] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    data?: Package;
  } | null>(null);

  const [deleteModal, setDeleteModal] = useState<{
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // ── Load ────────────────────────────────────────────────────

  const flattenServiceLeaves = (nodes: Service[]): Service[] => {
    const result: Service[] = [];
    const walk = (node: Service) => {
      if (node.children?.length) node.children.forEach(walk);
      if (node.service_category === 'service') result.push(node);
    };
    nodes.forEach(walk);
    return result;
  };

  const load = useCallback(async () => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const [pkgRes, serviceRes, walletRes] = await Promise.all([fetch('/api/packages'), fetch('/api/services'), fetch('/api/customer-packages')]);
      if (pkgRes.ok) {
        dispatch(setPackages(await pkgRes.json()));
        setPage(1);
      }
      if (serviceRes.ok) {
        setServiceLeaves(flattenServiceLeaves(await serviceRes.json()));
      }
      if (walletRes.ok) {
        setWallets(await walletRes.json());
        setWalletError(null);
      } else {
        setWalletError('Failed to load customer package wallets');
      }
    } catch {
      dispatch(setError('Failed to load packages'));
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  useEffect(() => { load(); }, [load]);

  // ── CRUD ────────────────────────────────────────────────────

  const savePackage = async (form: PackageForm, id?: string) => {
    const payload = {
      name: form.name,
      description: form.description || null,
      total_sessions: form.total_sessions !== '' ? Number(form.total_sessions) : null,
      total_price: form.total_price !== '' ? Number(form.total_price) : null,
      validity_days: form.validity_days !== '' ? Number(form.validity_days) : null,
      service_links: form.service_links,
    };

    const res = id
      ? await fetch(`/api/packages/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : await fetch('/api/packages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

    if (!res.ok) throw new Error((await res.json()).error);
    await load();
  };

  const toggleActive = async (pkg: Package) => {
    await fetch(`/api/packages/${pkg.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !pkg.is_active }),
    });
    await load();
  };

  const deletePackage = async (id: string) => {
    const res = await fetch(`/api/packages/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to deactivate package');
    await load();
  };

  const updateWallet = async (walletId: string, action: 'activate' | 'void' | 'refund') => {
    const reason = action === 'activate'
      ? 'Admin activated pending package payment'
      : action === 'refund'
        ? 'Admin refunded before first completed session'
        : 'Admin voided package wallet';
    const res = await fetch(`/api/customer-packages/${walletId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to update wallet');
    await load();
  };

  // ── Pagination ───────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(packages.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = packages.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const from = packages.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE, packages.length);

  const packagePreview = (pkg: Package) => {
    const first = pkg.service_links?.find((link) => link.service)?.service;
    if (!first || pkg.total_sessions === null || pkg.total_price === null) return null;
    const firstOption = first.price_options?.[0];
    const servicePrice = firstOption?.price ?? first.price ?? null;
    const deliveryFee = firstOption?.delivery_fee ?? first.delivery_fee ?? null;
    const serviceTotal = servicePrice !== null ? servicePrice * pkg.total_sessions : null;
    const deliveryTotal = deliveryFee !== null ? deliveryFee * pkg.total_sessions : null;
    const gross = serviceTotal !== null && deliveryTotal !== null ? serviceTotal + deliveryTotal : serviceTotal;
    const discount = gross ? Math.max(0, ((gross - pkg.total_price) / gross) * 100) : null;
    return { serviceTotal, deliveryTotal, discount };
  };

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Packages
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Manage packages separately from the service tree, including eligible service leaves and customer-facing pricing preview
          </p>
        </div>
        <Button
          leftIcon={<Plus size={15} />}
          onClick={() => setPkgModal({ open: true, mode: 'create' })}
          className="self-start sm:self-auto"
        >
          Add Package
        </Button>
      </div>

      {/* Table */}
      <Table
        headers={TABLE_HEADERS}
        loading={loading}
        isEmpty={packages.length === 0}
        emptyText="No packages yet. Add your first package to get started."
        footer={
          <Pagination
            page={safePage}
            totalPages={totalPages}
            total={packages.length}
            from={from}
            to={to}
            onPageChange={setPage}
            itemLabel="package"
          />
        }
      >
        {paginated.map((pkg, i) => (
          <TableRow key={pkg.id} isLast={i === paginated.length - 1}>

            {/* Package Name + Description */}
            <Td>
              <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {pkg.name}
              </p>
              {pkg.description && (
                <p
                  className="text-xs mt-0.5 truncate max-w-[260px]"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {pkg.description}
                </p>
              )}
            </Td>

            {/* Eligible Services */}
            <Td>
              <div className="space-y-1">
                {(pkg.service_links || []).slice(0, 3).map((link) => (
                  <p key={link.id || link.service_id} className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {link.service?.name || 'Unknown service'}
                    {link.sessions_allowed ? ` · ${link.sessions_allowed} sessions` : ''}
                  </p>
                ))}
                {(!pkg.service_links || pkg.service_links.length === 0) && (
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No eligible services</span>
                )}
                {(pkg.service_links?.length || 0) > 3 && (
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>+{(pkg.service_links?.length || 0) - 3} more</span>
                )}
              </div>
            </Td>

            {/* Pricing Preview */}
            <Td className="whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
              {(() => {
                const preview = packagePreview(pkg);
                return (
                  <div className="text-xs space-y-0.5">
                    <p>Service: {preview?.serviceTotal !== null && preview?.serviceTotal !== undefined ? `SAR ${preview.serviceTotal.toLocaleString()}` : '—'}</p>
                    <p>Delivery: {preview?.deliveryTotal !== null && preview?.deliveryTotal !== undefined ? `SAR ${preview.deliveryTotal.toLocaleString()}` : 'TBD'}</p>
                    <p>Discount: {preview?.discount !== null && preview?.discount !== undefined ? `${preview.discount.toFixed(1)}%` : '—'}</p>
                    <p className="font-medium">Final: {pkg.total_price !== null ? `SAR ${Number(pkg.total_price).toLocaleString()}` : '—'}</p>
                  </div>
                );
              })()}
            </Td>

            {/* Sessions */}
            <Td className="whitespace-nowrap">
              {pkg.total_sessions !== null ? (
                <span className="inline-flex items-center gap-1.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  <Layers size={13} style={{ color: 'var(--color-accent)' }} />
                  {pkg.total_sessions} sessions
                </span>
              ) : (
                <span style={{ color: 'var(--color-text-muted)' }}>—</span>
              )}
            </Td>

            {/* Validity */}
            <Td className="whitespace-nowrap">
              {pkg.validity_days !== null ? (
                <span className="inline-flex items-center gap-1.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  <CalendarDays size={13} style={{ color: 'var(--color-info)' }} />
                  {pkg.validity_days} days
                </span>
              ) : (
                <span style={{ color: 'var(--color-text-muted)' }}>—</span>
              )}
            </Td>

            {/* Status */}
            <Td>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  background: pkg.is_active
                    ? 'var(--color-status-confirmed-bg)'
                    : 'var(--color-status-noshow-bg)',
                  color: pkg.is_active
                    ? 'var(--color-status-confirmed-text)'
                    : 'var(--color-status-noshow-text)',
                }}
              >
                {pkg.is_active ? 'Active' : 'Inactive'}
              </span>
            </Td>

            {/* Actions */}
            <Td>
              <div className="flex items-center gap-1 justify-end">
                <button
                  onClick={() => toggleActive(pkg)}
                  title={pkg.is_active ? 'Deactivate' : 'Activate'}
                  className="w-7 h-7 rounded-md flex items-center justify-center"
                  style={{
                    color: pkg.is_active ? 'var(--color-success)' : 'var(--color-text-muted)',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = pkg.is_active
                      ? 'var(--color-warning)'
                      : 'var(--color-success)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = pkg.is_active
                      ? 'var(--color-success)'
                      : 'var(--color-text-muted)')
                  }
                >
                  {pkg.is_active ? <ToggleRight size={17} /> : <ToggleLeft size={17} />}
                </button>

                <button
                  onClick={() => setPkgModal({ open: true, mode: 'edit', data: pkg })}
                  title="Edit"
                  className="w-7 h-7 rounded-md flex items-center justify-center"
                  style={{ color: 'var(--color-text-muted)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-accent)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
                >
                  <Pencil size={14} />
                </button>

                <button
                  onClick={() =>
                    setDeleteModal({
                      message: `Deactivate "${pkg.name}"? Existing wallet/history rows stay preserved.`,
                      onConfirm: () => deletePackage(pkg.id),
                    })
                  }
                  title="Delete"
                  className="w-7 h-7 rounded-md flex items-center justify-center"
                  style={{ color: 'var(--color-text-muted)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-danger)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </Td>

          </TableRow>
        ))}
      </Table>



      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Customer Package Wallets
          </h3>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Staff visibility for bot package requests, active wallets, remaining sessions, and immutable ledger events.
          </p>
          {walletError && <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{walletError}</p>}
        </div>

        <Table
          headers={WALLET_HEADERS}
          loading={loading}
          isEmpty={wallets.length === 0}
          emptyText="No customer package wallets yet. Bot package requests and staff-created wallets will appear here."
        >
          {wallets.slice(0, 20).map((wallet, i) => {
            const lastEvent = wallet.ledger?.[0];
            const canActivate = wallet.status === 'pending_payment';
            const canRefund = ['pending_payment', 'active'].includes(wallet.status) && !wallet.first_used_at;
            const canVoid = ['pending_payment', 'active'].includes(wallet.status);
            return (
              <TableRow key={wallet.id} isLast={i === Math.min(wallets.length, 20) - 1}>
                <Td>
                  <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {wallet.customer?.full_name || 'Unnamed customer'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{wallet.customer?.phone || 'No phone'}</p>
                </Td>
                <Td>
                  <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{wallet.package?.name || 'Unknown package'}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Source: {wallet.source || '—'}</p>
                </Td>
                <Td className="whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
                  {wallet.remaining_sessions ?? '—'} / {wallet.total_sessions ?? '—'} sessions
                </Td>
                <Td>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--color-page-bg)', color: 'var(--color-text-secondary)' }}>
                    {wallet.status}
                  </span>
                </Td>
                <Td>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{lastEvent?.event_type || '—'}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{lastEvent?.created_at ? new Date(lastEvent.created_at).toLocaleString() : ''}</p>
                </Td>
                <Td>
                  <div className="flex items-center gap-1 justify-end">
                    {canActivate && (
                      <button className="text-xs px-2 py-1 rounded-md" style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }} onClick={() => updateWallet(wallet.id, 'activate')}>Activate</button>
                    )}
                    {canRefund && (
                      <button className="text-xs px-2 py-1 rounded-md" style={{ background: 'var(--color-status-cancelled-bg)', color: 'var(--color-status-cancelled-text)' }} onClick={() => updateWallet(wallet.id, 'refund')}>Refund</button>
                    )}
                    {canVoid && (
                      <button className="text-xs px-2 py-1 rounded-md" style={{ background: 'var(--color-page-bg)', color: 'var(--color-text-muted)' }} onClick={() => updateWallet(wallet.id, 'void')}>Void</button>
                    )}
                  </div>
                </Td>
              </TableRow>
            );
          })}
        </Table>
      </div>

      {/* Package Modal */}
      {pkgModal?.open && (
        <PackageModal
          mode={pkgModal.mode}
          initial={pkgModal.data}
          onClose={() => setPkgModal(null)}
          services={serviceLeaves}
          onSave={(form) => savePackage(form, pkgModal.data?.id)}
        />
      )}

      {/* Delete Confirm */}
      {deleteModal && (
        <ConfirmModal
          message={deleteModal.message}
          onConfirm={deleteModal.onConfirm}
          onClose={() => setDeleteModal(null)}
        />
      )}
    </div>
  );
}
