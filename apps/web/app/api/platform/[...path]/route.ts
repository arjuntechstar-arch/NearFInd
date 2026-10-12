import { NextResponse } from 'next/server';
import { apiFetch, assertSameOrigin } from '../../../../lib/server-auth';

const ALLOWED_ROOTS = new Set([
  'account',
  'providers',
  'provider',
  'admin',
  'contributions',
  'reviews',
  'notifications',
  'offline-pack',
  'fuel-observations',
  'ev-connectors',
  'route-optimizations',
  'route-sessions',
  'provider-slots',
  'bookings',
  'dispatch-requests',
  'rewards',
  'properties',
  'inspection-bookings',
  'uploads',
  'feature-flags',
]);
const MAX_PROXY_BODY_BYTES = 1_048_576;

function validSegment(segment: string): boolean {
  if (segment.length === 0 || segment.length > 100) return false;
  for (const char of segment) {
    const code = char.charCodeAt(0);
    const allowed =
      (code >= 48 && code <= 57) ||
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122) ||
      char === '-' ||
      char === '_';
    if (!allowed) return false;
  }
  return true;
}

function buildUpstreamPath(request: Request, path: string[]): string | null {
  if (path.length === 0 || path.length > 8 || !ALLOWED_ROOTS.has(path[0] ?? '') || path.some((segment) => !validSegment(segment))) {
    return null;
  }
  const url = new URL(request.url);
  return `/${path.map(encodeURIComponent).join('/')}${url.search}`;
}

async function proxy(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
): Promise<NextResponse> {
  const { path } = await context.params;
  const upstreamPath = buildUpstreamPath(request, path);
  if (!upstreamPath) return NextResponse.json({ error: 'Unsupported API path' }, { status: 404 });

  if (method !== 'GET') {
    try {
      assertSameOrigin(request);
    } catch {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_PROXY_BODY_BYTES) {
    return NextResponse.json({ error: 'Request body is too large' }, { status: 413 });
  }

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const body = method === 'GET' || method === 'DELETE' ? undefined : await request.text();
  if (body && new TextEncoder().encode(body).byteLength > MAX_PROXY_BODY_BYTES) {
    return NextResponse.json({ error: 'Request body is too large' }, { status: 413 });
  }

  const response = await apiFetch(upstreamPath, {
    method,
    headers,
    ...(body !== undefined && body.length > 0 ? { body } : {}),
  });
  const responseType = response.headers.get('content-type') ?? 'application/json';
  const responseBody = await response.text();
  return new NextResponse(responseBody, { status: response.status, headers: { 'content-type': responseType } });
}

export function GET(request: Request, context: { params: Promise<{ path: string[] }> }): Promise<NextResponse> {
  return proxy(request, context, 'GET');
}

export function POST(request: Request, context: { params: Promise<{ path: string[] }> }): Promise<NextResponse> {
  return proxy(request, context, 'POST');
}

export function PATCH(request: Request, context: { params: Promise<{ path: string[] }> }): Promise<NextResponse> {
  return proxy(request, context, 'PATCH');
}

export function DELETE(request: Request, context: { params: Promise<{ path: string[] }> }): Promise<NextResponse> {
  return proxy(request, context, 'DELETE');
}
