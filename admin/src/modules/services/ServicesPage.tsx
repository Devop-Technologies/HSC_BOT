'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Home,
  Building2,
  Droplets,
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  GripVertical,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { Table, TableRow, Td } from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import ConfirmModal from '@/components/modals/ConfirmModal';
import ServiceTreeModal from '@/components/modals/ServiceTreeModal';
import type { Service, ServiceForm } from '@/types/services';

// ─── Constants ────────────────────────────────────────────────

const PAGE_SIZE = 25;

// ─── Feature Icon ─────────────────────────────────────────────

function FeatureIcon({
  active,
  icon: Icon,
  title,
}: {
  active: boolean;
  icon: React.ElementType;
  title: string;
}) {
  return (
    <span
      title={title}
      style={{
        color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
        opacity: active ? 1 : 0.3,
      }}
    >
      <Icon size={14} />
    </span>
  );
}

// ─── Category Badge ───────────────────────────────────────────

function CategoryBadge({ cat }: { cat: string }) {
  const styles: Record<string, React.CSSProperties> = {
    category: {
      background: 'var(--color-accent-subtle)',
      color: 'var(--color-accent)',
    },
    service: {
      background: 'var(--color-info-bg)',
      color: 'var(--color-info)',
    },
  };
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
      style={styles[cat] || styles.service}
    >
      {cat}
    </span>
  );
}

// ─── Tree Node Row ────────────────────────────────────────────

