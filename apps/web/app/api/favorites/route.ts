import { NextResponse } from 'next/server';
import { apiFetch } from '../../../lib/server-auth';

export async function GET(): Promise<NextResponse> {
  const response = await apiFetch('/favorites');
  if (!response.ok) return NextResponse.json({ error: 'Unable to load favorites' }, { status: response.status });
  return NextResponse.json(await response.json());
}
