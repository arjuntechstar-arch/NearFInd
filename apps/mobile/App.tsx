import '@expo/metro-runtime';
import { useEffect, useMemo, useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, radii, spacing } from '@nearfind/design-tokens';
import {
  clearAuthSession,
  isSessionFresh,
  loadAuthSession,
  refreshAuthSession,
  saveAuthSession,
  type StoredAuthSession,
} from './auth';

WebBrowser.maybeCompleteAuthSession();

declare const process: {
  env: {
    EXPO_PUBLIC_API_BASE_URL?: string;
    EXPO_PUBLIC_OIDC_ISSUER_URL?: string;
    EXPO_PUBLIC_OIDC_CLIENT_ID?: string;
  };
};

interface Category {
  id: string;
  slug: string;
  name: string;
}

interface NearbyService {
  id: string;
  name: string;
  address: string;
  city: string;
  rating: number;
  reviewCount: number;
  distanceMeters: number;
  category: { slug: string; name: string; icon: string };
}

interface Profile {
  id: string;
  displayName: string | null;
  email: string | null;
  role: 'USER' | 'PROVIDER' | 'ADMIN';
}

interface Favorite {
  placeId: string;
  name: string;
  address: string;
  city: string;
  rating: number;
  reviewCount: number;
  category: { slug: string; name: string } | null;
  createdAt: string;
}

type ViewMode = 'explore' | 'saved';

const apiBaseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/v1').replace(/\/$/, '');
const oidcIssuer = process.env.EXPO_PUBLIC_OIDC_ISSUER_URL?.replace(/\/$/, '');
const oidcClientId = process.env.EXPO_PUBLIC_OIDC_CLIENT_ID;
const redirectUri = AuthSession.makeRedirectUri({ scheme: 'nearfind', path: 'auth/callback' });

