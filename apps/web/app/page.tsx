'use client';

import { useMemo, useState } from 'react';

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

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/v1').replace(/\/$/, '');

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<NearbyService[]>([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Location is requested only after you choose “Use my location”.');

  const visibleServices = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return services;
    return services.filter((service) =>
      `${service.name} ${service.category.name} ${service.address} ${service.city}`.toLowerCase().includes(normalized),
    );
  }, [query, services]);

  async function loadCategories(): Promise<void> {
    if (categories.length > 0) return;
    const response = await fetch(`${apiBaseUrl}/discovery/categories`);
    if (!response.ok) throw new Error('Unable to load categories');
    setCategories((await response.json()) as Category[]);
  }

  async function loadNearby(lat: number, lng: number, category = activeCategory): Promise<void> {
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      radiusMeters: '10000',
      limit: '30',
    });
    if (category) params.set('category', category);

    const response = await fetch(`${apiBaseUrl}/discovery/nearby?${params.toString()}`);
    if (!response.ok) throw new Error('Unable to load nearby services');
    setServices((await response.json()) as NearbyService[]);
  }

  function useMyLocation(): void {
    if (!navigator.geolocation) {
      setStatus('Geolocation is not supported by this browser.');
      return;
    }

    setLoading(true);
    setStatus('Requesting location permission…');
    void loadCategories().catch(() => undefined);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextCoords = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCoords(nextCoords);
        void loadNearby(nextCoords.lat, nextCoords.lng)
          .then(() => setStatus('Showing services near your current location.'))
          .catch((error: unknown) => setStatus(error instanceof Error ? error.message : 'Unable to load nearby services.'))
          .finally(() => setLoading(false));
      },
      () => {
        setStatus('Location permission was not granted. You can allow it later in browser settings.');
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
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

  return (
    <main className="appShell">
      <aside className="rail" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="NearFind home">
          <span className="brandMark" aria-hidden="true">N</span>
          <span>NearFind</span>
        </a>
        <nav className="railNav">
          <a className="navItem active" href="#explore">Explore</a>
          <a className="navItem" href="#browse">Browse</a>
          <a className="navItem" href="#saved">Saved & SOS</a>
          <a className="navItem" href="#community">Community</a>
          <a className="navItem" href="#profile">Profile</a>
        </nav>
        <div className="railFooter">
          <p className="eyebrow">Safety first</p>
          <p className="smallText">Emergency features never delay direct access to local emergency numbers.</p>
        </div>
      </aside>

      <section className="content" id="explore">
        <header className="topbar" id="top">
          <div>
            <p className="eyebrow">Driver companion</p>
            <h1>Find what you need nearby.</h1>
          </div>
          <button className="ghostButton" type="button">Notifications</button>
        </header>

        <div className="searchRow" role="search">
          <label className="searchBox">
            <span className="srOnly">Search nearby services</span>
            <input
              type="search"
              placeholder="Search fuel, ATM, hospital, mechanic…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button className="primaryButton" type="button" onClick={useMyLocation} disabled={loading}>
            {loading ? 'Loading…' : 'Use my location'}
          </button>
        </div>
        <p className="smallText" aria-live="polite">{status}</p>

        <div className="chipRow" aria-label="Service categories">
          {categories.map((category) => (
            <button
              className={activeCategory === category.slug ? 'chip chipActive' : 'chip'}
              key={category.id}
              type="button"
              aria-pressed={activeCategory === category.slug}
              onClick={() => void selectCategory(category.slug)}
            >
              {category.name}
            </button>
          ))}
        </div>

        <div className="exploreGrid">
          <section className="resultsPane" aria-labelledby="nearby-title">
            <div className="sectionHeading">
              <div>
                <p className="eyebrow">Near your current area</p>
                <h2 id="nearby-title">Nearby services</h2>
              </div>
              <span className="smallText">{visibleServices.length} found</span>
            </div>

            <div className="resultList">
              {visibleServices.map((service) => (
                <article className="serviceCard" key={service.id}>
                  <div className="serviceIcon" aria-hidden="true">{service.category.name.slice(0, 1)}</div>
                  <div className="serviceBody">
                    <div className="cardTitleRow">
                      <div>
                        <p className="categoryLabel">{service.category.name}</p>
                        <h3>{service.name}</h3>
                      </div>
                      <span className="statusBadge">★ {service.rating.toFixed(1)}</span>
                    </div>
                    <p className="serviceMeta">{formatDistance(service.distanceMeters)} • {service.reviewCount} reviews</p>
                    <p className="smallText">{service.address}, {service.city}</p>
                    <div className="cardActions">
                      <a className="secondaryButton" href={`${apiBaseUrl}/discovery/places/${service.id}`}>Details</a>
                      <a
                        className="primaryButton compact"
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${service.name}, ${service.address}, ${service.city}`)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Route
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mapPane" aria-labelledby="map-title">
            <div className="mapToolbar">
              <div>
                <p className="eyebrow">Live area view</p>
                <h2 id="map-title">Map</h2>
              </div>
              <span className="privacyBadge">Location private by default</span>
            </div>
            <div className="mapCanvas" role="img" aria-label="Stylized preview of the future interactive service map">
              <div className="road roadA" />
              <div className="road roadB" />
              <div className="road roadC" />
              {visibleServices.slice(0, 3).map((service, index) => (
                <span className={`mapPin pin${String.fromCharCode(65 + index)}`} key={service.id}>{service.category.name.slice(0, 1)}</span>
              ))}
              <div className="mapHint">
                <strong>Map provider abstraction comes next.</strong>
                <span>The list is now database-backed and location opt-in. The interactive map will query by viewport and radius.</span>
              </div>
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
