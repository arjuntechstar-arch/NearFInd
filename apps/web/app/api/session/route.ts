import { NextResponse } from 'next/server';
import { apiFetch } from '../../../lib/server-auth';

export async function GET(): Promise<NextResponse> {
  const response = await apiFetch('/me');
  if (response.status === 401) return NextResponse.json({ authenticated: false }, { status: 200 });
  if (!response.ok) return NextResponse.json({ error: 'Unable to load profile' }, { status: response.status });

  const profile: unknown = await response.json();
  return NextResponse.json({ authenticated: true, profile });
}