export default function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<NearbyService[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Location is only requested when you tap the button.');
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [session, setSession] = useState<StoredAuthSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [authBusy, setAuthBusy] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('explore');

  const favoriteIds = useMemo(() => new Set(favorites.map((favorite) => favorite.placeId)), [favorites]);
  const visibleServices = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return services;
    return services.filter((service) =>
      `${service.name} ${service.category.name} ${service.address} ${service.city}`.toLowerCase().includes(normalized),
    );
  }, [query, services]);

  useEffect(() => {
    void restoreSession();
  }, []);

  async function restoreSession(): Promise<void> {
    setAuthBusy(true);
    try {
      const stored = await loadAuthSession();
      if (!stored) return;
      const active = await ensureFreshSession(stored);
      if (!active) {
        await clearLocalSession();
        return;
      }
      setSession(active);
      await bootstrapIdentity(active);
    } catch {
      await clearLocalSession();
    } finally {
      setAuthBusy(false);
    }
  }

  async function ensureFreshSession(current: StoredAuthSession): Promise<StoredAuthSession | null> {
    if (isSessionFresh(current)) return current;
    if (!oidcIssuer || !oidcClientId || !current.refreshToken) return null;
    const discovery = await AuthSession.fetchDiscoveryAsync(oidcIssuer);
    return refreshAuthSession(current, oidcClientId, discovery);
  }

  async function authenticatedFetch(
    path: string,
    init?: RequestInit,
    explicitSession: StoredAuthSession | null = session,
  ): Promise<Response> {
    if (!explicitSession) throw new Error('Sign in required');
    const active = await ensureFreshSession(explicitSession);
    if (!active) {
      await clearLocalSession();
      throw new Error('Your session expired. Please sign in again.');
    }
    if (active !== explicitSession) setSession(active);

    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${active.accessToken}`);
    const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers });
    if (response.status === 401) {
      await clearLocalSession();
      throw new Error('Your session expired. Please sign in again.');
    }
    return response;
  }

  async function bootstrapIdentity(active: StoredAuthSession): Promise<void> {
    const [profileResponse, favoritesResponse] = await Promise.all([
      authenticatedFetch('/me', undefined, active),
      authenticatedFetch('/favorites', undefined, active),
    ]);
    if (!profileResponse.ok || !favoritesResponse.ok) throw new Error('Unable to load your account');
    setProfile((await profileResponse.json()) as Profile);
    setFavorites((await favoritesResponse.json()) as Favorite[]);
  }

  async function signIn(): Promise<void> {
    if (!oidcIssuer || !oidcClientId) {
      setStatus('Sign-in is not configured. Set the mobile OIDC issuer and client ID.');
      return;
    }

    setAuthBusy(true);
    setStatus('Opening secure sign-in…');
    try {
      const discovery = await AuthSession.fetchDiscoveryAsync(oidcIssuer);
      if (!discovery.authorizationEndpoint || !discovery.tokenEndpoint) {
        throw new Error('Identity provider discovery is incomplete');
      }

      const request = new AuthSession.AuthRequest({
        clientId: oidcClientId,
        redirectUri,
        responseType: AuthSession.ResponseType.Code,
        scopes: ['openid', 'profile', 'email'],
        usePKCE: true,
      });
      const result = await request.promptAsync(discovery);
      if (result.type !== 'success') {
        setStatus(result.type === 'dismiss' || result.type === 'cancel' ? 'Sign-in cancelled.' : 'Sign-in was not completed.');
        return;
      }

      const code = result.params.code;
      if (!code || !request.codeVerifier) throw new Error('Authorization response was incomplete');
      const token = await AuthSession.exchangeCodeAsync(
        {
          clientId: oidcClientId,
          code,
          redirectUri,
          extraParams: { code_verifier: request.codeVerifier },
        },
        discovery,
      );
      const nextSession = await saveAuthSession(token);
      setSession(nextSession);
      await bootstrapIdentity(nextSession);
      setStatus('Signed in securely.');
    } catch (error) {
      await clearLocalSession();
      setStatus(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut(): Promise<void> {
    setAuthBusy(true);
    await clearLocalSession();
    setViewMode('explore');
    setStatus('Signed out.');
    setAuthBusy(false);
  }

  async function clearLocalSession(): Promise<void> {
    await clearAuthSession();
    setSession(null);
    setProfile(null);
    setFavorites([]);
  }

  async function loadCategories(): Promise<Category[]> {
    if (categories.length > 0) return categories;
    const response = await fetch(`${apiBaseUrl}/discovery/categories`);
    if (!response.ok) throw new Error('Unable to load categories');
    const loaded = (await response.json()) as Category[];
    setCategories(loaded);
    return loaded;
  }

  async function loadNearby(lat: number, lng: number, category = activeCategory): Promise<void> {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng), radiusMeters: '10000', limit: '30' });
    if (category) params.set('category', category);
    const response = await fetch(`${apiBaseUrl}/discovery/nearby?${params.toString()}`);
    if (!response.ok) throw new Error('Unable to load nearby services');
    setServices((await response.json()) as NearbyService[]);
  }

  async function useMyLocation(): Promise<void> {
    setLoading(true);
    setStatus('Requesting foreground location…');
    try {
      await loadCategories();
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setStatus('Location permission was not granted. You can enable it later in device settings.');
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const nextCoords = { lat: location.coords.latitude, lng: location.coords.longitude };
      setCoords(nextCoords);
      await loadNearby(nextCoords.lat, nextCoords.lng);
      setStatus('Showing services near your current location.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to load nearby services.');
    } finally {
      setLoading(false);
    }
  }

  async function selectCategory(slug: string): Promise<void> {
    const next = slug === activeCategory ? '' : slug;
    setActiveCategory(next);
    if (!coords) return;
    setLoading(true);
    try {
      await loadNearby(coords.lat, coords.lng, next);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to filter nearby services.');
    } finally {
      setLoading(false);
    }
  }

  async function toggleFavorite(placeId: string): Promise<void> {
    if (!session) {
      await signIn();
      setStatus('Signed in. Tap Save again to save this place.');
      return;
    }

    const saved = favoriteIds.has(placeId);
    try {
      const response = await authenticatedFetch(`/favorites/${placeId}`, { method: saved ? 'DELETE' : 'POST' });
      if (!response.ok) throw new Error(saved ? 'Unable to remove saved place' : 'Unable to save place');
      const favoritesResponse = await authenticatedFetch('/favorites');
      if (!favoritesResponse.ok) throw new Error('Unable to refresh saved places');
      setFavorites((await favoritesResponse.json()) as Favorite[]);
      setStatus(saved ? 'Removed from Saved.' : 'Saved for later.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to update saved places.');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Driver companion</Text>
            <Text style={styles.title}>{viewMode === 'saved' ? 'Your saved places.' : 'Find what you need nearby.'}</Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.accountButton}
            onPress={() => void (session ? signOut() : signIn())}
            disabled={authBusy}
          >
            <Text style={styles.accountButtonText}>{authBusy ? '…' : session ? 'Sign out' : 'Sign in'}</Text>
          </TouchableOpacity>
        </View>

        {profile ? <Text style={styles.accountText}>Signed in as {profile.displayName ?? profile.email ?? 'NearFind user'} · {profile.role}</Text> : null}

        <View style={styles.tabRow}>
          <TouchableOpacity
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === 'explore' }}
            style={[styles.tab, viewMode === 'explore' && styles.tabActive]}
            onPress={() => setViewMode('explore')}
          >
            <Text style={[styles.tabText, viewMode === 'explore' && styles.tabTextActive]}>Explore</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === 'saved' }}
            style={[styles.tab, viewMode === 'saved' && styles.tabActive]}
            onPress={() => setViewMode('saved')}
          >
            <Text style={[styles.tabText, viewMode === 'saved' && styles.tabTextActive]}>Saved ({favorites.length})</Text>
          </TouchableOpacity>
        </View>

        {viewMode === 'explore' ? (
          <>
            <TextInput
              accessibilityLabel="Search nearby services"
              placeholder="Search fuel, ATM, hospital…"
              placeholderTextColor={colors.text.muted}
              style={styles.search}
              returnKeyType="search"
              value={query}
              onChangeText={setQuery}
            />
            <TouchableOpacity accessibilityRole="button" style={styles.locationButton} onPress={() => void useMyLocation()} disabled={loading}>
              <Text style={styles.locationButtonText}>{loading ? 'Loading nearby…' : 'Use my location'}</Text>
            </TouchableOpacity>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
              {categories.map((category) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{ selected: activeCategory === category.slug }}
                  key={category.id}
                  onPress={() => void selectCategory(category.slug)}
                  style={[styles.chip, activeCategory === category.slug && styles.chipActive]}
                >
                  <Text style={[styles.chipText, activeCategory === category.slug && styles.chipTextActive]}>{category.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.eyebrow}>Near your current area</Text>
                <Text style={styles.sectionTitle}>Nearby services</Text>
              </View>
              <Text style={styles.filterText}>{visibleServices.length} found</Text>
            </View>
            <View style={styles.cards}>
              {visibleServices.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  saved={favoriteIds.has(service.id)}
                  onToggleFavorite={() => void toggleFavorite(service.id)}
                />
              ))}
            </View>
          </>
        ) : (
          <SavedView favorites={favorites} signedIn={Boolean(session)} onSignIn={() => void signIn()} onRemove={(placeId) => void toggleFavorite(placeId)} />
        )}

        <Text accessibilityLiveRegion="polite" style={styles.locationStatus}>{status}</Text>
        <View style={styles.safetyCard}>
          <Text style={styles.safetyTitle}>Safety first</Text>
          <Text style={styles.safetyBody}>Emergency features will always keep direct local emergency calling available and separate from private roadside assistance.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ServiceCard({ service, saved, onToggleFavorite }: { service: NearbyService; saved: boolean; onToggleFavorite: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.iconBubble}><Text style={styles.iconText}>{service.category.name.charAt(0)}</Text></View>
      <View style={styles.cardBody}>
        <View style={styles.cardHeading}>
          <View style={styles.cardHeadingCopy}>
            <Text style={styles.categoryLabel}>{service.category.name}</Text>
            <Text style={styles.cardTitle}>{service.name}</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={saved ? `Remove ${service.name} from saved places` : `Save ${service.name}`} onPress={onToggleFavorite} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>{saved ? 'Saved' : 'Save'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.meta}>{formatDistance(service.distanceMeters)} • ★ {service.rating.toFixed(1)} ({service.reviewCount})</Text>
        <Text style={styles.meta}>{service.address}, {service.city}</Text>
        <View style={styles.actions}>
          <TouchableOpacity accessibilityRole="button" style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Details</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" style={styles.primaryButton}><Text style={styles.primaryButtonText}>Route</Text></TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function SavedView({ favorites, signedIn, onSignIn, onRemove }: { favorites: Favorite[]; signedIn: boolean; onSignIn: () => void; onRemove: (placeId: string) => void }) {
  if (!signedIn) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.sectionTitle}>Sign in to use Saved</Text>
        <Text style={styles.meta}>Your saved places are tied to your NearFind account and isolated from other users.</Text>
        <TouchableOpacity accessibilityRole="button" style={styles.locationButton} onPress={onSignIn}><Text style={styles.locationButtonText}>Sign in securely</Text></TouchableOpacity>
      </View>
    );
  }
  if (favorites.length === 0) return <View style={styles.emptyCard}><Text style={styles.sectionTitle}>Nothing saved yet</Text><Text style={styles.meta}>Use Save on a nearby service to keep it here.</Text></View>;

  return (
    <View style={styles.cards}>
      {favorites.map((favorite) => (
        <View key={favorite.placeId} style={styles.card}>
          <View style={styles.cardBody}>
            <Text style={styles.categoryLabel}>{favorite.category?.name ?? 'Service'}</Text>
            <Text style={styles.cardTitle}>{favorite.name}</Text>
            <Text style={styles.meta}>★ {favorite.rating.toFixed(1)} ({favorite.reviewCount})</Text>
            <Text style={styles.meta}>{favorite.address}, {favorite.city}</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove ${favorite.name} from saved places`} style={styles.secondaryButton} onPress={() => onRemove(favorite.placeId)}>
              <Text style={styles.secondaryButtonText}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

