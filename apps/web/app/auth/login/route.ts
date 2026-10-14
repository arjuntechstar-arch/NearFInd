import { NextResponse, type NextRequest } from 'next/server';
import {
  createLocalDevToken,
import { NextResponse } from 'next/server';
import {
  createPkceChallenge,
  generateOpaqueValue,
  getDiscovery,
  getWebAuthConfig,
  getWebBaseUrl,
  isLocalDevAuthEnabled,
  setAccessTokenCookie,
  setLoginCookies,
} from '../../../lib/server-auth';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    if (isLocalDevAuthEnabled()) {
      const role = request.nextUrl.searchParams.get('role');
      const response = NextResponse.redirect(new URL('/', getWebBaseUrl()));
      setAccessTokenCookie(response, createLocalDevToken(role), 86_400);
  isDevelopmentAuthEnabled,
  requestDevelopmentAccessToken,
  setAccessTokenCookie,
  setLoginCookies,
  type DevelopmentRole,
} from '../../../lib/server-auth';

const developmentRoles = new Set<DevelopmentRole>(['USER', 'PROVIDER', 'ADMIN']);

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const requestUrl = new URL(request.url);
    const requestedRole = requestUrl.searchParams.get('role')?.toUpperCase() as DevelopmentRole | undefined;
    const role = requestedRole && developmentRoles.has(requestedRole) ? requestedRole : 'USER';
    const next = safeNextPath(requestUrl.searchParams.get('next'));

    if (isDevelopmentAuthEnabled()) {
      const session = await requestDevelopmentAccessToken(role);
      const response = NextResponse.redirect(new URL(next, getWebBaseUrl()));
      setAccessTokenCookie(response, session.accessToken, session.expiresIn);
      return response;
    }

    const config = getWebAuthConfig();
    const discovery = await getDiscovery();
    const state = generateOpaqueValue();
    const verifier = generateOpaqueValue(48);
    const authorizationUrl = new URL(discovery.authorization_endpoint);
    authorizationUrl.searchParams.set('client_id', config.clientId);
    authorizationUrl.searchParams.set('redirect_uri', config.redirectUri);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('scope', 'openid profile email');
    authorizationUrl.searchParams.set('state', state);
    authorizationUrl.searchParams.set('code_challenge', createPkceChallenge(verifier));
    authorizationUrl.searchParams.set('code_challenge_method', 'S256');

    const response = NextResponse.redirect(authorizationUrl);
    await setLoginCookies(response, state, verifier);
    return response;
  } catch {
    return NextResponse.json({ error: 'Web sign-in is not configured.' }, { status: 503 });
  }
}

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}
