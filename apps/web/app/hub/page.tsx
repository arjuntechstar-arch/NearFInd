'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

interface Profile { id: string; displayName: string | null; email: string | null; role: 'USER' | 'PROVIDER' | 'ADMIN'; }
interface SessionResponse { authenticated: boolean; profile?: Profile; }
interface Preferences {
  manualLocationLabel: string | null;
  manualLat: string | null;
  manualLng: string | null;
  notificationPush: boolean;
  notificationEmail: boolean;
  leaderboardOptIn: boolean;
}
interface Vehicle { id: string; label: string; vehicleType: string; fuelType: string | null; registrationLast4: string | null; isDefault: boolean; }
interface Contribution { id: string; kind: string; status: string; createdAt: string; }
interface NotificationItem { id: string; type: string; title: string; body: string; readAt: string | null; createdAt: string; }
interface Booking { id: string; status: string; amountMinor: number; currency: string; serviceLocationId: string; createdAt: string; }
interface DispatchRequest { id: string; serviceType: string; status: string; vehicleId: string | null; assignedProviderId: string | null; createdAt: string; }
interface LedgerEntry { id: string; points: number; sourceType: string; createdAt: string; }
interface Wallet { balance: number; entries: LedgerEntry[]; }
interface Challenge { id: string; name: string; targetCount: number; rewardPoints: number; progress: number; completedAt: string | null; }
interface Perk { id: string; name: string; description: string | null; costPoints: number; stock: number; }
interface Provider { id: string; name: string; status: string; version: number; }
interface PropertyListing { id: string; title: string; city: string; priceMinor: number; currency: string; propertyType: string; status: string; }
interface FeatureFlag { key: string; enabled: boolean; config: Record<string, unknown>; }
interface RouteCandidate { placeId: string; name: string; city: string; score: number; detourProxyMeters: number; fuel: { type: string; price: number | null; currency: string | null; freshnessHours: number | null } | null; }
interface RouteResult { routeSessionId: string; preview: { distanceMeters: number; durationSeconds: number; navigationUrl: string }; candidates: RouteCandidate[]; }

