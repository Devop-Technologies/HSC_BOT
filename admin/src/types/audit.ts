// ─── Audit Log Types ──────────────────────────────────────────

export type AuditModule =
  | 'booking'
  | 'client'
  | 'provider'
  | 'driver'
  | 'service'
  | 'package'
  | 'payment'
  | 'settings';

export type AuditAction =
  | 'created'
  | 'updated'
  | 'activated'
  | 'deactivated'
  | 'status_changed'
  | 'services_updated'
  | 'rescheduled'
  | 'payment.paid'
  | 'payment.refunded'
  | 'payment.pending';

export interface AuditLog {
  id: string;
  created_at: string;
  module: AuditModule | string;
  action: AuditAction | string;
  entity_id: string | null;
  entity_label: string | null;
  details: Record<string, unknown> | null;
  performed_by: string | null;
  performed_by_id: string | null;
}

export interface AuditLogsResponse {
  data: AuditLog[];
  total: number;
  page: number;
  totalPages: number;
}
