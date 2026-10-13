import { NativeModules, Platform } from 'react-native';

declare const process: {
  env: {
    EXPO_PUBLIC_API_BASE_URL?: string;
  };
};

const LOCALHOST_NAMES = new Set(['localhost', '127.0.0.1', '::1']);

export function resolveMobileApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
  const metroHost = resolveMetroHost();

  if (configured) {
    try {
      const url = new URL(configured);
      if (LOCALHOST_NAMES.has(url.hostname)) {
        if (metroHost && !LOCALHOST_NAMES.has(metroHost)) url.hostname = metroHost;
        else if (Platform.OS === 'android') url.hostname = '10.0.2.2';
      }
      return url.toString().replace(/\/$/, '');
    } catch {
      return configured;
    }
  }

  if (metroHost && !LOCALHOST_NAMES.has(metroHost)) return `http://${metroHost}:4000/v1`;
  if (Platform.OS === 'android') return 'http://10.0.2.2:4000/v1';
  return 'http://localhost:4000/v1';
}

function resolveMetroHost(): string | null {
  const sourceCode = NativeModules.SourceCode as { scriptURL?: unknown } | undefined;
  if (typeof sourceCode?.scriptURL !== 'string') return null;
  try {
    return new URL(sourceCode.scriptURL).hostname || null;
  } catch {
    return null;
  }
}
