// ─── Auth Types ───────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
}

export interface JWTPayload {
  sub: string; // user id
  email: string;
  name: string;
  role: string;
}
