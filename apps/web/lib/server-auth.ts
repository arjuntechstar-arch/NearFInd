import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const ACCESS_TOKEN_COOKIE = 'nearfind_access_token';
const STATE_COOKIE = 'nearfind_oauth_state';
const VERIFIER_COOKIE = 'nearfind_pkce_verifier';
const TRANSIENT_MAX_AGE_SECONDS = 600;
const ACCESS_TOKEN_MAX_AGE_SECONDS = 3600;

interface OidcDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
}

export function getWebAuthConfig() {
  const issuer = process.env.OIDC_WEB_ISSUER_URL?.replace(/\/$/, '');
  const clientId = process.env.OIDC_WEB_CLIENT_ID;
  const baseUrl = process.env.WEB_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
  const redirectUri = process.env.OIDC_WEB_REDIRECT_URI ?? `${baseUrl}/auth/callback`;
  if (!issuer || !clientId) throw new Error('Web OIDC is not configured');
  return { issuer, clientId, baseUrl, redirectUri };
}

export function getApiBaseUrl(): string {
  return (process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/v1').replace(/\/$/, '');
}

export async function getDiscovery(): Promise<OidcDiscovery> {
  const { issuer } = getWebAuthConfig();
  const response = await fetch(`${issuer}/.well-known/openid-configuration`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to load OIDC discovery document');
  const body = (await response.json()) as Partial<OidcDiscovery>;
  if (!body.authorization_endpoint || !body.token_endpoint) throw new Error('OIDC discovery document is incomplete');
  return { authorization_endpoint: body.authorization_endpoint, token_endpoint: body.token_endpoint };
}

export function generateOpaqueValue(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function createPkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function setLoginCookies(response: NextResponse, state: string, verifier: string): Promise<void> {
  const secure = process.env.NODE_ENV === 'production';
  const options = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/', maxAge: TRANSIENT_MAX_AGE_SECONDS };
  response.cookies.set(STATE_COOKIE, state, options);
  response.cookies.set(VERIFIER_COOKIE, verifier, options);
}

export async function readLoginCookies(): Promise<{ state?: string; verifier?: string }> {
  const store = await cookies();
  const state = store.get(STATE_COOKIE)?.value;
  const verifier = store.get(VERIFIER_COOKIE)?.value;
  return {
    ...(state ? { state } : {}),
    ...(verifier ? { verifier } : {}),
  };
}

export function clearLoginCookies(response: NextResponse): void {
  response.cookies.delete(STATE_COOKIE);
  response.cookies.delete(VERIFIER_COOKIE);
}

export function setAccessTokenCookie(response: NextResponse, token: string, expiresIn?: number): void {
  const secure = process.env.NODE_ENV === 'production';
  response.cookies.set(ACCESS_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.max(60, Math.min(expiresIn ?? ACCESS_TOKEN_MAX_AGE_SECONDS, 86400)),
  });
}

export function clearAccessTokenCookie(response: NextResponse): void {
  response.cookies.delete(ACCESS_TOKEN_COOKIE);
}

export async function getAccessToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

export function assertSameOrigin(request: Request): void {
  const { baseUrl } = getWebAuthConfig();
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(baseUrl).origin) throw new Error('Invalid request origin');
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  if (!token) return new Response(null, { status: 401 });
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  return fetch(`${getApiBaseUrl()}${path}`, { ...init, headers, cache: 'no-store' });
}
