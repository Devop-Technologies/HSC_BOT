'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Phone, Search, ToggleLeft, ToggleRight, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Table, TableRow, Td } from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import ConfirmModal from '@/components/modals/ConfirmModal';
import HumanAgentModal from '@/components/modals/HumanAgentModal';
import type { HumanAgent, HumanAgentForm } from '@/types/humanAgents';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setHumanAgents, setLoading, setError } from '@/store/humanAgentsSlice';

const PAGE_SIZE = 10;
const TABLE_HEADERS = ['Agent', 'Phone Number', 'Status', 'Added On', ''];

function agentInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export default function HumanAgentsPage() {
  const dispatch = useAppDispatch();
  const { items: agents, loading } = useAppSelector((s) => s.humanAgents);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const [modal, setModal] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    data?: HumanAgent;
  } | null>(null);

  const [deleteModal, setDeleteModal] = useState<{
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // ── Load ──────────────────────────────────────────────────────

  const load = useCallback(async () => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const res = await fetch('/api/human-agents');
      if (res.ok) {
        dispatch(setHumanAgents(await res.json()));
        setPage(1);
      }
    } catch {
      dispatch(setError('Failed to load agents'));
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search]);

  // ── CRUD ──────────────────────────────────────────────────────

  const saveAgent = async (form: HumanAgentForm, id?: string) => {
    const payload = { name: form.name, phone_number: form.phone_number };

    const res = id
      ? await fetch(`/api/human-agents/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : await fetch('/api/human-agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

    if (!res.ok) throw new Error((await res.json()).error);
    await load();
  };

  const deleteAgent = async (id: string) => {
    const res = await fetch(`/api/human-agents/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete');
    await load();
  };

  const toggleActive = async (agent: HumanAgent) => {
    const res = await fetch(`/api/human-agents/${agent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !agent.is_active }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setErrorBanner(json.error || 'Failed to update agent status.');
      return;
    }
    setErrorBanner(null);
    await load();
  };

  // ── Pagination ────────────────────────────────────────────────

  const filtered = search.trim()
    ? agents.filter((a) =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.phone_number.includes(search)
      )
    : agents;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE, filtered.length);

  const activeCount = agents.filter((a) => a.is_active).length;

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Human Agents
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {activeCount} active · {agents.length} total — notified when a customer requests a real person
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--color-text-muted)' }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or phone…"
              className="text-sm rounded-lg pl-8 pr-3 py-2 outline-none w-56"
              style={{
                background: 'var(--color-input-bg)',
                border: '1px solid var(--color-input-border)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          <Button
            leftIcon={<Plus size={15} />}
            onClick={() => setModal({ open: true, mode: 'create' })}
          >
            Add Agent
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {errorBanner && (
        <div
          className="flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm"
          style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}
        >
          <span>{errorBanner}</span>
          <button onClick={() => setErrorBanner(null)} className="flex-shrink-0 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Info banner when no active agents */}
      {!loading && agents.length > 0 && activeCount === 0 && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}
        >
          No active agents — customer &quot;speak to a real person&quot; requests will go unnotified.
        </div>
      )}

      {/* Table */}
      <Table
        headers={TABLE_HEADERS}
        loading={loading}
        isEmpty={agents.length === 0}
        emptyText="No human agents yet. Add an agent to receive customer contact requests."
        footer={
          <Pagination
            page={safePage}
            totalPages={totalPages}
            total={filtered.length}
            from={from}
            to={to}
            onPageChange={setPage}
            itemLabel="agent"
          />
        }
      >
        {paginated.map((agent, i) => (
          <TableRow key={agent.id} isLast={i === paginated.length - 1}>

            {/* Agent */}
            <Td>
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'var(--color-accent)', color: '#fff' }}
                >
                  {agentInitials(agent.name)}
                </div>
                <span className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
                  {agent.name}
                </span>
              </div>
            </Td>

            {/* Phone */}
            <Td>
              <div className="flex items-center gap-1.5">
                <Phone size={13} style={{ color: 'var(--color-text-muted)' }} />
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {agent.phone_number}
                </span>
              </div>
            </Td>

            {/* Status */}
            <Td>
              <button
                onClick={() => toggleActive(agent)}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium cursor-pointer transition-opacity"
                style={{
                  background: agent.is_active ? 'var(--color-status-confirmed-bg)' : 'var(--color-status-noshow-bg)',
                  color: agent.is_active ? 'var(--color-status-confirmed-text)' : 'var(--color-status-noshow-text)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                title={agent.is_active ? 'Click to deactivate' : 'Click to activate'}
              >
                {agent.is_active ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                {agent.is_active ? 'Active' : 'Inactive'}
              </button>
            </Td>

            {/* Added On */}
            <Td>
              <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {formatDate(agent.created_at)}
              </span>
            </Td>

            {/* Actions */}
            <Td>
              <div className="flex items-center gap-1 justify-end">
                <button
                  onClick={() => setModal({ open: true, mode: 'edit', data: agent })}
                  title="Edit"
                  className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer"
                  style={{ color: 'var(--color-text-muted)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-accent)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() =>
                    setDeleteModal({
                      message: `Delete "${agent.name}"? They will no longer receive customer contact requests.`,
                      onConfirm: () => deleteAgent(agent.id),
                    })
                  }
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
        ))}
      </Table>

      {/* Agent Modal */}
      {modal?.open && (
        <HumanAgentModal
          mode={modal.mode}
          initial={modal.data}
          onClose={() => setModal(null)}
          onSave={(form) => saveAgent(form, modal.data?.id)}
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
