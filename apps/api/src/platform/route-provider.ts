import { Injectable } from '@nestjs/common';

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface RoutePreview {
  provider: string;
  distanceMeters: number;
  durationSeconds: number;
  navigationUrl: string;
}

export const ROUTE_PROVIDER = Symbol('ROUTE_PROVIDER');

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

@Injectable()
export class DirectRouteProvider {
  preview(start: RoutePoint, end: RoutePoint): RoutePreview {
    const earthRadius = 6_371_000;
    const dLat = toRadians(end.lat - start.lat);
    const dLng = toRadians(end.lng - start.lng);
    const lat1 = toRadians(start.lat);
    const lat2 = toRadians(end.lat);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    const straightLine = 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(a)));
    const roadEstimate = Math.round(straightLine * 1.22);
    return {
      provider: 'DIRECT_ESTIMATE',
      distanceMeters: roadEstimate,
      durationSeconds: Math.max(60, Math.round(roadEstimate / 11.1)),
      navigationUrl: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${start.lat},${start.lng}`)}&destination=${encodeURIComponent(`${end.lat},${end.lng}`)}`,
    };
  }
}