type Tab = 'overview' | 'account' | 'community' | 'travel' | 'roadside' | 'rewards' | 'provider' | 'admin' | 'properties';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/platform/${path}`, {
    cache: 'no-store',
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  if (response.status === 401) {
    window.location.assign('/auth/login');
    throw new Error('Sign in required');
  }
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const problem = (await response.json()) as { title?: string; message?: string; error?: string };
      message = problem.title ?? problem.message ?? problem.error ?? message;
    } catch {
      // Keep the status-based fallback for non-JSON upstream failures.
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

function money(minor: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(minor / 100);
}

export default function HubPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [dispatches, setDispatches] = useState<DispatchRequest[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [perks, setPerks] = useState<Perk[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [adminProviders, setAdminProviders] = useState<Provider[]>([]);
  const [moderationQueue, setModerationQueue] = useState<Contribution[]>([]);
  const [propertyFlag, setPropertyFlag] = useState<FeatureFlag | null>(null);
  const [properties, setProperties] = useState<PropertyListing[]>([]);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Loading your NearFind hub…');

  const unreadNotifications = useMemo(() => notifications.filter((item) => !item.readAt).length, [notifications]);
  const activeDispatch = dispatches.find((item) => !['COMPLETED', 'CANCELLED'].includes(item.status)) ?? null;

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap(): Promise<void> {
    try {
      const sessionResponse = await fetch('/api/session', { cache: 'no-store' });
      if (!sessionResponse.ok) throw new Error('Unable to load session');
      const session = (await sessionResponse.json()) as SessionResponse;
      if (!session.authenticated || !session.profile) {
        window.location.assign('/auth/login');
        return;
      }
      setProfile(session.profile);
      await refresh(session.profile);
      setStatus('Hub data is up to date.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to load your hub.');
    }
  }

  async function refresh(currentProfile = profile): Promise<void> {
    if (!currentProfile) return;
    const [prefs, vehicleRows, contributionRows, notificationRows, bookingRows, dispatchRows, walletData, challengeRows, perkRows, providerRows, flag] = await Promise.all([
      api<Preferences>('account/preferences'),
      api<Vehicle[]>('account/vehicles'),
      api<Contribution[]>('contributions/mine'),
      api<NotificationItem[]>('notifications'),
      api<Booking[]>('bookings'),
      api<DispatchRequest[]>('dispatch-requests'),
      api<Wallet>('rewards/wallet'),
      api<Challenge[]>('rewards/challenges'),
      api<Perk[]>('rewards/perks'),
      api<Provider[]>('providers/mine'),
      api<FeatureFlag>('feature-flags/property_module').catch(() => null),
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
    setProviders(providerRows);
    setPropertyFlag(flag);
    if (flag?.enabled) setProperties(await api<PropertyListing[]>('properties?limit=20'));
    else setProperties([]);
    if (currentProfile.role === 'ADMIN') {
      const [providerQueue, contributionsQueue] = await Promise.all([
        api<Provider[]>('admin/providers'),
        api<Contribution[]>('admin/moderation/contributions'),
      ]);
      setAdminProviders(providerQueue);
      setModerationQueue(contributionsQueue);
    }
  }

  async function runAction(action: () => Promise<void>, success: string): Promise<void> {
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

  async function savePreferences(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runAction(async () => {
      await api<Preferences>('account/preferences', {
        method: 'PATCH',
        body: JSON.stringify({
          manualLocationLabel: String(form.get('label') ?? ''),
          manualLat: Number(form.get('lat')),
          manualLng: Number(form.get('lng')),
          notificationPush: form.get('push') === 'on',
          notificationEmail: form.get('email') === 'on',
          leaderboardOptIn: form.get('leaderboard') === 'on',
        }),
      });
    }, 'Preferences updated.');
  }

  async function addVehicle(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runAction(async () => {
      await api<Vehicle>('account/vehicles', {
        method: 'POST',
        body: JSON.stringify({
          label: String(form.get('label') ?? ''),
          vehicleType: String(form.get('type') ?? 'CAR'),
          fuelType: String(form.get('fuel') ?? 'PETROL'),
          registrationLast4: String(form.get('last4') ?? ''),
          isDefault: form.get('default') === 'on',
        }),
      });
      event.currentTarget.reset();
    }, 'Vehicle added.');
  }

  async function addContribution(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runAction(async () => {
      await api<Contribution>('contributions', {
        method: 'POST',
        body: JSON.stringify({ kind: String(form.get('kind') ?? 'PLACE_UPDATE'), details: { note: String(form.get('note') ?? '') } }),
      });
      event.currentTarget.reset();
    }, 'Contribution submitted for moderation.');
  }

  async function optimizeRoute(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const result = await api<RouteResult>('route-optimizations', {
        method: 'POST',
        body: JSON.stringify({
          startLat: Number(form.get('startLat')),
          startLng: Number(form.get('startLng')),
          endLat: Number(form.get('endLat')),
          endLng: Number(form.get('endLng')),
          corridorMeters: Number(form.get('corridor')),
          fuelType: String(form.get('fuelType') ?? '').trim() || undefined,
        }),
      });
      setRouteResult(result);
      setStatus('Route alternatives calculated.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to optimize route.');
    } finally {
      setBusy(false);
    }
  }

  async function createDispatch(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runAction(async () => {
      await api<DispatchRequest>('dispatch-requests', {
        method: 'POST',
        body: JSON.stringify({
          serviceType: String(form.get('serviceType') ?? 'TOW'),
          lat: Number(form.get('lat')),
          lng: Number(form.get('lng')),
          notes: String(form.get('notes') ?? ''),
          idempotencyKey: crypto.randomUUID(),
          ...(String(form.get('vehicleId') ?? '') ? { vehicleId: String(form.get('vehicleId')) } : {}),
        }),
      });
    }, 'Private roadside request created. Direct public emergency calling remains separate.');
  }

  async function applyProvider(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runAction(async () => {
      await api<Provider>('providers', { method: 'POST', body: JSON.stringify({ name: String(form.get('name') ?? '') }) });
      event.currentTarget.reset();
    }, 'Provider application submitted for admin approval.');
  }

  async function reserveSlot(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runAction(async () => {
      await api<Booking>('bookings', {
        method: 'POST',
        body: JSON.stringify({ slotId: String(form.get('slotId') ?? ''), idempotencyKey: crypto.randomUUID() }),
      });
    }, 'Booking slot reserved for 15 minutes.');
  }

  async function authorizePayment(booking: Booking): Promise<void> {
    await runAction(async () => {
      await api(`bookings/${booking.id}/authorize-payment`, {
        method: 'POST',
        body: JSON.stringify({ paymentMethodToken: `sandbox_pm_web_${crypto.randomUUID()}`, idempotencyKey: crypto.randomUUID() }),
      });
    }, 'Sandbox payment authorized and booking confirmed.');
  }

  async function redeem(perk: Perk): Promise<void> {
    await runAction(async () => {
      await api(`rewards/perks/${perk.id}/redemptions`, { method: 'POST', body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }) });
    }, `Redeemed ${perk.name}.`);
  }

  async function approveProvider(provider: Provider): Promise<void> {
    await runAction(async () => {
      await api(`admin/providers/${provider.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'ACTIVE' }) });
    }, `${provider.name} approved.`);
  }

  async function moderateContribution(contribution: Contribution, decision: 'APPROVED' | 'REJECTED'): Promise<void> {
    await runAction(async () => {
      await api(`admin/moderation/contributions/${contribution.id}`, { method: 'POST', body: JSON.stringify({ decision }) });
    }, `Contribution ${decision.toLowerCase()}.`);
  }

  async function togglePropertyModule(): Promise<void> {
    if (!propertyFlag) return;
    await runAction(async () => {
      await api('admin/feature-flags/property_module', {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !propertyFlag.enabled, config: propertyFlag.config }),
      });
    }, `Property module ${propertyFlag.enabled ? 'disabled' : 'enabled'}.`);
  }

  async function bookInspection(event: FormEvent<HTMLFormElement>, propertyId: string): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runAction(async () => {
      await api(`properties/${propertyId}/inspection-bookings`, {
        method: 'POST',
        body: JSON.stringify({ scheduledAt: new Date(String(form.get('scheduledAt'))).toISOString(), idempotencyKey: crypto.randomUUID() }),
      });
    }, 'Inspection requested.');
  }

  if (!profile) {
    return <main className="hubShell"><section className="hubPanel"><p aria-live="polite">{status}</p><a className="primaryButton hubButton" href="/auth/login">Sign in</a></section></main>;
  }

  const tabs: Array<{ id: Tab; label: string; show: boolean }> = [
    { id: 'overview', label: 'Overview', show: true },
    { id: 'account', label: 'Account', show: true },
    { id: 'community', label: `Community${unreadNotifications ? ` · ${unreadNotifications}` : ''}`, show: true },
    { id: 'travel', label: 'Routes & bookings', show: true },
    { id: 'roadside', label: 'Roadside', show: true },
    { id: 'rewards', label: 'Rewards', show: true },
    { id: 'provider', label: 'Provider', show: true },
    { id: 'admin', label: 'Admin', show: profile.role === 'ADMIN' },
    { id: 'properties', label: 'Properties', show: propertyFlag?.enabled === true || profile.role === 'ADMIN' },
  ];

  return (
    <main className="hubShell">
      <header className="hubHeader">
        <div><p className="eyebrow">NearFind control center</p><h1>Everything around the journey.</h1><p className="smallText">Signed in as {profile.displayName ?? profile.email ?? 'NearFind user'} · {profile.role}</p></div>
        <div className="cardActions"><a className="secondaryButton hubButton" href="/">Explore</a><form action="/auth/logout" method="post"><button className="ghostButton" type="submit">Sign out</button></form></div>
      </header>

      <nav className="hubTabs" aria-label="Hub sections">
        {tabs.filter((item) => item.show).map((item) => <button key={item.id} className={tab === item.id ? 'chip chipActive' : 'chip'} type="button" aria-pressed={tab === item.id} onClick={() => setTab(item.id)}>{item.label}</button>)}
      </nav>
      <p className="hubStatus" aria-live="polite">{status}</p>

      {tab === 'overview' && <section className="hubGrid">
        <Metric title="Saved journeys" value={String(bookings.length)} note="Bookings on your account" />
        <Metric title="Roadside" value={activeDispatch?.status ?? 'Ready'} note="Private roadside support" />
        <Metric title="Rewards" value={String(wallet?.balance ?? 0)} note="Available points" />
        <Metric title="Community" value={String(contributions.length)} note="Updates you submitted" />
        <article className="hubPanel hubSpan"><h2>Safety boundary</h2><p className="smallText">NearFind roadside assistance is a private service. For public emergencies, use your verified local emergency number directly; NearFind does not claim to dispatch government emergency services.</p></article>
      </section>}

      {tab === 'account' && <section className="hubGrid">
        <article className="hubPanel"><h2>Location & privacy</h2><form className="hubForm" onSubmit={(event) => void savePreferences(event)}>
          <input name="label" aria-label="Manual location label" placeholder="Manual location label" defaultValue={preferences?.manualLocationLabel ?? ''} required />
          <div className="hubFormRow"><input name="lat" aria-label="Latitude" type="number" step="any" placeholder="Latitude" defaultValue={preferences?.manualLat ?? ''} required /><input name="lng" aria-label="Longitude" type="number" step="any" placeholder="Longitude" defaultValue={preferences?.manualLng ?? ''} required /></div>
          <label><input name="push" type="checkbox" defaultChecked={preferences?.notificationPush} /> Push notifications</label>
          <label><input name="email" type="checkbox" defaultChecked={preferences?.notificationEmail} /> Email notifications</label>
          <label><input name="leaderboard" type="checkbox" defaultChecked={preferences?.leaderboardOptIn} /> Opt in to public leaderboard</label>
          <button className="primaryButton hubButton" disabled={busy}>Save preferences</button>
        </form></article>
        <article className="hubPanel"><h2>Vehicles</h2><div className="hubList">{vehicles.map((vehicle) => <div className="hubListItem" key={vehicle.id}><strong>{vehicle.label}</strong><span>{vehicle.vehicleType} · {vehicle.fuelType ?? 'Fuel not set'}{vehicle.registrationLast4 ? ` · ••••${vehicle.registrationLast4}` : ''}</span></div>)}</div>
          <form className="hubForm" onSubmit={(event) => void addVehicle(event)}><input name="label" placeholder="Vehicle name" required /><div className="hubFormRow"><input name="type" placeholder="CAR" defaultValue="CAR" required /><input name="fuel" placeholder="PETROL" defaultValue="PETROL" required /></div><input name="last4" placeholder="Registration last 4" minLength={4} maxLength={4} /><label><input name="default" type="checkbox" /> Default vehicle</label><button className="secondaryButton hubButton" disabled={busy}>Add vehicle</button></form>
        </article>
      </section>}

      {tab === 'community' && <section className="hubGrid">
        <article className="hubPanel"><h2>Submit an update</h2><form className="hubForm" onSubmit={(event) => void addContribution(event)}><input name="kind" defaultValue="PLACE_UPDATE" aria-label="Contribution type" required /><textarea name="note" rows={4} placeholder="What changed?" required /><button className="primaryButton hubButton" disabled={busy}>Submit for moderation</button></form></article>
        <article className="hubPanel"><h2>Your contributions</h2><div className="hubList">{contributions.map((item) => <div className="hubListItem" key={item.id}><strong>{item.kind}</strong><span>{item.status} · {new Date(item.createdAt).toLocaleDateString()}</span></div>)}</div></article>
        <article className="hubPanel hubSpan"><h2>Notifications</h2><div className="hubList">{notifications.map((item) => <div className="hubListItem" key={item.id}><strong>{item.title}</strong><span>{item.body}</span></div>)}</div></article>
      </section>}

      {tab === 'travel' && <section className="hubGrid">
        <article className="hubPanel"><h2>Route optimizer</h2><form className="hubForm" onSubmit={(event) => void optimizeRoute(event)}><div className="hubFormRow"><input name="startLat" type="number" step="any" placeholder="Start lat" required /><input name="startLng" type="number" step="any" placeholder="Start lng" required /></div><div className="hubFormRow"><input name="endLat" type="number" step="any" placeholder="End lat" required /><input name="endLng" type="number" step="any" placeholder="End lng" required /></div><div className="hubFormRow"><input name="corridor" type="number" min={500} max={25000} defaultValue={5000} /><input name="fuelType" placeholder="PETROL (optional)" /></div><button className="primaryButton hubButton" disabled={busy}>Optimize</button></form>
          {routeResult && <div className="hubList"><a className="secondaryButton hubButton" href={routeResult.preview.navigationUrl} target="_blank" rel="noreferrer">Open navigation</a>{routeResult.candidates.map((candidate) => <div className="hubListItem" key={candidate.placeId}><strong>{candidate.name}</strong><span>{candidate.city} · detour ≈ {candidate.detourProxyMeters} m{candidate.fuel?.price ? ` · ${candidate.fuel.currency ?? ''} ${candidate.fuel.price}` : ''}</span></div>)}</div>}
        </article>
        <article className="hubPanel"><h2>Bookings</h2><form className="hubForm" onSubmit={(event) => void reserveSlot(event)}><input name="slotId" placeholder="Provider slot UUID" required /><button className="secondaryButton hubButton" disabled={busy}>Reserve slot</button></form><div className="hubList">{bookings.map((booking) => <div className="hubListItem" key={booking.id}><strong>{booking.status} · {money(booking.amountMinor, booking.currency)}</strong><span>{booking.id}</span>{booking.status === 'RESERVED' && <button className="textButton" onClick={() => void authorizePayment(booking)} disabled={busy}>Authorize sandbox payment</button>}</div>)}</div></article>
      </section>}

      {tab === 'roadside' && <section className="hubGrid">
        <article className="hubPanel"><h2>Private roadside assistance</h2><p className="smallText">For a public emergency, call your regional emergency number directly. This form creates a NearFind private roadside request only.</p><form className="hubForm" onSubmit={(event) => void createDispatch(event)}><select name="serviceType" defaultValue="TOW"><option value="TOW">Tow</option><option value="BATTERY">Battery</option><option value="TIRE">Tire</option><option value="FUEL">Fuel</option></select><select name="vehicleId" defaultValue=""><option value="">No vehicle selected</option>{vehicles.map((vehicle) => <option value={vehicle.id} key={vehicle.id}>{vehicle.label}</option>)}</select><div className="hubFormRow"><input name="lat" type="number" step="any" placeholder="Latitude" required /><input name="lng" type="number" step="any" placeholder="Longitude" required /></div><textarea name="notes" rows={3} placeholder="Safe landmark / notes" /><button className="primaryButton hubButton" disabled={busy}>Request private roadside help</button></form></article>
        <article className="hubPanel"><h2>Request history</h2><div className="hubList">{dispatches.map((item) => <div className="hubListItem" key={item.id}><strong>{item.serviceType} · {item.status}</strong><span>{new Date(item.createdAt).toLocaleString()}</span></div>)}</div></article>
      </section>}

      {tab === 'rewards' && <section className="hubGrid">
        <Metric title="Wallet" value={String(wallet?.balance ?? 0)} note="Points are derived from an immutable ledger" />
        <article className="hubPanel"><h2>Challenges</h2><div className="hubList">{challenges.map((challenge) => <div className="hubListItem" key={challenge.id}><strong>{challenge.name}</strong><span>{challenge.progress}/{challenge.targetCount} · +{challenge.rewardPoints} pts</span></div>)}</div></article>
        <article className="hubPanel hubSpan"><h2>Perks</h2><div className="hubCards">{perks.map((perk) => <div className="miniCard" key={perk.id}><strong>{perk.name}</strong><span>{perk.costPoints} points · {perk.stock} left</span><button className="secondaryButton hubButton" disabled={busy || perk.stock <= 0 || (wallet?.balance ?? 0) < perk.costPoints} onClick={() => void redeem(perk)}>Redeem</button></div>)}</div></article>
      </section>}

      {tab === 'provider' && <section className="hubGrid">
        <article className="hubPanel"><h2>Provider applications</h2><form className="hubForm" onSubmit={(event) => void applyProvider(event)}><input name="name" placeholder="Provider/business name" required /><button className="primaryButton hubButton" disabled={busy}>Apply as provider</button></form></article>
        <article className="hubPanel"><h2>Your providers</h2><div className="hubList">{providers.map((provider) => <div className="hubListItem" key={provider.id}><strong>{provider.name}</strong><span>{provider.status} · v{provider.version}</span></div>)}</div><p className="smallText">Approved provider accounts can manage locations, slots, bookings, EV connectors, roadside assignments and property listings through the same authenticated platform API.</p></article>
      </section>}

      {tab === 'admin' && profile.role === 'ADMIN' && <section className="hubGrid">
        <article className="hubPanel"><h2>Provider approvals</h2><div className="hubList">{adminProviders.map((provider) => <div className="hubListItem" key={provider.id}><strong>{provider.name}</strong><span>{provider.status}</span>{provider.status !== 'ACTIVE' && <button className="textButton" disabled={busy} onClick={() => void approveProvider(provider)}>Approve</button>}</div>)}</div></article>
        <article className="hubPanel"><h2>Contribution moderation</h2><div className="hubList">{moderationQueue.map((item) => <div className="hubListItem" key={item.id}><strong>{item.kind}</strong><span>{item.status}</span><div><button className="textButton" disabled={busy} onClick={() => void moderateContribution(item, 'APPROVED')}>Approve</button><button className="textButton" disabled={busy} onClick={() => void moderateContribution(item, 'REJECTED')}>Reject</button></div></div>)}</div></article>
        <article className="hubPanel hubSpan"><h2>Feature rollout</h2><p className="smallText">Property is intentionally off by default in new environments and should be enabled only after moderation/support readiness.</p><button className="secondaryButton hubButton" disabled={busy || !propertyFlag} onClick={() => void togglePropertyModule()}>{propertyFlag?.enabled ? 'Disable property module' : 'Enable property module'}</button></article>
      </section>}

      {tab === 'properties' && <section className="hubGrid">
        <article className="hubPanel hubSpan"><h2>Property discovery</h2>{propertyFlag?.enabled ? <div className="hubCards">{properties.map((property) => <div className="miniCard" key={property.id}><strong>{property.title}</strong><span>{property.city} · {property.propertyType} · {money(property.priceMinor, property.currency)}</span><form className="hubForm" onSubmit={(event) => void bookInspection(event, property.id)}><input name="scheduledAt" type="datetime-local" required /><button className="secondaryButton hubButton" disabled={busy}>Request inspection</button></form></div>)}</div> : <p className="smallText">Property discovery is currently disabled by feature flag.</p>}</article>
      </section>}
    </main>
  );
}

function Metric({ title, value, note }: { title: string; value: string; note: string }) {
  return <article className="hubPanel metricCard"><p className="eyebrow">{title}</p><strong className="metricValue">{value}</strong><span className="smallText">{note}</span></article>;
}