function TreeNodeRow({
  node,
  depth = 0,
  expanded,
  onToggle,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  node: Service;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (svc: Service) => void;
  onToggleActive: (svc: Service) => void;
  onDelete: (svc: Service) => void;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const indent = depth * 24;

  const categoryIcon =
    node.service_category === 'category' ? (
      <Folder size={15} style={{ color: 'var(--color-accent)' }} />
    ) : (
      <FileText size={15} style={{ color: 'var(--color-text-muted)' }} />
    );

  return (
    <>
      <TableRow>
        {/* Name + Tree */}
        <Td>
          <div className="flex items-center gap-1.5" style={{ paddingLeft: indent }}>
            {/* Expand/collapse */}
            {hasChildren ? (
              <button
                onClick={() => onToggle(node.id)}
                className="w-5 h-5 flex items-center justify-center rounded flex-shrink-0 cursor-pointer hover:opacity-70"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            ) : (
              <div className="w-5 flex-shrink-0" />
            )}

            {/* Icon */}
            <span className="flex-shrink-0">{categoryIcon}</span>

            {/* Name + Arabic + description */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {node.icon && (
                  <span className="text-base flex-shrink-0" title="Icon">
                    {node.icon}
                  </span>
                )}
                <p
                  className="font-medium truncate"
                  style={{
                    color: 'var(--color-text-primary)',
                    fontWeight: node.service_category === 'category' ? 600 : 500,
                  }}
                >
                  {node.name}
                </p>
              </div>
              {node.name_ar && (
                <p
                  className="text-xs mt-0.5 truncate max-w-[200px]"
                  dir="rtl"
                  style={{ color: 'var(--color-text-muted)', fontFamily: 'system-ui' }}
                >
                  {node.name_ar}
                </p>
              )}
              {node.description && depth <= 1 && (
                <p
                  className="text-xs mt-0.5 truncate max-w-[220px]"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {node.description}
                </p>
              )}
            </div>
          </div>
        </Td>

        {/* Category */}
        <Td>
          <CategoryBadge cat={node.service_category} />
        </Td>

        {/* Price */}
        <Td className="whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
          {node.price !== null ? `SAR ${Number(node.price).toLocaleString()}` : '—'}
        </Td>

        {/* Duration */}
        <Td className="whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>
          {node.duration_minutes !== null ? `${node.duration_minutes} min` : '—'}
        </Td>

        {/* Price Options */}
        <Td>
          {node.price_options && node.price_options.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {node.price_options.map((po, i) => (
                <span
                  key={i}
                  className="text-xs whitespace-nowrap"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {po.label || `${po.duration_minutes}min`}: SAR {Number(po.price).toLocaleString()}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              —
            </span>
          )}
        </Td>

        {/* Features */}
        <Td>
          <div className="flex items-center gap-2">
            <FeatureIcon active={!!node.oil_based} icon={Droplets} title="Oil-based" />
            <FeatureIcon active={!!node.available_for_home} icon={Home} title="Available for Home" />
            <FeatureIcon active={!!node.available_in_center} icon={Building2} title="Available in Center" />
          </div>
        </Td>

        {/* Status */}
        <Td>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              background: node.is_active
                ? 'var(--color-status-confirmed-bg)'
                : 'var(--color-status-noshow-bg)',
              color: node.is_active
                ? 'var(--color-status-confirmed-text)'
                : 'var(--color-status-noshow-text)',
            }}
          >
            {node.is_active ? 'Active' : 'Inactive'}
          </span>
        </Td>

        {/* Actions */}
        <Td>
          <div className="flex items-center gap-1 justify-end">
            <button
              onClick={() => onToggleActive(node)}
              title={node.is_active ? 'Deactivate' : 'Activate'}
              className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer"
              style={{
                color: node.is_active ? 'var(--color-success)' : 'var(--color-text-muted)',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = node.is_active
                  ? 'var(--color-warning)'
                  : 'var(--color-success)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = node.is_active
                  ? 'var(--color-success)'
                  : 'var(--color-text-muted)')
              }
            >
              {node.is_active ? <ToggleRight size={17} /> : <ToggleLeft size={17} />}
            </button>

            <button
              onClick={() => onEdit(node)}
              title="Edit"
              className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer"
              style={{ color: 'var(--color-text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
            >
              <Pencil size={14} />
            </button>

            <button
              onClick={() => onDelete(node)}
              title="Delete"
              className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer"
              style={{ color: 'var(--color-text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-danger)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </Td>
      </TableRow>

      {/* Children (recursive) */}
      {hasChildren && isExpanded && (
        <>
          {node.children!.map((child) => (
            <TreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onEdit={onEdit}
              onToggleActive={onToggleActive}
              onDelete={onDelete}
            />
          ))}
        </>
      )}
    </>
  );
}

// ─── Flatten tree for search/pagination ───────────────────────

function flattenTree(nodes: Service[]): Service[] {
  const flat: Service[] = [];
  function walk(list: Service[], depth: number) {
    for (const n of list) {
      flat.push({ ...n, _depth: depth });
      if (n.children && n.children.length > 0) {
        walk(n.children, depth + 1);
      }
    }
  }
  walk(nodes, 0);
  return flat;
}

function buildTree(flat: Service[]): Service[] {
  const map = new Map<string, Service>();
  const roots: Service[] = [];

  // First pass: index all
  for (const s of flat) {
    map.set(s.id, { ...s, children: [] });
  }

  // Second pass: build hierarchy
  for (const s of flat) {
    const node = map.get(s.id)!;
    if (s.parent_id && map.has(s.parent_id)) {
      map.get(s.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort by sort_order at each level
  function sortTree(nodes: Service[]) {
    nodes.sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
    for (const n of nodes) {
      if (n.children && n.children.length > 0) sortTree(n.children);
    }
  }
  sortTree(roots);

  return roots;
}

// ─── Page ─────────────────────────────────────────────────────

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const [svcModal, setSvcModal] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    data?: Service;
  } | null>(null);

  const [deleteModal, setDeleteModal] = useState<{
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // ── Build tree ──────────────────────────────────────────────

  const tree = useMemo(() => buildTree(services), [services]);
  const flatList = useMemo(() => flattenTree(tree), [tree]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return flatList;
    const q = searchQuery.toLowerCase();
    return flatList.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.name_ar && s.name_ar.toLowerCase().includes(q)) ||
        (s.description && s.description.toLowerCase().includes(q))
    );
  }, [flatList, searchQuery]);

  // ── Load ────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/services');
      if (res.ok) {
        setServices(await res.json());
        setPage(1);
      }
    } catch {
      setError('Failed to load services');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Tree toggle ─────────────────────────────────────────────

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Expand all by default on first load
  useEffect(() => {
    if (services.length > 0 && expanded.size === 0) {
      // Expand top-level categories
      const cats = services.filter((s) => !s.parent_id);
      setExpanded(new Set(cats.map((c) => c.id)));
    }
  }, [services, expanded.size]);

  // ── CRUD ────────────────────────────────────────────────────

  const saveService = async (form: ServiceForm, id?: string) => {
    const payload: Record<string, unknown> = {
      name: form.name,
      name_ar: form.name_ar || null,
      description: form.description || null,
      icon: form.icon || null,
      parent_id: form.parent_id || null,
      sort_order: form.sort_order !== '' ? Number(form.sort_order) : 0,
      oil_based: form.oil_based,
      available_for_home: form.available_for_home,
      available_in_center: form.available_in_center,
      service_category: form.service_category,
      price: form.price !== '' ? Number(form.price) : null,
      duration_minutes: form.duration_minutes !== '' ? Number(form.duration_minutes) : null,
      delivery_fee: form.delivery_fee !== '' ? Number(form.delivery_fee) : null,
    };

    // Strip price_options if it's a category (categories don't have prices)
    if (form.service_category === 'category') {
      payload.price_options = [];
    } else if (form.price_options && form.price_options.length > 0) {
      payload.price_options = form.price_options.filter(
        (po) => po.price !== null || po.duration_minutes !== null
      );
    }

    const res = id
      ? await fetch(`/api/services/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : await fetch('/api/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

    if (!res.ok) throw new Error((await res.json()).error);
    await load();
  };

  const toggleActive = async (svc: Service) => {
    await fetch(`/api/services/${svc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !svc.is_active }),
    });
    await load();
  };

  const deleteService = async (id: string) => {
    const res = await fetch(`/api/services/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete');
    await load();
  };

  // ── Pagination ───────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE, filtered.length);

  // ── Parent options for modal ────────────────────────────────

  const parentOptions = useMemo(() => {
    return services
      .filter((s) => s.service_category === 'category')
      .map((s) => ({ id: s.id, name: s.name, name_ar: s.name_ar }));
  }, [services]);

  // ── Render ──────────────────────────────────────────────────

  const TABLE_HEADERS = ['Name', 'Type', 'Price', 'Duration', 'Price Options', 'Features', 'Status', ''];

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Service Catalog
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Manage nested service categories and bookable service leaves. Packages live in the separate Packages module.
          </p>
        </div>
        <Button
          leftIcon={<Plus size={15} />}
          onClick={() => setSvcModal({ open: true, mode: 'create' })}
          className="self-start sm:self-auto"
        >
          Add Service
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search services by name, Arabic name, or description..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(1);
          }}
          className="w-full rounded-lg text-sm outline-none px-4 py-2.5"
          style={{
            background: 'var(--color-input-bg)',
            border: '1px solid var(--color-input-border)',
            color: 'var(--color-text-primary)',
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs cursor-pointer"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <Table
        headers={TABLE_HEADERS}
        loading={loading}
        isEmpty={services.length === 0}
        emptyText={
          searchQuery
            ? 'No services match your search.'
            : 'No services yet. Start by adding a category, then add services under it.'
        }
        footer={
          <Pagination
            page={safePage}
            totalPages={totalPages}
            total={filtered.length}
            from={from}
            to={to}
            onPageChange={setPage}
            itemLabel="service"
          />
        }
      >
        {paginated.map((svc, i) => (
          <TreeNodeRow
            key={svc.id}
            node={svc}
            depth={svc._depth ?? 0}
            expanded={expanded}
            onToggle={toggleExpand}
            onEdit={(s) => setSvcModal({ open: true, mode: 'edit', data: s })}
            onToggleActive={toggleActive}
            onDelete={(s) =>
              setDeleteModal({
                message: `Delete "${s.name}"? This action cannot be undone.${
                  s.children && s.children.length > 0
                    ? ' All child services will also be removed.'
                    : ''
                }`,
                onConfirm: () => deleteService(s.id),
              })
            }
          />
        ))}
      </Table>

      {/* Service Tree Modal */}
      {svcModal?.open && (
        <ServiceTreeModal
          mode={svcModal.mode}
          initial={svcModal.data}
          parentOptions={parentOptions}
          onClose={() => setSvcModal(null)}
          onSave={(form) => saveService(form, svcModal.data?.id)}
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
