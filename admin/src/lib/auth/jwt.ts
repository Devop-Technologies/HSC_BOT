import { SignJWT, jwtVerify } from 'jose';
import type { JWTPayload } from '@/types/auth';

export type { JWTPayload };

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET!);

const EXPIRES_IN = '7d';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRES_IN)
    .sign(secret());
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export { COOKIE_MAX_AGE };
