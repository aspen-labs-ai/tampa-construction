import type { ArcGISResponse, GeoJSONCollection, GeoJSONPoint } from '@/types';

/**
 * Fetch from ArcGIS REST API.
 * Tries direct fetch first; if CORS fails, falls back to our /api/arcgis proxy.
 */
export async function fetchArcGIS(
  url: string,
  params: Record<string, string> = {}
): Promise<ArcGISResponse> {
  const q = new URLSearchParams({
    where: '1=1',
    outFields: '*',
    outSR: '4326',
    f: 'json',
    returnGeometry: 'true',
    ...params,
  });
  const directUrl = `${url}/query?${q.toString()}`;

  let res: Response;
  try {
    res = await fetch(directUrl);
  } catch {
    // CORS or network error → use proxy
    const proxyUrl = `/api/arcgis?url=${encodeURIComponent(directUrl)}`;
    res = await fetch(proxyUrl);
  }

  if (!res.ok) throw new Error(`ArcGIS error ${res.status} from ${url}`);
  const data = await res.json() as ArcGISResponse;
  if ((data as unknown as { error?: unknown }).error) {
    console.error('ArcGIS query error:', (data as unknown as { error: unknown }).error, url);
    return { features: [] };
  }
  return data;
}

export async function paginateArcGIS(
  url: string,
  params: Record<string, string> = {}
): Promise<ArcGISResponse['features']> {
  const all: ArcGISResponse['features'] = [];
  let offset = 0;
  const maxPages = 50; // safety limit
  for (let page = 0; page < maxPages; page++) {
    const data = await fetchArcGIS(url, { ...params, resultOffset: String(offset) });
    if (!data.features || data.features.length === 0) break;
    all.push(...data.features);
    // Stop if we got fewer than the server max (2000) meaning no more pages
    if (data.features.length < 2000 && !data.exceededTransferLimit) break;
    offset += data.features.length;
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