function formatDistance(distanceMeters: number): string {
  return distanceMeters < 1000 ? `${distanceMeters} m` : `${(distanceMeters / 1000).toFixed(1)} km`;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface.canvas },
  container: { padding: spacing.md, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  headerCopy: { flex: 1 },
  eyebrow: { color: colors.brand.primaryStrong, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  title: { color: colors.text.primary, fontSize: 30, lineHeight: 36, fontWeight: '700', maxWidth: 300 },
  accountButton: { minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radii.control, backgroundColor: colors.surface.card, alignItems: 'center', justifyContent: 'center' },
  accountButtonText: { color: colors.brand.primaryStrong, fontWeight: '700' },
  accountText: { color: colors.text.muted, fontSize: 12, marginTop: spacing.sm },
  tabRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  tab: { flex: 1, minHeight: 44, borderRadius: radii.control, borderWidth: 1, borderColor: '#EAD8E7', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface.card },
  tabActive: { backgroundColor: colors.brand.secondary, borderColor: colors.brand.secondary },
  tabText: { color: colors.text.muted, fontWeight: '700' },
  tabTextActive: { color: colors.text.inverse },
  search: { marginTop: spacing.md, minHeight: 50, borderRadius: radii.control, borderWidth: 1, borderColor: '#EAD8E7', backgroundColor: colors.surface.card, paddingHorizontal: spacing.md, color: colors.text.primary, fontSize: 16 },
  locationButton: { minHeight: 48, marginTop: spacing.sm, borderRadius: radii.control, backgroundColor: colors.brand.primary, alignItems: 'center', justifyContent: 'center' },
  locationButtonText: { color: colors.text.inverse, fontWeight: '700', fontSize: 15 },
  locationStatus: { color: colors.text.muted, fontSize: 12, lineHeight: 18, marginTop: spacing.md },
  categoryRow: { gap: spacing.sm, paddingVertical: spacing.md },
  chip: { minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radii.control, borderWidth: 1, borderColor: '#EAD8E7', backgroundColor: colors.surface.card, justifyContent: 'center' },
  chipActive: { backgroundColor: colors.brand.secondary, borderColor: colors.brand.secondary },
  chipText: { color: colors.text.muted, fontWeight: '600' },
  chipTextActive: { color: colors.text.inverse },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  sectionTitle: { color: colors.text.primary, fontSize: 22, lineHeight: 28, fontWeight: '700' },
  filterText: { color: colors.brand.primaryStrong, fontWeight: '700' },
  cards: { gap: spacing.md, marginTop: spacing.md },
  card: { flexDirection: 'row', gap: 12, borderRadius: radii.card, borderWidth: 1, borderColor: '#EAD8E7', backgroundColor: colors.surface.card, padding: spacing.md },
  iconBubble: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand.tertiary },
  iconText: { color: colors.text.inverse, fontSize: 18, fontWeight: '700' },
  cardBody: { flex: 1 },
  cardHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  cardHeadingCopy: { flex: 1 },
  categoryLabel: { color: colors.brand.secondary, fontSize: 12, fontWeight: '700' },
  cardTitle: { color: colors.text.primary, fontSize: 17, fontWeight: '700', marginTop: 2 },
  meta: { color: colors.text.muted, fontSize: 14, lineHeight: 20, marginTop: 4 },
  saveButton: { minHeight: 38, paddingHorizontal: spacing.sm, borderRadius: radii.control, backgroundColor: '#F9DFF0', alignItems: 'center', justifyContent: 'center' },
  saveButtonText: { color: colors.brand.primaryStrong, fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: 12 },
  secondaryButton: { minHeight: 42, paddingHorizontal: spacing.md, marginTop: spacing.sm, borderRadius: radii.control, backgroundColor: '#F9DFF0', alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: colors.brand.primaryStrong, fontWeight: '700' },
  primaryButton: { minHeight: 42, paddingHorizontal: spacing.md, borderRadius: radii.control, backgroundColor: colors.brand.primary, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: colors.text.inverse, fontWeight: '700' },
  emptyCard: { marginTop: spacing.lg, padding: spacing.lg, borderRadius: radii.card, borderWidth: 1, borderColor: '#EAD8E7', backgroundColor: colors.surface.card },
  safetyCard: { marginTop: spacing.lg, padding: spacing.md, borderRadius: radii.card, backgroundColor: '#EAF7FC' },
  safetyTitle: { color: '#006C91', fontWeight: '700', fontSize: 16 },
  safetyBody: { color: colors.text.muted, lineHeight: 21, marginTop: 4 },
});
