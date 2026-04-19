import type { ArcGISResponse, GeoJSONCollection, GeoJSONPoint } from '@/types';

export async function fetchArcGIS(
  url: string,
  params: Record<string, string> = {}
): Promise<ArcGISResponse> {
  const q = new URLSearchParams({
    where: '1=1',
    outFields: '*',
    outSR: '4326',
    f: 'json',
    resultRecordCount: '2000',
    ...params,
  });
  const res = await fetch(`${url}/query?${q.toString()}`);
  if (!res.ok) throw new Error(`ArcGIS error ${res.status} from ${url}`);
  return res.json() as Promise<ArcGISResponse>;
}

export async function paginateArcGIS(
  url: string,
  params: Record<string, string> = {}
): Promise<ArcGISResponse['features']> {
  const all: ArcGISResponse['features'] = [];
  let offset = 0;
  for (;;) {
    const data = await fetchArcGIS(url, { ...params, resultOffset: String(offset) });
    all.push(...data.features);
    if (!data.exceededTransferLimit) break;
    offset += 2000;
  }
  return all;
}

export function toGeoJSON(features: ArcGISResponse['features']): GeoJSONCollection {
  const pts: GeoJSONPoint[] = features
    .filter((f) => f.geometry != null)
    .map((f) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [f.geometry!.x, f.geometry!.y] },
      properties: f.attributes,
    }));
  return { type: 'FeatureCollection', features: pts };
}
