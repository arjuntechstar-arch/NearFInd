import { notFound } from 'next/navigation';
import { getApiBaseUrl } from '../../../lib/server-auth';

interface PlaceDetail {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  countryCode: string;
  rating: number;
  reviewCount: number;
  category: { slug: string; name: string; icon: string };
  coordinates: { lat: number; lng: number };
  sourceProvider: string;
  sourceAttribution: string | null;
}

export default async function PlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const response = await fetch(`${getApiBaseUrl()}/discovery/places/${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error('Unable to load this service location');
  const place = (await response.json()) as PlaceDetail;
  const destination = encodeURIComponent(`${place.coordinates.lat},${place.coordinates.lng}`);
  const delta = 0.012;
  const bbox = [
    place.coordinates.lng - delta,
    place.coordinates.lat - delta,
    place.coordinates.lng + delta,
    place.coordinates.lat + delta,
  ].join(',');
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${place.coordinates.lat},${place.coordinates.lng}`)}`;

  return (
    <main style={{ maxWidth: 920, margin: '0 auto', padding: '32px 20px 64px' }}>
      <div className="cardActions" style={{ justifyContent: 'space-between' }}>
        <a className="ghostButton" href="/">← Explore</a>
        <a className="ghostButton" href="/hub">Journey hub</a>
      </div>

      <section className="serviceCard" style={{ marginTop: 24 }}>
        <div className="serviceIcon" aria-hidden="true">{place.category.name.slice(0, 1)}</div>
        <div className="serviceBody">
          <p className="categoryLabel">{place.category.name}</p>
          <h1>{place.name}</h1>
          <p className="smallText">{place.address}{place.city ? `, ${place.city}` : ''}{place.state ? `, ${place.state}` : ''}</p>
          <p className="serviceMeta">
            {place.rating > 0 ? `★ ${place.rating.toFixed(1)} · ${place.reviewCount} reviews` : 'Live service location'}
          </p>
          <div className="cardActions" style={{ marginTop: 16 }}>
            <a className="primaryButton compact" href={`https://www.google.com/maps/dir/?api=1&destination=${destination}`} target="_blank" rel="noreferrer">Route</a>
            <a className="secondaryButton" href={`https://www.openstreetmap.org/?mlat=${place.coordinates.lat}&mlon=${place.coordinates.lng}#map=17/${place.coordinates.lat}/${place.coordinates.lng}`} target="_blank" rel="noreferrer">Open map</a>
          </div>
        </div>
      </section>

      <section className="mapPane" style={{ marginTop: 24, minHeight: 420 }} aria-labelledby="place-map-title">
        <div className="mapToolbar">
          <div><p className="eyebrow">Location</p><h2 id="place-map-title">Map</h2></div>
          <span className="privacyBadge">{place.coordinates.lat.toFixed(5)}, {place.coordinates.lng.toFixed(5)}</span>
        </div>
        <iframe
          title={`Map showing ${place.name}`}
          src={mapUrl}
          style={{ width: '100%', height: 360, border: 0, borderRadius: 18 }}
          loading="lazy"
        />
        {place.sourceProvider === 'openstreetmap' ? (
          <p className="smallText" style={{ marginTop: 10 }}>Place/map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> · ODbL.</p>
        ) : null}
      </section>
    </main>
  );
}
