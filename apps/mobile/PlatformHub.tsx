import * as Crypto from 'expo-crypto';
import { useEffect, useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, radii, spacing } from '@nearfind/design-tokens';

interface Props {
  signedIn: boolean;
  request: (path: string, init?: RequestInit) => Promise<Response>;
  onSignIn: () => void;
}

interface Preferences {
  manualLocationLabel: string | null;
  manualLat: string | null;
  manualLng: string | null;
}
interface Vehicle { id: string; label: string; vehicleType: string; fuelType: string | null; }
interface Contribution { id: string; kind: string; status: string; createdAt: string; }
interface NotificationItem { id: string; title: string; body: string; readAt: string | null; }
interface Booking { id: string; status: string; amountMinor: number; currency: string; }
interface DispatchRequest { id: string; serviceType: string; status: string; createdAt: string; }
interface Wallet { balance: number; }
interface Challenge { id: string; name: string; targetCount: number; rewardPoints: number; progress: number; }
interface Perk { id: string; name: string; costPoints: number; stock: number; }
interface PropertyListing { id: string; title: string; city: string; priceMinor: number; currency: string; propertyType: string; }
interface FeatureFlag { enabled: boolean; }
interface RouteResult {
  preview: { distanceMeters: number; durationSeconds: number; navigationUrl: string };
  candidates: Array<{ placeId: string; name: string; city: string; detourProxyMeters: number }>;
}

type Section = 'account' | 'community' | 'travel' | 'roadside' | 'rewards' | 'properties';

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return (await response.json()) as T;
}

