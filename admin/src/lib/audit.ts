import { cookies } from "next/headers";
import { verifyToken } from "./auth/jwt";
import { pool } from "./db";
import type { AuditModule, AuditAction } from "@/types/audit";

interface LogActionParams {
  module: AuditModule | string;
  action: AuditAction | string;
  entity_id?: string;
  entity_label?: string;
  details?: Record<string, unknown>;
}

/**
 * Fire-and-forget audit logger. Call from any API route.
 * Never throws — logging failure must never break the main operation.
 */
export async function logAction(params: LogActionParams): Promise<void> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token")?.value;

    let performedBy = "System";
    let performedById: string | null = null;

    if (token) {
      const payload = await verifyToken(token);
      if (payload) {
        performedBy =
          (payload.name as string) || (payload.email as string) || "Admin";
        performedById = (payload.sub as string) ?? null;
      }
    }

    await pool.query(
      `INSERT INTO audit_logs
        (module, action, entity_id, entity_label, details, performed_by, performed_by_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        params.module,
        params.action,
        params.entity_id ?? null,
        params.entity_label ?? null,
        params.details ? JSON.stringify(params.details) : null,
        performedBy,
        performedById,
      ]
    );
  } catch {
    // Intentionally swallowed — logs must never break business logic
  }
}
