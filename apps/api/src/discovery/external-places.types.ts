export interface ExternalPlace {
  provider: 'openstreetmap';
  externalId: string;
  categorySlug: 'fuel' | 'atm' | 'hospital' | 'bank' | 'mechanic' | 'pharmacy';
  name: string;
  address: string;
  city: string;
  state: string;
  countryCode: string;
  phone: string | null;
  websiteUrl: string | null;
  lat: number;
  lng: number;
  attribution: string;
}

export interface ExternalPlacesSearch {
  lat: number;
  lng: number;
  radiusMeters: number;
}
