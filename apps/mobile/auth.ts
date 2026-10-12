import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'nearfind.oidc.session.v1';
const TOKEN_REFRESH_MARGIN_SECONDS = 60;

export interface StoredAuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  issuedAt: number;
}

interface TokenResponseLike {
  accessToken: string;
  refreshToken?: string | null;
  expiresIn?: number | null;
  issuedAt?: number | null;
}

export async function loadAuthSession(): Promise<StoredAuthSession | null> {
  const value = await SecureStore.getItemAsync(SESSION_KEY);
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<StoredAuthSession>;
    if (typeof parsed.accessToken !== 'string' || parsed.accessToken.length === 0) return null;
    if (typeof parsed.issuedAt !== 'number' || !Number.isFinite(parsed.issuedAt)) return null;
    return {
      accessToken: parsed.accessToken,
      ...(typeof parsed.refreshToken === 'string' && parsed.refreshToken.length > 0
        ? { refreshToken: parsed.refreshToken }
        : {}),
      ...(typeof parsed.expiresIn === 'number' && Number.isFinite(parsed.expiresIn)
        ? { expiresIn: parsed.expiresIn }
        : {}),
      issuedAt: parsed.issuedAt,
    };
  } catch {
    await clearAuthSession();
    return null;
  }
}

export async function saveAuthSession(token: TokenResponseLike): Promise<StoredAuthSession> {
  const session: StoredAuthSession = {
    accessToken: token.accessToken,
    ...(token.refreshToken ? { refreshToken: token.refreshToken } : {}),
    ...(typeof token.expiresIn === 'number' ? { expiresIn: token.expiresIn } : {}),
    issuedAt: token.issuedAt ?? AuthSession.getCurrentTimeInSeconds(),
  };
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function clearAuthSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export function isSessionFresh(session: StoredAuthSession): boolean {
  if (session.expiresIn === undefined) return true;
  return AuthSession.getCurrentTimeInSeconds() + TOKEN_REFRESH_MARGIN_SECONDS < session.issuedAt + session.expiresIn;
}

export async function refreshAuthSession(
  session: StoredAuthSession,
  clientId: string,
  discovery: Pick<AuthSession.DiscoveryDocument, 'tokenEndpoint'>,
): Promise<StoredAuthSession | null> {
  if (isSessionFresh(session)) return session;
  if (!session.refreshToken || !discovery.tokenEndpoint) return null;

  const token = await AuthSession.refreshAsync(
    {
      clientId,
      refreshToken: session.refreshToken,
    },
    discovery,
  );

  return saveAuthSession({
    accessToken: token.accessToken,
    refreshToken: token.refreshToken ?? session.refreshToken,
    expiresIn: token.expiresIn,
    issuedAt: token.issuedAt,
  });
}
