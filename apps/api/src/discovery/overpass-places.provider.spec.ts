import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildOverpassQuery, mapOverpassElement } from './overpass-places.provider.js';

void describe('Overpass places provider', () => {
  void it('builds one bounded query for all supported driver-service categories', () => {
    const query = buildOverpassQuery({ lat: 13.06, lng: 80.25, radiusMeters: 50_000 });
    assert.match(query, /around:20000,13\.06,80\.25/);
    for (const selector of ['fuel', 'charging_station', 'atm', 'hospital', 'clinic', 'bank', 'pharmacy', 'car_repair']) {
      assert.ok(query.includes(selector), `Expected Overpass selector ${selector}`);
    }
  });

  void it('maps node amenities to stable external ids and normalized address metadata', () => {
    const place = mapOverpassElement({
      type: 'node',
      id: 42,
      lat: 13.061,
      lon: 80.251,
      tags: {
        amenity: 'charging_station',
        name: 'Example EV Hub',
        'addr:housenumber': '10',
        'addr:street': 'Anna Salai',
        'addr:city': 'Chennai',
        'addr:state': 'Tamil Nadu',
        'addr:country': 'IN',
        'contact:phone': '+91 44 0000 0000',
      },
    });

    assert.ok(place);
    assert.equal(place.externalId, 'node/42');
    assert.equal(place.categorySlug, 'fuel');
    assert.equal(place.address, '10, Anna Salai, Chennai');
    assert.equal(place.city, 'Chennai');
    assert.equal(place.countryCode, 'IN');
    assert.equal(place.attribution, '© OpenStreetMap contributors');
  });

  void it('uses center coordinates for way/relation services and rejects unsupported tags', () => {
    const mechanic = mapOverpassElement({
      type: 'way',
      id: 77,
      center: { lat: 13.05, lon: 80.24 },
      tags: { shop: 'car_repair', name: 'Example Auto Care' },
    });
    assert.ok(mechanic);
    assert.equal(mechanic.categorySlug, 'mechanic');
    assert.equal(mechanic.lat, 13.05);
    assert.equal(mechanic.lng, 80.24);

    const unsupported = mapOverpassElement({
      type: 'node',
      id: 99,
      lat: 13.05,
      lon: 80.24,
      tags: { amenity: 'cinema' },
    });
    assert.equal(unsupported, null);
  });
});
