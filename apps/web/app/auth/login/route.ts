import { NextResponse } from 'next/server';
import { createPkceChallenge, generateOpaqueValue, getDiscovery, getWebAuthConfig, setLoginCookies } from '../../../lib/server-auth';

export async function GET(): Promise<NextResponse> {
  try {
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