function money(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

export function PlatformHub({ signedIn, request, onSignIn }: Props) {
  const [section, setSection] = useState<Section>('account');
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [dispatches, setDispatches] = useState<DispatchRequest[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [perks, setPerks] = useState<Perk[]>([]);
  const [properties, setProperties] = useState<PropertyListing[]>([]);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [propertyEnabled, setPropertyEnabled] = useState(false);
  const [note, setNote] = useState('');
  const [startLat, setStartLat] = useState('13.0604');
  const [startLng, setStartLng] = useState('80.2496');
  const [endLat, setEndLat] = useState('13.0827');
  const [endLng, setEndLng] = useState('80.2707');
  const [roadsideLat, setRoadsideLat] = useState('13.0604');
  const [roadsideLng, setRoadsideLng] = useState('80.2496');
  const [status, setStatus] = useState('Sign in to use your journey hub.');
  const [busy, setBusy] = useState(false);

  const unread = useMemo(() => notifications.filter((item) => !item.readAt).length, [notifications]);

  useEffect(() => {
    if (signedIn) void refresh();
  }, [signedIn]);

  async function refresh(): Promise<void> {
    if (!signedIn) return;
    setBusy(true);
    try {
      const [prefs, vehicleRows, contributionRows, notificationRows, bookingRows, dispatchRows, walletData, challengeRows, perkRows] = await Promise.all([
        readJson<Preferences>(await request('/account/preferences')),
        readJson<Vehicle[]>(await request('/account/vehicles')),
        readJson<Contribution[]>(await request('/contributions/mine')),
        readJson<NotificationItem[]>(await request('/notifications')),
        readJson<Booking[]>(await request('/bookings')),
        readJson<DispatchRequest[]>(await request('/dispatch-requests')),
        readJson<Wallet>(await request('/rewards/wallet')),
        readJson<Challenge[]>(await request('/rewards/challenges')),
        readJson<Perk[]>(await request('/rewards/perks')),
      ]);
      setPreferences(prefs);
      setVehicles(vehicleRows);
      setContributions(contributionRows);
      setNotifications(notificationRows);
      setBookings(bookingRows);
      setDispatches(dispatchRows);
      setWallet(walletData);
      setChallenges(challengeRows);
      setPerks(perkRows);

      const flagResponse = await request('/feature-flags/property_module');
      if (flagResponse.ok) {
        const flag = (await flagResponse.json()) as FeatureFlag;
        setPropertyEnabled(flag.enabled);
        if (flag.enabled) {
          const propertyResponse = await request('/properties?limit=20');
          if (propertyResponse.ok) setProperties((await propertyResponse.json()) as PropertyListing[]);
        } else {
          setProperties([]);
        }
      }
      setStatus('Journey hub updated.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to refresh journey hub.');
    } finally {
      setBusy(false);
    }
  }

  async function run(action: () => Promise<void>, success: string): Promise<void> {
    setBusy(true);
    try {
      await action();
      setStatus(success);
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to complete the action.');
    } finally {
      setBusy(false);
    }
  }

  async function submitContribution(): Promise<void> {
    if (!note.trim()) return;
    await run(async () => {
      const response = await request('/contributions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'PLACE_UPDATE', details: { note: note.trim() } }),
      });
      await readJson<Contribution>(response);
      setNote('');
    }, 'Contribution submitted for moderation.');
  }

  async function optimizeRoute(): Promise<void> {
    setBusy(true);
    try {
      const response = await request('/route-optimizations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          startLat: Number(startLat), startLng: Number(startLng), endLat: Number(endLat), endLng: Number(endLng), corridorMeters: 5000,
        }),
      });
      setRouteResult(await readJson<RouteResult>(response));
      setStatus('Route alternatives calculated.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to optimize route.');
    } finally {
      setBusy(false);
    }
  }

  async function requestRoadside(): Promise<void> {
    await run(async () => {
      const response = await request('/dispatch-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          serviceType: 'TOW',
          lat: Number(roadsideLat),
          lng: Number(roadsideLng),
          notes: 'Requested from NearFind mobile journey hub.',
          idempotencyKey: Crypto.randomUUID(),
        }),
      });
      await readJson<DispatchRequest>(response);
    }, 'Private roadside request created. Public emergency calling remains separate.');
  }

  async function redeem(perk: Perk): Promise<void> {
    await run(async () => {
      const response = await request(`/rewards/perks/${perk.id}/redemptions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idempotencyKey: Crypto.randomUUID() }),
      });
      await readJson<Record<string, unknown>>(response);
    }, `${perk.name} redeemed.`);
  }

  async function requestInspection(property: PropertyListing): Promise<void> {
    await run(async () => {
      const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const response = await request(`/properties/${property.id}/inspection-bookings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scheduledAt, idempotencyKey: Crypto.randomUUID() }),
      });
      await readJson<Record<string, unknown>>(response);
    }, `Inspection requested for ${property.title}.`);
  }

  if (!signedIn) {
    return <View style={styles.panel}><Text style={styles.title}>Journey hub</Text><Text style={styles.body}>Sign in to manage community updates, bookings, private roadside requests, rewards, and inspections.</Text><TouchableOpacity style={styles.primaryButton} onPress={onSignIn}><Text style={styles.primaryText}>Sign in securely</Text></TouchableOpacity></View>;
  }

  const sections: Array<{ id: Section; label: string }> = [
    { id: 'account', label: 'Account' },
    { id: 'community', label: unread > 0 ? `Community ${unread}` : 'Community' },
    { id: 'travel', label: 'Travel' },
    { id: 'roadside', label: 'Roadside' },
    { id: 'rewards', label: 'Rewards' },
    { id: 'properties', label: 'Properties' },
  ];

  return <View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
      {sections.map((item) => <TouchableOpacity key={item.id} accessibilityRole="tab" accessibilityState={{ selected: section === item.id }} style={[styles.tab, section === item.id && styles.tabActive]} onPress={() => setSection(item.id)}><Text style={[styles.tabText, section === item.id && styles.tabTextActive]}>{item.label}</Text></TouchableOpacity>)}
    </ScrollView>

    <Text accessibilityLiveRegion="polite" style={styles.status}>{busy ? 'Working…' : status}</Text>

    {section === 'account' && <View style={styles.stack}>
      <View style={styles.panel}><Text style={styles.title}>Account & offline readiness</Text><Text style={styles.body}>Manual location: {preferences?.manualLocationLabel ?? 'Not set'}</Text><Text style={styles.body}>{vehicles.length} vehicle(s) saved. Emergency contacts and favorites are available through the encrypted offline pack API.</Text><TouchableOpacity style={styles.secondaryButton} onPress={() => void refresh()} disabled={busy}><Text style={styles.secondaryText}>Refresh account</Text></TouchableOpacity></View>
      {vehicles.map((vehicle) => <View style={styles.panel} key={vehicle.id}><Text style={styles.cardTitle}>{vehicle.label}</Text><Text style={styles.body}>{vehicle.vehicleType} · {vehicle.fuelType ?? 'Fuel not set'}</Text></View>)}
    </View>}

    {section === 'community' && <View style={styles.stack}>
      <View style={styles.panel}><Text style={styles.title}>Community update</Text><TextInput style={styles.input} multiline placeholder="What changed nearby?" placeholderTextColor={colors.text.muted} value={note} onChangeText={setNote} /><TouchableOpacity style={styles.primaryButton} onPress={() => void submitContribution()} disabled={busy || !note.trim()}><Text style={styles.primaryText}>Submit for moderation</Text></TouchableOpacity></View>
      {contributions.slice(0, 10).map((item) => <View style={styles.panel} key={item.id}><Text style={styles.cardTitle}>{item.kind}</Text><Text style={styles.body}>{item.status} · {new Date(item.createdAt).toLocaleDateString()}</Text></View>)}
      {notifications.slice(0, 10).map((item) => <View style={styles.panel} key={item.id}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.body}>{item.body}</Text></View>)}
    </View>}

    {section === 'travel' && <View style={styles.stack}>
      <View style={styles.panel}><Text style={styles.title}>Route optimizer</Text><View style={styles.row}><TextInput style={styles.halfInput} value={startLat} onChangeText={setStartLat} keyboardType="decimal-pad" placeholder="Start lat" /><TextInput style={styles.halfInput} value={startLng} onChangeText={setStartLng} keyboardType="decimal-pad" placeholder="Start lng" /></View><View style={styles.row}><TextInput style={styles.halfInput} value={endLat} onChangeText={setEndLat} keyboardType="decimal-pad" placeholder="End lat" /><TextInput style={styles.halfInput} value={endLng} onChangeText={setEndLng} keyboardType="decimal-pad" placeholder="End lng" /></View><TouchableOpacity style={styles.primaryButton} onPress={() => void optimizeRoute()} disabled={busy}><Text style={styles.primaryText}>Optimize route</Text></TouchableOpacity>{routeResult ? <><Text style={styles.body}>{Math.round(routeResult.preview.distanceMeters / 100) / 10} km · {Math.round(routeResult.preview.durationSeconds / 60)} min</Text><TouchableOpacity style={styles.secondaryButton} onPress={() => void Linking.openURL(routeResult.preview.navigationUrl)}><Text style={styles.secondaryText}>Open navigation</Text></TouchableOpacity></> : null}</View>
      {routeResult?.candidates.slice(0, 5).map((candidate) => <View style={styles.panel} key={candidate.placeId}><Text style={styles.cardTitle}>{candidate.name}</Text><Text style={styles.body}>{candidate.city} · detour ≈ {candidate.detourProxyMeters} m</Text></View>)}
      {bookings.slice(0, 10).map((booking) => <View style={styles.panel} key={booking.id}><Text style={styles.cardTitle}>{booking.status}</Text><Text style={styles.body}>{money(booking.amountMinor, booking.currency)}</Text></View>)}
    </View>}

    {section === 'roadside' && <View style={styles.stack}>
      <View style={styles.safetyPanel}><Text style={styles.title}>Private roadside assistance</Text><Text style={styles.body}>This does not contact or replace public emergency services. For a public emergency, use your verified regional emergency number directly.</Text></View>
      <View style={styles.panel}><View style={styles.row}><TextInput style={styles.halfInput} value={roadsideLat} onChangeText={setRoadsideLat} keyboardType="decimal-pad" placeholder="Latitude" /><TextInput style={styles.halfInput} value={roadsideLng} onChangeText={setRoadsideLng} keyboardType="decimal-pad" placeholder="Longitude" /></View><TouchableOpacity style={styles.primaryButton} onPress={() => void requestRoadside()} disabled={busy}><Text style={styles.primaryText}>Request private tow help</Text></TouchableOpacity></View>
      {dispatches.slice(0, 10).map((item) => <View style={styles.panel} key={item.id}><Text style={styles.cardTitle}>{item.serviceType} · {item.status}</Text><Text style={styles.body}>{new Date(item.createdAt).toLocaleString()}</Text></View>)}
    </View>}

    {section === 'rewards' && <View style={styles.stack}>
      <View style={styles.panel}><Text style={styles.title}>{wallet?.balance ?? 0} points</Text><Text style={styles.body}>Points come from the immutable server ledger. Leaderboard participation is opt-in.</Text></View>
      {challenges.map((challenge) => <View style={styles.panel} key={challenge.id}><Text style={styles.cardTitle}>{challenge.name}</Text><Text style={styles.body}>{challenge.progress}/{challenge.targetCount} · +{challenge.rewardPoints} points</Text></View>)}
      {perks.map((perk) => <View style={styles.panel} key={perk.id}><Text style={styles.cardTitle}>{perk.name}</Text><Text style={styles.body}>{perk.costPoints} points · {perk.stock} left</Text><TouchableOpacity style={styles.secondaryButton} disabled={busy || perk.stock <= 0 || (wallet?.balance ?? 0) < perk.costPoints} onPress={() => void redeem(perk)}><Text style={styles.secondaryText}>Redeem</Text></TouchableOpacity></View>)}
    </View>}

    {section === 'properties' && <View style={styles.stack}>
      {!propertyEnabled ? <View style={styles.panel}><Text style={styles.title}>Property discovery</Text><Text style={styles.body}>This module is currently disabled by feature flag.</Text></View> : properties.map((property) => <View style={styles.panel} key={property.id}><Text style={styles.cardTitle}>{property.title}</Text><Text style={styles.body}>{property.city} · {property.propertyType} · {money(property.priceMinor, property.currency)}</Text><TouchableOpacity style={styles.secondaryButton} disabled={busy} onPress={() => void requestInspection(property)}><Text style={styles.secondaryText}>Request inspection tomorrow</Text></TouchableOpacity></View>)}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  tabs: { gap: 8, paddingVertical: spacing.sm },
  tab: { minHeight: 40, borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface.card },
  tabActive: { backgroundColor: colors.brand.secondary, borderColor: colors.brand.secondary },
  tabText: { color: colors.text.muted, fontWeight: '700' },
  tabTextActive: { color: '#fff' },
  status: { color: colors.text.muted, marginBottom: spacing.md, lineHeight: 20 },
  stack: { gap: spacing.md },
  panel: { backgroundColor: colors.surface.card, borderRadius: radii.card, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  safetyPanel: { backgroundColor: '#E8F6FB', borderRadius: radii.card, padding: spacing.lg, borderWidth: 1, borderColor: '#B9E3F2', gap: spacing.sm },
  title: { color: colors.text.primary, fontWeight: '800', fontSize: 20 },
  cardTitle: { color: colors.text.primary, fontWeight: '700', fontSize: 16 },
  body: { color: colors.text.muted, lineHeight: 21 },
  input: { minHeight: 88, borderWidth: 1, borderColor: colors.border, borderRadius: radii.control, padding: spacing.md, color: colors.text.primary, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: spacing.sm },
  halfInput: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radii.control, paddingHorizontal: spacing.md, color: colors.text.primary },
  primaryButton: { minHeight: 44, borderRadius: 999, backgroundColor: colors.brand.primary, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
  primaryText: { color: '#fff', fontWeight: '800' },
  secondaryButton: { minHeight: 42, borderRadius: 999, backgroundColor: '#F9DFF0', paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
  secondaryText: { color: '#A91B73', fontWeight: '800' },
});
