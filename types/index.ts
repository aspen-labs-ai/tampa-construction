export interface ArcGISFeature {
  attributes: Record<string, unknown>;
  geometry: { x: number; y: number } | null;
}

export interface ArcGISResponse {
  features: ArcGISFeature[];
  exceededTransferLimit?: boolean;
}

export interface GeoJSONPoint {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: Record<string, unknown>;
}

export interface GeoJSONCollection {
  type: 'FeatureCollection';
  features: GeoJSONPoint[];
}
