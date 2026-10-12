import { NextResponse } from 'next/server';
import { apiFetch, assertSameOrigin } from '../../../../lib/server-auth';

function validPlaceId(placeId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(placeId);
}

async function proxyMutation(request: Request, placeId: string, method: 'POST' | 'DELETE'): Promise<NextResponse> {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }
  if (!validPlaceId(placeId)) return NextResponse.json({ error: 'Invalid place id' }, { status: 400 });
  const response = await apiFetch(`/favorites/${placeId}`, { method });
  if (!response.ok) return NextResponse.json({ error: 'Favorite update failed' }, { status: response.status });
  return NextResponse.json(await response.json());
}

export async function POST(request: Request, context: { params: Promise<{ placeId: string }> }): Promise<NextResponse> {
  const { placeId } = await context.params;
  return proxyMutation(request, placeId, 'POST');
}

export async function DELETE(request: Request, context: { params: Promise<{ placeId: string }> }): Promise<NextResponse> {
  const { placeId } = await context.params;
  return proxyMutation(request, placeId, 'DELETE');
}
