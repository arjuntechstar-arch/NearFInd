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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseStoredSession(value: string): StoredAuthSession | null {
  const parsed: unknown = JSON.parse(value);
  if (!isRecord(parsed)) return null;

  const accessToken = parsed.accessToken;
  const issuedAt = parsed.issuedAt;
  const refreshToken = parsed.refreshToken;
  const expiresIn = parsed.expiresIn;

  if (typeof accessToken !== 'string' || accessToken.length === 0) return null;
  if (typeof issuedAt !== 'number' || !Number.isFinite(issuedAt)) return null;
  if (refreshToken !== undefined && (typeof refreshToken !== 'string' || refreshToken.length === 0)) return null;
  if (expiresIn !== undefined && (typeof expiresIn !== 'number' || !Number.isFinite(expiresIn) || expiresIn <= 0)) return null;

  return {
    accessToken,
    ...(typeof refreshToken === 'string' ? { refreshToken } : {}),
    ...(typeof expiresIn === 'number' ? { expiresIn } : {}),
    issuedAt,
  };
}

export async function loadAuthSession(): Promise<StoredAuthSession | null> {
  const value = await SecureStore.getItemAsync(SESSION_KEY);
  if (!value) return null;

  try {
    const session = parseStoredSession(value);
    if (session) return session;
  } catch {
    // Fall through and remove malformed/corrupted persisted state.
  }

  await clearAuthSession();
  return null;
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
  discovery: AuthSession.DiscoveryDocument,
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
    ...(typeof token.expiresIn === 'number' ? { expiresIn: token.expiresIn } : {}),
    issuedAt: token.issuedAt,
  });
}
