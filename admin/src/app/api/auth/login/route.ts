import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { signToken, COOKIE_MAX_AGE } from '@/lib/auth/jwt';

function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required for admin login');
  }

  return new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const pool = getPool();
    const result = await pool.query(
      'SELECT id, email, full_name, password, role, is_active FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    await pool.end();

    const user = result.rows[0];
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (!user.is_active) {
      return NextResponse.json({ error: 'Account deactivated' }, { status: 403 });
    }

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = await signToken({
      sub: user.id,
      email: user.email,
      name: user.full_name,
      role: user.role,
    });

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.full_name, role: user.role },
    });

    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Login error:', message);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
