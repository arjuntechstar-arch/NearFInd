'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchAllNearbyServices, movedAtLeastMeters, type NearbyService } from '../lib/nearby-client';

interface Category { id: string; slug: string; name: string; }
interface Profile { id: string; displayName: string | null; email: string | null; role: string; }
interface Favorite {
  placeId: string; name: string; address: string; city: string; rating: number; reviewCount: number;
  category: { slug: string; name: string } | null; createdAt: string;
}
interface SessionResponse { authenticated: boolean; profile?: Profile; }

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/v1').replace(/\/$/, '');
const LOCATION_REFRESH_DISTANCE_METERS = 250;

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<NearbyService[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeCategory, setActiveCategory] = useState('');
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [favoriteBusyId, setFavoriteBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState('Location is requested only after you choose “Use my location”.');
  const locationWatchIdRef = useRef<number | null>(null);
  const lastLoadedCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const nearbyRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void loadSession();
    return () => {
      if (locationWatchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(locationWatchIdRef.current);
      }
      nearbyRequestRef.current?.abort();
    };
  }, []);

  const savedIds = useMemo(() => new Set(favorites.map((favorite) => favorite.placeId)), [favorites]);
  const visibleServices = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return services.filter((service) => {
      if (activeCategory && service.category.slug !== activeCategory) return false;
      if (!normalized) return true;
      return `${service.name} ${service.category.name} ${service.address} ${service.city}`.toLowerCase().includes(normalized);
    });
  }, [activeCategory, query, services]);

  async function loadSession(): Promise<void> {
    try {
      const response = await fetch('/api/session', { cache: 'no-store' });
      if (!response.ok) return;
      const session = (await response.json()) as SessionResponse;
      if (!session.authenticated || !session.profile) return;
      setProfile(session.profile);
      await loadFavorites();
    } finally {
      setAuthReady(true);
    }
  }

  async function loadFavorites(): Promise<void> {
    const response = await fetch('/api/favorites', { cache: 'no-store' });
    if (response.ok) setFavorites((await response.json()) as Favorite[]);
  }

  async function toggleFavorite(placeId: string): Promise<void> {
    if (!profile) {
      window.location.assign('/auth/login');
      return;
    }
    const saved = savedIds.has(placeId);
    setFavoriteBusyId(placeId);
    try {
      const response = await fetch(`/api/favorites/${placeId}`, { method: saved ? 'DELETE' : 'POST' });
      if (response.status === 401) {
        window.location.assign('/auth/login');
        return;
      }
      if (!response.ok) throw new Error('Unable to update saved place');
      await loadFavorites();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to update saved place.');
    } finally {
      setFavoriteBusyId(null);
    }
  }

  async function loadCategories(): Promise<void> {
    if (categories.length > 0) return;
    const response = await fetch(`${apiBaseUrl}/discovery/categories`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Unable to load categories');
    setCategories((await response.json()) as Category[]);
  }

  async function refreshNearby(nextCoords: { lat: number; lng: number }, resetFilters: boolean): Promise<void> {
    if (!resetFilters && !movedAtLeastMeters(lastLoadedCoordsRef.current, nextCoords, LOCATION_REFRESH_DISTANCE_METERS)) return;

    lastLoadedCoordsRef.current = nextCoords;
    setCoords(nextCoords);
    if (resetFilters) {
      setActiveCategory('');
      setQuery('');
    }

    nearbyRequestRef.current?.abort();
    const controller = new AbortController();
    nearbyRequestRef.current = controller;
    setLoading(true);
    try {
      const allServices = await fetchAllNearbyServices(apiBaseUrl, nextCoords.lat, nextCoords.lng, controller.signal);
      if (controller.signal.aborted) return;
      setServices(allServices);
      setStatus(`Showing all ${allServices.length} available services near your current location. Foreground location updates are active.`);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setStatus(error instanceof Error ? error.message : 'Unable to load nearby services.');
    } finally {
      if (nearbyRequestRef.current === controller) {
        nearbyRequestRef.current = null;
        setLoading(false);
      }
    }
  }

  function startLocationWatch(): void {
    if (!navigator.geolocation) return;
    if (locationWatchIdRef.current !== null) navigator.geolocation.clearWatch(locationWatchIdRef.current);
    locationWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        void refreshNearby({ lat: position.coords.latitude, lng: position.coords.longitude }, false);
      },
      () => {
        setStatus('Live location refresh paused. Existing nearby results remain available; use Refresh my location to retry.');
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 },
    );
  }

  function useMyLocation(): void {
    if (!navigator.geolocation) {
      setStatus('Geolocation is not supported by this browser.');
      return;
    }
    setLoading(true);
    setStatus('Requesting foreground location…');
    void loadCategories().catch((error: unknown) => {
      setStatus(error instanceof Error ? error.message : 'Unable to load service categories.');
    });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextCoords = { lat: position.coords.latitude, lng: position.coords.longitude };
        void refreshNearby(nextCoords, true).then(startLocationWatch);
      },
      () => {
        setStatus('Location permission was not granted. You can allow it later in browser settings.');
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 },
    );
  }

  function selectCategory(slug: string): void {
    setActiveCategory(slug === activeCategory ? '' : slug);
  }

  return (
    <main className="appShell">
      <aside className="rail" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="NearFind home"><span className="brandMark" aria-hidden="true">N</span><span>NearFind</span></a>
        <nav className="railNav">
          <a className="navItem active" href="#explore">Explore</a><a className="navItem" href="#browse">Browse</a>
          <a className="navItem" href="#saved">Saved & SOS</a><a className="navItem" href="#community">Community</a><a className="navItem" href="#profile">Profile</a>
        </nav>
        <div className="railFooter"><p className="eyebrow">Safety first</p><p className="smallText">Emergency features never delay direct access to local emergency numbers.</p></div>
      </aside>

      <section className="content" id="explore">
        <header className="topbar" id="top">
          <div><p className="eyebrow">Driver companion</p><h1>Find what you need nearby.</h1></div>
          <div className="cardActions" id="profile">
            {authReady && profile ? (
              <><span className="smallText">{profile.displayName ?? profile.email ?? 'Signed in'}</span><form action="/auth/logout" method="post"><button className="ghostButton" type="submit">Sign out</button></form></>
            ) : authReady ? <a className="ghostButton" href="/auth/login">Sign in</a> : <span className="smallText">Checking session…</span>}
          </div>
        </header>

        <div className="searchRow" role="search">
          <label className="searchBox"><span className="srOnly">Search nearby services</span><input type="search" placeholder="Search fuel, ATM, hospital, mechanic…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <button className="primaryButton" type="button" onClick={useMyLocation} disabled={loading}>{loading ? 'Loading…' : coords ? 'Refresh my location' : 'Use my location'}</button>
        </div>
        <p className="smallText" aria-live="polite">{status}</p>

        <section id="saved" aria-labelledby="saved-title">
          <div className="sectionHeading">
            <div><p className="eyebrow">Your places</p><h2 id="saved-title">Saved</h2></div>
            {profile ? <span className="smallText">{favorites.length} saved</span> : <a className="secondaryButton" href="/auth/login">Sign in to save</a>}
          </div>
          {profile && favorites.length > 0 ? (
            <div className="chipRow" aria-label="Saved places">
              {favorites.map((favorite) => <span className="chip chipActive" key={favorite.placeId}>{favorite.name} · {favorite.city}</span>)}
            </div>
          ) : <p className="smallText">{profile ? 'Save a nearby place and it will appear here.' : 'Saved places sync securely to your NearFind account.'}</p>}
        </section>

        <div className="chipRow" aria-label="Service categories">
          {categories.length > 0 ? <button className={activeCategory === '' ? 'chip chipActive' : 'chip'} type="button" aria-pressed={activeCategory === ''} onClick={() => setActiveCategory('')}>All</button> : null}
          {categories.map((category) => (
            <button className={activeCategory === category.slug ? 'chip chipActive' : 'chip'} key={category.id} type="button" aria-pressed={activeCategory === category.slug} onClick={() => selectCategory(category.slug)}>{category.name}</button>
          ))}
        </div>

        <div className="exploreGrid">
          <section className="resultsPane" aria-labelledby="nearby-title">
            <div className="sectionHeading"><div><p className="eyebrow">Near your current area</p><h2 id="nearby-title">Nearby services</h2></div><span className="smallText">{visibleServices.length} shown · {services.length} loaded</span></div>
            <div className="resultList">
              {visibleServices.map((service) => {
                const saved = savedIds.has(service.id);
                return (
                  <article className="serviceCard" key={service.id}>
                    <div className="serviceIcon" aria-hidden="true">{service.category.name.slice(0, 1)}</div>
                    <div className="serviceBody">
                      <div className="cardTitleRow"><div><p className="categoryLabel">{service.category.name}</p><h3>{service.name}</h3></div><span className="statusBadge">★ {service.rating.toFixed(1)}</span></div>
                      <p className="serviceMeta">{formatDistance(service.distanceMeters)} • {service.reviewCount} reviews</p><p className="smallText">{service.address}, {service.city}</p>
                      <div className="cardActions">
                        <button className="secondaryButton" type="button" aria-pressed={saved} disabled={favoriteBusyId === service.id} onClick={() => void toggleFavorite(service.id)}>{favoriteBusyId === service.id ? 'Saving…' : saved ? 'Saved' : 'Save'}</button>
                        <a className="secondaryButton" href={`${apiBaseUrl}/discovery/places/${service.id}`}>Details</a>
                        <a className="primaryButton compact" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${service.name}, ${service.address}, ${service.city}`)}`} target="_blank" rel="noreferrer">Route</a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="mapPane" aria-labelledby="map-title">
            <div className="mapToolbar"><div><p className="eyebrow">Live area view</p><h2 id="map-title">Map</h2></div><span className="privacyBadge">Foreground location only</span></div>
            <div className="mapCanvas" role="img" aria-label="Stylized preview of nearby service positions"><div className="road roadA" /><div className="road roadB" /><div className="road roadC" />
              {visibleServices.slice(0, 3).map((service, index) => <span className={`mapPin pin${String.fromCharCode(65 + index)}`} key={service.id}>{service.category.name.slice(0, 1)}</span>)}
              <div className="mapHint"><strong>Nearby results update as your foreground location changes.</strong><span>All active services inside the search radius are loaded first; search and category filters are applied locally.</span></div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function formatDistance(distanceMeters: number): string {
  return distanceMeters < 1000 ? `${distanceMeters} m` : `${(distanceMeters / 1000).toFixed(1)} km`;
}
