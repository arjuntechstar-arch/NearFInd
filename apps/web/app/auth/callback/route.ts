import { NextResponse } from 'next/server';
import { clearLoginCookies, getDiscovery, getWebAuthConfig, readLoginCookies, safeEqual, setAccessTokenCookie } from '../../../lib/server-auth';

export async function GET(request: Request): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const returnedState = requestUrl.searchParams.get('state');
  const login = await readLoginCookies();

  const fallback = NextResponse.redirect(new URL('/?auth=failed', request.url));
  clearLoginCookies(fallback);
  if (!code || !returnedState || !login.state || !login.verifier || !safeEqual(returnedState, login.state)) return fallback;

  try {
    const config = getWebAuthConfig();
    const discovery = await getDiscovery();
    const tokenResponse = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        code,
        redirect_uri: config.redirectUri,
        code_verifier: login.verifier,
      }),
      cache: 'no-store',
    });
    if (!tokenResponse.ok) return fallback;

    const tokenBody = (await tokenResponse.json()) as { access_token?: unknown; expires_in?: unknown };
    if (typeof tokenBody.access_token !== 'string' || tokenBody.access_token.length === 0 || tokenBody.access_token.length > 8192) return fallback;

    const response = NextResponse.redirect(new URL('/', request.url));
    clearLoginCookies(response);
    setAccessTokenCookie(response, tokenBody.access_token, typeof tokenBody.expires_in === 'number' ? tokenBody.expires_in : undefined);
    return response;
  } catch {
    return fallback;
  }
}
